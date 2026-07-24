import React, { useState, useEffect } from 'react';
import { Search, Image as ImageIcon, Video, History, Heart, Share2, Eye, UserCheck, X, ChevronLeft, ChevronRight, Play, Sparkles, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Memory } from '../types';
import { MEMORIES } from '../data/schoolData';
import { getCloudinaryThumbnail } from '../utils/videoUtils';

interface MemoryGalleryProps {
  customMemories: Memory[]; // Support parent uploaded memories too!
  cleanUpMode: boolean;
}

export default function MemoryGallery({ customMemories, cleanUpMode }: MemoryGalleryProps) {
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [likedMemories, setLikedMemories] = useState<Record<string, boolean>>({});
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [watchedVideos, setWatchedVideos] = useState<string[]>([]);

  useEffect(() => {
    const updateWatched = () => {
      try {
        const watched = localStorage.getItem('watched_videos');
        setWatchedVideos(watched ? JSON.parse(watched) : []);
      } catch (e) {
        console.error(e);
      }
    };
    updateWatched();
    window.addEventListener('video-watched-update', updateWatched);
    return () => window.removeEventListener('video-watched-update', updateWatched);
  }, []);

  // Safe date formatter to prevent RangeError crashes on invalid or missing dates
  const formatDate = (dateStr: any) => {
    try {
      if (!dateStr) return "Archive Date";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Return string value as fallback, or default date string
        return typeof dateStr === 'string' ? dateStr : "Archive Date";
      }
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return "Archive Date";
    }
  };

  // Combine default memories with parent/teacher contributions
  useEffect(() => {
    // Unique list of memories to prevent duplicate key crashes
    const rawCombined = [...customMemories, ...MEMORIES.filter(m => !customMemories.some(c => c.id === m.id))];
    
    const seenIds = new Set<string>();
    const combined = rawCombined.filter(m => {
      if (!m.id) return false;
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    });

    // Sort combined memories: featured first, then newest date
    combined.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    setAllMemories(combined);
  }, [customMemories]);

  // Listen to custom event filter-gallery-tag
  useEffect(() => {
    const handleTagFilter = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const rawTag = customEvent.detail.trim();
        
        // Map event titles to existing tags/categories/keywords
        let tag = rawTag;
        const tagMap: Record<string, string> = {
          'Graduation Ceremony': 'Graduation',
          'Sports Day': 'Sports',
          'Cultural Day': 'Arts',
          'Christmas Carol': 'Music',
          'Prize Giving Day': 'History',
          'Science Fair': 'Science',
          'Excursions': 'Excursion',
          'Debate Competition': 'Debate'
        };
        
        if (tagMap[rawTag]) {
          tag = tagMap[rawTag];
        }

        if (tag.toLowerCase() === 'photo' || tag.toLowerCase() === 'video') {
          setFilter(tag.toLowerCase());
          setSearchQuery('');
        } else {
          // Strip out year suffix to match tags better
          const parsedTag = tag.replace(/\d{4}/, '').trim();
          setSearchQuery(parsedTag);
          setFilter('all'); // Reset tab filter to find it better
        }
      }
    };

    window.addEventListener('filter-gallery-tag', handleTagFilter);
    return () => window.removeEventListener('filter-gallery-tag', handleTagFilter);
  }, []);

  // Filter logic
  const filteredMemories = allMemories.filter((mem) => {
    const category = (mem.category || '').toLowerCase();
    const isVideo = category === 'video' || !!mem.videoUrl;
    const isPhoto = !isVideo;

    const matchesTab =
      filter === 'all' ||
      (filter === 'photo' && isPhoto) ||
      (filter === 'video' && isVideo) ||
      (filter === 'parent' && (category === 'parent' || category === 'photo' || (mem.id && mem.id.startsWith('photo-')))) ||
      (filter === 'teacher' && category === 'teacher') ||
      (filter === 'archive' && category === 'archive');

    const matchesSearch =
      (mem.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mem.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mem.tag || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mem.author && mem.author.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  // Diagnostic logging to verify live streams and render status
  useEffect(() => {
    console.log("[MEMORY GALLERY DEBUG] Data Source (allMemories) updated. Count:", allMemories.length, allMemories);
  }, [allMemories]);

  useEffect(() => {
    console.log("[MEMORY GALLERY DEBUG] Rendering Gallery. Applied Filters:", { tabFilter: filter, search: searchQuery });
    console.log("[MEMORY GALLERY DEBUG] Matches Found (filteredMemories):", filteredMemories.length, filteredMemories);
    console.log("[MEMORY GALLERY DEBUG] Visibility: fully visible, Height: auto, Width: 100%");
  }, [filteredMemories, filter, searchQuery]);

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedMemories((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleShare = (mem: Memory, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/#gallery?id=${mem.id}`);
    setShareFeedback(mem.id);
    setTimeout(() => setShareFeedback(null), 2500);
  };

  const categories = [
    { value: 'all', label: 'All Memories', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { value: 'photo', label: 'Latest Photos', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { value: 'video', label: 'Latest Videos', icon: <Video className="w-3.5 h-3.5" /> },
    { value: 'parent', label: 'Parents Feed', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { value: 'teacher', label: 'Teachers Hub', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { value: 'archive', label: 'Historical Files', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <section 
      id="gallery" 
      className="py-24 bg-transparent relative z-20 overflow-visible w-full h-auto block"
      style={{ opacity: 1, visibility: 'visible' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] bg-white/90 border border-gray-200 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
            <span>Living Repository</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-display">
            Digital Memory Gallery
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-xl mx-auto font-normal">
            Browse through generations of smiles, awards, and historical milestones. Use the controls to search or filter.
          </p>
          <div className="h-1 w-20 bg-[var(--accent)] mx-auto mt-4 rounded-full" />
        </div>

        {/* Filters and Search toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-12 bg-white/95 border border-gray-200/85 p-4 rounded-2xl shadow-xl" id="gallery-controls">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-none no-scrollbar">
            {categories.map((cat) => {
              const isActive = filter === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setFilter(cat.value)}
                  className={`flex items-center gap-1.5 px-4.5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all duration-300 ${
                    isActive
                      ? 'bg-[var(--primary)] text-white shadow-lg border border-transparent scale-[1.03]'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
                  }`}
                  style={{ opacity: 1 }}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Bar Input */}
          <div className="relative w-full lg:w-80 shrink-0">
            <input
              type="text"
              placeholder="Search by keyword, event, or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-xl text-xs font-semibold focus:outline-none bg-white border border-gray-300 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[var(--primary-light)] focus:border-[var(--primary)]"
              id="gallery-search-input"
              style={{ opacity: 1 }}
            />
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-700 font-bold text-xs"
              >
                Clear
              </button>
            )}
          </div>

        </div>

        {/* Gallery Grid (Pinterest Masonry) */}
        <AnimatePresence mode="popLayout">
          {filteredMemories.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-white/40 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm"
            >
              <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-gray-800">No Preserved Memories Found</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                We couldn't find any photos or videos matching "{searchQuery}". Try modifying your filters or search keywords.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilter('all');
                }}
                className="mt-6 px-5 py-2.5 text-xs font-bold text-white bg-[var(--primary)] uppercase tracking-wider rounded-xl hover:bg-[var(--accent)] transition-all hover:shadow-md cursor-pointer"
              >
                Reset Filters
              </button>
            </motion.div>
          ) : (
            <motion.div
              layout
              id="gallery-masonry"
              className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6 [column-fill:_balance] w-full"
            >
              {filteredMemories.map((mem) => {
                const isLiked = !!likedMemories[mem.id];
                return (
                  <motion.div
                    layout
                    key={mem.id}
                    onClick={() => {
                      const mediaItems = filteredMemories.map(m => ({
                        id: m.id,
                        type: m.category === 'video' ? 'video' as const : 'photo' as const,
                        title: m.title,
                        description: m.description,
                        imageUrl: m.imageUrl,
                        videoUrl: m.videoUrl,
                        tag: m.tag,
                        author: m.author,
                        date: m.date
                      }));
                      const index = filteredMemories.findIndex(m => m.id === mem.id);
                      window.dispatchEvent(new CustomEvent('open-fullscreen-media', {
                        detail: {
                          items: mediaItems,
                          currentIndex: index !== -1 ? index : 0
                        }
                      }));
                    }}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.45 }}
                    whileHover={{ y: -5 }}
                    className="break-inside-avoid bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-md group hover:shadow-xl transition-all duration-300 cursor-pointer relative block"
                    style={{ opacity: 1 }}
                  >
                    {/* Visual deletion overlay for Clean Up Mode */}
                    {cleanUpMode && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Are you sure you want to permanently delete memory "${mem.title}"?`)) {
                            return;
                          }
                          try {
                            const isPhoto = mem.id.startsWith('photo-') || mem.category === 'parent';
                            const isVideo = mem.id.startsWith('video-') || mem.category === 'video';
                            const targetCol = isPhoto ? 'photos' : isVideo ? 'videos' : null;
                            
                            if (!targetCol) {
                              alert('This is a core template asset. Custom user uploads can be pruned directly.');
                              return;
                            }
                            
                            const { db } = await import('../firebase');
                            const { doc, deleteDoc } = await import('firebase/firestore');
                            await deleteDoc(doc(db, targetCol, mem.id));
                            
                            // Clean up Cloudinary asset if applicable
                            const assetUrl = isPhoto ? mem.imageUrl : mem.videoUrl;
                            if (assetUrl && assetUrl.includes('cloudinary.com')) {
                              fetch('/api/delete-cloudinary', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: assetUrl }),
                              }).catch((err) => console.error('Cloudinary asset cleanup error:', err));
                            }
                          } catch (err: any) {
                            alert(`Failed to delete asset: ${err.message || err}`);
                          }
                        }}
                        className="absolute top-3 right-12 z-30 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-400 hover:scale-110 transition-transform animate-pulse cursor-pointer flex items-center justify-center"
                        title="Delete Memory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    
                    {/* Photo or Video Thumbnail with smooth zoom hover */}
                    <div className="relative overflow-hidden w-full bg-gray-100">
                      {mem.category === 'video' ? (
                        (() => {
                          const clThumb = getCloudinaryThumbnail(mem.videoUrl);
                          const isWatched = watchedVideos.includes(mem.id);
                          return (
                            <div className={`relative w-full aspect-video overflow-hidden bg-black ${isWatched ? 'opacity-70' : ''}`}>
                              {/* Background native video frame as a robust absolute fallback */}
                              <video
                                src={`${mem.videoUrl}#t=0.5`}
                                poster={mem.imageUrl}
                                className="absolute inset-0 w-full h-full object-cover z-0"
                                preload="metadata"
                                muted
                                playsInline
                              />

                              {clThumb && (
                                <motion.img
                                  src={clThumb}
                                  alt={mem.title}
                                  loading="lazy"
                                  className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300"
                                  whileHover={{ scale: 1.05 }}
                                  transition={{ duration: 0.4, ease: 'easeOut' }}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    // Soft fade-out if thumbnail fails, showing video frame behind
                                    e.currentTarget.style.opacity = '0';
                                  }}
                                />
                              )}

                              {/* Subtle Play Icon Overlay over Thumbnail */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <motion.div 
                                  className="p-3 bg-[var(--accent)] text-white rounded-full shadow-lg"
                                  whileHover={{ scale: 1.15, rotate: 5 }}
                                  animate={{ scale: [1, 1.05, 1] }}
                                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                                >
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                </motion.div>
                              </div>

                              {/* Watched Indicator Overlay */}
                              {isWatched && (
                                <div className="absolute top-3 right-3 z-30 bg-emerald-600/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] font-bold text-white uppercase tracking-widest flex items-center gap-1 shadow-md border border-emerald-400/30">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Watched</span>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <motion.img
                          src={mem.imageUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600'}
                          alt={mem.title}
                          loading="lazy"
                          className="w-full h-[260px] sm:h-[300px] object-cover grayscale-[0.02] contrast-[1.01]"
                          whileHover={{ scale: 1.05, filter: 'brightness(1.05)' }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // High-quality default archive image fallback on image load errors
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600';
                          }}
                        />
                      )}

                      {/* Quick Info badges */}
                      <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                        <span className="bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-bold text-gray-800 uppercase tracking-widest border border-white/40 shadow-sm">
                          {mem.tag}
                        </span>
                        {mem.featured && (
                          <span className="bg-amber-500 text-white px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm flex items-center gap-1">
                            <span>★</span> <span>Featured</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Text Details */}
                    <div className="p-5 text-left">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                        {formatDate(mem.date)}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight mt-1 line-clamp-1 group-hover:text-[var(--primary)] transition-colors">
                        {mem.title}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">
                        {mem.description}
                      </p>

                      {/* Card Footer interaction buttons */}
                      <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-gray-100 text-gray-500">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate max-w-[150px]">
                          {mem.author ? (
                            <span>By {mem.author}</span>
                          ) : (
                            <span className="text-[9px] tracking-widest text-gray-500">
                              Archive Staff
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => toggleLike(mem.id, e)}
                            className={`p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors ${
                              isLiked ? 'text-red-500' : 'text-gray-400'
                            }`}
                            title="Like memory"
                          >
                            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                          </button>
                          
                          <button
                            onClick={(e) => handleShare(mem, e)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-500 text-gray-400 transition-colors"
                            title="Copy memory link"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          
                          <span className="p-1.5 text-gray-300">
                            <Eye className="w-4 h-4" />
                          </span>
                        </div>
                      </div>

                      {/* Share Success Toast floating over card */}
                      {shareFeedback === mem.id && (
                        <div className="absolute bottom-16 right-5 bg-gray-900 text-white text-[9px] font-bold py-1 px-2.5 rounded shadow-lg uppercase tracking-wider animate-bounce">
                          Link Copied!
                        </div>
                      )}
                    </div>

                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </section>
  );
}
