import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Heart, MessageSquare, Share2, Download, 
  Volume2, VolumeX, Play, Pause, Maximize, Minimize, ZoomIn, ZoomOut, 
  RotateCcw, Send, CheckCircle2, Loader2, Copy, Check, Sparkles, Award, ArrowLeft
} from 'lucide-react';
import { GraduationMemory, GraduationMemoryComment } from '../types';
import { 
  toggleLike, 
  subscribeMediaLikes, 
  addGraduationMemoryComment, 
  subscribeGraduationMemoryComments 
} from '../services/firebaseService';
import { getOptimizedImageUrl, preloadImage } from '../utils/imageUtils';

interface GraduationReelsViewerProps {
  items: GraduationMemory[];
  initialItem: GraduationMemory;
  onClose: () => void;
}

export default function GraduationReelsViewer({
  items,
  initialItem,
  onClose
}: GraduationReelsViewerProps) {
  // Navigation State
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = items.findIndex(i => i.id === initialItem.id);
    return idx !== -1 ? idx : 0;
  });
  const activeItem = items[currentIndex] || initialItem;

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
  const [isFitMode, setIsFitMode] = useState(true); // true = object-contain (default TikTok/Reels fit), false = object-cover
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

  // Requirement 1 & 2: Lock body scroll when fullscreen viewer opens so returning restores exact position
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('reels-viewer-active');

    // Also freeze any scrolling gallery containers underneath so scroll position never shifts
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
    
    // Requirement 4: Auto-play active video and reset currentTime
    if (activeItem.mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [currentIndex, activeItem.id, startControlsTimer]);

  // Requirement 5: Auto-hide controls timer effect when playing
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

    const unsubComments = subscribeGraduationMemoryComments(activeItem.id, (commentsList) => {
      setComments(commentsList);
    });

    return () => {
      unsubLikes();
      unsubComments();
    };
  }, [activeItem.id]);

  // Requirement 9: Performance - Preload next and previous media
  useEffect(() => {
    if (items.length <= 1) return;

    const total = items.length;
    const prevIdx = (currentIndex - 1 + total) % total;
    const nextIdx = (currentIndex + 1) % total;
    const next2Idx = (currentIndex + 2) % total;

    [items[prevIdx], items[nextIdx], items[next2Idx]].forEach(item => {
      if (item && item.mediaType === 'image' && item.mediaUrl) {
        preloadImage(getOptimizedImageUrl(item.mediaUrl, 1600));
      }
    });
  }, [currentIndex, items]);

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
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        if (!isCommentsOpen && zoomLevel === 1) {
          e.preventDefault();
          handleNext();
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (!isCommentsOpen && zoomLevel === 1) {
          e.preventDefault();
          handlePrev();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, isCommentsOpen, zoomLevel, onClose]);

  // Navigation handlers (Requirement 3: Vertical Reels Scrolling)
  const handleNext = () => {
    if (items.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    if (items.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
  };

  // Mouse Wheel navigation (Vertical Reel Feed)
  const handleWheel = (e: React.WheelEvent) => {
    if (isCommentsOpen || zoomLevel > 1) return;
    
    if (wheelTimeoutRef.current) return; // Debounce wheel
    if (Math.abs(e.deltaY) > 15) {
      if (e.deltaY > 0) {
        handleNext(); // Scroll downward -> Next Media
      } else {
        handlePrev(); // Scroll upward -> Previous Media
      }
      wheelTimeoutRef.current = setTimeout(() => {
        wheelTimeoutRef.current = null;
      }, 450);
    }
  };

  // Touch Swipe & Pinch-to-Zoom Navigation (Requirement 3 & 8)
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

      // Ensure vertical swipe is dominant over horizontal (Reels style up/down)
      if (Math.abs(deltaY) > 40 && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
        if (deltaY < 0) {
          handleNext(); // Swipe Up -> Next Memory
        } else {
          handlePrev(); // Swipe Down -> Prev Memory
        }
      }
    }
    touchStartYRef.current = null;
    touchStartXRef.current = null;
  };

  // Double Tap vs Single Tap Detection (Requirement 5 & 8)
  const handleMediaStageTap = (e: React.MouseEvent) => {
    if (isCommentsOpen) return;
    
    const now = Date.now();
    const timeDiff = now - lastTapTimeRef.current;

    if (timeDiff < 300 && timeDiff > 0) {
      // Double Tap / Double Click Detected!
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = 0;
      if (activeItem.mediaType === 'image') {
        // Requirement 8: Double-click / double-tap to zoom on images
        if (zoomLevel > 1) {
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        } else {
          setZoomLevel(2);
          setPanOffset({ x: 0, y: 0 });
        }
      } else {
        handleDoubleTapLike();
      }
    } else {
      // Single Tap Potential -> Wait 300ms
      lastTapTimeRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        handleSingleTap();
        tapTimeoutRef.current = null;
      }, 300);
    }
  };

  const handleSingleTap = () => {
    if (activeItem.mediaType === 'video') {
      if (!showControls) {
        startControlsTimer();
      } else {
        togglePlayPause();
      }
    } else if (zoomLevel > 1) {
      // Reset zoom on tap if zoomed
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      startControlsTimer();
    }
  };

  const handleDoubleTapLike = () => {
    // Trigger animated heart
    setShowFloatingHeart(true);
    setTimeout(() => setShowFloatingHeart(false), 1000);

    // If not already liked, toggle like
    if (!hasLiked) {
      handleToggleLike();
    }
  };

  // Toggle Like Handler
  const handleToggleLike = async () => {
    const newLikedState = !hasLiked;
    setHasLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));
    
    try {
      await toggleLike(activeItem.id);
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };

  // Post Comment Handler
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setCommentSubmitting(true);
    try {
      await addGraduationMemoryComment({
        memoryId: activeItem.id,
        authorName: newCommentName.trim() || 'Visitor',
        authorRole: 'Community Member',
        text: newCommentText.trim()
      });

      setNewCommentText('');
      setCommentSubmitting(false);
      setCommentSuccessNotice(true);
      setTimeout(() => setCommentSuccessNotice(false), 4500);
    } catch (err) {
      console.error(err);
      setCommentSubmitting(false);
    }
  };

  // Share Handler
  const handleShare = async (platform?: 'whatsapp' | 'twitter' | 'facebook' | 'copy') => {
    const shareUrl = window.location.href;
    const shareTitle = `Wisdom Link Graduation Memory: "${activeItem.title || activeItem.caption}"`;
    const shareText = `${activeItem.caption}\nShared by ${activeItem.uploaderName || activeItem.uploadedByType}`;

    if (!platform && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setShowShareMenu(true);
        }
        return;
      }
    }

    if (!platform) {
      setShowShareMenu(prev => !prev);
      return;
    }

    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
    setShowShareMenu(false);
  };

  // Video Controls Handlers
  const togglePlayPause = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleVideoFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const container = document.getElementById('reels-stage-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreenVideo(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreenVideo(false);
    }
  };

  // Mouse drag panning for zoomed image
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999999] w-screen h-screen bg-black text-white m-0 p-0 flex flex-col justify-between overflow-hidden animate-in fade-in duration-300 pointer-events-auto select-none"
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
          2. BACK BUTTON (Requirement 3: TOP LEFT ← Back. Nothing else.)
          ========================================================== */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 pointer-events-auto">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-full bg-black/80 hover:bg-black text-white transition-all cursor-pointer shadow-2xl border border-white/20 flex items-center gap-2 font-bold text-sm active:scale-95 group"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform text-white" />
          <span>Back</span>
        </button>
      </div>

      {/* ==========================================================
          1. CENTER STAGE: TRUE FULLSCREEN MEDIA DISPLAY (100vw x 100vh)
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

              {/* Video Play Overlay Icon ONLY when paused (Requirement 5) */}
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

              {/* Video Controls Bottom Bar (Requirement 5: Auto-hides after 2s of no interaction) */}
              <div 
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-6 left-4 right-4 sm:left-20 sm:right-28 z-30 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 flex items-center justify-between gap-4 transition-all duration-500 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}
              >
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="text-white hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsFitMode(prev => !prev); }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold px-2"
                    title={isFitMode ? "Fill Entire Screen" : "Fit Original Aspect Ratio"}
                  >
                    <span>{isFitMode ? "Fill Screen" : "Fit Screen"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title={isMuted ? "Unmute Video" : "Mute Video"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleVideoFullscreen}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreenVideo ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Image Stage with Zoom & Pan (Requirement 8) */
            <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden">
              <img
                src={getOptimizedImageUrl(activeItem.mediaUrl, 1600)}
                alt={activeItem.caption || activeItem.title}
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                className={`w-screen h-screen ${isFitMode ? 'object-contain' : 'object-cover'} shadow-2xl select-none transition-all duration-300 ${
                  zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
                }`}
                referrerPolicy="no-referrer"
              />

              {/* Floating Image Zoom Controls (Requirement 5: Auto-hides after 2s of no interaction) */}
              <div 
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-20 right-4 z-30 flex flex-col sm:flex-row items-center gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 text-white transition-all duration-500 ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              >
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4))}
                  className="p-2 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-1">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 1))}
                  className="p-2 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                {zoomLevel > 1 && (
                  <button
                    type="button"
                    onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
                    className="p-2 rounded-xl hover:bg-amber-400 hover:text-slate-950 text-amber-300 transition-colors cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==========================================================
          6. SOCIAL ACTION BAR (Requirement 5 & 6: Lower-right, fixed position, NEVER auto-hides)
          ========================================================== */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute right-3 sm:right-6 bottom-24 sm:bottom-28 z-40 flex flex-col items-center gap-4 sm:gap-5 pointer-events-auto"
      >
        {/* Like Button */}
        <div className="flex flex-col items-center group">
          <button
            type="button"
            onClick={handleToggleLike}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer border ${
              hasLiked 
                ? 'bg-pink-600/90 text-white border-pink-400 scale-110 shadow-[0_0_25px_rgba(236,72,153,0.6)]' 
                : 'bg-black/60 hover:bg-black/90 text-white border-white/20 hover:scale-110'
            }`}
            title="Like Memory"
          >
            <Heart className={`w-6 h-6 sm:w-7 sm:h-7 ${hasLiked ? 'fill-current text-white animate-bounce' : 'text-white'}`} />
          </button>
          <span className="text-xs font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] mt-1.5 font-mono">
            {likesCount}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center group">
          <button
            type="button"
            onClick={() => setIsCommentsOpen(true)}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-2xl hover:scale-110 transition-all cursor-pointer"
            title="View Comments"
          >
            <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-400" />
          </button>
          <span className="text-xs font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] mt-1.5 font-mono">
            {comments.length}
          </span>
        </div>

        {/* Share Button */}
        <div className="relative flex flex-col items-center group">
          <button
            type="button"
            onClick={() => handleShare()}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-2xl hover:scale-110 transition-all cursor-pointer"
            title="Share Memory"
          >
            <Share2 className="w-6 h-6 sm:w-7 sm:h-7 text-sky-400" />
          </button>
          <span className="text-xs font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] mt-1.5 font-mono">
            Share
          </span>

          {/* Share Dropdown Menu (When Native Share is Unavailable) */}
          {showShareMenu && (
            <div className="absolute right-16 bottom-0 z-50 bg-slate-900/98 border border-white/20 rounded-2xl shadow-2xl p-3 w-52 space-y-2 text-left animate-in fade-in zoom-in-95 duration-200">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block px-1">Share via</span>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleShare('facebook')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Facebook</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShare('whatsapp')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShare('twitter')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Twitter / X</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShare('copy')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-between"
                >
                  <span>Copy Link</span>
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Download Button */}
        <div className="flex flex-col items-center group">
          <a
            href={activeItem.mediaUrl}
            download={`wisdom_link_graduation_${activeItem.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-2xl hover:scale-110 transition-all cursor-pointer"
            title="Download Original Media"
          >
            <Download className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
          </a>
          <span className="text-xs font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] mt-1.5 font-mono">
            Save
          </span>
        </div>
      </div>

      {/* ==========================================================
          7. CAPTION AREA (Requirement 7: Bottom-Left, Dark Gradient Background)
          ========================================================== */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-24 pb-6 px-4 sm:px-8 pointer-events-none text-left">
        <div className="max-w-2xl pr-20 sm:pr-24 space-y-2 pointer-events-auto">
          {/* Event Name & Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 shadow-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{activeItem.memoryType || 'Graduation'}</span>
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold text-slate-200 bg-white/15 backdrop-blur-md border border-white/20">
              {activeItem.eventName || `Class of ${activeItem.graduationYear || '2026'}`}
            </span>
          </div>

          {/* Caption */}
          <h3 className="text-base sm:text-xl font-bold text-white leading-snug drop-shadow-lg line-clamp-3 font-display">
            "{activeItem.caption || activeItem.title}"
          </h3>

          {/* Contributor Name & Upload Date */}
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium pt-1">
            <span className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-[10px]">
                {(activeItem.uploaderName || activeItem.uploadedByType || 'U').charAt(0).toUpperCase()}
              </div>
              <span>Shared by <strong className="text-amber-300 font-bold">{activeItem.uploaderName || activeItem.uploadedByType || 'Community Member'}</strong></span>
            </span>
            <span className="text-white/40">•</span>
            <span>{new Date(activeItem.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* ==========================================================
          COMMENTS PANEL (Slide-In Drawer from Right - Requirement 10: Preserve existing features)
          ========================================================== */}
      {isCommentsOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-slate-900/98 backdrop-blur-2xl border-l border-white/10 z-[1000000] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.9)] animate-in slide-in-from-right duration-300 text-left pointer-events-auto"
        >
          {/* Panel Header */}
          <div className="p-5 border-b border-white/10 bg-slate-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-black text-white uppercase tracking-wider font-display">
                Comments ({comments.length})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsCommentsOpen(false)}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close Comments Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Notice: Approved comments only */}
          <div className="px-5 py-2.5 bg-slate-950/60 border-b border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Community memories & well-wishes</span>
            <span className="text-amber-300 font-semibold">✓ Approved only</span>
          </div>

          {/* Comments List (Scrollable Middle) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5 custom-scrollbar bg-slate-950/40">
            {commentSuccessNotice && (
              <div className="p-3.5 bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-200 shadow-md">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-medium leading-relaxed">Comment submitted successfully! It has been placed in the administrator pending queue for review.</span>
              </div>
            )}

            {comments.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-slate-500">
                  <MessageSquare className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-xs text-slate-300 font-bold">No approved comments yet</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Be the first to leave a congratulatory note or share a fond memory for the Class of {activeItem.graduationYear}!
                </p>
              </div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="p-4 bg-slate-900/90 rounded-2xl border border-white/10 text-xs space-y-2 shadow-sm hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-xs">{c.authorName}</span>
                    <span className="text-slate-500 text-[10px] font-mono">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Sticky Comment Form at Bottom */}
          <div className="p-5 border-t border-white/10 bg-slate-900 shrink-0 space-y-3">
            <form onSubmit={handlePostComment} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={newCommentName}
                  onChange={(e) => setNewCommentName(e.target.value)}
                  placeholder="Your Name (Optional)"
                  className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all font-medium"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Write a congratulatory message..."
                  className="flex-1 p-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all font-medium"
                />
                <button
                  type="submit"
                  disabled={commentSubmitting}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  {commentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /><span>Send</span></>}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center italic">
                All submitted comments are directed to the admin pending workflow before appearing publicly.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
