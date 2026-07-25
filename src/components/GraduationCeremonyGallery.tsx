import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, Camera, Heart, Play, Sparkles, Users, Video, X, CheckCircle2, 
  UploadCloud, Search, Filter, MessageSquare, Share2, Download, Send, 
  ThumbsUp, Loader2, Calendar, Film, Image as ImageIcon, ShieldCheck, 
  Copy, Check, Volume2, VolumeX, Eye, ArrowLeft
} from 'lucide-react';
import { GraduationMemory, GraduationMemoryComment } from '../types';
import { 
  subscribeApprovedGraduationMemories, 
  submitGraduationCeremonyMemory,
  toggleLike,
  subscribeMediaLikes,
  addGraduationMemoryComment,
  subscribeGraduationMemoryComments
} from '../services/firebaseService';
import { compressImage } from '../lib/imageCompressor';
import { getCloudinaryThumbnail } from '../utils/videoUtils';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { stageOrUploadMedia, validateUploadFile } from '../utils/uploadHelper';

const UPLOADER_TYPES = [
  'Parent',
  'Student',
  'Teacher',
  'Photographer',
  'School Staff',
  'Visitor'
];

const MEMORY_TYPES = [
  'All Types',
  'Family Photo',
  'Graduation Portrait',
  'Award Presentation',
  'Graduation Speech',
  "Principal's Speech",
  'Teacher Moment',
  'Group Photo',
  'Dance Performance',
  'Drama Performance',
  'Choir Performance',
  'Celebration',
  'Graduation Gown',
  'Video Highlight',
  'Other'
];

const GRAD_YEARS = ['All Years', '2026', '2025', '2024', '2023', '2022'];

// Default high-quality fallback items for Graduation Ceremony Archive
const FALLBACK_CEREMONY_MEMORIES: GraduationMemory[] = [
  {
    id: 'ceremony-fallback-1',
    title: 'Triumphant Cap Toss 2026',
    eventName: 'Wisdom Link 34th Commencement',
    graduationYear: '2026',
    uploadedByType: 'Photographer',
    memoryType: 'Group Photo',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
    caption: 'The definitive climax of our annual commencement! A cascade of emerald and gold caps against the azure blue sky.',
    status: 'Approved',
    likesCount: 142,
    commentsCount: 18,
    uploaderName: 'Official School Photographer',
    createdAt: '2026-06-15T10:00:00Z',
    updatedAt: '2026-06-15T10:00:00Z'
  },
  {
    id: 'ceremony-fallback-2',
    title: 'Valedictorian Address Speech',
    eventName: 'Graduation Ceremony 2026',
    graduationYear: '2026',
    uploadedByType: 'Teacher',
    memoryType: 'Graduation Speech',
    mediaType: 'video',
    mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=1200',
    caption: 'Sarah Andrews delivering an inspiring valedictorian address on leadership, resilience, and brotherhood.',
    status: 'Approved',
    likesCount: 98,
    commentsCount: 12,
    uploaderName: 'Mr. Sterling',
    createdAt: '2026-06-15T11:30:00Z',
    updatedAt: '2026-06-15T11:30:00Z'
  },
  {
    id: 'ceremony-fallback-3',
    title: 'Receiving the Valedictorian Shield',
    eventName: 'Award Presentations',
    graduationYear: '2026',
    uploadedByType: 'School Staff',
    memoryType: 'Award Presentation',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&q=80&w=1200',
    caption: 'Awarding the Leadership Excellence Shield to David Vance for his outstanding academic and social contributions.',
    status: 'Approved',
    likesCount: 85,
    commentsCount: 9,
    uploaderName: 'Events Coordinator',
    createdAt: '2026-06-15T12:00:00Z',
    updatedAt: '2026-06-15T12:00:00Z'
  },
  {
    id: 'ceremony-fallback-4',
    title: 'Generations of Wisdom Link Pride',
    eventName: 'Family Celebrations',
    graduationYear: '2026',
    uploadedByType: 'Parent',
    memoryType: 'Family Photo',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1200',
    caption: 'Three generations celebrating graduation day with proud smiles, vibrant floral bouquets, and academic caps.',
    status: 'Approved',
    likesCount: 110,
    commentsCount: 15,
    uploaderName: 'Mrs. Vance (Parent)',
    createdAt: '2026-06-15T13:15:00Z',
    updatedAt: '2026-06-15T13:15:00Z'
  },
  {
    id: 'ceremony-fallback-5',
    title: 'Graduation Choir Special Performance',
    eventName: 'Choral Tribute',
    graduationYear: '2026',
    uploadedByType: 'Student',
    memoryType: 'Choir Performance',
    mediaType: 'video',
    mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200',
    caption: 'The Wisdom Link Model Choir performing the official school anthem during the commencement recessional.',
    status: 'Approved',
    likesCount: 76,
    commentsCount: 6,
    uploaderName: 'Marcus V.',
    createdAt: '2026-06-15T14:00:00Z',
    updatedAt: '2026-06-15T14:00:00Z'
  },
  {
    id: 'ceremony-fallback-6',
    title: 'Backstage Gown Adjustments & Hugs',
    eventName: 'Behind the Scenes',
    graduationYear: '2026',
    uploadedByType: 'Student',
    memoryType: 'Celebration',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1200',
    caption: 'Emotional moments backstage right before marching down the main auditorium aisle in full regalia.',
    status: 'Approved',
    likesCount: 94,
    commentsCount: 11,
    uploaderName: 'Class Officer',
    createdAt: '2026-06-15T09:30:00Z',
    updatedAt: '2026-06-15T09:30:00Z'
  }
];

