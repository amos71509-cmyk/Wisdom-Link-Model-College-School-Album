import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Award, Camera, Heart, Play, Sparkles, Users, Video, X, CheckCircle2, 
  UploadCloud, Search, Filter, MessageSquare, Download, ThumbsUp, Loader2, 
  Calendar, Film, Image as ImageIcon, ShieldCheck, ArrowLeft, RotateCcw
} from 'lucide-react';
import { GraduationMemory } from '../types';
import { 
  subscribeApprovedEventMemories, 
  submitEventMemory
} from '../services/firebaseService';
import GraduationReelsViewer from './GraduationReelsViewer';
import { compressImage } from '../lib/imageCompressor';
import { getCloudinaryThumbnail } from '../utils/videoUtils';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { stageOrUploadMedia, validateUploadFile, uploadMultipleImagesSequentially } from '../utils/uploadHelper';

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

export interface GraduationCeremonyGalleryProps {
  onClose?: () => void;
  eventTitle?: string;
  eventCategory?: string;
  eventDescription?: string;
}

export default function GraduationCeremonyGallery({ 
  onClose,
  eventTitle = 'Graduation Ceremony',
  eventCategory = 'Ceremony',
  eventDescription = 'Explore stage speeches, award honorings, family embraces, choral performances, and celebration highlights.'
}: GraduationCeremonyGalleryProps) {
  const [memories, setMemories] = useState<GraduationMemory[]>(eventTitle === 'Graduation Ceremony' ? FALLBACK_CEREMONY_MEMORIES : []);
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
  
  // Multi-file selection state with upload queue tracking
  interface UploadFileItem {
    id: string;
    file: File;
    previewUrl: string;
    mediaType: 'image' | 'video';
    sizeText: string;
    status: 'idle' | 'uploading' | 'completed' | 'error';
    progressPercent: number;
    errorMsg?: string;
    mediaUrl?: string;
    docId?: string;
  }
  const [selectedFiles, setSelectedFiles] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccessToast, setUploadSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);

  // Fullscreen Viewer State
  const [selectedItem, setSelectedItem] = useState<GraduationMemory | null>(null);

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

  // Lock background scroll when modal or media viewer is open
  useEffect(() => {
    if (isUploadModalOpen || selectedItem) {
      document.body.style.overflow = 'hidden';
      
      if (isUploadModalOpen) {
        // Auto-scroll modal body container to top 0
        const timer = setTimeout(() => {
          if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
          }
        }, 20);
        return () => clearTimeout(timer);
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isUploadModalOpen, selectedItem]);

  // Real-time Firestore subscription to Approved Event Memories
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeApprovedEventMemories(eventTitle, (liveMemories) => {
      if (liveMemories && liveMemories.length > 0) {
        setMemories(liveMemories);
      } else if (eventTitle === 'Graduation Ceremony') {
        setMemories(FALLBACK_CEREMONY_MEMORIES);
      } else {
        setMemories([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [eventTitle]);

  // File Selector & Drag-and-Drop Handler (Supports up to 20 images & 5 videos concurrently)
  const handleFilesAdded = (filesArray: File[]) => {
    if (!filesArray || filesArray.length === 0) return;

    let currentImageCount = selectedFiles.filter(f => f.mediaType === 'image').length;
    let currentVideoCount = selectedFiles.filter(f => f.mediaType === 'video').length;

    const newItems: UploadFileItem[] = [];
    const errors: string[] = [];

    filesArray.forEach((f) => {
      const validation = validateUploadFile(f);
      if (!validation.valid) {
        if (validation.error) errors.push(validation.error);
        return;
      }

      const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f.name);
      const mediaType: 'image' | 'video' = isImg ? 'image' : 'video';

      if (mediaType === 'image') {
        if (currentImageCount >= 20) {
          errors.push(`Maximum of 20 images reached. Skipped "${f.name}".`);
          return;
        }
        currentImageCount++;
      } else {
        if (currentVideoCount >= 5) {
          errors.push(`Maximum of 5 videos reached. Skipped "${f.name}".`);
          return;
        }
        currentVideoCount++;
      }

      newItems.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        file: f,
        previewUrl: isImg ? URL.createObjectURL(f) : '',
        mediaType,
        sizeText: (f.size / (1024 * 1024)).toFixed(2) + ' MB',
        status: 'idle',
        progressPercent: 0
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
      if (e.target) e.target.value = '';
    }
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find(f => f.id === id);
      if (target?.previewUrl) {
        try { URL.revokeObjectURL(target.previewUrl); } catch (e) { /* ignore */ }
      }
      return prev.filter(f => f.id !== id);
    });
  };

  // Upload single file task independently
  const uploadSingleFile = async (item: UploadFileItem): Promise<boolean> => {
    setSelectedFiles((prev) =>
      prev.map((f) =>
        f.id === item.id
          ? { ...f, status: 'uploading', progressPercent: 0, errorMsg: undefined }
          : f
      )
    );

    try {
      const result = await stageOrUploadMedia(item.file, {
        folder: 'scholars_class_2026',
        onProgress: (pct) => {
          setSelectedFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progressPercent: pct } : f))
          );
        }
      });

      const finalMediaUrl = result.secure_url || result.url;
      if (!finalMediaUrl) throw new Error("Upload failed to return valid media URL.");

      let thumbnailUrl = '';
      if (item.mediaType === 'video') {
        thumbnailUrl = getCloudinaryThumbnail(finalMediaUrl) || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800';
      }

      // Immediately write metadata for this specific file upon Cloudinary upload success
      const docId = await submitEventMemory(eventTitle, {
        title: uploadCaption.substring(0, 40) + (uploadCaption.length > 40 ? '...' : ''),
        eventName: `${eventTitle} ${uploadYear}`,
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

      setSelectedFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: 'completed', progressPercent: 100, mediaUrl: finalMediaUrl, docId }
            : f
        )
      );
      return true;
    } catch (err: any) {
      console.error(`[QUEUE ITEM FAIL] ${item.file.name}:`, err);
      const errMsg = err?.message || 'Upload failed';
      setSelectedFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'error', errorMsg: errMsg } : f))
      );
      return false;
    }
  };

  // Submit Graduation Ceremony Queue (Concurrently uploads up to 3 files via UploadManagerV2)
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

    const pendingItems = selectedFiles.filter(f => f.status === 'idle' || f.status === 'error');
    if (pendingItems.length === 0) {
      if (selectedFiles.every(f => f.status === 'completed')) {
        setIsUploadModalOpen(false);
        setSelectedFiles([]);
        setUploadCaption('');
        setUploadName('');
        setUploadSuccessToast(true);
        setTimeout(() => setUploadSuccessToast(false), 5000);
      }
      return;
    }

    setUploading(true);
    setUploadError('');

    if (pendingItems.length === 1) {
      // Single-image path completely untouched
      await uploadSingleFile(pendingItems[0]);
    } else {
      // Brand-new sequential multiple-image upload path
      const pendingFiles = pendingItems.map((p) => p.file);

      // Set initial status to uploading for all pending items
      setSelectedFiles((prev) =>
        prev.map((f) =>
          pendingItems.some((p) => p.id === f.id)
            ? { ...f, status: 'uploading', progressPercent: 0, errorMsg: undefined }
            : f
        )
      );

      await uploadMultipleImagesSequentially(pendingFiles, {
        folder: 'scholars_class_2026',
        onProgress: (index, total, pct, file) => {
          const item = pendingItems[index];
          if (item) {
            setSelectedFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progressPercent: pct } : f))
            );
          }
        },
        onWriteFirestore: async (file, uploadResult) => {
          const item = pendingItems.find((p) => p.file === file);
          if (!item) return;

          const finalMediaUrl = uploadResult.secure_url || uploadResult.url;
          let thumbnailUrl = '';
          if (item.mediaType === 'video') {
            thumbnailUrl = getCloudinaryThumbnail(finalMediaUrl) || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800';
          }

          // Save each successful image to Firestore immediately after Cloudinary returns success
          const docId = await submitEventMemory(eventTitle, {
            title: uploadCaption.substring(0, 40) + (uploadCaption.length > 40 ? '...' : ''),
            eventName: `${eventTitle} ${uploadYear}`,
            graduationYear: uploadYear,
            uploadedByType: uploadRole as any,
            memoryType: uploadType,
            mediaType: item.mediaType,
            mediaUrl: finalMediaUrl,
            thumbnailUrl,
            caption: uploadCaption,
            uploaderName: uploadName.trim() || ('Anonymous ' + uploadRole),
            isStaged: false,
            status: 'Pending'
          });

          setSelectedFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, status: 'completed', progressPercent: 100, mediaUrl: finalMediaUrl, docId }
                : f
            )
          );
        },
        onItemError: (file, error, index) => {
          const item = pendingItems[index];
          if (item) {
            setSelectedFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, status: 'error', errorMsg: error.message } : f))
            );
          }
        }
      });
    }

    setUploading(false);

    // Evaluate final queue state
    setSelectedFiles((latestFiles) => {
      const failed = latestFiles.filter(f => f.status === 'error').length;
      const completed = latestFiles.filter(f => f.status === 'completed').length;

      if (completed > 0) {
        setUploadProgressPercent(100);
        setUploadProgressText(`Uploaded successfully: ${completed}${failed > 0 ? `, Failed: ${failed}` : ''}`);
        
        // Notify user, close modal automatically, and auto-disappear notification toast after 3.5s
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setSelectedFiles([]);
          setUploadCaption('');
          setUploadName('');
          setToastMessage(
            failed === 0
              ? `Successfully submitted ${completed} graduation memory item(s)! Awaiting approval.`
              : `Uploaded ${completed} item(s) successfully (${failed} failed).`
          );
          setUploadSuccessToast(true);
          setTimeout(() => {
            setUploadSuccessToast(false);
          }, 3500);
        }, 800);
      } else if (failed > 0) {
        setUploadError(`Failed to upload ${failed} item(s). Click Retry on failed files.`);
      }
      return latestFiles;
    });
  };

  const retrySingleFile = async (item: UploadFileItem) => {
    if (!uploadCaption.trim()) {
      setUploadError('Please provide a description or caption for your graduation memory.');
      return;
    }
    setUploadError('');
    setUploading(true);
    await uploadSingleFile(item);
    setUploading(false);

    setSelectedFiles((latestFiles) => {
      const failed = latestFiles.filter(f => f.status === 'error').length;
      const completed = latestFiles.filter(f => f.status === 'completed').length;
      if (completed > 0 && failed === 0) {
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setSelectedFiles([]);
          setUploadCaption('');
          setUploadName('');
          setToastMessage(`Successfully submitted ${completed} graduation memory item(s)!`);
          setUploadSuccessToast(true);
          setTimeout(() => setUploadSuccessToast(false), 3500);
        }, 500);
      }
      return latestFiles;
    });
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
    <section id="graduation-highlights" className="py-6 sm:py-12 bg-slate-950 text-slate-100 relative z-10 border-t border-b border-white/10 my-4 sm:my-8">
      
      {/* ==========================================================
          PERMANENT FLOATING BUTTONS (FIXED POSITION ATTACHED TO VIEWPORT)
          ========================================================== */}
      {!isUploadModalOpen && !selectedItem && (
        <>
          {/* TOP-LEFT: Upload Your Event Memory Button */}
          <button
            type="button"
            onClick={openModal}
            style={{
              position: 'fixed',
              top: 'max(10px, env(safe-area-inset-top, 10px))',
              left: 'max(12px, env(safe-area-inset-left, 12px))',
              zIndex: 99999,
            }}
            className="h-[38px] sm:h-[42px] px-[14px] py-[10px] rounded-[18px] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-[13px] sm:text-[14px] uppercase tracking-wider shadow-[0_8px_25px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300/40 flex items-center gap-2 shrink-0 group backdrop-blur-md"
          >
            <UploadCloud className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] shrink-0 group-hover:animate-bounce" />
            <span className="hidden sm:inline">Upload Memory</span>
            <span className="sm:hidden">Upload</span>
          </button>

          {/* TOP-RIGHT: Back to Major Events Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                position: 'fixed',
                top: 'max(10px, env(safe-area-inset-top, 10px))',
                right: 'max(12px, env(safe-area-inset-right, 12px))',
                zIndex: 99999,
              }}
              className="h-[38px] sm:h-[42px] px-[14px] py-[10px] rounded-[18px] bg-slate-900/95 hover:bg-slate-800 text-slate-100 border border-white/20 text-[13px] sm:text-[14px] font-bold shadow-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 group backdrop-blur-md"
            >
              <ArrowLeft className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] text-amber-400 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back to Major Events</span>
              <span className="sm:hidden">Back</span>
            </button>
          )}
        </>
      )}

      <div className={isUploadModalOpen || selectedItem ? "hidden" : "block"}>
      
      {/* Toast Notification for Submission Success */}
      {uploadSuccessToast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-200" />
          <div className="text-left">
            <h4 className="font-bold text-sm text-white">Graduation Memory Submitted!</h4>
            <p className="text-xs text-emerald-100 font-medium">
              {toastMessage || 'Your memory is now awaiting administrator review and approval.'}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header Title Section */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10 text-left">
          <div className="max-w-3xl">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{eventCategory} Archives & Highlights</span>
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
              {eventTitle} Gallery
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {eventDescription}
            </p>
          </div>

          {/* Upload Button CTA */}
          <button
            onClick={openModal}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-103 hover:shadow-amber-500/25 active:scale-98 transition-all cursor-pointer border border-amber-300/30 shrink-0"
          >
            <UploadCloud className="w-5 h-5 shrink-0" />
            <span>Upload Memory</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 md:p-6 mb-6 shadow-xl backdrop-blur-md space-y-4">
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
            <div className="md:col-span-3">
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
            <div className="md:col-span-4">
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

          </div>
        </div>

        {/* Sticky Filter Bar (All / Photos / Videos) */}
        <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-xl border-y border-white/10 py-3 px-4 -mx-4 sm:mx-0 sm:rounded-2xl shadow-2xl mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedMediaType('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                selectedMediaType === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>All ({memories.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMediaType('image')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                selectedMediaType === 'image'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/10'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photos ({memories.filter(m => m.mediaType === 'image').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMediaType('video')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                selectedMediaType === 'video'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20 scale-105'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/10'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-purple-300" />
              <span>Videos ({memories.filter(m => m.mediaType === 'video').length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            Showing <span className="text-white font-bold">{filteredMemories.length}</span> {selectedMediaType === 'image' ? 'Photos' : selectedMediaType === 'video' ? 'Videos' : 'Memories'}
          </div>
        </div>

        {/* Gallery Grid Container */}
        {filteredMemories.length === 0 ? (
          <div className="py-20 px-6 text-center flex flex-col items-center justify-center space-y-5 bg-slate-900/60 border border-white/10 rounded-3xl backdrop-blur-md my-8 shadow-2xl max-w-2xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Camera className="w-10 h-10 text-amber-300 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                No memories have been uploaded for this event yet.
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">
                Be the first to preserve this special moment. Upload photos or video highlights from {eventTitle}.
              </p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-amber-300/40"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload First Memory</span>
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
                {/* Media Frame Container */}
                <div className="relative aspect-[16/10] w-full bg-slate-950 overflow-hidden border-b border-white/5">
                  {item.mediaType === 'video' ? (
                    <div className="relative w-full h-full">
                      {/* Video Thumbnail (Static image, no autoplay in grid) */}
                      <img
                        src={item.thumbnailUrl || getCloudinaryThumbnail(item.mediaUrl) || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800'}
                        alt={item.caption || item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-transparent group-hover:via-black/10 transition-colors flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                          <Play className="w-7 h-7 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Video Badge (Top Left) */}
                      <div className="absolute top-3 left-3 z-10 pointer-events-none">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-950/90 backdrop-blur-md text-purple-300 border border-purple-400/30 shadow-lg flex items-center gap-1.5">
                          <Film className="w-3.5 h-3.5 text-purple-400" />
                          <span>VIDEO</span>
                        </span>
                      </div>

                      {/* Video Duration Badge (Bottom Right) */}
                      <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-slate-950/90 backdrop-blur-md text-slate-200 border border-white/10 shadow-lg flex items-center gap-1">
                          <Film className="w-3 h-3 text-purple-400" />
                          <span>0:30</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-full">
                      {/* Photo Image */}
                      <img
                        src={getOptimizedImageUrl(item.mediaUrl, 800)}
                        alt={item.caption || item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />

                      {/* Photo Badge (Top Left) */}
                      <div className="absolute top-3 left-3 z-10 pointer-events-none">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-950/90 backdrop-blur-md text-emerald-300 border border-emerald-400/30 shadow-lg flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                          <span>PHOTO</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Memory Type Tag (Top Right) */}
                  <div className="absolute top-3 right-3 pointer-events-none z-10">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-400/20 shadow-md">
                      {item.memoryType}
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
              Share your photos and videos from {eventTitle} to be permanently preserved in the school archive. Submissions go directly to the administrator pending queue for review and approval.
            </p>
            <div className="pt-2">
              <button
                onClick={openModal}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Upload Memory for {eventTitle}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ==========================================================
          UPLOAD MEMORY MODAL FORM (FULL-SCREEN PAGE PORTAL EXPERIENCE)
          ========================================================== */}
      {isUploadModalOpen && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100dvh',
            maxHeight: '-webkit-fill-available',
            zIndex: 999999,
          }}
          className="bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-200 inset-0"
        >
          {/* 1. STICKY TOP HEADER OF UPLOAD PAGE */}
          <div 
            style={{
              paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))'
            }}
            className="shrink-0 bg-slate-900 border-b border-white/10 px-4 py-3 sm:px-6 flex items-center justify-between gap-3 shadow-md z-30"
          >
            {/* Top Left: Back to Gallery */}
            <button
              type="button"
              onClick={closeAndResetModal}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/5 hover:bg-amber-400 hover:text-slate-950 text-slate-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shrink-0 border border-white/10 group"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400 group-hover:text-slate-950 transition-colors" />
              <span className="hidden sm:inline">Back to Gallery</span>
              <span className="sm:hidden">Back</span>
            </button>

            {/* Center: Title */}
            <div className="text-center min-w-0 px-2">
              <h2 className="text-xs sm:text-base font-black text-white flex items-center justify-center gap-2 truncate font-display">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                <span className="truncate">Upload {eventTitle} Memory</span>
              </h2>
            </div>

            {/* Top Right: Close Icon */}
            <button
              type="button"
              onClick={closeAndResetModal}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer shrink-0 border border-white/10"
              title="Close form"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* 2. SCROLLABLE FORM BODY */}
          <div 
            ref={modalBodyRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-2xl mx-auto w-full space-y-5 custom-scrollbar overscroll-contain"
          >
            {uploadError && (
              <div className="p-3.5 bg-red-950/90 border border-red-500/40 text-red-200 text-xs rounded-2xl flex items-center gap-2.5 shadow-md">
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
                    className="w-full p-3.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
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
                    className="w-full p-3.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                  >
                    {GRAD_YEARS.filter(y => y !== 'All Years').map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Memory Category Dropdown */}
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                  Memory Category
                </label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
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

                {/* Drop Zone Box (Supports drag-and-drop & multi-select) */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleFilesAdded(Array.from(e.dataTransfer.files));
                    }
                  }}
                  className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer text-center space-y-2.5 group ${
                    isDragging ? 'border-amber-400 bg-amber-500/10' : 'border-white/20 hover:border-amber-400/60 bg-slate-900/60'
                  }`}
                >
                  <UploadCloud className={`w-9 h-9 transition-colors mx-auto ${isDragging ? 'text-amber-400 animate-bounce' : 'text-slate-400 group-hover:text-amber-400'}`} />
                  <p className="text-xs sm:text-sm text-slate-200 font-bold">
                    Click or drag to add photos or video clips
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-400 tracking-wide">
                    Max 20 images (JPG, PNG, WEBP) & 5 videos (MP4, MOV, WEBM)
                  </p>
                </div>

                {/* Selected File List / Previews */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 pt-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                      Selected Files ({selectedFiles.filter(f => f.mediaType === 'image').length} / 20 Images, {selectedFiles.filter(f => f.mediaType === 'video').length} / 5 Videos)
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {selectedFiles.map((item) => (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl bg-slate-900 border space-y-2 transition-all ${
                            item.status === 'error'
                              ? 'border-red-500/40 bg-red-950/10'
                              : item.status === 'completed'
                              ? 'border-emerald-500/40 bg-emerald-950/10'
                              : 'border-white/10 group hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Mini Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-slate-950 overflow-hidden shrink-0 relative flex items-center justify-center border border-white/5">
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

                            {/* File Details & Status Badge */}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-xs font-medium text-white truncate">{item.file.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  item.mediaType === 'video'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {item.mediaType === 'video' ? 'Video' : 'Image'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{item.sizeText}</span>

                                {item.status === 'completed' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" /> Uploaded
                                  </span>
                                )}
                                {item.status === 'uploading' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    <Loader2 className="w-3 h-3 animate-spin" /> {item.progressPercent}%
                                  </span>
                                )}
                                {item.status === 'error' && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                    Failed
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons: Retry / Remove */}
                            <div className="flex items-center gap-1 shrink-0">
                              {item.status === 'error' && (
                                <button
                                  type="button"
                                  onClick={() => retrySingleFile(item)}
                                  disabled={uploading}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/30 transition-colors cursor-pointer"
                                  title="Retry uploading this file"
                                >
                                  <RotateCcw className="w-3 h-3" /> Retry
                                </button>
                              )}
                              {item.status !== 'uploading' && (
                                <button
                                  type="button"
                                  onClick={() => removeSelectedFile(item.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                                  title="Remove file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Per-File Progress Bar */}
                          {item.status === 'uploading' && (
                            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-400 h-full transition-all duration-200"
                                style={{ width: `${item.progressPercent}%` }}
                              />
                            </div>
                          )}

                          {/* Per-File Error Detail */}
                          {item.status === 'error' && item.errorMsg && (
                            <p className="text-[10px] text-red-400 text-left font-medium">
                              {item.errorMsg}
                            </p>
                          )}
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
                  className="w-full p-3.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                />
              </div>

              {/* Caption */}
              <div className="space-y-1 text-left pb-4">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300 block">
                  Caption / Story
                </label>
                <textarea
                  required
                  rows={3}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Our family celebrating after receiving the graduation certificate."
                  className="w-full p-3.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400 resize-none font-medium leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 italic text-left">
                  Provide a brief description of what was happening in these photos or videos.
                </p>
              </div>

            </form>
          </div>

          {/* 3. STICKY FOOTER WITH SAFE-AREA INSET */}
          <div 
            style={{
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
            }}
            className="shrink-0 p-4 sm:px-6 bg-slate-900 border-t border-white/10 shadow-2xl space-y-3 w-full z-30"
          >
            <div className="max-w-2xl mx-auto w-full space-y-3">
              {uploading && (
                <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-xl space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                    <span className="truncate">
                      {uploadProgressText || `Uploading queue (${selectedFiles.filter(f => f.status === 'completed').length}/${selectedFiles.length} finished)...`}
                    </span>
                    <span>
                      {Math.round(selectedFiles.reduce((acc, f) => acc + (f.status === 'completed' ? 100 : (f.progressPercent || 0)), 0) / (selectedFiles.length || 1))}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.round(selectedFiles.reduce((acc, f) => acc + (f.status === 'completed' ? 100 : (f.progressPercent || 0)), 0) / (selectedFiles.length || 1))}%`
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                form="graduation-upload-form"
                disabled={uploading || selectedFiles.length === 0}
                className="w-full py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-300/40"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>
                      Uploading Queue ({selectedFiles.filter(f => f.status === 'completed').length}/{selectedFiles.length})...
                    </span>
                  </>
                ) : selectedFiles.some(f => f.status === 'error') ? (
                  <>
                    <RotateCcw className="w-5 h-5" />
                    <span>Retry Failed Uploads</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" />
                    <span>
                      {selectedFiles.length > 1
                        ? `Submit ${selectedFiles.length} Memories for ${eventTitle}`
                        : `Submit Memory for ${eventTitle}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>,
        document.body
      )}
      </div>

      {/* ==========================================================
          FULLSCREEN PHOTO & REELS MEDIA VIEWER
          ========================================================== */}
      {selectedItem && (
        <GraduationReelsViewer
          items={filteredMemories}
          initialItem={selectedItem}
          eventTitle={eventTitle}
          onClose={() => setSelectedItem(null)}
        />
      )}

    </section>
  );
}
