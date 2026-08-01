import React, { useState, useEffect } from 'react';
import { Heart, MessageSquare, Share2, Send, X, Star, User, Award, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { TeacherTribute, MediaComment } from '../types';
import { submitComment, subscribeApprovedComments } from '../services/firebaseService';

// Utility for optimizing image urls (both Cloudinary & Unsplash)
function getOptimizedImageUrl(url: string | undefined | null, width = 500): string {
  if (!url) return '';
  if (url.includes('cloudinary.com') && url.includes('/image/upload/')) {
    return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`);
  }
  if (url.includes('images.unsplash.com')) {
    let cleanUrl = url.replace(/&fit=crop/g, '').replace(/\?fit=crop&/g, '?').replace(/fit=crop&/g, '').replace(/fit=crop/g, '');
    if (cleanUrl.includes('w=')) {
      cleanUrl = cleanUrl.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, 'q=80');
    } else {
      cleanUrl = `${cleanUrl}&w=${width}&q=80&auto=format`;
    }
    return cleanUrl;
  }
  return url;
}

interface CommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle: string;
  onCommentSubmitted: () => void;
}

export function CommentDrawer({ isOpen, onClose, mediaId, mediaTitle, onCommentSubmitted }: CommentDrawerProps) {
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    // Subscribe to approved comments
    const unsubscribe = subscribeApprovedComments((allComments) => {
      const filtered = allComments.filter(c => c.mediaId === mediaId);
      setComments(filtered);
    });

    return () => unsubscribe();
  }, [isOpen, mediaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !text.trim()) return;

    setIsSubmitting(true);
    try {
      await submitComment({
        mediaId,
        mediaTitle,
        mediaType: 'photo',
        authorName: authorName.trim(),
        text: text.trim(),
        submittedAt: new Date().toISOString()
      });
      
      setAuthorName('');
      setText('');
      setSuccessMsg(true);
      onCommentSubmitted();
      setTimeout(() => {
        setSuccessMsg(false);
      }, 5000);
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col h-full border-l border-gray-100 text-left"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest font-semibold">Moderated Message Board</h3>
                <h2 className="text-base font-extrabold text-slate-800 tracking-tight mt-1 line-clamp-1">{mediaTitle}</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-3">
                  <MessageSquare className="w-10 h-10 text-gray-200 animate-pulse" />
                  <p className="text-xs font-medium max-w-xs">No approved messages here yet. Be the first to share an appreciation message!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block">
                    Approved community notes ({comments.length})
                  </span>
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 shadow-sm transition-all hover:bg-gray-50/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                          <User className="w-3 h-3 text-[var(--primary)]" />
                          {comment.authorName}
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">
                          {(() => {
                            try {
                              if (!comment.submittedAt) return "Archive Date";
                              const d = new Date(comment.submittedAt);
                              if (isNaN(d.getTime())) return "Archive Date";
                              return d.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              });
                            } catch (e) {
                              return "Archive Date";
                            }
                          })()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-normal whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / Submit Comment Form */}
            <div className="p-6 border-t border-gray-100 bg-slate-50 space-y-4">
              {successMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium text-center"
                >
                  🎉 Message submitted successfully! It has been sent to the Admin Dashboard and will appear once authorized.
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                  Write your greeting
                </span>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Your Full Name (e.g., Parent of Class of '26)"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-gray-800"
                  />
                  <textarea
                    rows={3}
                    required
                    placeholder="Type your appreciation note or congratulatory wish..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-gray-800 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !authorName.trim() || !text.trim()}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-gray-300 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {isSubmitting ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit message for review</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface PrincipalProps {
  onCommentSubmitted: () => void;
}

export function PrincipalHonourSection({ onCommentSubmitted }: PrincipalProps) {
  const [principal, setPrincipal] = useState({
    name: 'Dr. Elizabeth Sterling, PhD',
    title: 'Principal, The Wisdom Link Model College',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=800',
    welcomeMessage: `Welcome to The Wisdom Link Model College Digital Memory Archive. For over three decades, our institution has stood as a beacon of academic excellence, character building, and creative growth. This digital sanctuary is celebrating our students, safeguarding our collective achievements, and keeping our rich heritage alive for generations of Wisdom Link families.`,
    yearsOfService: '15 Years'
  });

  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [shareFeedback, setShareFeedback] = useState(false);

  useEffect(() => {
    // 1. Subscribe to principal document
    const unsubPrincipal = onSnapshot(doc(db, "branding", "principal"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPrincipal({
          name: data.name || 'Dr. Elizabeth Sterling, PhD',
          title: data.title || 'Principal, The Wisdom Link Model College',
          image: data.image || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=800',
          welcomeMessage: data.welcomeMessage || '',
          yearsOfService: data.yearsOfService || '15 Years'
        });
      }
    }, (err) => {
      console.warn("Using default principal info due to:", err);
      setPrincipal({
        name: 'Dr. Elizabeth Sterling, PhD',
        title: 'Principal, The Wisdom Link Model College',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=800',
        welcomeMessage: '',
        yearsOfService: '15 Years'
      });
    });

    // 2. Initialize likes count & liked state from localStorage
    const localLiked = localStorage.getItem('principal_liked') === 'true';
    setIsLiked(localLiked);
    
    // Stable random seed base + 1 if liked
    const baseLikes = 184;
    setLikes(localLiked ? baseLikes + 1 : baseLikes);

    // 3. Subscribe to approved comments on Principal to show counts
    const unsubComments = subscribeApprovedComments((allComments) => {
      const filtered = allComments.filter(c => c.mediaId === 'principal');
      setCommentsCount(filtered.length);
    });

    return () => {
      unsubPrincipal();
      unsubComments();
    };
  }, []);

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikes(prev => prev - 1);
      localStorage.setItem('principal_liked', 'false');
    } else {
      setIsLiked(true);
      setLikes(prev => prev + 1);
      localStorage.setItem('principal_liked', 'true');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareFeedback(true);
    setTimeout(() => {
      setShareFeedback(false);
    }, 2500);
  };

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto z-10 text-left border-b border-gray-100 bg-[#ffffff]/60 backdrop-blur-md rounded-3xl mt-12 shadow-sm border border-gray-200/50">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Principal Portrait Left Column */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          {/* Accent Overlap Box */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[var(--primary)] to-[var(--accent)] opacity-[0.08] blur-xl" />
          
          <div className="relative w-full max-w-md rounded-2xl overflow-hidden border border-gray-200/60 shadow-2xl bg-slate-950 group h-[440px] sm:h-[540px]">
            {/* Ambient Blurred Background to fill frame smoothly */}
            <img 
              src={getOptimizedImageUrl(principal.image, 1000)} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover filter blur-2xl opacity-40 scale-110 pointer-events-none"
              aria-hidden="true"
            />
            <img 
              src={getOptimizedImageUrl(principal.image, 1000)} 
              alt={principal.name} 
              className="relative z-0 w-full h-full object-cover object-top filter saturate-[0.98] group-hover:scale-105 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
            {/* Subtle vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />
            
            {/* Principal Office Ribbon */}
            <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-white/10 shadow-lg z-10">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] font-mono font-bold tracking-widest text-amber-400 uppercase">OFFICE OF THE PRINCIPAL</span>
            </div>

            {/* Service Badge */}
            {principal.yearsOfService && (
              <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/95 text-slate-800 text-[10px] font-mono font-bold tracking-wider rounded-md border border-gray-200/40 shadow-md z-10">
                <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>{principal.yearsOfService} Service</span>
              </div>
            )}
          </div>
        </div>

        {/* Principal Messages Right Column */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-center">
          <div className="space-y-2">
            <h4 className="text-[10px] sm:text-xs font-mono font-black tracking-[0.25em] text-[var(--primary)] uppercase">Leadership & Welcome</h4>
            <h2 className="text-3xl sm:text-[36px] font-semibold text-slate-900 tracking-tight font-display">{principal.name}</h2>
            <p className="text-sm font-bold text-slate-500 font-mono tracking-wider">{principal.title}</p>
          </div>

          <div className="border-l-4 border-[var(--primary)] pl-5 py-2 text-left italic">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
              "{principal.welcomeMessage}"
            </p>
          </div>

          {/* Social Feedback Row */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
            {/* Like Button */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                isLiked 
                  ? 'bg-red-50 border-red-200 text-red-500 shadow-sm' 
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Heart className={`w-4 h-4 transition-transform ${isLiked ? 'scale-110 fill-red-500' : 'scale-100'}`} />
              <span>Like ({likes})</span>
            </button>

            {/* Comment Button */}
            <button
              onClick={() => setCommentDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
              <span>Comment ({commentsCount})</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer relative"
              title="Copy page link"
            >
              <Share2 className="w-4 h-4 text-slate-400" />
              <span>Share</span>

              {shareFeedback && (
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-slate-950 text-white text-[9px] font-bold rounded shadow-lg whitespace-nowrap">
                  Link Copied!
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Comment Drawer */}
      <CommentDrawer
        isOpen={commentDrawerOpen}
        onClose={() => setCommentDrawerOpen(false)}
        mediaId="principal"
        mediaTitle={principal.name}
        onCommentSubmitted={onCommentSubmitted}
      />
    </section>
  );
}

export function TeachersHonourSection({ onCommentSubmitted }: { onCommentSubmitted: () => void }) {
  const [teachers, setTeachers] = useState<TeacherTribute[]>([]);
  const [likedTeachers, setLikedTeachers] = useState<Record<string, boolean>>({});
  const [activeTeacher, setActiveTeacher] = useState<TeacherTribute | null>(null);
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [teacherComments, setTeacherComments] = useState<Record<string, number>>({});

  useEffect(() => {
    // 1. Subscribe to teacher tributes
    const q = query(collection(db, "teacher_tributes"), where("status", "==", "Approved"));
    const unsubTeachers = onSnapshot(q, (snapshot) => {
      const list: TeacherTribute[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TeacherTribute);
      });
      
      // Sort: Featured first, then alphabetical name
      list.sort((a: any, b: any) => {
        const aFeat = a.featured === true || a.featured === 'true' ? 1 : 0;
        const bFeat = b.featured === true || b.featured === 'true' ? 1 : 0;
        if (bFeat !== aFeat) return bFeat - aFeat;
        return a.name.localeCompare(b.name);
      });
      setTeachers(list);
    }, (err) => {
      console.error("Error subscribing to teachers:", err);
      setTeachers([]);
    });

    // 2. Load liked teachers from localStorage
    const localLikes: Record<string, boolean> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('teacher_liked_')) {
        const id = key.replace('teacher_liked_', '');
        localLikes[id] = localStorage.getItem(key) === 'true';
      }
    }
    setLikedTeachers(localLikes);

    // 3. Subscribe to all approved comments to compile teacher comments count
    const unsubComments = subscribeApprovedComments((allComments) => {
      const counts: Record<string, number> = {};
      allComments.forEach(c => {
        if (c.mediaId.startsWith('teacher-')) {
          counts[c.mediaId] = (counts[c.mediaId] || 0) + 1;
        }
      });
      setTeacherComments(counts);
    });

    return () => {
      unsubTeachers();
      unsubComments();
    };
  }, []);

  const handleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStatus = likedTeachers[id];
    const newStatus = !currentStatus;
    
    setLikedTeachers(prev => ({
      ...prev,
      [id]: newStatus
    }));

    localStorage.setItem(`teacher_liked_${id}`, newStatus ? 'true' : 'false');
  };

  const handleOpenComments = (teacher: TeacherTribute, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTeacher(teacher);
    setCommentDrawerOpen(true);
  };

  if (teachers.length === 0) return null;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto z-10 text-left border-b border-gray-100">
      <div className="space-y-12">
        {/* Header Title */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h4 className="text-xs sm:text-sm font-mono font-black tracking-[0.3em] text-[var(--primary)] uppercase">Honouring Leadership</h4>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">Our Dedicated Teachers</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            The heart and soul of The Wisdom Link Model College. Meet the talented mentors and educators shaping our students and guiding their future triumphs.
          </p>
        </div>

        {/* Teacher Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {teachers.map((teacher: any) => {
            const isLiked = !!likedTeachers[teacher.id];
            const isFeatured = teacher.featured === true || teacher.featured === 'true';
            
            // Generate a stable base likes count (derived from name length) + 1 if liked
            const baseLikes = (teacher.name.length * 4) % 40 + 20;
            const likesCount = isLiked ? baseLikes + 1 : baseLikes;
            const commCount = teacherComments[`teacher-${teacher.id}`] || 0;

            return (
              <div 
                key={teacher.id} 
                className="bg-white rounded-2xl overflow-hidden border border-gray-200/80 shadow-md group hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between"
              >
                <div>
                  {/* Photo container */}
                  <div className="aspect-[4/3] w-full bg-slate-950 overflow-hidden relative">
                    <img 
                      src={getOptimizedImageUrl(teacher.image, 500)} 
                      alt={teacher.name} 
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Featured star badge */}
                    {isFeatured && (
                      <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-mono text-[8px] font-black uppercase tracking-wider shadow-md">
                        <Star className="w-3 h-3 fill-slate-950 text-slate-950" />
                        <span>Featured Educator</span>
                      </div>
                    )}

                    {/* Department badge */}
                    <span className="absolute bottom-3 right-3 px-2 py-1 rounded bg-slate-950/80 text-white font-mono text-[9px] font-medium uppercase tracking-wider shadow-sm">
                      {teacher.subject}
                    </span>
                  </div>

                  {/* Content space */}
                  <div className="p-5 text-left space-y-2">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight leading-snug">{teacher.name}</h3>
                    <p className="text-xs text-gray-600 leading-relaxed italic">
                      "{teacher.message}"
                    </p>
                  </div>
                </div>

                {/* Footer with actions */}
                <div className="p-5 border-t border-gray-100 flex items-center justify-between">
                  {/* Like Button */}
                  <button
                    onClick={(e) => handleLike(teacher.id, e)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                      isLiked 
                        ? 'bg-red-50 text-red-500' 
                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    <span>Like ({likesCount})</span>
                  </button>

                  {/* Comment Button */}
                  <button
                    onClick={(e) => handleOpenComments(teacher, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Comment ({commCount})</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comment Drawer for individual teachers */}
      {activeTeacher && (
        <CommentDrawer
          isOpen={commentDrawerOpen}
          onClose={() => { setCommentDrawerOpen(false); setActiveTeacher(null); }}
          mediaId={`teacher-${activeTeacher.id}`}
          mediaTitle={`Teacher: ${activeTeacher.name}`}
          onCommentSubmitted={onCommentSubmitted}
        />
      )}
    </section>
  );
}