interface GraduationCeremonyGalleryProps {
  onClose?: () => void;
}

export default function GraduationCeremonyGallery({ onClose }: GraduationCeremonyGalleryProps) {
  const [memories, setMemories] = useState<GraduationMemory[]>(FALLBACK_CEREMONY_MEMORIES);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [selectedMemoryType, setSelectedMemoryType] = useState('All Types');
  const [selectedUploaderType, setSelectedUploaderType] = useState('All Roles');
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'image' | 'video'>('all');

  // Modal Upload Form State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadRole, setUploadRole] = useState('Parent');
  const [uploadYear, setUploadYear] = useState('2026');
  const [uploadType, setUploadType] = useState('Family Photo');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadName, setUploadName] = useState('');
  
  // Multi-file selection state
  interface UploadFileItem {
    id: string;
    file: File;
    previewUrl: string;
    mediaType: 'image' | 'video';
    sizeText: string;
  }
  const [selectedFiles, setSelectedFiles] = useState<UploadFileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccessToast, setUploadSuccessToast] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Fullscreen Viewer State
  const [selectedItem, setSelectedItem] = useState<GraduationMemory | null>(null);
  const [activeComments, setActiveComments] = useState<GraduationMemoryComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentName, setNewCommentName] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSuccessNotice, setCommentSuccessNotice] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [currentLikes, setCurrentLikes] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Close and clean up form state
  const closeAndResetModal = () => {
    // Revoke object URLs
    selectedFiles.forEach(f => {
      if (f.previewUrl) {
        try { URL.revokeObjectURL(f.previewUrl); } catch (e) { /* ignore */ }
      }
    });
    setSelectedFiles([]);
    setUploadCaption('');
    setUploadName('');
    setUploadError('');
    setUploadProgressText('');
    setUploadProgressPercent(0);
    setIsUploadModalOpen(false);
  };

  const openModal = () => {
    setUploadError('');
    setIsUploadModalOpen(true);
  };

  // Lock background scroll when modal is open & scroll modal to top
  useEffect(() => {
    if (isUploadModalOpen) {
      document.body.style.overflow = 'hidden';
      
      // Auto-scroll modal body container to top 0
      const timer = setTimeout(() => {
        if (modalBodyRef.current) {
          modalBodyRef.current.scrollTop = 0;
        }
      }, 20);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isUploadModalOpen]);

  // Real-time Firestore subscription to Approved Graduation Memories
  useEffect(() => {
    const unsub = subscribeApprovedGraduationMemories((liveMemories) => {
      if (liveMemories && liveMemories.length > 0) {
        setMemories(liveMemories);
      } else {
        setMemories(FALLBACK_CEREMONY_MEMORIES);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Handle Likes & Comments for Fullscreen Viewer
  useEffect(() => {
    if (!selectedItem) return;

    setCurrentLikes(selectedItem.likesCount || 0);

    // Likes subscription
    const unsubLikes = subscribeMediaLikes(selectedItem.id, (count, userHasLiked) => {
      setCurrentLikes(count);
      setHasLiked(userHasLiked);
    });

    // Comments subscription
    const unsubComments = subscribeGraduationMemoryComments(selectedItem.id, (commentsList) => {
      setActiveComments(commentsList);
    });

    return () => {
      unsubLikes();
      unsubComments();
    };
  }, [selectedItem]);

  // Video Autoplay on Scroll (Intersection Observer)
  useEffect(() => {
    const videoElements = document.querySelectorAll<HTMLVideoElement>('.ceremony-video-item');
    if (videoElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.5 });

    videoElements.forEach(v => observer.observe(v));

    return () => {
      videoElements.forEach(v => observer.unobserve(v));
    };
  }, [memories, selectedYear, selectedMemoryType, selectedMediaType, searchQuery]);

  // File Selector Handler (Supports Multiple Files & Auto-Detects Media Type)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray: File[] = Array.from(e.target.files);
      const newItems: UploadFileItem[] = [];
      const errors: string[] = [];

      filesArray.forEach((f) => {
        const validation = validateUploadFile(f);
        if (!validation.valid) {
          if (validation.error) errors.push(validation.error);
          return;
        }

        const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f.name);
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          previewUrl: URL.createObjectURL(f),
          mediaType: isImg ? 'image' : 'video',
          sizeText: (f.size / (1024 * 1024)).toFixed(2) + ' MB'
        });
      });

      if (errors.length > 0) {
        setUploadError(errors.join(' '));
      } else {
        setUploadError('');
      }

      if (newItems.length > 0) {
        setSelectedFiles((prev) => [...prev, ...newItems]);
      }
    }
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter(f => f.id !== id));
  };

  // Submit Graduation Ceremony Uploads (Multi-file enabled)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Please choose at least one image or video file to upload.');
      return;
    }
    if (!uploadCaption.trim()) {
      setUploadError('Please provide a description or caption for your graduation memory.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadedCount(0);

    const total = selectedFiles.length;
    let successfulCount = 0;

    try {
      for (let i = 0; i < total; i++) {
        const item = selectedFiles[i];
        setUploadProgressText(`Uploading ${i + 1} of ${total}: ${item.file.name}`);
        setUploadProgressPercent(Math.round(((i) / total) * 100));

        console.log(`[UPLOAD FLOW] Staging upload for ${item.file.name}...`);
        const result = await stageOrUploadMedia(item.file, {
          folder: 'scholars_class_2026',
          onProgress: (pct) => {
            const overallPct = Math.round(((i + pct / 100) / total) * 100);
            setUploadProgressPercent(overallPct);
          }
        });

        const finalMediaUrl = result.secure_url || result.url;
        if (!finalMediaUrl) {
          throw new Error("Upload failed to return a valid media URL.");
        }

        console.log(`[UPLOAD FLOW SUCCESS] Staging URL ready: ${finalMediaUrl.substring(0, 50)}...`);

        let thumbnailUrl = '';
        if (item.mediaType === 'video') {
          thumbnailUrl = getCloudinaryThumbnail(finalMediaUrl) || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800';
        }

        // Save ONLY the staged or media URL to Firestore
        await submitGraduationCeremonyMemory({
          title: uploadCaption.substring(0, 40) + (uploadCaption.length > 40 ? '...' : ''),
          eventName: 'Graduation Ceremony ' + uploadYear,
          graduationYear: uploadYear,
          uploadedByType: uploadRole as any,
          memoryType: uploadType,
          mediaType: item.mediaType,
          mediaUrl: finalMediaUrl,
          thumbnailUrl,
          caption: uploadCaption,
          uploaderName: uploadName.trim() || ('Anonymous ' + uploadRole),
          isStaged: result.isStaged,
          status: 'Pending'
        });

        successfulCount++;
        setUploadedCount(successfulCount);
      }

      setUploadProgressPercent(100);
      setUploadProgressText('Successfully submitted to admin pending queue!');

      setTimeout(() => {
        setUploading(false);
        setIsUploadModalOpen(false);
        setSelectedFiles([]);
        setUploadCaption('');
        setUploadName('');
        setUploadSuccessToast(true);
        setTimeout(() => setUploadSuccessToast(false), 5000);
      }, 500);

    } catch (err: any) {
      console.error('Upload error:', err);
      let errMsg = 'An error occurred during submission. Please try again.';
      if (err?.message && typeof err.message === 'string' && !err.message.includes('{"error":') && err.message.length < 150) {
        errMsg = err.message;
      }
      setUploadError(errMsg);
      setUploading(false);
    }
  };

  // Toggle Like
  const handleToggleLike = async () => {
    if (!selectedItem) return;
    const newLikedState = await toggleLike(selectedItem.id);
    setHasLiked(newLikedState);
  };

  // Post Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !newCommentText.trim()) return;

    setCommentSubmitting(true);
    try {
      await addGraduationMemoryComment({
        memoryId: selectedItem.id,
        authorName: newCommentName.trim() || 'Visitor',
        authorRole: 'Community Member',
        text: newCommentText.trim()
      });

      setNewCommentText('');
      setCommentSubmitting(false);
      setCommentSuccessNotice(true);
      setTimeout(() => setCommentSuccessNotice(false), 4000);
    } catch (err) {
      console.error(err);
      setCommentSubmitting(false);
    }
  };

  // Social Share Handler
  const handleShare = (platform: 'whatsapp' | 'twitter' | 'facebook' | 'copy') => {
    if (!selectedItem) return;
    const shareUrl = window.location.href;
    const text = `Check out this graduation ceremony memory from Wisdom Link Model College: "${selectedItem.caption}"`;

    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + shareUrl)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Filtered Memories Calculation
  const filteredMemories = memories.filter((mem) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCap = mem.caption?.toLowerCase().includes(q);
      const matchTitle = mem.title?.toLowerCase().includes(q);
      const matchName = mem.uploaderName?.toLowerCase().includes(q);
      const matchType = mem.memoryType?.toLowerCase().includes(q);
      if (!matchCap && !matchTitle && !matchName && !matchType) return false;
    }

    // Filter Year
    if (selectedYear !== 'All Years' && mem.graduationYear !== selectedYear) {
      return false;
    }

    // Filter Memory Type
    if (selectedMemoryType !== 'All Types' && mem.memoryType !== selectedMemoryType) {
      return false;
    }

    // Filter Uploader Role
    if (selectedUploaderType !== 'All Roles' && mem.uploadedByType !== selectedUploaderType) {
      return false;
    }

    // Filter Media Type
    if (selectedMediaType === 'image' && mem.mediaType !== 'image') return false;
    if (selectedMediaType === 'video' && mem.mediaType !== 'video') return false;

    return true;
  });

  return (
    <section id="graduation-highlights" className="py-20 bg-slate-950 text-slate-100 relative z-10 overflow-hidden border-t border-b border-white/10 my-8">
      
      {/* Toast Notification for Submission Success */}
      {uploadSuccessToast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div className="text-left">
            <h4 className="font-bold text-sm">Graduation Memory Submitted!</h4>
            <p className="text-xs text-emerald-100">Your memory is now awaiting administrator review and approval.</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 text-xs font-bold transition-all mb-6 cursor-pointer shadow-lg hover:border-amber-400/50"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Back to Major Events</span>
          </button>
        )}

        {/* Header Title Section */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 text-left">
          <div className="max-w-3xl">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Graduation Ceremony Archive</span>
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
              Graduation Ceremony Gallery
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Explore stage speeches, award honorings, family embraces, choral performances, and celebration highlights.
            </p>
          </div>

          {/* Upload Button CTA */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-103 hover:shadow-amber-500/25 active:scale-98 transition-all cursor-pointer border border-amber-300/30 shrink-0"
          >
            <UploadCloud className="w-5 h-5 shrink-0" />
            <span>Upload Your Graduation Memory</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 md:p-6 mb-10 shadow-xl backdrop-blur-md space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search captions, speakers, or uploaders..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all text-left"
              />
            </div>

            {/* Year Dropdown */}
            <div className="md:col-span-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-400 text-left"
              >
                {GRAD_YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Memory Type Dropdown */}
            <div className="md:col-span-3">
              <select
                value={selectedMemoryType}
                onChange={(e) => setSelectedMemoryType(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-400 text-left"
              >
                {MEMORY_TYPES.map(mt => (
                  <option key={mt} value={mt}>{mt}</option>
                ))}
              </select>
            </div>

            {/* Media Type Filter Pills */}
            <div className="md:col-span-2 flex items-center justify-end gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setSelectedMediaType('all')}
                className={`flex-1 py-1.5 px-2 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                  selectedMediaType === 'all' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedMediaType('image')}
                className={`flex-1 py-1.5 px-2 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                  selectedMediaType === 'image' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Photos
              </button>
              <button
                onClick={() => setSelectedMediaType('video')}
                className={`flex-1 py-1.5 px-2 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                  selectedMediaType === 'video' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Videos
              </button>
            </div>

          </div>
        </div>

        {/* Gallery Grid Container */}
        {filteredMemories.length === 0 ? (
          <div className="p-16 text-center bg-slate-900/50 border border-white/5 rounded-3xl space-y-4">
            <Camera className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Ceremony Memories Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to share photos or video clips from this graduation milestone!
            </p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider hover:bg-amber-300 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Memory Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {filteredMemories.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group relative bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden hover:border-amber-400/50 transition-all duration-300 cursor-pointer shadow-xl flex flex-col"
              >
                {/* Media Frame Container (Fills out card completely) */}
                <div className="relative aspect-[16/10] w-full bg-slate-950 overflow-hidden border-b border-white/5">
                  {item.mediaType === 'video' ? (
                    <div className="relative w-full h-full">
                      <video
                        src={item.mediaUrl}
                        poster={item.thumbnailUrl || getCloudinaryThumbnail(item.mediaUrl)}
                        muted
                        loop
                        playsInline
                        className="ceremony-video-item w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-transparent group-hover:via-black/10 transition-colors flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-amber-400/90 text-slate-950 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={getOptimizedImageUrl(item.mediaUrl, 800)}
                      alt={item.caption || item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  )}

                  {/* Top Badges Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-400/20 shadow-md">
                      {item.memoryType}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-950/80 backdrop-blur-md text-slate-300 border border-white/10 shadow-md">
                      {item.graduationYear}
                    </span>
                  </div>
                </div>

                {/* Card Content Footer */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <p className="text-xs sm:text-sm text-slate-200 font-medium line-clamp-2 leading-relaxed">
                      "{item.caption}"
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{item.uploaderName || item.uploadedByType}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="flex items-center gap-1 text-slate-400 group-hover:text-amber-300 transition-colors">
                        <Heart className="w-3.5 h-3.5 text-pink-400" />
                        <span>{item.likesCount || 0}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{item.commentsCount || 0}</span>
                      </span>
                      <a
                        href={item.mediaUrl}
                        download={`graduation_memory_${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-400/20 text-slate-400 hover:text-amber-300 border border-white/5 hover:border-amber-400/30 transition-colors"
                        title="Download Media"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dedicated "UPLOAD YOUR MEMORY" Banner Section */}
        <div className="mt-16 bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border border-amber-500/30 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-2xl mx-auto space-y-4 relative z-10">
            <span className="px-3.5 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black uppercase tracking-widest border border-amber-400/30 inline-flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-amber-400" />
              <span>Community Contributions</span>
            </span>
            <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight font-display uppercase">
              UPLOAD YOUR MEMORY
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Share your photos and videos from graduation ceremonies to be permanently preserved in the school archive. Submissions go directly to the administrator pending queue for review and approval.
            </p>
            <div className="pt-2">
              <button
                onClick={openModal}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Upload Your Graduation Memory</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ==========================================================
          UPLOAD MEMORY MODAL FORM
          ========================================================== */}
      {isUploadModalOpen && (
        <div 
          className="fixed inset-0 z-[999999] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAndResetModal();
            }
          }}
        >
          {/* Main Modal Card */}
          <div className="bg-slate-900 border border-white/15 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] relative overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
            
            {/* 1. STICKY HEADER (Always Visible at Top) */}
            <div className="shrink-0 bg-slate-900/98 border-b border-white/10 p-4 sm:p-5 flex items-center justify-between gap-3 z-30 shadow-md">
              {/* Back Button */}
              <button
                type="button"
                onClick={closeAndResetModal}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-amber-400 hover:text-slate-950 text-slate-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shrink-0 border border-white/10 group"
              >
                <ArrowLeft className="w-4 h-4 text-amber-400 group-hover:text-slate-950 transition-colors" />
                <span>Back</span>
              </button>

              {/* Title & Icon */}
              <div className="text-center min-w-0 px-2">
                <h3 className="text-sm sm:text-lg font-black text-white flex items-center justify-center gap-2 truncate font-display">
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                  <span className="truncate">Upload Graduation Memory</span>
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden sm:block">
                  Share photos or videos with the school memory archive
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={closeAndResetModal}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-red-500 hover:text-white text-slate-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shrink-0 border border-white/10 group"
                title="Close form"
              >
                <span className="hidden sm:inline">Close</span>
                <X className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* 2. SCROLLABLE FORM BODY (Always starts at top scroll position 0) */}
            <div 
              ref={modalBodyRef}
              className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-5 text-left custom-scrollbar"
            >
              {uploadError && (
                <div className="p-3.5 bg-red-950/80 border border-red-500/40 text-red-200 text-xs rounded-2xl flex items-center gap-2.5">
                  <X className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              <form id="graduation-upload-form" onSubmit={handleUploadSubmit} className="space-y-5">
                
                {/* Who are you? Dropdown & Graduation Year Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 text-left">
                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                      Who are you?
                    </label>
                    <select
                      value={uploadRole}
                      onChange={(e) => setUploadRole(e.target.value)}
                      className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                    >
                      {UPLOADER_TYPES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                      Graduation Year
                    </label>
                    <select
                      value={uploadYear}
                      onChange={(e) => setUploadYear(e.target.value)}
                      className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                    >
                      {GRAD_YEARS.filter(y => y !== 'All Years').map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Memory Type Dropdown */}
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                    Memory Category
                  </label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                  >
                    {MEMORY_TYPES.filter(m => m !== 'All Types').map(mt => (
                      <option key={mt} value={mt}>{mt}</option>
                    ))}
                  </select>
                </div>

                {/* Upload Files Drop Area */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                      Upload Files <span className="text-amber-400 font-normal">(Multiple Files Supported)</span>
                    </label>
                    {selectedFiles.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {selectedFiles.length} file(s) selected
                      </span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    multiple
                    className="hidden"
                  />

                  {/* Drop Zone Box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 sm:p-8 border-2 border-dashed border-white/15 rounded-2xl hover:border-amber-400/50 bg-slate-950/70 transition-all cursor-pointer text-center space-y-2.5 group"
                  >
                    <UploadCloud className="w-9 h-9 text-slate-500 group-hover:text-amber-400 transition-colors mx-auto" />
                    <p className="text-xs sm:text-sm text-slate-200 font-bold">
                      Click or drag to add photos or video clips
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-400 tracking-wide">
                      Supported Formats: JPG, JPEG, PNG, WEBP, MP4, MOV, WEBM
                    </p>
                  </div>

                  {/* Selected File List / Previews */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2 pt-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                        Selected Files ({selectedFiles.filter(f => f.mediaType === 'image').length} Image / {selectedFiles.filter(f => f.mediaType === 'video').length} Video)
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {selectedFiles.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-white/10 group hover:border-white/20 transition-all"
                          >
                            {/* Mini Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-slate-900 overflow-hidden shrink-0 relative flex items-center justify-center border border-white/5">
                              {item.mediaType === 'video' ? (
                                <div className="w-full h-full flex items-center justify-center bg-purple-950/50 text-purple-400">
                                  <Video className="w-5 h-5" />
                                </div>
                              ) : (
                                <img
                                  src={item.previewUrl}
                                  alt={item.file.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>

                            {/* File Details & Auto-detected Badge */}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-xs font-medium text-white truncate">{item.file.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  item.mediaType === 'video'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  Auto Detected: {item.mediaType === 'video' ? 'Video' : 'Image'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{item.sizeText}</span>
                              </div>
                            </div>

                            {/* Remove Button */}
                            <button
                              type="button"
                              onClick={() => removeSelectedFile(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                              title="Remove file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Contributor Name */}
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                    Uploader Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="e.g. Mr. & Mrs. Johnson / Sarah Andrews"
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                {/* Caption */}
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                    Caption / Story
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    placeholder="Our family celebrating after receiving the graduation certificate."
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 resize-none font-medium leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-500 italic text-left">
                    Provide a brief description of what was happening in these photos or videos.
                  </p>
                </div>

              </form>
            </div>

            {/* 3. STICKY FOOTER (Always Visible Submit Action) */}
            <div className="shrink-0 p-4 sm:p-5 bg-slate-900/98 border-t border-white/10 z-30 shadow-lg space-y-3">
              {uploading && (
                <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-xl space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                    <span className="truncate">{uploadProgressText || 'Uploading memories...'}</span>
                    <span>{uploadProgressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                form="graduation-upload-form"
                disabled={uploading || selectedFiles.length === 0}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-300/40"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting ({uploadProgressPercent}%)...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    <span>
                      {selectedFiles.length > 1
                        ? `Submit ${selectedFiles.length} Graduation Memories`
                        : 'Submit Graduation Memory'}
                    </span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================================
          FULLSCREEN MEDIA VIEWER MODAL
          ========================================================== */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col p-4 sm:p-8 overflow-y-auto animate-in fade-in duration-200">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col my-auto space-y-6">
            
            {/* Modal Top Header Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {selectedItem.memoryType}
                </span>
                <span className="text-xs font-mono text-slate-400">Class of {selectedItem.graduationYear}</span>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Main Stage Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Media Display Area */}
              <div className="lg:col-span-7 bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-2 flex items-center justify-center max-h-[65vh]">
                {selectedItem.mediaType === 'video' ? (
                  <video
                    src={selectedItem.mediaUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full max-h-[60vh] object-contain rounded-2xl"
                  />
                ) : (
                  <img
                    src={selectedItem.mediaUrl}
                    alt={selectedItem.caption}
                    className="w-full h-full max-h-[60vh] object-contain rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              {/* Right Details, Actions & Comments */}
              <div className="lg:col-span-5 space-y-6 text-left flex flex-col justify-between">
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white leading-snug">
                      "{selectedItem.caption}"
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-2">
                      <span>Shared by</span>
                      <span className="font-bold text-amber-400">{selectedItem.uploaderName || selectedItem.uploadedByType}</span>
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                    
                    {/* Like Button */}
                    <button
                      onClick={handleToggleLike}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        hasLiked 
                          ? 'bg-pink-600/20 text-pink-300 border-pink-500/40 shadow-lg' 
                          : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current text-pink-400' : ''}`} />
                      <span>{currentLikes} Likes</span>
                    </button>

                    {/* Direct Download Button */}
                    <a
                      href={selectedItem.mediaUrl}
                      download={`wisdom_link_graduation_${selectedItem.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors cursor-pointer"
                      title="Download Original Quality Media"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                  </div>

                  {/* Social Share Buttons */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Share Memory</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleShare('whatsapp')}
                        className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold flex-1 transition-all cursor-pointer"
                      >
                        WhatsApp
                      </button>
                      <button
                        onClick={() => handleShare('twitter')}
                        className="p-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-semibold flex-1 transition-all cursor-pointer"
                      >
                        Twitter/X
                      </button>
                      <button
                        onClick={() => handleShare('copy')}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span>Memory Comments ({activeComments.length})</span>
                  </h4>

                  {commentSuccessNotice && (
                    <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Comment submitted for administrator review!</span>
                    </div>
                  )}

                  {/* Comment List */}
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                    {activeComments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No comments yet. Leave a warm note!</p>
                    ) : (
                      activeComments.map(c => (
                        <div key={c.id} className="p-3 bg-slate-900 rounded-xl border border-white/5 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-400 text-[10px]">
                            <span className="font-bold text-amber-300">{c.authorName}</span>
                            <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-200">{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment Form */}
                  <form onSubmit={handlePostComment} className="space-y-2">
                    <input
                      type="text"
                      value={newCommentName}
                      onChange={(e) => setNewCommentName(e.target.value)}
                      placeholder="Your Name (Optional)"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Write a congratulatory message..."
                        className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={commentSubmitting}
                        className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {commentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                      </button>
                    </div>
                  </form>

                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </section>
  );
}
