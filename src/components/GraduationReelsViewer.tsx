import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Heart, MessageSquare, Share2, Download, 
  Volume2, VolumeX, Play, Pause, Maximize, Minimize, ZoomIn, ZoomOut, 
  RotateCcw, Send, CheckCircle2, Loader2, Copy, Check, Sparkles, Award, ArrowLeft,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Film, Image as ImageIcon
} from 'lucide-react';
import { GraduationMemory, GraduationMemoryComment } from '../types';
import { 
  toggleLike, 
  subscribeMediaLikes, 
  addEventMemoryComment, 
  subscribeEventMemoryComments 
} from '../services/firebaseService';
import { getOptimizedImageUrl, preloadImage } from '../utils/imageUtils';

interface GraduationReelsViewerProps {
  items: GraduationMemory[];
  initialItem: GraduationMemory;
  onClose: () => void;
  eventTitle?: string;
}

export default function GraduationReelsViewer({
  items,
  initialItem,
  onClose,
  eventTitle = 'Graduation Ceremony'
}: GraduationReelsViewerProps) {
  // Requirement 3 & 4: Strict media queue isolation so photos only show photos and videos only show videos
  const mediaQueue = React.useMemo(() => {
    const queue = items.filter(i => i.mediaType === initialItem.mediaType);
    return queue.length > 0 ? queue : [initialItem];
  }, [items, initialItem]);

  const isPhotoMode = initialItem.mediaType === 'image';
  const isVideoMode = initialItem.mediaType === 'video';

  // Navigation State
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = mediaQueue.findIndex(i => i.id === initialItem.id);
    return idx !== -1 ? idx : 0;
  });
  const activeItem = mediaQueue[currentIndex] || initialItem;

  // Real-time Likes & Comments
  const [likesCount, setLikesCount] = useState(activeItem.likesCount || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<GraduationMemoryComment[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  // Comment Submission State
  const [newCommentName, setNewCommentName] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSuccessNotice, setCommentSuccessNotice] = useState(false);

  // Sharing State
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Video Playback & Display State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);
  const [isFitMode, setIsFitMode] = useState(true); // true = object-contain, false = object-cover
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startControlsTimer = React.useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, []);

  // Double-tap Like Animation State
  const [showFloatingHeart, setShowFloatingHeart] = useState(false);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Image Zoom & Pan State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch & Pinch-to-Zoom Navigation
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomLevelRef = useRef<number>(1);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lock body scroll when fullscreen viewer opens so returning restores exact position
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('reels-viewer-active');

    const galleryScrollContainers = document.querySelectorAll('.overflow-y-auto');
    const savedOverflows: { el: HTMLElement; overflow: string }[] = [];
    galleryScrollContainers.forEach(el => {
      savedOverflows.push({ el: el as HTMLElement, overflow: (el as HTMLElement).style.overflow });
      (el as HTMLElement).style.overflow = 'hidden';
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove('reels-viewer-active');
      savedOverflows.forEach(({ el, overflow }) => {
        if (el) el.style.overflow = overflow;
      });
    };
  }, []);

  // Reset states when switching items
  useEffect(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setIsPlaying(true);
    setShowShareMenu(false);
    startControlsTimer();
    
    // Auto-play active video and reset currentTime
    if (activeItem.mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [currentIndex, activeItem.id, activeItem.mediaType, startControlsTimer]);

  // Auto-hide controls timer effect when playing
  useEffect(() => {
    if (isPlaying) {
      startControlsTimer();
    } else {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, startControlsTimer]);

  // Real-time subscriptions for Active Item
  useEffect(() => {
    if (!activeItem) return;

    setLikesCount(activeItem.likesCount || 0);

    const unsubLikes = subscribeMediaLikes(activeItem.id, (count, userHasLiked) => {
      setLikesCount(count);
      setHasLiked(userHasLiked);
    });

    const effectiveEventTitle = eventTitle || activeItem.eventName || 'Graduation Ceremony';
    const unsubComments = subscribeEventMemoryComments(effectiveEventTitle, activeItem.id, (commentsList) => {
      setComments(commentsList);
    });

    return () => {
      unsubLikes();
      unsubComments();
    };
  }, [activeItem.id]);

  // Performance - Preload next and previous media
  useEffect(() => {
    if (mediaQueue.length <= 1) return;

    const total = mediaQueue.length;
    const prevIdx = (currentIndex - 1 + total) % total;
    const nextIdx = (currentIndex + 1) % total;

    [mediaQueue[prevIdx], mediaQueue[nextIdx]].forEach(item => {
      if (item && item.mediaType === 'image' && item.mediaUrl) {
        preloadImage(getOptimizedImageUrl(item.mediaUrl, 1600));
      }
    });
  }, [currentIndex, mediaQueue]);

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCommentsOpen) {
          setIsCommentsOpen(false);
        } else if (zoomLevel > 1) {
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight' || (isPhotoMode && e.key === 'ArrowDown') || e.key === 'PageDown' || e.key === ' ') {
        if (!isCommentsOpen && zoomLevel === 1) {
          e.preventDefault();
          handleNext();
        }
      } else if (e.key === 'ArrowLeft' || (isPhotoMode && e.key === 'ArrowUp') || e.key === 'PageUp') {
        if (!isCommentsOpen && zoomLevel === 1) {
          e.preventDefault();
          handlePrev();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaQueue.length, isCommentsOpen, zoomLevel, isPhotoMode, onClose]);

  // Navigation handlers
  const handleNext = () => {
    if (mediaQueue.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % mediaQueue.length);
  };

  const handlePrev = () => {
    if (mediaQueue.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + mediaQueue.length) % mediaQueue.length);
  };

  // Mouse Wheel navigation
  const handleWheel = (e: React.WheelEvent) => {
    if (isCommentsOpen || zoomLevel > 1) return;
    
    if (wheelTimeoutRef.current) return;
    const delta = isPhotoMode ? (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) : e.deltaY;

    if (Math.abs(delta) > 15) {
      if (delta > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      wheelTimeoutRef.current = setTimeout(() => {
        wheelTimeoutRef.current = null;
      }, 450);
    }
  };

  // Touch Swipe Navigation (Requirement 3: Horizontal for Photo, Requirement 4: Vertical for Video)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistanceRef.current = dist;
      initialZoomLevelRef.current = zoomLevel;
    } else if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
      if (zoomLevel > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - panOffset.x,
          y: e.touches[0].clientY - panOffset.y
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleRatio = dist / initialPinchDistanceRef.current;
      setZoomLevel(Math.min(Math.max(1, initialZoomLevelRef.current * scaleRatio), 4));
    } else if (zoomLevel > 1 && isDragging && e.touches.length === 1) {
      setPanOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistanceRef.current = null;
    }

    if (zoomLevel > 1) {
      setIsDragging(false);
      return;
    }

    if (touchStartYRef.current !== null && touchStartXRef.current !== null && e.changedTouches.length === 1) {
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;

      if (isPhotoMode) {
        // Requirement 3: PHOTO VIEWER - Swipe Left = Next Photo, Swipe Right = Previous Photo
        if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) {
            handleNext();
          } else {
            handlePrev();
          }
        }
      } else {
        // Requirement 4: VIDEO VIEWER - Swipe Up = Next Video, Swipe Down = Previous Video
        if (Math.abs(deltaY) > 40 && Math.abs(deltaY) > Math.abs(deltaX)) {
          if (deltaY < 0) {
            handleNext();
          } else {
            handlePrev();
          }
        }
      }
    }
    touchStartYRef.current = null;
    touchStartXRef.current = null;
  };

  // Double Tap vs Single Tap Detection
  const handleMediaStageTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const doubleTapThreshold = 300;

    if (now - lastTapTimeRef.current < doubleTapThreshold) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      lastTapTimeRef.current = 0;
      handleDoubleTapLike();
    } else {
      lastTapTimeRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        if (activeItem.mediaType === 'video') {
          togglePlayPause();
        } else {
          startControlsTimer();
        }
      }, doubleTapThreshold);
    }
  };

  // Double-tap Like Action
  const handleDoubleTapLike = async () => {
    setShowFloatingHeart(true);
    setTimeout(() => setShowFloatingHeart(false), 800);
    if (!hasLiked) {
      setHasLiked(true);
      setLikesCount(prev => prev + 1);
      await toggleLike(activeItem.id);
    }
  };

  // Explicit Like Button Click
  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLikedState = !hasLiked;
    setHasLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));
    await toggleLike(activeItem.id);
  };

  // Video Controls
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(prev => !prev);
  };

  // Dragging for Panned Zoomed Images
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Comment Submission Handler
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || commentSubmitting) return;

    setCommentSubmitting(true);
    try {
      const effectiveEventTitle = eventTitle || activeItem.eventName || 'Graduation Ceremony';
      await addEventMemoryComment(effectiveEventTitle, {
        memoryId: activeItem.id,
        authorName: newCommentName.trim() || 'Guest',
        text: newCommentText.trim()
      });
      setNewCommentText('');
      setCommentSuccessNotice(true);
      setTimeout(() => setCommentSuccessNotice(false), 3000);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Native Share / Copy Link
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: activeItem.title || 'Graduation Memory',
      text: activeItem.caption || 'Check out this memory from the graduation ceremony!',
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        setShowShareMenu(true);
      }
    } else {
      setShowShareMenu(true);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] bg-black select-none overflow-hidden touch-none flex flex-col font-sans"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => {
        handleMouseMove(e);
        startControlsTimer();
      }}
      onMouseUp={handleMouseUp}
    >
      {/* ==========================================================
          TOP HEADER: BACK BUTTON & MEDIA TYPE BADGE
          ========================================================== */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-3 pointer-events-auto">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-full bg-black/80 hover:bg-black text-white transition-all cursor-pointer shadow-2xl border border-white/20 flex items-center gap-2 font-bold text-sm active:scale-95 group"
          title="Back to Gallery"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform text-white" />
          <span>Back</span>
        </button>

        {isPhotoMode ? (
          <span className="px-3.5 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-400/30 shadow-2xl flex items-center gap-1.5 backdrop-blur-md">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>PHOTO ({currentIndex + 1} / {mediaQueue.length})</span>
          </span>
        ) : (
          <span className="px-3.5 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-purple-950/90 text-purple-300 border border-purple-400/30 shadow-2xl flex items-center gap-1.5 backdrop-blur-md">
            <Film className="w-4 h-4 text-purple-400" />
            <span>VIDEO ({currentIndex + 1} / {mediaQueue.length})</span>
          </span>
        )}
      </div>

      {/* ==========================================================
          ON-SCREEN NAVIGATION BUTTONS (Requirement 3 & 4)
          ========================================================== */}
      {mediaQueue.length > 1 && (
        <>
          {isPhotoMode ? (
            /* PHOTO VIEWER: Left and Right Horizontal Navigation Arrows */
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3.5 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Previous Photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3.5 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Next Photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          ) : (
            /* VIDEO VIEWER: Up and Down Vertical Navigation Arrows */
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute right-4 sm:right-6 top-24 z-40 p-3 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                title="Previous Video"
              >
                <ChevronUp className="w-5 h-5 text-purple-300" />
                <span className="text-[10px] font-bold font-mono uppercase hidden sm:inline">Prev</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 sm:right-6 bottom-28 z-40 p-3 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                title="Next Video"
              >
                <ChevronDown className="w-5 h-5 text-purple-300" />
                <span className="text-[10px] font-bold font-mono uppercase hidden sm:inline">Next</span>
              </button>
            </>
          )}
        </>
      )}

      {/* ==========================================================
          CENTER STAGE: FULLSCREEN MEDIA DISPLAY (100vw x 100vh)
          ========================================================== */}
      <div 
        id="reels-stage-container"
        className="relative flex-1 w-screen h-screen flex items-center justify-center overflow-hidden bg-transparent cursor-pointer z-10"
        onClick={handleMediaStageTap}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (activeItem.mediaType === 'image') {
            if (zoomLevel > 1) {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            } else {
              setZoomLevel(2);
              setPanOffset({ x: 0, y: 0 });
            }
          }
        }}
      >
        {/* Animated Double-Tap Heart Overlay */}
        {showFloatingHeart && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-in zoom-in fade-in duration-300">
            <Heart className="w-32 h-32 text-pink-500 fill-current drop-shadow-[0_0_40px_rgba(236,72,153,0.8)] animate-pulse" />
          </div>
        )}

        {/* Active Media Slide */}
        <div 
          key={activeItem.id} 
          className="relative w-screen h-screen flex items-center justify-center animate-in fade-in duration-300"
        >
          {activeItem.mediaType === 'video' ? (
            <div className="relative w-screen h-screen flex items-center justify-center">
              <video
                key={activeItem.id}
                ref={videoRef}
                src={activeItem.mediaUrl}
                poster={activeItem.thumbnailUrl || undefined}
                autoPlay
                playsInline
                loop
                muted={isMuted}
                onCanPlay={(e) => {
                  const v = e.currentTarget;
                  v.play().then(() => setIsPlaying(true)).catch(() => {});
                }}
                onLoadedData={(e) => {
                  const v = e.currentTarget;
                  v.play().then(() => setIsPlaying(true)).catch(() => {});
                }}
                onPlay={() => {
                  setIsPlaying(true);
                  startControlsTimer();
                }}
                onPause={() => setIsPlaying(false)}
                className={`w-screen h-screen ${isFitMode ? 'object-contain' : 'object-cover'} shadow-2xl transition-all duration-300`}
              />

              {/* Video Play Overlay Icon ONLY when paused */}
              {!isPlaying && (
                <div 
                  onClick={togglePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity z-20"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-transform cursor-pointer">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
                  </div>
                </div>
              )}

              {/* Video Controls Bottom Bar */}
              <div 
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-6 left-4 right-4 sm:left-20 sm:right-28 z-30 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 flex items-center justify-between gap-4 transition-all duration-500 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}
              >
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="text-white hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFitMode(!isFitMode)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-[10px] font-mono font-bold uppercase border border-white/10"
                    title="Toggle Fit/Cover Mode"
                  >
                    {isFitMode ? 'Fit Screen' : 'Fill Screen'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* PHOTO DISPLAY */
            <div 
              className="relative w-screen h-screen flex items-center justify-center transition-transform duration-100"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
            >
              <img
                src={getOptimizedImageUrl(activeItem.mediaUrl, 1600)}
                alt={activeItem.caption || activeItem.title}
                className="max-w-full max-h-full object-contain shadow-2xl pointer-events-none select-none"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>
      </div>

      {/* ==========================================================
          SIDE ACTION BAR (LIKE, COMMENT, SHARE, DOWNLOAD)
          ========================================================== */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute right-4 bottom-28 sm:right-6 sm:bottom-32 z-40 flex flex-col items-center gap-5 pointer-events-auto"
      >
        {/* Like Button */}
        <button
          type="button"
          onClick={handleLikeClick}
          className="group flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
        >
          <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center shadow-2xl transition-all duration-300 ${
            hasLiked 
              ? 'bg-pink-600 border-pink-400 text-white scale-110 shadow-pink-500/30' 
              : 'bg-black/60 border-white/20 text-white hover:bg-black/80 hover:scale-105'
          }`}>
            <Heart className={`w-6 h-6 transition-transform group-active:scale-125 ${hasLiked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] font-mono">
            {likesCount}
          </span>
        </button>

        {/* Comment Button */}
        <button
          type="button"
          onClick={() => setIsCommentsOpen(!isCommentsOpen)}
          className="group flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
        >
          <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md flex items-center justify-center shadow-2xl hover:bg-black/80 hover:scale-105 transition-all">
            <MessageSquare className="w-6 h-6 text-indigo-300 group-active:scale-125 transition-transform" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] font-mono">
            {comments.length}
          </span>
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="group flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
        >
          <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md flex items-center justify-center shadow-2xl hover:bg-black/80 hover:scale-105 transition-all">
            <Share2 className="w-6 h-6 text-amber-300 group-active:scale-125 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] uppercase">
            Share
          </span>
        </button>

        {/* Download Button */}
        <a
          href={activeItem.mediaUrl}
          download={`graduation_memory_${activeItem.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
          title="Download Media"
        >
          <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md flex items-center justify-center shadow-2xl hover:bg-black/80 hover:scale-105 transition-all">
            <Download className="w-6 h-6 text-emerald-300 group-active:scale-125 transition-transform" />
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] uppercase">
            Save
          </span>
        </a>
      </div>

      {/* ==========================================================
          BOTTOM LEFT CAPTION & UPLOADER OVERLAY
          ========================================================== */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-6 left-4 right-20 sm:left-6 sm:right-32 z-30 pointer-events-auto space-y-2 text-left"
      >
        <div className="bg-black/60 backdrop-blur-md border border-white/15 p-4 rounded-2xl shadow-2xl space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
              {activeItem.uploaderName || activeItem.uploadedByType || 'Graduation Memory'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              • {activeItem.graduationYear}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-white font-medium line-clamp-3 leading-relaxed drop-shadow-md">
            "{activeItem.caption || activeItem.title || 'Graduation ceremony memory'}"
          </p>
        </div>
      </div>

      {/* ==========================================================
          COMMENTS DRAWER SLIDE-OVER
          ========================================================== */}
      {isCommentsOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-950/95 border-l border-white/10 backdrop-blur-2xl p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300 pointer-events-auto"
        >
          <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Comments ({comments.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCommentsOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comment List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-left">
              {comments.length === 0 ? (
                <div className="text-center py-12 space-y-2 text-slate-500">
                  <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-xs font-medium">No comments yet. Be the first to leave a warm message!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-900/80 border border-white/5 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-300">{comment.authorName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{comment.text || (comment as any).commentText}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="pt-4 border-t border-white/10 space-y-2 text-left">
            {commentSuccessNotice && (
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Comment added successfully!</span>
              </div>
            )}
            <input
              type="text"
              value={newCommentName}
              onChange={(e) => setNewCommentName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim() || commentSubmitting}
                className="p-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 disabled:opacity-40 transition-all cursor-pointer"
              >
                {commentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================
          SHARE MODAL POPUP
          ========================================================== */}
      {showShareMenu && (
        <div 
          onClick={(e) => { e.stopPropagation(); setShowShareMenu(false); }}
          className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-left"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Share Graduation Memory</span>
              </h3>
              <button
                onClick={() => setShowShareMenu(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Copy link to share this graduation memory with alumni, friends, and family.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                readOnly
                value={window.location.href}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-300 font-mono truncate"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
