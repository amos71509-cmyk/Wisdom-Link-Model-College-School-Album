import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Play, ZoomIn, ZoomOut, RotateCcw, 
  MessageSquare, Send, Calendar, User, Clock, Heart, Share2, Download, 
  Link2, MessageCircle, Facebook, Twitter, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeApprovedComments, submitComment, 
  subscribeMediaLikes, toggleLike 
} from '../services/firebaseService';
import { MediaComment } from '../types';
import { markVideoAsWatched } from '../utils/videoUtils';

export interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  tag: string;
  author?: string;
  date?: string;
  attachedImages?: string[];
  gallery?: string[];
}

// Self-contained reactive Like button for individual attached images
function PerImageLikeButton({ imageUrl, imageId }: { imageUrl: string; imageId: string }) {
  const [likesCount, setLikesCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    const mediaId = imageId || imageUrl;
    const unsubscribe = subscribeMediaLikes(mediaId, (count, liked) => {
      setLikesCount(count);
      setHasLiked(liked);
    });
    return () => unsubscribe();
  }, [imageUrl, imageId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const mediaId = imageId || imageUrl;
    const nextLiked = !hasLiked;
    setHasLiked(nextLiked);
    setLikesCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
    await toggleLike(mediaId);
  };

  return (
    <button
      onClick={handleToggle}
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
        hasLiked 
          ? 'bg-rose-500 text-white hover:bg-rose-600 scale-105 shadow-rose-500/20' 
          : 'bg-black/60 hover:bg-black/80 text-white border border-white/20'
      }`}
      title={hasLiked ? 'Unlike photo' : 'Like photo'}
    >
      <Heart className={`w-4 h-4 ${hasLiked ? 'fill-white text-white animate-bounce' : 'text-rose-400'}`} />
      <span>{likesCount} {likesCount === 1 ? 'Like' : 'Likes'}</span>
    </button>
  );
}

interface FullscreenMediaViewerProps {
  isOpen: boolean;
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

export default function FullscreenMediaViewer({
  isOpen,
  items,
  initialIndex,
  onClose
}: FullscreenMediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  // Safe date formatter to prevent RangeError crashes on invalid or missing dates
  const formatDate = (dateStr: any, showTime = false) => {
    try {
      if (!dateStr) return "Archive Date";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return typeof dateStr === 'string' ? dateStr : "Archive Date";
      }
      return d.toLocaleDateString('en-US', showTime ? {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      } : {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return "Archive Date";
    }
  };

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      resetZoom();
      setImageLoading(true);
      setSubmitSuccess(false);
      setSubmitError('');
      setCommentText('');
    }
  }, [isOpen, initialIndex]);

  const activeItem = items[currentIndex];

  // Comments states
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Reset comment inputs when current index changes
  useEffect(() => {
    setSubmitSuccess(false);
    setSubmitError('');
    setCommentText('');
  }, [currentIndex]);

  // Likes and Share states
  const [likesCount, setLikesCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const commentFormRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to real-time likes for this media item
  useEffect(() => {
    if (!isOpen || !activeItem) return;
    const mediaId = activeItem.id || activeItem.imageUrl;
    const unsubscribe = subscribeMediaLikes(mediaId, (count, liked) => {
      setLikesCount(count);
      setHasLiked(liked);
    });
    return () => unsubscribe();
  }, [isOpen, activeItem?.id, activeItem?.imageUrl, currentIndex]);

  // Reset likes states and share menu when index changes
  useEffect(() => {
    setShowShareDropdown(false);
    setCopied(false);
  }, [currentIndex]);

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeItem) return;
    const mediaId = activeItem.id || activeItem.imageUrl;
    // Optimistic UI update
    const nextLiked = !hasLiked;
    setHasLiked(nextLiked);
    setLikesCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
    await toggleLike(mediaId);
  };

  const handleShare = async () => {
    const shareUrl = window.location.origin + '?mediaId=' + encodeURIComponent(activeItem.imageUrl);
    const shareTitle = activeItem.title || "Graduation Student Memory";
    const shareText = activeItem.description || "Check out this graduating student profile photo!";

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        console.warn("Web Share failed:", err);
        setShowShareDropdown(prev => !prev);
      }
    } else {
      setShowShareDropdown(prev => !prev);
    }
  };

  const handleDownload = async () => {
    try {
      const url = activeItem.imageUrl;
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = activeItem.title ? `${activeItem.title.replace(/\s+/g, '_')}.jpg` : 'graduation_memory.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Direct blob download failed, falling back to window.open", err);
      const a = document.createElement('a');
      a.href = activeItem.imageUrl;
      a.target = '_blank';
      a.download = 'graduation_memory.jpg';
      a.click();
    }
  };

  const scrollToCommentForm = () => {
    if (commentFormRef.current) {
      commentFormRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Subscribe to real-time approved comments for this media item
  useEffect(() => {
    if (!isOpen || !activeItem) return;
    const unsubscribe = subscribeApprovedComments((allComments) => {
      const filtered = allComments.filter(c => c.mediaId === activeItem.id);
      setComments(filtered);
    });
    return () => unsubscribe();
  }, [isOpen, activeItem?.id]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    if (!authorName.trim()) {
      setSubmitError('Please enter your name.');
      return;
    }
    if (!commentText.trim()) {
      setSubmitError('Please write a comment.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      await submitComment({
        mediaId: activeItem.id,
        mediaTitle: activeItem.title || "Untitled Memory",
        mediaType: activeItem.type,
        authorName: authorName.trim(),
        text: commentText.trim(),
        submittedAt: new Date().toISOString()
      });
      setCommentText('');
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 6000);
    } catch (err: any) {
      console.error("Error posting comment:", err);
      setSubmitError(err.message || 'Failed to submit comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
    resetZoom();
    setImageLoading(true);
  };

  const handlePrev = () => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    resetZoom();
    setImageLoading(true);
  };

  const resetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const toggleZoom = () => {
    if (activeItem.type === 'video') return;
    if (zoomScale > 1) {
      resetZoom();
    } else {
      setZoomScale(2.2);
    }
  };

  // Preload nearby images for buttery-smooth performance
  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    
    const indicesToPreload = [
      (currentIndex + 1) % items.length,
      (currentIndex - 1 + items.length) % items.length
    ];

    indicesToPreload.forEach((idx) => {
      const item = items[idx];
      if (item && item.type === 'photo') {
        const img = new Image();
        img.src = item.imageUrl;
      }
    });
  }, [currentIndex, items, isOpen]);

  // Handle keypress shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if user is typing in form/editable inputs
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        const isEditable = activeEl.getAttribute('contenteditable') === 'true';
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          tagName === 'button' ||
          isEditable
        ) {
          return;
        }
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case ' ': // Spacebar
          if (activeItem?.type === 'video') {
            e.preventDefault();
            if (videoRef.current) {
              if (videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
              } else {
                videoRef.current.pause();
              }
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentIndex, items, activeItem]);

  // Prevent scroll on mount
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Touch handlers for mobile swipes & down-swipe-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartPos.current.x;
    const diffY = touch.clientY - touchStartPos.current.y;

    // Minimum swipe distance
    const threshold = 65;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe
      if (diffX > threshold) {
        handlePrev();
      } else if (diffX < -threshold) {
        handleNext();
      }
    } else {
      // Vertical swipe
      if (diffY > threshold && zoomScale === 1) {
        // Swipe down to close
        onClose();
      }
    }
    touchStartPos.current = null;
  };

  // Mouse pan handlers when image is zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    const x = e.clientX - dragStart.current.x;
    const y = e.clientY - dragStart.current.y;

    // Limit pan boundary based on scale
    const maxPan = (zoomScale - 1) * 200;
    const boundedX = Math.max(-maxPan, Math.min(maxPan, x));
    const boundedY = Math.max(-maxPan, Math.min(maxPan, y));

    setPanOffset({ x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || !activeItem) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="global-media-viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="fixed inset-0 w-full h-screen bg-black/95 backdrop-blur-xl z-[99999] flex flex-col overflow-y-auto text-white select-none scrollbar-thin"
      >
        {/* Background Click to Close */}
        <div 
          className="absolute inset-0 z-0" 
          onClick={onClose}
        />

        {/* Header Bar */}
        <div className="relative z-10 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent shrink-0">
          <div className="flex flex-col text-left">
            <span className="text-[10px] sm:text-xs text-amber-400 font-mono tracking-widest uppercase font-bold">
              {activeItem.tag}
            </span>
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight mt-0.5 line-clamp-1 max-w-xl">
              {activeItem.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {activeItem.type === 'photo' && (
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full p-1 mr-2">
                <button
                  onClick={() => setZoomScale(prev => Math.max(1, prev - 0.4))}
                  className="p-1.5 hover:bg-white/15 rounded-full transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4 text-gray-300" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1 text-gray-300">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale(prev => Math.min(4, prev + 0.4))}
                  className="p-1.5 hover:bg-white/15 rounded-full transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4 text-gray-300" />
                </button>
                {zoomScale > 1 && (
                  <button
                    onClick={resetZoom}
                    className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-amber-400"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2.5 sm:p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full transition-all text-white hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shadow-xl z-20"
              aria-label="Close media viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Central Stage: Vertical Scrollable Attached Images Feed */}
        <div className="relative flex-1 flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-6 z-10 select-text">
          
          {/* Navigation - Prev Button */}
          {items.length > 1 && (
            <button
              onClick={handlePrev}
              className="fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-black/70 hover:bg-white hover:text-black rounded-full text-white transition-all border border-white/10 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center shadow-2xl z-30"
              aria-label="Previous student or memory"
              title="Previous Showcase Item"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Navigation - Next Button */}
          {items.length > 1 && (
            <button
              onClick={handleNext}
              className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-black/70 hover:bg-white hover:text-black rounded-full text-white transition-all border border-white/10 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center shadow-2xl z-30"
              aria-label="Next student or memory"
              title="Next Showcase Item"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Video or Scrollable Attached Photos Collection */}
          {activeItem.type === 'video' && activeItem.videoUrl ? (
            <div className="w-full my-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black max-w-4xl w-full aspect-video mx-auto">
                <video
                  ref={videoRef}
                  src={activeItem.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  onPlay={() => {
                    if (activeItem.id) {
                      markVideoAsWatched(activeItem.id);
                    }
                  }}
                  className="w-full h-full object-contain bg-black"
                />
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col space-y-10 my-2">
              {(() => {
                const attachedList: string[] = Array.from(new Set([
                  activeItem.imageUrl,
                  ...(activeItem.attachedImages || []),
                  ...(activeItem.gallery || [])
                ].filter(Boolean)));

                return attachedList.map((imgUrl, imgIdx) => {
                  const imageDocId = `${activeItem.id}_img_${imgIdx}`;
                  return (
                    <div 
                      key={`${imgUrl}-${imgIdx}`}
                      className="bg-slate-900/80 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 relative group/imgcard overflow-hidden"
                    >
                      {/* Photo Badge Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase">
                          Attached Photo {imgIdx + 1} of {attachedList.length}
                        </span>
                        
                        {/* Download & Share for specific photo */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const shareUrl = window.location.origin + '?mediaId=' + encodeURIComponent(imgUrl);
                              if (navigator.share) {
                                navigator.share({
                                  title: activeItem.title,
                                  text: `Check out photo #${imgIdx + 1} from ${activeItem.title}`,
                                  url: shareUrl
                                }).catch(() => {});
                              } else {
                                navigator.clipboard.writeText(shareUrl);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }
                            }}
                            className="p-2 bg-white/5 hover:bg-white/15 rounded-full transition-all text-gray-300 hover:text-white cursor-pointer"
                            title="Share Photo"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = imgUrl;
                              a.target = '_blank';
                              a.download = `${activeItem.title.replace(/\s+/g, '_')}_photo_${imgIdx + 1}.jpg`;
                              a.click();
                            }}
                            className="p-2 bg-white/5 hover:bg-white/15 rounded-full transition-all text-gray-300 hover:text-white cursor-pointer"
                            title="Download Photo"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Image Container */}
                      <div className="relative overflow-hidden rounded-2xl bg-black border border-white/5 flex items-center justify-center max-h-[75vh]">
                        <img
                          src={imgUrl}
                          alt={`${activeItem.title} - photo ${imgIdx + 1}`}
                          className="max-h-[70vh] w-auto object-contain rounded-xl select-none"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Attached Per-Image Like Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="flex items-center gap-3">
                          <PerImageLikeButton imageUrl={imgUrl} imageId={imageDocId} />
                          <span className="text-xs text-gray-400 italic">
                            Click heart to like photo #{imgIdx + 1}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {activeItem.author || 'The Wisdom Link Model College'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

        </div>

        {/* Footer Info & General Comments Panel */}
        <div className="relative z-10 w-full p-5 sm:p-8 bg-gradient-to-t from-black via-black/95 to-transparent flex justify-center shrink-0 border-t border-white/10">
          <div className="max-w-4xl w-full text-left">
            
            <p className="text-sm text-gray-200 font-normal leading-relaxed">
              {activeItem.description}
            </p>
            {(activeItem.author || activeItem.date) && (
              <div className="flex flex-wrap gap-4 mt-3.5 border-t border-white/10 pt-3 text-[11px] text-gray-400 font-mono">
                {activeItem.author && (
                  <span>
                    Contributor / Graduate: <span className="text-white font-medium">{activeItem.author}</span>
                  </span>
                )}
                {activeItem.date && (
                  <span>
                    Date / Class: <span className="text-white font-medium">{formatDate(activeItem.date)}</span>
                  </span>
                )}
                {items.length > 1 && (
                  <span className="ml-auto text-amber-400 font-bold">
                    Entry {currentIndex + 1} of {items.length}
                  </span>
                )}
              </div>
            )}

            {/* Comments Divider */}
            <div className="h-[1px] bg-white/10 my-8" />

            {/* General Comment Section (One General Comment section for all attached photos) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 select-text">
              {/* Left Column: General Comments List */}
              <div className="flex flex-col space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm sm:text-base font-bold tracking-tight text-white uppercase font-display">
                    General Comments ({comments.length})
                  </h3>
                </div>
                <p className="text-[11px] text-gray-400 italic -mt-2">
                  General comments for {activeItem.author || activeItem.title} across all attached photos
                </p>

                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
                  {comments.length === 0 ? (
                    <div className="text-center py-10 bg-white/5 border border-white/5 rounded-2xl">
                      <p className="text-xs text-gray-400">
                        Be the first to share a general comment or well-wish for this entry.
                      </p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div 
                        key={comment.id} 
                        className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                              {comment.authorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-white">
                              {comment.authorName}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {formatDate(comment.submittedAt, true)}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-200 leading-relaxed pl-8">
                          {comment.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Add General Comment Form */}
              <div ref={commentFormRef} className="flex flex-col space-y-4">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm sm:text-base font-bold tracking-tight text-white uppercase font-display">
                    Leave a General Comment
                  </h3>
                </div>

                <form onSubmit={handleSubmitComment} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-mono tracking-widest text-gray-400 uppercase mb-1.5 font-bold">
                      Your Name / Well-Wisher
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mrs. Sarah Jenkins"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-amber-500/50 rounded-xl text-xs font-semibold focus:outline-none transition-all placeholder:text-gray-500 text-white"
                      disabled={isSubmitting}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono tracking-widest text-gray-400 uppercase mb-1.5 font-bold">
                      General Comment / Message
                    </label>
                    <textarea
                      placeholder="Share your general thoughts, memory, or congratulations..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-amber-500/50 rounded-xl text-xs font-semibold focus:outline-none transition-all placeholder:text-gray-500 resize-none text-white font-sans"
                      disabled={isSubmitting}
                      required
                    />
                  </div>

                  {submitSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-400 font-medium">
                      ✓ Your general comment has been submitted for moderation and will appear once approved by an administrator.
                    </div>
                  )}

                  {submitError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 font-medium">
                      ✗ {submitError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit General Comment'}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
}
