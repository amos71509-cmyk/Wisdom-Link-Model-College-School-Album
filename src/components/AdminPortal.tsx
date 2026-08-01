import React, { useState, useEffect } from 'react';
import { 
  Shield, X, Mail, Lock, LogOut, Loader2, Plus, Edit2, Trash2, 
  UploadCloud, Settings, Users, Film, Award, Calendar, Layers, 
  Image as ImageIcon, CheckCircle, Clock, ChevronRight, Menu, Check, HelpCircle, Sparkles, AlertCircle, MessageSquare, Camera,
  Layout, ArrowUp, ArrowDown, History, Info, Play, Image, GraduationCap
} from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  PendingSubmission, 
  CustomSection, 
  SchoolPalette,
  Student,
  TimelineEvent,
  VideoMemory,
  Superlative,
  TeacherTribute,
  CommunityMemory,
  MediaComment
} from '../types';
import { compressImage } from '../lib/imageCompressor';
import { uploadFileToCloudinary } from '../utils/uploadHelper';
import { 
  approveSubmission, 
  rejectSubmission, 
  updateSchoolLogo, 
  updateActiveBannerEvent, 
  saveCustomSection, 
  deleteCustomSection,
  subscribePendingComments,
  approveComment,
  rejectComment
} from '../services/firebaseService';
import GraduationManagementTab from './GraduationManagementTab';
import AdminGraduationCeremonyCMS from './AdminGraduationCeremonyCMS';
import { FEATURED_EVENTS } from '../data/schoolData';

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  activePalette: SchoolPalette;
  cleanUpMode: boolean;
  setCleanUpMode: (val: boolean) => void;
}

type TabId = 'queue' | 'community_memories' | 'students' | 'custom_sections' | 'timeline' | 'videos' | 'tributes' | 'admins' | 'comments' | 'website_content' | 'graduation_management';

export default function AdminPortal({ isOpen, onClose, activePalette, cleanUpMode, setCleanUpMode }: AdminPortalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  
  // Auth Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Layout navigation
  const [activeTab, setActiveTab] = useState<TabId>('queue');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Shared status feedback banner
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ----------------------------------------------------
  // DATA STATES FOR ALL 7 TABS
  // ----------------------------------------------------
  // 1. Moderation Queue
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Community Submissions State
  const [communityMemories, setCommunityMemories] = useState<CommunityMemory[]>([]);

  // Pending Comments State
  const [pendingComments, setPendingComments] = useState<MediaComment[]>([]);

  // 2. Graduand Wall
  const [students, setStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState<Omit<Student, 'id'>>({
    name: '', nickname: '', image: '', favoriteMemory: '', messageToClassmates: '', aspirations: '', house: 'Emerald House',
    quote: '', stateOfOrigin: '', bio: '', instagram: '', twitter: '', displayOrder: 0, featured: false
  });
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentUploading, setStudentUploading] = useState(false);

  // 3. Custom Sections
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [editingSection, setEditingSection] = useState<CustomSection | null>(null);
  const [sectionForm, setSectionForm] = useState({
    title: '', subtext: '', mediaUrl: '', mediaType: 'none' as 'image' | 'video' | 'none', orderIndex: 1, layoutType: 'standard' as any
  });
  const [savingSection, setSavingSection] = useState(false);
  const [sectionUploading, setSectionUploading] = useState(false);

  // 4. Timeline Events
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [eventForm, setEventForm] = useState<Omit<TimelineEvent, 'id'>>({
    date: '', title: '', description: '', image: ''
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventUploading, setEventUploading] = useState(false);

  // 5. Reels & Videos
  const [videos, setVideos] = useState<VideoMemory[]>([]);
  const [editingVideo, setEditingVideo] = useState<VideoMemory | null>(null);
  const [videoForm, setVideoForm] = useState<Omit<VideoMemory, 'id' | 'uploadedAt'>>({
    title: '', submittedBy: '', role: 'Student', url: ''
  });
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);

  // 6. Tributes & Accolades (Superlatives + Teacher Tributes)
  const [superlatives, setSuperlatives] = useState<Superlative[]>([]);
  const [editingSuperlative, setEditingSuperlative] = useState<Superlative | null>(null);
  const [superlativeForm, setSuperlativeForm] = useState<Omit<Superlative, 'id'>>({
    category: '', description: '', studentName: '', studentImage: ''
  });
  const [savingSuperlative, setSavingSuperlative] = useState(false);
  const [superlativeUploading, setSuperlativeUploading] = useState(false);

  const [teacherTributes, setTeacherTributes] = useState<TeacherTribute[]>([]);
  const [editingTribute, setEditingTribute] = useState<TeacherTribute | null>(null);
  const [tributeForm, setTributeForm] = useState<Omit<TeacherTribute & { featured?: boolean }, 'id'>>({
    name: '', subject: '', image: '', message: '', featured: false, department: '', displayOrder: 0
  });
  const [savingTribute, setSavingTribute] = useState(false);
  const [tributeUploading, setTributeUploading] = useState(false);

  // Principal Profile Management
  const [principalForm, setPrincipalForm] = useState({
    name: 'Dr. Elizabeth Sterling, PhD',
    title: 'Principal, The Wisdom Link Model College',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=800',
    welcomeMessage: `Welcome to The Wisdom Link Model College Digital Memory Archive. For over three decades, our institution has stood as a beacon of academic excellence, character building, and creative growth. This digital sanctuary is celebrating our students, safeguarding our collective achievements, and keeping our rich heritage alive for generations of Wisdom Link families.`,
    yearsOfService: '15 Years'
  });
  const [savingPrincipal, setSavingPrincipal] = useState(false);
  const [principalUploading, setPrincipalUploading] = useState(false);

  // 7. Brand & Admins
  const [bannerText, setBannerText] = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerType, setBannerType] = useState('announcement');
  const [savingBanner, setSavingBanner] = useState(false);

  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  // --- WEBSITE CMS TAB STATES ---
  const [cmsSubTab, setCmsSubTab] = useState<'hero' | 'principal' | 'teachers' | 'history' | 'events' | 'footer' | 'branding'>('hero');
  // 1. Hero Slides slideshow config
  const [heroSlides, setHeroSlides] = useState<any[]>([]);
  const [heroSlideForm, setHeroSlideForm] = useState({
    id: '', url: '', label: '', desc: '', date: ''
  });
  const [isEditingSlide, setIsEditingSlide] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [savingHero, setSavingHero] = useState(false);

  // 4. School History section config
  const [historyConfig, setHistoryConfig] = useState({
    coverImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
    title: 'A Legacy of Excellence Since 1991',
    description: 'The Wisdom Link Model College was founded with a singular vision: to cultivate character, champion intellectual rigor, and foster an environment of continuous growth. Over the last three decades, our campus has expanded, but our core devotion to family, academic brilliance, and athletic triumph remains unaltered.',
    gallery: [] as string[]
  });
  const [historyCoverUploading, setHistoryCoverUploading] = useState(false);
  const [historyGalleryUploading, setHistoryGalleryUploading] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);

  // 7. School Events section config
  const [schoolEvents, setSchoolEvents] = useState<any[]>([]);
  const [editingSchoolEvent, setEditingSchoolEvent] = useState<any | null>(null);
  const [schoolEventForm, setSchoolEventForm] = useState({
    title: '', category: '', date: '', description: '', image: '', gallery: [] as string[]
  });
  const [eventCoverUploading, setEventCoverUploading] = useState(false);
  const [eventGalleryUploading, setEventGalleryUploading] = useState(false);
  const [savingSchoolEvent, setSavingSchoolEvent] = useState(false);

  // 8. Footer section config
  const [footerConfig, setFooterConfig] = useState({
    logoUrl: '',
    backgroundImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1920',
    description: 'Preserving the beautiful smiles, triumphs, and shared stories of our student families for generations to come. Every moment matters.',
    phone: '+1 (555) 345-0922',
    email: 'info@wisdomlink.edu.ng',
    address: 'Plot 12, Victoria Island Educational Sanctuary, Lagos, Nigeria'
  });
  const [footerLogoUploading, setFooterLogoUploading] = useState(false);
  const [footerBgUploading, setFooterBgUploading] = useState(false);
  const [savingFooter, setSavingFooter] = useState(false);

  // 9. Website Branding (logo, favicon, shareImage, ogImage)
  const [brandingConfig, setBrandingConfig] = useState({
    logoUrl: '',
    faviconUrl: '',
    shareImageUrl: '',
    ogImageUrl: '',
    bannerText: '🎉 Congratulations to the Class of 2026 on your glorious graduation day! 🎉',
    bannerActive: true
  });
  const [brandFaviconUploading, setBrandFaviconUploading] = useState(false);
  const [brandShareUploading, setBrandShareUploading] = useState(false);
  const [brandOgUploading, setBrandOgUploading] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);

  // Community Memory moderation filter states
  const [commFilterStatus, setCommFilterStatus] = useState<string>('All');
  const [commFilterEvent, setCommFilterEvent] = useState<string>('All');
  const [commFilterMediaType, setCommFilterMediaType] = useState<string>('All');
  const [commSearchQuery, setCommSearchQuery] = useState<string>('');

  // Active editing community memory
  const [editingCommMemory, setEditingCommMemory] = useState<CommunityMemory | null>(null);
  const [editCommTitle, setEditCommTitle] = useState('');
  const [editCommCaption, setEditCommCaption] = useState('');
  const [editCommCategory, setEditCommCategory] = useState('');
  
  // Rejection reason modal or active ID
  const [rejectingCommId, setRejectingCommId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<string | null>(null);
  const [submissionRejectionReasonInput, setSubmissionRejectionReasonInput] = useState('');
  const [rejectingCommentId, setRejectingCommentId] = useState<string | null>(null);
  const [commentRejectionReasonInput, setCommentRejectionReasonInput] = useState('');
  
  // Preview lightbox
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [previewMediaType, setPreviewMediaType] = useState<'image' | 'video' | null>(null);

  // CHANGE THUMBNAIL FEATURE STATE
  const [thumbnailTarget, setThumbnailTarget] = useState<{
    type: 'milestone' | 'school_event' | 'video' | 'graduation_memory';
    id: string;
    title: string;
    currentThumbnail: string;
    itemData?: any;
  } | null>(null);

  const [thumbnailSourceMode, setThumbnailSourceMode] = useState<'upload' | 'picker'>('upload');
  const [thumbnailFileToUpload, setThumbnailFileToUpload] = useState<File | null>(null);
  const [thumbnailChosenUrl, setThumbnailChosenUrl] = useState<string>('');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  // Pool of existing images across CMS for the thumbnail picker
  const existingImagePool = React.useMemo(() => {
    const urls = new Set<string>();
    
    // School Events
    schoolEvents.forEach(ev => {
      if (ev.image) urls.add(ev.image);
      if (Array.isArray(ev.gallery)) {
        ev.gallery.forEach((g: string) => g && urls.add(g));
      }
    });

    // Timeline Events / Milestones
    timelineEvents.forEach(t => {
      if (t.image) urls.add(t.image);
    });

    // Hero slides
    heroSlides.forEach(s => {
      if (s.url) urls.add(s.url);
    });

    // History
    if (historyConfig.coverImage) urls.add(historyConfig.coverImage);
    if (Array.isArray(historyConfig.gallery)) {
      historyConfig.gallery.forEach(g => g && urls.add(g));
    }

    // Community memories
    communityMemories.forEach(m => {
      if (m.mediaUrl && m.mediaType === 'image') urls.add(m.mediaUrl);
      if (m.thumbnailUrl) urls.add(m.thumbnailUrl);
    });

    return Array.from(urls).filter(u => typeof u === 'string' && u.trim().length > 0);
  }, [schoolEvents, timelineEvents, heroSlides, historyConfig, communityMemories]);

  const handleOpenChangeThumbnail = (target: {
    type: 'milestone' | 'school_event' | 'video' | 'graduation_memory';
    id: string;
    title: string;
    currentThumbnail: string;
    itemData?: any;
  }) => {
    setThumbnailTarget(target);
    setThumbnailSourceMode('upload');
    setThumbnailFileToUpload(null);
    setThumbnailChosenUrl(target.currentThumbnail || '');
  };

  const handleSaveThumbnailChange = async () => {
    if (!thumbnailTarget) return;

    setThumbnailUploading(true);
    let finalUrl = '';

    try {
      if (thumbnailSourceMode === 'upload') {
        if (!thumbnailFileToUpload) {
          if (!thumbnailChosenUrl) {
            triggerFeedback('error', 'Please select or upload an image file.');
            setThumbnailUploading(false);
            return;
          }
          finalUrl = thumbnailChosenUrl;
        } else {
          const res = await uploadFileToCloudinary(thumbnailFileToUpload, { folder: 'scholars_class_2026' });
          finalUrl = res.secure_url || res.url;
        }
      } else {
        if (!thumbnailChosenUrl) {
          triggerFeedback('error', 'Please click an image from the gallery picker.');
          setThumbnailUploading(false);
          return;
        }
        finalUrl = thumbnailChosenUrl;
      }

      if (!finalUrl) {
        throw new Error('Could not obtain a valid thumbnail image URL.');
      }

      const oldUrl = thumbnailTarget.currentThumbnail;

      // 1. Update Firestore
      if (thumbnailTarget.type === 'milestone') {
        await setDoc(doc(db, "timeline", thumbnailTarget.id), {
          ...thumbnailTarget.itemData,
          image: finalUrl,
          thumbnailUrl: finalUrl,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else if (thumbnailTarget.type === 'school_event') {
        const updatedEvents = schoolEvents.map(ev => {
          if (ev.title.toLowerCase() === thumbnailTarget.id.toLowerCase() || ev.title === thumbnailTarget.title) {
            return { ...ev, image: finalUrl };
          }
          return ev;
        });
        await setDoc(doc(db, "cms_content", "school_events"), { events: updatedEvents });
        setSchoolEvents(updatedEvents);
      } else if (thumbnailTarget.type === 'video') {
        await setDoc(doc(db, "videos", thumbnailTarget.id), {
          ...thumbnailTarget.itemData,
          thumbnailUrl: finalUrl,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Old Cloudinary cleanup if no longer referenced anywhere
      if (oldUrl && oldUrl !== finalUrl && oldUrl.includes('cloudinary.com')) {
        const isUsedInSchoolEvents = schoolEvents.some(e => e.image === oldUrl || (e.gallery && e.gallery.includes(oldUrl)));
        const isUsedInMilestones = timelineEvents.some(t => t.image === oldUrl);
        const isUsedInHero = heroSlides.some(s => s.url === oldUrl);

        if (!isUsedInSchoolEvents && !isUsedInMilestones && !isUsedInHero) {
          fetch('/api/delete-cloudinary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: oldUrl })
          }).catch(err => console.warn('Old thumbnail cleanup skipped/failed:', err));
        }
      }

      triggerFeedback('success', `Thumbnail for "${thumbnailTarget.title}" updated successfully!`);
      setThumbnailTarget(null);
    } catch (err: any) {
      console.error('Failed to change thumbnail:', err);
      triggerFeedback('error', err.message || 'Failed to update thumbnail.');
    } finally {
      setThumbnailUploading(false);
    }
  };

  // IMMUTABLE PROTECTION CONTROLLER
  const IMMUTABLE_ADMIN_EMAIL = 'justfashion414@gmail.com';

  // ----------------------------------------------------
  // FIREBASE AUTH MONITOR & ROLE VERIFICATION
  // ----------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    setCheckingAuth(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const normalizedEmail = currentUser.email?.trim().toLowerCase() || '';
        
        // Query administrators collection
        const adminCheckResult = await checkIsAdmin(normalizedEmail);
        
        if (adminCheckResult) {
          setUser(currentUser);
          setIsAdmin(true);
          localStorage.setItem('scholars_admin_session', 'true');
        } else {
          // Denied access - sign out
          setAuthError(`Access Denied: Your account (${normalizedEmail}) does not have administrator credentials.`);
          await signOut(auth);
          setUser(null);
          setIsAdmin(false);
          localStorage.removeItem('scholars_admin_session');
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        // Fallback check against local session to maintain fast loading if already approved
        if (localStorage.getItem('scholars_admin_session') === 'true') {
          // Keep as authorized in local states if they were logged in, but force standard check
        }
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Load real-time data when user is validated admin
  useEffect(() => {
    if (!isOpen || !isAdmin) return;

    // 1. Moderation Submissions subscription
    const unsubSubmissions = onSnapshot(collection(db, "submissions"), (snap) => {
      const list: PendingSubmission[] = [];
      snap.forEach(d => {
        const item = d.data() as PendingSubmission;
        if (!item.status || item.status === 'Pending') {
          list.push(item);
        }
      });
      // Client-side sort by submittedAt desc
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setPendingSubmissions(list);
    });

    // 2. Graduands (students) subscription
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      const list: Student[] = [];
      snap.forEach(d => list.push(d.data() as Student));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);
    });

    // 3. Custom Sections subscription
    const unsubSections = onSnapshot(collection(db, "custom_sections"), (snap) => {
      const list: CustomSection[] = [];
      snap.forEach(d => list.push(d.data() as CustomSection));
      list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setCustomSections(list);
    });

    // 4. Timeline Events subscription
    const unsubTimeline = onSnapshot(collection(db, "timeline"), (snap) => {
      const list: TimelineEvent[] = [];
      snap.forEach(d => list.push(d.data() as TimelineEvent));
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimelineEvents(list);
    });

    // 5. Videos subscription
    const unsubVideos = onSnapshot(collection(db, "videos"), (snap) => {
      const list: VideoMemory[] = [];
      snap.forEach(d => list.push(d.data() as VideoMemory));
      list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      setVideos(list);
    });

    // 6. Superlatives & Teacher Tributes subscription
    const unsubSuperlatives = onSnapshot(collection(db, "superlatives"), (snap) => {
      const list: Superlative[] = [];
      snap.forEach(d => list.push(d.data() as Superlative));
      setSuperlatives(list);
    });

    const unsubTributes = onSnapshot(collection(db, "teacher_tributes"), (snap) => {
      const list: TeacherTribute[] = [];
      snap.forEach(d => list.push(d.data() as TeacherTribute));
      setTeacherTributes(list);
    });

    // 7. Branding config & administrators subscription
    const unsubBranding = onSnapshot(doc(db, "branding", "config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.banner) {
          setBannerText(data.banner.text || '');
          setBannerActive(!!data.banner.active);
          setBannerType(data.banner.type || 'announcement');
        }
        if (data.logoUrl) {
          setLogoUrlInput(data.logoUrl);
        }
      }
    });

    const unsubPrincipal = onSnapshot(doc(db, "branding", "principal"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPrincipalForm({
          name: data.name || 'Dr. Elizabeth Sterling, PhD',
          title: data.title || 'Principal, The Wisdom Link Model College',
          image: data.image || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=800',
          welcomeMessage: data.welcomeMessage || '',
          yearsOfService: data.yearsOfService || '15 Years'
        });
      }
    });

    const unsubAdmins = onSnapshot(collection(db, "admins"), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      setAdminsList(list);
    });

    const unsubCommunityMemories = onSnapshot(collection(db, "community_memories"), (snap) => {
      const list: CommunityMemory[] = [];
      snap.forEach(d => list.push(d.data() as CommunityMemory));
      // Sort by createdAt or uploadDate descending
      list.sort((a, b) => new Date(b.createdAt || b.uploadDate || 0).getTime() - new Date(a.createdAt || a.uploadDate || 0).getTime());
      setCommunityMemories(list);
    });

    const unsubComments = subscribePendingComments((list) => {
      setPendingComments(list);
    });

    // --- WEBSITE CMS REAL-TIME SUBSCRIBERS ---
    const unsubHero = onSnapshot(doc(db, "cms_content", "hero"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.slides) setHeroSlides(data.slides);
      }
    });

    const unsubHistory = onSnapshot(doc(db, "cms_content", "history"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHistoryConfig({
          coverImage: data.coverImage || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
          title: data.title || 'A Legacy of Excellence Since 1991',
          description: data.description || 'The Wisdom Link Model College was founded with a singular vision: to cultivate character, champion intellectual rigor, and foster an environment of continuous growth. Over the last three decades, our campus has expanded, but our core devotion to family, academic brilliance, and athletic triumph remains unaltered.',
          gallery: data.gallery || []
        });
      }
    });

    const unsubSchoolEvents = onSnapshot(doc(db, "cms_content", "school_events"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.events && data.events.length > 0) {
          setSchoolEvents(data.events);
        } else {
          setSchoolEvents(FEATURED_EVENTS);
        }
      } else {
        setSchoolEvents(FEATURED_EVENTS);
      }
    });

    const unsubFooter = onSnapshot(doc(db, "cms_content", "footer"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFooterConfig({
          logoUrl: data.logoUrl || '',
          backgroundImage: data.backgroundImage || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1920',
          description: data.description || 'Preserving the beautiful smiles, triumphs, and shared stories of our student families for generations to come. Every moment matters.',
          phone: data.phone || '+1 (555) 345-0922',
          email: data.email || 'info@wisdomlink.edu.ng',
          address: data.address || 'Plot 12, Victoria Island Educational Sanctuary, Lagos, Nigeria'
        });
      }
    });

    const unsubCmsBranding = onSnapshot(doc(db, "cms_content", "branding"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBrandingConfig({
          logoUrl: data.logoUrl || '',
          faviconUrl: data.faviconUrl || '',
          shareImageUrl: data.shareImageUrl || '',
          ogImageUrl: data.ogImageUrl || '',
          bannerText: data.bannerText || '🎉 Congratulations to the Class of 2026 on your glorious graduation day! 🎉',
          bannerActive: data.bannerActive !== undefined ? data.bannerActive : true
        });
      }
    });

    return () => {
      unsubSubmissions();
      unsubStudents();
      unsubSections();
      unsubTimeline();
      unsubVideos();
      unsubSuperlatives();
      unsubTributes();
      unsubBranding();
      unsubPrincipal();
      unsubAdmins();
      unsubCommunityMemories();
      unsubComments();
      unsubHero();
      unsubHistory();
      unsubSchoolEvents();
      unsubFooter();
      unsubCmsBranding();
    };
  }, [isOpen, isAdmin]);

  // Helper check admin
  const checkIsAdmin = async (emailStr: string): Promise<boolean> => {
    const normalized = emailStr.trim().toLowerCase();
    if (normalized === IMMUTABLE_ADMIN_EMAIL || normalized === 'adesegunakinye416@gmail.com') {
      return true;
    }
    try {
      const docSnap = await getDoc(doc(db, "admins", normalized));
      if (docSnap.exists()) return true;

      const q = query(collection(db, "admins"), where("email", "==", normalized));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (e) {
      console.error("Admin verification issue:", e);
      return false;
    }
  };

  // Trigger feedback
  const triggerFeedback = (type: 'success' | 'error', message: string) => {
    setStatusFeedback({ type, message });
    setTimeout(() => setStatusFeedback(null), 5000);
  };

  // ----------------------------------------------------
  // ACTIONS & HANDLERS
  // ----------------------------------------------------
  
  // A. Google Authentication Sign In
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setAuthError(err.message || "Failed to complete Google Single Sign-On.");
    } finally {
      setAuthLoading(false);
    }
  };

  // B. Fallback Password Form Sign In
  const handleCredentialSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.error("Credential sign in error:", err);
      setAuthError(err.message || "Authentication rejected. Double-check your PIN or password.");
    } finally {
      setAuthLoading(false);
    }
  };

  // C. Disconnect / Logout
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('scholars_admin_session');
      setIsAdmin(false);
      setUser(null);
    } catch (err) {
      console.error("Signout error:", err);
    }
  };

  // D. Approve submission
  const handleApproveSubmission = async (item: PendingSubmission) => {
    // Verify administrator privileges
    if (!isAdmin) {
      triggerFeedback('error', "Unauthorized: Administrator privileges are required to approve submissions.");
      return;
    }
    if (!auth.currentUser) {
      triggerFeedback('error', "Authentication required: Please sign in to approve submissions.");
      return;
    }

    setProcessingId(item.id);
    try {
      await approveSubmission(item);
      triggerFeedback('success', "Memory approved successfully.");
    } catch (e: any) {
      triggerFeedback('error', `Approval failed: ${e.message || e}`);
    } finally {
      setProcessingId(null);
    }
  };

  // E. Reject submission (with Cloudinary cleanup and Modal)
  const handleRejectSubmission = (item: PendingSubmission) => {
    setRejectingSubmissionId(item.id);
    setSubmissionRejectionReasonInput('');
  };

  const handleDoRejectSubmission = async () => {
    if (!rejectingSubmissionId) return;
    const item = pendingSubmissions.find(s => s.id === rejectingSubmissionId);
    if (!item) return;

    setProcessingId(rejectingSubmissionId);
    try {
      await rejectSubmission(item, submissionRejectionReasonInput.trim());
      triggerFeedback('success', `Submission marked as rejected and storage scrubbed.`);
      setRejectingSubmissionId(null);
      setSubmissionRejectionReasonInput('');
    } catch (e: any) {
      triggerFeedback('error', `Rejection failed: ${e.message || e}`);
    } finally {
      setProcessingId(null);
    }
  };

  // Comment Moderation Actions
  const handleApproveComment = async (comment: MediaComment) => {
    if (!isAdmin) {
      triggerFeedback('error', "Unauthorized: Administrator privileges are required to approve comments.");
      return;
    }
    const adminEmail = auth.currentUser?.email || 'admin@example.com';
    setProcessingId(comment.id);
    try {
      await approveComment(comment.id, adminEmail);
      triggerFeedback('success', "Comment approved successfully.");
    } catch (e: any) {
      triggerFeedback('error', `Approval failed: ${e.message || e}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectComment = (comment: MediaComment) => {
    if (!isAdmin) {
      triggerFeedback('error', "Unauthorized: Administrator privileges are required to reject comments.");
      return;
    }
    setRejectingCommentId(comment.id);
    setCommentRejectionReasonInput('');
  };

  const handleDoRejectComment = async () => {
    if (!rejectingCommentId) return;
    setProcessingId(rejectingCommentId);
    try {
      await rejectComment(rejectingCommentId, commentRejectionReasonInput.trim());
      triggerFeedback('success', "Comment rejected successfully.");
      setRejectingCommentId(null);
      setCommentRejectionReasonInput('');
    } catch (e: any) {
      triggerFeedback('error', `Rejection failed: ${e.message || e}`);
    } finally {
      setProcessingId(null);
    }
  };

  // F. Create/Edit Student
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;

    setSavingStudent(true);
    try {
      const targetId = editingStudent ? editingStudent.id : `stud-${Date.now()}`;
      const payload = {
        id: targetId,
        status: "Approved",
        approved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || "Admin",
        ...studentForm
      };
      await setDoc(doc(db, "students", targetId), payload);
      console.log("[FIRESTORE WRITE] Collection: students, DocID:", targetId, "Action: handleSaveStudent, Payload:", payload);
      triggerFeedback('success', editingStudent ? "Graduand profile updated!" : "Graduand profile added!");
      
      // Reset
      setEditingStudent(null);
      setStudentForm({
        name: '', nickname: '', image: '', favoriteMemory: '', messageToClassmates: '', aspirations: '', house: 'Emerald House',
        quote: '', stateOfOrigin: '', bio: '', instagram: '', twitter: '', displayOrder: 0, featured: false
      });
    } catch (err: any) {
      triggerFeedback('error', `Failed to save student: ${err.message || err}`);
    } finally {
      setSavingStudent(false);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name || '',
      nickname: student.nickname || '',
      image: student.image || '',
      favoriteMemory: student.favoriteMemory || '',
      messageToClassmates: student.messageToClassmates || '',
      aspirations: student.aspirations || '',
      house: student.house || 'Emerald House',
      quote: student.quote || '',
      stateOfOrigin: student.stateOfOrigin || '',
      bio: student.bio || '',
      instagram: student.instagram || '',
      twitter: student.twitter || '',
      displayOrder: student.displayOrder || 0,
      featured: student.featured === true || student.featured === 'true'
    });
  };

  const handleDeleteStudent = async (id: string, imageUrl?: string) => {
    if (!confirm("Permanently delete this student?")) return;
    try {
      await deleteDoc(doc(db, "students", id));
      triggerFeedback('success', "Student deleted.");
      if (imageUrl && imageUrl.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: imageUrl })
        }).catch(err => console.error("Cloudinary cleanup warning:", err));
      }
    } catch (err: any) {
      triggerFeedback('error', `Deletion error: ${err.message}`);
    }
  };

  const handleMoveStudent = async (index: number, direction: 'up' | 'down') => {
    try {
      const sortedGrads = [...students].sort((a, b) => {
        const aFeat = a.featured === true || a.featured === 'true' ? 1 : 0;
        const bFeat = b.featured === true || b.featured === 'true' ? 1 : 0;
        if (bFeat !== aFeat) return bFeat - aFeat;
        if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        }
        return a.name.localeCompare(b.name);
      });

      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === sortedGrads.length - 1) return;

      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      const current = sortedGrads[index];
      const other = sortedGrads[swapIndex];

      const batch = writeBatch(db);
      batch.update(doc(db, "students", current.id), { displayOrder: swapIndex });
      batch.update(doc(db, "students", other.id), { displayOrder: index });
      await batch.commit();
      
      triggerFeedback('success', "Display order updated.");
    } catch (err: any) {
      triggerFeedback('error', `Reordering failed: ${err.message || err}`);
    }
  };

  // G. Create/Edit Custom Section (with BIRTHDAY preset layout)
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.title.trim()) return;

    setSavingSection(true);
    try {
      const targetId = editingSection ? editingSection.id : `sect-${Date.now()}`;
      const payload: CustomSection & { status?: string; approved?: boolean; approvedAt?: string; approvedBy?: string } = {
        id: targetId,
        title: sectionForm.title,
        subtext: sectionForm.subtext,
        mediaUrl: sectionForm.mediaType !== 'none' ? sectionForm.mediaUrl : undefined,
        mediaType: sectionForm.mediaType,
        orderIndex: Number(sectionForm.orderIndex),
        layoutType: sectionForm.layoutType,
        status: "Approved",
        approved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || "Admin"
      };
      await setDoc(doc(db, "custom_sections", targetId), payload);
      console.log("[FIRESTORE WRITE] Collection: custom_sections, DocID:", targetId, "Action: handleSaveSection, Payload:", payload);
      triggerFeedback('success', "Section configured and deployed!");
      
      // Reset
      setEditingSection(null);
      setSectionForm({
        title: '', subtext: '', mediaUrl: '', mediaType: 'none', orderIndex: customSections.length + 2, layoutType: 'standard'
      });
    } catch (err: any) {
      triggerFeedback('error', `Failed to save section: ${err.message}`);
    } finally {
      setSavingSection(false);
    }
  };

  const handleEditSection = (section: CustomSection) => {
    setEditingSection(section);
    setSectionForm({
      title: section.title || '',
      subtext: section.subtext || '',
      mediaUrl: section.mediaUrl || '',
      mediaType: section.mediaType || 'none',
      orderIndex: section.orderIndex || 1,
      layoutType: section.layoutType || 'standard'
    });
  };

  const handleDeleteSection = async (id: string, mediaUrl?: string) => {
    if (!confirm("Permanently remove this layout section?")) return;
    try {
      await deleteCustomSection(id);
      triggerFeedback('success', "Section deleted.");
      if (mediaUrl && mediaUrl.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: mediaUrl })
        }).catch(err => console.error(err));
      }
    } catch (err: any) {
      triggerFeedback('error', `Deletion failed: ${err.message}`);
    }
  };

  // H. Create/Edit Timeline Events
  const handleSaveTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.date) return;

    setSavingEvent(true);
    try {
      const targetId = editingEvent ? editingEvent.id : `te-${Date.now()}`;
      const payload = {
        id: targetId,
        status: "Approved",
        approved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || "Admin",
        ...eventForm
      };
      await setDoc(doc(db, "timeline", targetId), payload);
      console.log("[FIRESTORE WRITE] Collection: timeline, DocID:", targetId, "Action: handleSaveTimeline, Payload:", payload);
      triggerFeedback('success', "Timeline milestone updated!");
      setEditingEvent(null);
      setEventForm({ date: '', title: '', description: '', image: '' });
    } catch (e: any) {
      triggerFeedback('error', e.message);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteTimeline = async (id: string, imageUrl?: string) => {
    if (!confirm("Delete this timeline milestone?")) return;
    try {
      await deleteDoc(doc(db, "timeline", id));
      triggerFeedback('success', "Milestone deleted.");
      if (imageUrl && imageUrl.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: imageUrl }) }).catch(() => {});
      }
    } catch (e: any) {
      triggerFeedback('error', e.message);
    }
  };

  // I. Create/Edit Videos
  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoForm.title.trim() || !videoForm.url.trim()) return;

    setSavingVideo(true);
    try {
      const targetId = editingVideo ? editingVideo.id : `video-${Date.now()}`;
      const uploadedAtStr = editingVideo ? editingVideo.uploadedAt : new Date().toISOString();
      const payload = {
        id: targetId,
        uploadedAt: uploadedAtStr,
        date: uploadedAtStr.split('T')[0],
        status: "Approved",
        approved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || "Admin",
        ...videoForm,
        // Dual mappings for schema compliance and filtering safety
        videoUrl: videoForm.url,
        url: videoForm.url,
        caption: videoForm.title,
        contributorName: videoForm.submittedBy || "Anonymous",
        relation: videoForm.role || "Contributor"
      };
      await setDoc(doc(db, "videos", targetId), payload);
      console.log("[FIRESTORE WRITE] Collection: videos, DocID:", targetId, "Action: handleSaveVideo, Payload:", payload);
      triggerFeedback('success', "Video memory published!");
      setEditingVideo(null);
      setVideoForm({ title: '', submittedBy: '', role: 'Student', url: '' });
    } catch (e: any) {
      triggerFeedback('error', e.message);
    } finally {
      setSavingVideo(false);
    }
  };

  const handleDeleteVideo = async (id: string, url?: string) => {
    if (!confirm("Delete this video memory?")) return;
    try {
      await deleteDoc(doc(db, "videos", id));
      triggerFeedback('success', "Video removed.");
      if (url && url.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).catch(() => {});
      }
    } catch (e: any) {
      triggerFeedback('error', e.message);
    }
  };

  // --- WEBSITE CMS ACTION HANDLERS ---
  const handleSaveHeroSlides = async (slidesToSave: any[]) => {
    setSavingHero(true);
    try {
      await setDoc(doc(db, "cms_content", "hero"), { slides: slidesToSave });
      triggerFeedback('success', "Hero Slideshow configurations saved successfully!");
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed to save Hero Slides.");
    } finally {
      setSavingHero(false);
    }
  };

  const handleMoveSlide = async (index: number, direction: 'up' | 'down') => {
    const updated = [...heroSlides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    await handleSaveHeroSlides(updated);
  };

  const handleStartEditSlide = (slide: any) => {
    setHeroSlideForm(slide);
    setIsEditingSlide(true);
  };

  const handleDeleteHeroSlide = async (id: string, imageUrl: string) => {
    if (!confirm('Are you sure you want to permanently delete this hero slide?')) return;
    const updated = heroSlides.filter(s => s.id !== id);
    await handleSaveHeroSlides(updated);
    if (imageUrl && imageUrl.includes('cloudinary.com')) {
      fetch('/api/delete-cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl })
      }).catch(err => console.error(err));
    }
  };

  const handleSaveHistoryConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHistory(true);
    try {
      await setDoc(doc(db, "cms_content", "history"), historyConfig);
      triggerFeedback('success', "School History section saved successfully!");
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed to save School History.");
    } finally {
      setSavingHistory(false);
    }
  };

  const handleSaveSchoolEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolEventForm.title.trim()) return;
    setSavingSchoolEvent(true);
    try {
      let updatedEvents = [...schoolEvents];
      const matchIndex = schoolEvents.findIndex(ev => ev.title.toLowerCase() === schoolEventForm.title.toLowerCase());
      
      const payload = { ...schoolEventForm };
      if (matchIndex >= 0) {
        updatedEvents[matchIndex] = payload;
      } else {
        updatedEvents.push(payload);
      }
      
      await setDoc(doc(db, "cms_content", "school_events"), { events: updatedEvents });
      setSchoolEvents(updatedEvents);
      triggerFeedback('success', "School Event configured!");
      setEditingSchoolEvent(null);
      setSchoolEventForm({ title: '', category: '', date: '', description: '', image: '', gallery: [] });
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed to save School Event.");
    } finally {
      setSavingSchoolEvent(false);
    }
  };

  const handleDeleteSchoolEvent = async (title: string) => {
    if (!confirm(`Delete configured content for "${title}"?`)) return;
    try {
      const updatedEvents = schoolEvents.filter(ev => ev.title.toLowerCase() !== title.toLowerCase());
      await setDoc(doc(db, "cms_content", "school_events"), { events: updatedEvents });
      setSchoolEvents(updatedEvents);
      triggerFeedback('success', "School Event config removed.");
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed to delete Event.");
    }
  };

  const handleSaveFooterConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFooter(true);
    try {
      await setDoc(doc(db, "cms_content", "footer"), footerConfig);
      triggerFeedback('success', "Footer section saved successfully!");
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed to save Footer.");
    } finally {
      setSavingFooter(false);
    }
  };

  const handleSaveBrandingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    try {
      // Save to website_cms node
      await setDoc(doc(db, "cms_content", "branding"), brandingConfig);
      
      // Also write backfill to branding/config for older components compatibility
      await setDoc(doc(db, "branding", "config"), {
        logoUrl: brandingConfig.logoUrl,
        banner: {
          text: brandingConfig.bannerText,
          active: brandingConfig.bannerActive,
          type: 'announcement'
        }
      });
      triggerFeedback('success', "Branding configurations updated successfully!");
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed to save Branding.");
    } finally {
      setSavingBranding(false);
    }
  };

  // J. Tributes & Accolades (Superlatives + Teacher Tributes)
  const handleSaveSuperlative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superlativeForm.category.trim() || !superlativeForm.studentName.trim()) return;

    setSavingSuperlative(true);
    try {
      const targetId = editingSuperlative ? editingSuperlative.id : `sup-${Date.now()}`;
      const payload = {
        id: targetId,
        status: "Approved",
        approved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || "Admin",
        ...superlativeForm
      };
      await setDoc(doc(db, "superlatives", targetId), payload);
      console.log("[FIRESTORE WRITE] Collection: superlatives, DocID:", targetId, "Action: handleSaveSuperlative, Payload:", payload);
      triggerFeedback('success', "Superlative accolade updated!");
      setEditingSuperlative(null);
      setSuperlativeForm({ category: '', description: '', studentName: '', studentImage: '' });
    } catch (e: any) {
      triggerFeedback('error', e.message);
    } finally {
      setSavingSuperlative(false);
    }
  };

  const handleDeleteSuperlative = async (id: string, imageUrl?: string) => {
    if (!confirm("Delete this superlative award?")) return;
    try {
      await deleteDoc(doc(db, "superlatives", id));
      triggerFeedback('success', "Superlative deleted.");
      if (imageUrl && imageUrl.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: imageUrl }) }).catch(() => {});
      }
    } catch (e: any) {
      triggerFeedback('error', e.message);
    }
  };

  const handleSaveTribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tributeForm.name.trim() || !tributeForm.message.trim()) return;

    setSavingTribute(true);
    try {
      const targetId = editingTribute ? editingTribute.id : `tt-${Date.now()}`;
      const payload = {
        id: targetId,
        status: "Approved",
        approved: true,
        approvedAt: new Date().toISOString(),
        approvedBy: user?.email || "Admin",
        ...tributeForm,
        displayOrder: Number(tributeForm.displayOrder) || 0
      };
      await setDoc(doc(db, "teacher_tributes", targetId), payload);
      console.log("[FIRESTORE WRITE] Collection: teacher_tributes, DocID:", targetId, "Action: handleSaveTribute, Payload:", payload);
      triggerFeedback('success', "Teacher tribute updated!");
      setEditingTribute(null);
      setTributeForm({ name: '', subject: '', image: '', message: '', featured: false, department: '', displayOrder: 0 });
    } catch (e: any) {
      triggerFeedback('error', e.message);
    } finally {
      setSavingTribute(false);
    }
  };

  const handleDeleteTribute = async (id: string, imageUrl?: string) => {
    if (!confirm("Delete this teacher tribute?")) return;
    try {
      await deleteDoc(doc(db, "teacher_tributes", id));
      triggerFeedback('success', "Tribute removed.");
      if (imageUrl && imageUrl.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: imageUrl }) }).catch(() => {});
      }
    } catch (e: any) {
      triggerFeedback('error', e.message);
    }
  };

  const handleSavePrincipal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrincipal(true);
    try {
      const docRef = doc(db, "branding", "principal");
      const payload = {
        name: principalForm.name,
        title: principalForm.title,
        image: principalForm.image,
        welcomeMessage: principalForm.welcomeMessage,
        yearsOfService: principalForm.yearsOfService,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload);
      triggerFeedback('success', "Principal profile updated successfully!");
    } catch (error: any) {
      console.error("Error saving principal:", error);
      triggerFeedback('error', error.message || "Failed to save Principal profile.");
    } finally {
      setSavingPrincipal(false);
    }
  };

  // K. Brand updates
  const handleSaveBannerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBanner(true);
    try {
      await updateActiveBannerEvent(bannerText, bannerActive, bannerType);
      triggerFeedback('success', "Banner alert settings published!");
    } catch (e: any) {
      triggerFeedback('error', e.message);
    } finally {
      setSavingBanner(false);
    }
  };

  // L. Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const uploadResult = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026' });
      const logoUrl = uploadResult.secure_url || uploadResult.url;
      setLogoUrlInput(logoUrl);
      await updateSchoolLogo(logoUrl);
      triggerFeedback('success', "Custom branding logo updated!");
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed logo upload");
    } finally {
      setLogoUploading(false);
    }
  };

  // M. Admin users management
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    const emailToAdd = newAdminEmail.trim().toLowerCase();
    setSavingAdmin(true);
    try {
      await setDoc(doc(db, "admins", emailToAdd), {
        email: emailToAdd,
        addedAt: new Date().toISOString(),
        addedBy: user?.email || 'System'
      });
      triggerFeedback('success', `Secondary administrator "${emailToAdd}" authorized.`);
      setNewAdminEmail('');
    } catch (e: any) {
      triggerFeedback('error', e.message);
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (emailToDelete: string) => {
    const normalized = emailToDelete.trim().toLowerCase();
    
    // IMMUTABLE ADMIN PROTECTION RULE
    if (normalized === IMMUTABLE_ADMIN_EMAIL) {
      alert(`Access Rejected: The Primary Administrator (${IMMUTABLE_ADMIN_EMAIL}) is strictly immutable and protected against deletion or modification.`);
      triggerFeedback('error', `Cannot delete immutable primary administrator.`);
      return;
    }

    if (!confirm(`Revoke administrative access for ${emailToDelete}?`)) return;

    try {
      await deleteDoc(doc(db, "admins", normalized));
      triggerFeedback('success', "Administrator privilege revoked.");
    } catch (e: any) {
      triggerFeedback('error', e.message);
    }
  };

  // N. Community Submissions Moderation Actions
  const handleApproveCommMemory = async (item: CommunityMemory) => {
    // 1. Verify administrator privileges
    if (!isAdmin) {
      triggerFeedback('error', "Unauthorized: Administrator privileges are required to approve submissions.");
      return;
    }
    if (!auth.currentUser) {
      triggerFeedback('error', "Authentication required: Please sign in to approve submissions.");
      return;
    }

    setProcessingId(item.id);
    try {
      // 2 & 4. Update the exact existing document in Firestore using its original ID
      const memoryRef = doc(db, "community_memories", item.id);
      
      const adminId = auth.currentUser.uid || auth.currentUser.email || 'Admin';
      const timestamp = new Date().toISOString();

      await updateDoc(memoryRef, {
        status: 'Approved',
        approved: true,
        approvedAt: timestamp,
        approvedBy: adminId,
        approvedDate: timestamp, // keep for backward compatibility
        updatedAt: timestamp
      });

      // 5. Success notification exactly as requested
      triggerFeedback('success', "Memory approved successfully.");
    } catch (e: any) {
      console.error("Community memory approval transaction failed:", e);
      triggerFeedback('error', `Approval failed: ${e.message || e}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCommMemory = async (id: string, reason: string) => {
    setProcessingId(id);
    try {
      const mem = communityMemories.find(m => m.id === id);
      if (mem && mem.mediaUrl && mem.mediaUrl.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: mem.mediaUrl })
        }).catch(err => console.warn(err));
      }
      const memoryRef = doc(db, "community_memories", id);
      await deleteDoc(memoryRef);
      triggerFeedback('success', `Submission rejected and storage scrubbed.`);
      setRejectingCommId(null);
      setRejectionReasonInput('');
    } catch (e: any) {
      console.error(e);
      triggerFeedback('error', `Rejection failed: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleFeatureCommMemory = async (item: CommunityMemory) => {
    setProcessingId(item.id);
    try {
      const memoryRef = doc(db, "community_memories", item.id);
      await updateDoc(memoryRef, {
        featured: !item.featured,
        updatedAt: new Date().toISOString()
      });
      triggerFeedback('success', !item.featured ? `Marked "${item.title}" as Featured!` : `Removed "${item.title}" from Featured.`);
    } catch (e: any) {
      console.error(e);
      triggerFeedback('error', `Failed to toggle feature state: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleStartEditCommMemory = (item: CommunityMemory) => {
    setEditingCommMemory(item);
    setEditCommTitle(item.title);
    setEditCommCaption(item.caption);
    setEditCommCategory(item.eventCategory);
  };

  const handleSaveCommMemoryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommMemory) return;
    setProcessingId(editingCommMemory.id);
    try {
      const memoryRef = doc(db, "community_memories", editingCommMemory.id);
      await updateDoc(memoryRef, {
        title: editCommTitle.trim(),
        caption: editCommCaption.trim(),
        eventCategory: editCommCategory,
        updatedAt: new Date().toISOString()
      });
      triggerFeedback('success', "Memory edited successfully!");
      setEditingCommMemory(null);
    } catch (err: any) {
      console.error(err);
      triggerFeedback('error', `Failed to edit: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteCommMemory = async (id: string, mediaUrl?: string) => {
    if (!confirm("Are you absolutely sure you want to delete this submission permanently from the database? This action is irreversible.")) return;
    setProcessingId(id);
    try {
      await deleteDoc(doc(db, "community_memories", id));
      triggerFeedback('success', "Submission deleted permanently.");
      
      if (mediaUrl && mediaUrl.includes("cloudinary.com")) {
        fetch("/api/delete-cloudinary", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ url: mediaUrl }) 
        }).catch(err => console.warn("Cloudinary cleanup warning:", err));
      }
    } catch (err: any) {
      console.error(err);
      triggerFeedback('error', `Failed to delete: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ----------------------------------------------------
  // FILE UPLOAD WRAPPERS FOR FORMS (BASE64 -> API)
  // ----------------------------------------------------
  const handleGenericUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    setUploading: (u: boolean) => void,
    setUrl: (url: string) => void,
    type: 'image' | 'video' = 'image'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadResult = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026' });
      const mediaUrl = uploadResult.secure_url || uploadResult.url;
      setUrl(mediaUrl);
      triggerFeedback('success', "Media uploaded successfully!");
    } catch (err: any) {
      triggerFeedback('error', err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="immersive-admin-portal" className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-slate-100 overflow-hidden font-sans">
      
      {/* ----------------------------------------------------
          PORTAL SCREEN 1: AUTHENTICATION MODAL (NOT LOGGED IN)
          ---------------------------------------------------- */}
      {!isAdmin ? (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-4 relative bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950">
          
          {/* Decorative glows */}
          <div className="absolute top-[20%] left-[20%] w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[130px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] rounded-full bg-pink-500/10 blur-[130px] pointer-events-none" />

          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-8 space-y-6 relative z-10 text-left">
            
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold font-display text-white mt-3">Gatekeeper Authorization</h2>
              <p className="text-xs text-slate-400">Class of 2026 Yearbook Security System</p>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 leading-relaxed text-center">
                {authError}
              </div>
            )}

            {/* Google Sign-In Trigger */}
            <button
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 text-white" />
              )}
              <span>Sign In with Google</span>
            </button>

            <div className="relative flex items-center justify-center py-2">
              <div className="border-t border-white/5 w-full" />
              <span className="bg-slate-900 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest absolute">
                Or credential login
              </span>
            </div>

            {/* Email/Password fallback */}
            <form onSubmit={handleCredentialSignIn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Administrator Username / Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="admin@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500/50 text-white focus:outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Secret Credentials PIN / Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500/50 text-white focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 shadow transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Access Security Console</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-white/5">
              Authorized admin accounts only. Secondary admins must be enrolled by the primary administrator.
            </div>

          </div>
        </div>
      ) : (
        
        /* ----------------------------------------------------
            PORTAL SCREEN 2: MAIN DASHBOARD DECK (LOGGED IN)
            ---------------------------------------------------- */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-900 text-slate-200">
          
          {/* Responsive Sidebar */}
          <aside className={`bg-slate-950 border-r border-white/5 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-full md:w-64' : 'w-0 overflow-hidden md:w-16'} shrink-0`}>
            
            {/* Sidebar header */}
            <div className="p-4.5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                {sidebarOpen && (
                  <div className="min-w-0 text-left">
                    <h3 className="text-sm font-bold tracking-tight text-white font-display truncate">Gatekeeper</h3>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Console v1.4</p>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white hidden md:block"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Selector Menu List */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {[
                { id: 'queue', label: 'Moderation Queue', icon: Clock, count: pendingSubmissions.length },
                { id: 'community_memories', label: 'Community Submissions', icon: Sparkles, count: communityMemories.filter(m => m.status === 'Pending').length },
                { id: 'comments', label: 'Comments Moderation', icon: MessageSquare, count: pendingComments.length },
                { id: 'graduation_management', label: 'Graduation Management', icon: GraduationCap },
                { id: 'custom_sections', label: 'Custom Sections', icon: Layers },
                { id: 'timeline', label: 'Timeline Events', icon: Calendar },
                { id: 'videos', label: 'Reels & Videos', icon: Film },
                { id: 'tributes', label: 'Tributes & Accolades', icon: Award },
                { id: 'website_content', label: 'Website Content', icon: Layout },
                { id: 'admins', label: 'Brand & Admins', icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as TabId);
                      // Collapse on mobile upon selection
                      if (window.innerWidth < 768) {
                        setSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      {sidebarOpen && <span className="truncate">{tab.label}</span>}
                    </div>
                    {sidebarOpen && tab.count !== undefined && tab.count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${isActive ? 'bg-white text-indigo-700' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Dropdown Select Viewport Collapse fallback */}
            <div className="p-3 border-t border-white/5 md:hidden">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Quick Select Module</label>
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as TabId)}
                className="w-full p-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="queue">Moderation Queue</option>
                <option value="community_memories">Community Submissions</option>
                <option value="comments">Comments Moderation</option>
                <option value="graduation_management">🎓 Graduation Management</option>
                <option value="custom_sections">Custom Sections</option>
                <option value="timeline">Timeline Events</option>
                <option value="videos">Reels & Videos</option>
                <option value="tributes">Tributes & Accolades</option>
                <option value="admins">Brand & Admins</option>
              </select>
            </div>

            {/* User Session Footer inside Sidebar */}
            {sidebarOpen && (
              <div className="p-4 bg-slate-950/60 border-t border-white/5 text-left space-y-2.5">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Administrator Identity</span>
                  <span className="text-xs font-semibold text-white truncate block mt-0.5" title={user?.email || ''}>
                    {user?.email || 'Authorized admin'}
                  </span>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Lock Console</span>
                </button>

                {/* Conspicuous Clean Up Mode toggle */}
                <div className="pt-2.5 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                      <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                      <span>Clean Up Mode</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCleanUpMode(!cleanUpMode)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        cleanUpMode ? 'bg-red-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          cleanUpMode ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    Display high-visibility pulsing red trash icons across public modules for direct pruning.
                  </p>
                </div>
              </div>
            )}

          </aside>

          {/* Main Dashboard Panel Content Area */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* Header navbar */}
            <header className="h-14 border-b border-white/5 bg-slate-900/60 backdrop-blur flex items-center justify-between px-6 z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white md:hidden"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-extrabold tracking-wide uppercase text-white font-display">
                  {activeTab.replace('_', ' ')}
                </h2>
              </div>
              
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1 px-3 py-1 text-xs"
              >
                <X className="w-4 h-4" />
                <span>Exit</span>
              </button>
            </header>

            {/* Alerts & Action Feedback Ticker */}
            {statusFeedback && (
              <div className={`p-3 text-xs font-semibold text-center flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300 border-b relative z-20 ${
                statusFeedback.type === 'success' 
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/20' 
                  : 'bg-red-950/40 text-red-300 border-red-500/20'
              }`}>
                <CheckCircle className="w-4 h-4" />
                <span>{statusFeedback.message}</span>
              </div>
            )}

            {/* Scrollable Content Pane */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-900 text-slate-300 text-left">
              
              {/* ----------------------------------------------------
                  TAB 0: GRADUATION MANAGEMENT
                  ---------------------------------------------------- */}
              {activeTab === 'graduation_management' && (
                <GraduationManagementTab activePalette={activePalette} />
              )}
              
              {/* ----------------------------------------------------
                  TAB 1: MODERATION QUEUE
                  ---------------------------------------------------- */}
              {activeTab === 'queue' && (
                <div className="space-y-6">
                  <div className="border-b border-white/5 pb-4">
                    <h3 className="text-base font-extrabold text-white">Staging Moderation Pipeline</h3>
                    <p className="text-xs text-slate-400 mt-1">Review pending items. Approved contributions are immediately written to live production streams.</p>
                  </div>

                  {pendingSubmissions.length === 0 ? (
                    <div className="text-center py-20 bg-slate-950/40 rounded-3xl border border-white/5 shadow-inner">
                      <CheckCircle className="w-12 h-12 text-emerald-400/80 mx-auto mb-4" />
                      <h4 className="text-sm font-bold text-slate-200">Moderation Queue Clear!</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">No pending student yearbook entries, timeline updates, or guestbook accolades require review at this time.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingSubmissions.map((item) => {
                        const payload = item.data;
                        const isProcessing = processingId === item.id;
                        return (
                          <div key={item.id} className="bg-slate-950/60 border border-white/5 rounded-2xl overflow-hidden shadow-xl flex flex-col relative group hover:border-white/10 transition-colors">
                            {/* Type tag */}
                            <div className="p-3 bg-slate-950/80 border-b border-white/5 flex items-center justify-between">
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full uppercase font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-widest">
                                {item.type}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500">
                                {new Date(item.submittedAt).toLocaleTimeString()}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="p-4 flex-1 space-y-4">
                              {/* Media frame */}
                              {(payload.imageUrl || payload.photoUrl || payload.url) && (
                                <div className="h-44 rounded-xl overflow-hidden bg-slate-900 border border-white/5 relative">
                                  {(item.type || '').includes('video') || (payload.url && payload.url.endsWith('.mp4')) ? (
                                    <video src={payload.imageUrl || payload.photoUrl || payload.url} className="w-full h-full object-cover" controls />
                                  ) : (
                                    <img src={payload.imageUrl || payload.photoUrl || payload.url} alt="submissions media" className="w-full h-full object-cover" />
                                  )}
                                </div>
                              )}

                              <div>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Text Content</h4>
                                <p className="text-xs font-bold text-slate-200 mt-1 leading-relaxed">
                                  {payload.title || payload.caption || payload.message || payload.event}
                                </p>
                              </div>

                              <div className="p-3 bg-slate-900/60 rounded-xl text-[10px] space-y-1 border border-white/5">
                                <div><strong className="text-slate-400">Contributor:</strong> {payload.contributorName || payload.name || payload.submittedBy || 'Anonymous'}</div>
                                {payload.relation && <div><strong className="text-slate-400">Relation:</strong> {payload.relation}</div>}
                                {payload.role && <div><strong className="text-slate-400">Role:</strong> {payload.role}</div>}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="p-3 bg-slate-950/80 border-t border-white/5 flex gap-2">
                              <button
                                onClick={() => handleRejectSubmission(item)}
                                className="flex-1 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveSubmission(item)}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                            </div>

                            {isProcessing && (
                              <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ----------------------------------------------------
                  TAB 1.6: PENDING COMMENTS MODERATION
                  ---------------------------------------------------- */}
              {activeTab === 'comments' && (
                <div className="space-y-6 animate-fade-in text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-white/5 gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-amber-400 animate-pulse" />
                        <span>Comment Moderation Console</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Review, approve, or reject visitor comments before they are published live.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                        <span className="text-xs font-bold text-amber-400 font-mono">
                          {pendingComments.length} Pending
                        </span>
                      </div>
                    </div>
                  </div>

                  {pendingComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20 bg-slate-900/40 border border-white/5 rounded-3xl p-8">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
                        <MessageSquare className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider font-display">No Comments Awaiting Moderation</h3>
                      <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                        All comments submitted by visitors have been processed! Keep up the great work.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {pendingComments.map((comment) => {
                        const isProcessing = processingId === comment.id;
                        return (
                          <div 
                            key={comment.id}
                            className="bg-slate-900/60 border border-white/5 hover:border-white/10 rounded-2xl p-5 sm:p-6 transition-all hover:shadow-lg flex flex-col md:flex-row md:items-start justify-between gap-6"
                          >
                            <div className="space-y-3.5 flex-1 min-w-0">
                              {/* Metadata Line */}
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-slate-300 font-mono flex items-center gap-1">
                                  <Users className="w-3 h-3 text-amber-400" />
                                  <span>Contributor: {comment.authorName}</span>
                                </span>
                                <span className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-slate-300 font-mono flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {new Date(comment.submittedAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </span>
                              </div>

                              {/* Target Item Reference */}
                              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex items-center gap-2.5 text-xs">
                                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[9px] font-bold uppercase font-mono tracking-widest">
                                  {comment.mediaType}
                                </span>
                                <span className="text-slate-400 font-semibold truncate flex-1">
                                  Related Memory: <span className="text-white font-bold">{comment.mediaTitle}</span>
                                </span>
                              </div>

                              {/* Comment Content */}
                              <div className="bg-white/[0.02] border border-white/[0.03] rounded-xl p-4">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display mb-1.5">Comment Text</span>
                                <p className="text-xs sm:text-sm text-slate-100 font-medium italic leading-relaxed">
                                  "{comment.text}"
                                </p>
                              </div>
                            </div>

                            {/* Moderator Action Buttons */}
                            <div className="flex flex-row md:flex-col items-stretch gap-2.5 md:w-44 shrink-0 justify-end md:justify-start">
                              <button
                                onClick={() => handleApproveComment(comment)}
                                disabled={isProcessing}
                                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                                ) : (
                                  <Check className="w-4 h-4 text-white" />
                                )}
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleRejectComment(comment)}
                                disabled={isProcessing}
                                className="flex-1 py-2.5 px-4 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600/20 text-rose-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                <X className="w-4 h-4" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ----------------------------------------------------
                  TAB 1.5: COMMUNITY MEMORIES MODERATION
                  ---------------------------------------------------- */}
              {activeTab === 'community_memories' && (() => {
                const EVENT_CATEGORIES = [
                  'Graduation Ceremony',
                  'Sports Day',
                  'Cultural Day',
                  'Prize Giving Day',
                  'Excursion',
                  'Christmas Carol',
                  'Science Fair',
                  'Club Activities',
                  'Other'
                ];

                const countPending = communityMemories.filter(m => m.status === 'Pending').length;
                const countApproved = communityMemories.filter(m => m.status === 'Approved').length;
                const countRejected = communityMemories.filter(m => m.status === 'Rejected').length;
                const countPhotos = communityMemories.filter(m => m.mediaType === 'image').length;
                const countVideos = communityMemories.filter(m => m.mediaType === 'video').length;
                const countRecentlyApproved = communityMemories.filter(m => m.status === 'Approved' && m.approvedDate && (Date.now() - new Date(m.approvedDate).getTime() < 3 * 24 * 60 * 60 * 1000)).length;

                const filteredCommunityMemories = communityMemories.filter((item) => {
                  const matchesStatus = commFilterStatus === 'All' || item.status === commFilterStatus;
                  const matchesCategory = commFilterEvent === 'All' || item.eventCategory === commFilterEvent;
                  const matchesMediaType = commFilterMediaType === 'All' || item.mediaType === commFilterMediaType;
                  
                  const query = commSearchQuery.toLowerCase().trim();
                  const matchesSearch = !query || 
                    (item.title || '').toLowerCase().includes(query) || 
                    (item.caption || '').toLowerCase().includes(query) || 
                    (item.contributorName && item.contributorName.toLowerCase().includes(query)) ||
                    (item.studentName && item.studentName.toLowerCase().includes(query));
                    
                  return matchesStatus && matchesCategory && matchesMediaType && matchesSearch;
                });

                return (
                  <div className="space-y-8" id="community-memories-moderation-tab">
                    
                    {/* Header */}
                    <div className="border-b border-white/5 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-white font-display">Community Memory Submissions</h3>
                        <p className="text-xs text-slate-400 mt-1">Review, authorize, feature, or moderate digital memories contributed by Wisdom Link students, alumni, parents, and teachers.</p>
                      </div>
                    </div>

                    {/* Moderation Statistics Deck */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" id="moderation-stats-grid">
                      
                      {/* Stat 1: Pending */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">Pending Queue</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-black text-amber-400 font-mono">{countPending}</span>
                          <span className="text-[10px] text-amber-400/60 font-semibold uppercase">Pending</span>
                        </div>
                      </div>

                      {/* Stat 2: Approved */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">Approved Memories</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-black text-emerald-400 font-mono">{countApproved}</span>
                          <span className="text-[10px] text-emerald-400/60 font-semibold uppercase">Public</span>
                        </div>
                      </div>

                      {/* Stat 3: Rejected */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">Rejected Queue</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-black text-red-400 font-mono">{countRejected}</span>
                          <span className="text-[10px] text-red-400/60 font-semibold uppercase">Private</span>
                        </div>
                      </div>

                      {/* Stat 4: Photos */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">Total Photos</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-black text-indigo-400 font-mono">{countPhotos}</span>
                          <span className="text-[10px] text-indigo-400/60 font-semibold uppercase">Images</span>
                        </div>
                      </div>

                      {/* Stat 5: Videos */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">Total Videos</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-black text-pink-400 font-mono">{countVideos}</span>
                          <span className="text-[10px] text-pink-400/60 font-semibold uppercase">Videos</span>
                        </div>
                      </div>

                      {/* Stat 6: Recently Approved */}
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-indigo-500/20 transition-colors">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">Recently Approved</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-2xl font-black text-teal-400 font-mono">{countRecentlyApproved}</span>
                          <span className="text-[10px] text-teal-400/60 font-semibold uppercase">Last 3d</span>
                        </div>
                      </div>

                    </div>

                    {/* Filters & Search Engine Panel */}
                    <div className="bg-slate-950/40 border border-white/5 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-4 items-end" id="filters-panel">
                      
                      {/* Search */}
                      <div className="md:col-span-4 space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Search Submission</label>
                        <input
                          type="text"
                          placeholder="Search title, contributor, student name..."
                          value={commSearchQuery}
                          onChange={(e) => setCommSearchQuery(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/5 focus:border-indigo-500 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Filter Status */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Status</label>
                        <select
                          value={commFilterStatus}
                          onChange={(e) => setCommFilterStatus(e.target.value)}
                          className="w-full p-2 rounded-xl bg-slate-950 border border-white/5 focus:border-indigo-500 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="All">All Statuses</option>
                          <option value="Pending">Pending Queue</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>

                      {/* Filter Event Category */}
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Event Category</label>
                        <select
                          value={commFilterEvent}
                          onChange={(e) => setCommFilterEvent(e.target.value)}
                          className="w-full p-2 rounded-xl bg-slate-950 border border-white/5 focus:border-indigo-500 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="All">All Event Categories</option>
                          {EVENT_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter Media Type */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Media Type</label>
                        <select
                          value={commFilterMediaType}
                          onChange={(e) => setCommFilterMediaType(e.target.value)}
                          className="w-full p-2 rounded-xl bg-slate-950 border border-white/5 focus:border-indigo-500 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="All">All Formats</option>
                          <option value="image">Image Only</option>
                          <option value="video">Video Only</option>
                        </select>
                      </div>

                      {/* Clear Button */}
                      <div className="md:col-span-1">
                        <button
                          onClick={() => {
                            setCommFilterStatus('All');
                            setCommFilterEvent('All');
                            setCommFilterMediaType('All');
                            setCommSearchQuery('');
                          }}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-white/5 hover:border-white/10 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-colors cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>

                    </div>

                    {/* Submissions List */}
                    {filteredCommunityMemories.length === 0 ? (
                      <div className="text-center py-20 bg-slate-950/20 rounded-3xl border border-white/5">
                        <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h4 className="text-sm font-bold text-slate-400">No matching submissions found</h4>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search query to locate archives.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="submissions-cards-grid">
                        {filteredCommunityMemories.map((item) => {
                          const isProcessing = processingId === item.id;
                          return (
                            <div 
                              key={item.id} 
                              className={`bg-slate-950/50 border rounded-2xl overflow-hidden shadow-xl flex flex-col relative group transition-all duration-300 ${
                                item.featured ? 'border-amber-500/35 shadow-amber-500/5' : 'border-white/5 hover:border-white/10'
                              }`}
                            >
                              
                              {/* Thumbnail preview zone */}
                              <div className="h-48 bg-slate-950 relative overflow-hidden flex items-center justify-center group/preview">
                                {item.mediaType === 'video' ? (
                                  <div className="w-full h-full relative">
                                    <video src={item.mediaUrl} className="w-full h-full object-cover opacity-60" muted />
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
                                      <div className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white shadow-xl group-hover/preview:scale-110 transition-transform">
                                        <Film className="w-6 h-6 text-pink-400" />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <img 
                                    src={item.mediaUrl} 
                                    alt={item.title} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                  />
                                )}

                                {/* Hover preview overlay action */}
                                <button
                                  onClick={() => {
                                    setPreviewMediaUrl(item.mediaUrl);
                                    setPreviewMediaType(item.mediaType);
                                  }}
                                  className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center text-xs font-bold uppercase tracking-wider text-white transition-opacity duration-300 cursor-pointer"
                                >
                                  Click to Expand View
                                </button>

                                {/* Badges */}
                                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
                                  {/* Status badge */}
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-md ${
                                    item.status === 'Pending' 
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                      : item.status === 'Approved'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                  }`}>
                                    {item.status}
                                  </span>

                                  {/* Featured badge */}
                                  {item.featured && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500 text-slate-950 border border-amber-400 shadow-md flex items-center gap-1">
                                      ★ Featured
                                    </span>
                                  )}
                                </div>

                                {/* Event Category badge (bottom left) */}
                                <div className="absolute bottom-3 left-3 pointer-events-none">
                                  <span className="text-[9px] px-2.5 py-0.5 bg-slate-900/80 backdrop-blur border border-white/10 text-slate-300 rounded-lg font-semibold uppercase tracking-wider">
                                    {item.eventCategory}
                                  </span>
                                </div>
                              </div>

                              {/* Card Content body */}
                              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-xs font-bold text-white tracking-tight line-clamp-1">
                                      {item.title}
                                    </h4>
                                    <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                      {new Date(item.uploadDate).toLocaleDateString()}
                                    </span>
                                  </div>
                                  
                                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                                    {item.caption}
                                  </p>

                                  {item.status === 'Rejected' && item.rejectionReason && (
                                    <div className="p-2.5 bg-red-950/20 border border-red-500/10 rounded-xl text-[10px] text-red-300 mt-2 leading-relaxed">
                                      <strong>Rejection Reason:</strong> {item.rejectionReason}
                                    </div>
                                  )}
                                </div>

                                {/* Metadata fields */}
                                <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl text-[10px] space-y-1 text-slate-400 font-medium">
                                  <div className="flex justify-between">
                                    <span>Contributor:</span>
                                    <strong className="text-slate-200">{item.contributorName || 'Anonymous'}</strong>
                                  </div>
                                  {item.studentName && item.studentName !== 'N/A' && (
                                    <div className="flex justify-between">
                                      <span>Associated Student:</span>
                                      <strong className="text-slate-200">{item.studentName}</strong>
                                    </div>
                                  )}
                                  {item.className && item.className !== 'N/A' && (
                                    <div className="flex justify-between">
                                      <span>Class / Set:</span>
                                      <strong className="text-slate-200">{item.className}</strong>
                                    </div>
                                  )}
                                </div>

                                {/* Administrative Actions Row */}
                                <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                                  
                                  {/* Approve Action */}
                                  {item.status !== 'Approved' && (
                                    <button
                                      onClick={() => handleApproveCommMemory(item)}
                                      disabled={isProcessing}
                                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                  )}

                                  {/* Reject Trigger */}
                                  {item.status === 'Pending' && (
                                    <button
                                      onClick={() => setRejectingCommId(item.id)}
                                      disabled={isProcessing}
                                      className="flex-1 py-1.5 bg-slate-900 border border-red-500/25 text-red-400 hover:bg-red-500/10 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  )}

                                  {/* Feature toggle */}
                                  {item.status === 'Approved' && (
                                    <button
                                      onClick={() => handleToggleFeatureCommMemory(item)}
                                      disabled={isProcessing}
                                      className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                                        item.featured 
                                          ? 'border-amber-500 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' 
                                          : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                                      }`}
                                      title={item.featured ? "Remove from Featured" : "Mark as Featured"}
                                    >
                                      ★ Feature
                                    </button>
                                  )}

                                  {/* Edit handler */}
                                  <button
                                    onClick={() => handleStartEditCommMemory(item)}
                                    disabled={isProcessing}
                                    className="px-2.5 py-1.5 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                                    title="Edit Metadata"
                                  >
                                    Edit
                                  </button>

                                  {/* Delete permanently */}
                                  <button
                                    onClick={() => handleDeleteCommMemory(item.id, item.mediaUrl)}
                                    disabled={isProcessing}
                                    className="px-2 py-1.5 bg-red-950/20 hover:bg-red-950/50 text-red-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all ml-auto shrink-0 border border-red-500/10"
                                    title="Delete Permanently"
                                  >
                                    Delete
                                  </button>

                                </div>

                              </div>

                              {/* Progress loader */}
                              {isProcessing && (
                                <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center z-10">
                                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                </div>
                              )}

                            </div>
                          );
                        })}
                      </div>
                    )}



                    {/* MODAL OVERLAY 2: METADATA EDIT OVERLAY */}
                    {editingCommMemory && (
                      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <form onSubmit={handleSaveCommMemoryEdit} className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl text-left space-y-4">
                          <h4 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                            Edit Submission Details
                          </h4>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Title</label>
                            <input
                              type="text"
                              required
                              value={editCommTitle}
                              onChange={(e) => setEditCommTitle(e.target.value)}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Caption</label>
                            <textarea
                              rows={3}
                              required
                              value={editCommCaption}
                              onChange={(e) => setEditCommCaption(e.target.value)}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 text-white focus:outline-none focus:border-indigo-500 resize-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Event Category</label>
                            <select
                              value={editCommCategory}
                              onChange={(e) => setEditCommCategory(e.target.value)}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 text-slate-300 focus:outline-none focus:border-indigo-500"
                            >
                              {EVENT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex gap-2 justify-end pt-3">
                            <button
                              type="button"
                              onClick={() => setEditingCommMemory(null)}
                              className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Save Changes
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* MODAL OVERLAY 3: MEDIA EXPAND PREVIEW LIGHTBOX */}
                    {previewMediaUrl && (
                      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                        <button
                          onClick={() => {
                            setPreviewMediaUrl(null);
                            setPreviewMediaType(null);
                          }}
                          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        
                        <div className="max-w-4xl max-h-[80vh] w-full h-full flex items-center justify-center">
                          {previewMediaType === 'video' ? (
                            <video src={previewMediaUrl} className="max-w-full max-h-full rounded-2xl shadow-2xl border border-white/10" controls autoPlay />
                          ) : (
                            <img src={previewMediaUrl} alt="expanded visual memory" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" />
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}



              {/* ----------------------------------------------------
                  TAB 3: CUSTOM SECTIONS
                  ---------------------------------------------------- */}
              {activeTab === 'custom_sections' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Form */}
                  <div className="lg:col-span-1 bg-slate-950/40 border border-white/5 p-6 rounded-2xl h-fit space-y-5">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {editingSection ? 'Modify Layout Section' : 'Create Layout Section'}
                    </h3>

                    <form onSubmit={handleSaveSection} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Section Header Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Science Fair Highlights"
                          value={sectionForm.title}
                          onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Section Paragraph narrative</label>
                        <textarea
                          rows={4}
                          required
                          placeholder="Celebrate milestones, describe achievements or announcements..."
                          value={sectionForm.subtext}
                          onChange={(e) => setSectionForm({ ...sectionForm, subtext: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Layout Preset Selector</label>
                          <select
                            value={sectionForm.layoutType}
                            onChange={(e) => setSectionForm({ ...sectionForm, layoutType: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          >
                            <option value="standard">Standard Card (Alternating Split)</option>
                            <option value="spotlight">Focus Spotlight (Sleek Dark Glow)</option>
                            <option value="announcement">Headline Alert Notice</option>
                            <option value="birthday">🎉 Birthday Celebration Card</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Order Index priority</label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={sectionForm.orderIndex}
                            onChange={(e) => setSectionForm({ ...sectionForm, orderIndex: Number(e.target.value) })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-white/5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Media Attachment Type</label>
                        <div className="flex gap-2 p-0.5 bg-slate-950 rounded-lg border border-white/5">
                          {(['none', 'image', 'video'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSectionForm({ ...sectionForm, mediaType: t })}
                              className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-colors cursor-pointer ${
                                sectionForm.mediaType === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {sectionForm.mediaType !== 'none' && (
                        <div className="space-y-2 pt-2 animate-in fade-in duration-300">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Media URL / Upload</label>
                          <input
                            type="url"
                            placeholder="https://images.unsplash.com/... or upload below"
                            value={sectionForm.mediaUrl}
                            onChange={(e) => setSectionForm({ ...sectionForm, mediaUrl: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <label className="flex-1 py-2 bg-slate-900 border border-dashed border-white/15 hover:border-white/35 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                              <input
                                type="file"
                                accept={sectionForm.mediaType === 'image' ? "image/*" : "video/*"}
                                onChange={(e) => handleGenericUpload(e, setSectionUploading, (url) => setSectionForm({ ...sectionForm, mediaUrl: url }), sectionForm.mediaType)}
                                className="hidden"
                              />
                              <span>Upload file to Cloud</span>
                            </label>
                            {sectionUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        {editingSection && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSection(null);
                              setSectionForm({ title: '', subtext: '', mediaUrl: '', mediaType: 'none', orderIndex: customSections.length + 1, layoutType: 'standard' });
                            }}
                            className="flex-1 py-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={savingSection}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1"
                        >
                          {savingSection && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{editingSection ? 'Apply Changes' : 'Publish Section'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* List */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4">Deployed Custom Sections ({customSections.length})</h3>

                      <div className="space-y-3">
                        {customSections.map((sect) => (
                          <div key={sect.id} className="p-4 bg-slate-950/80 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                            <div className="min-w-0 text-left space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] px-1.5 py-0.5 rounded uppercase font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Index #{sect.orderIndex}</span>
                                <span className="text-[8px] px-1.5 py-0.5 rounded uppercase font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">{sect.layoutType || 'standard'}</span>
                              </div>
                              <h4 className="text-xs font-bold text-white">{sect.title}</h4>
                              <p className="text-[10px] text-slate-500 truncate">{sect.subtext}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => handleEditSection(sect)} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors cursor-pointer" title="Edit section layout"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteSection(sect.id, sect.mediaUrl)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer" title="Delete section"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------
                  TAB 4: TIMELINE EVENTS
                  ---------------------------------------------------- */}
              {activeTab === 'timeline' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Form */}
                  <div className="lg:col-span-1 bg-slate-950/40 border border-white/5 p-6 rounded-2xl h-fit space-y-5">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {editingEvent ? 'Modify Timeline Event' : 'Create Timeline Event'}
                    </h3>

                    <form onSubmit={handleSaveTimeline} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Chronological Date</label>
                        <input
                          type="date"
                          required
                          value={eventForm.date}
                          onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Event Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sports Day Championship Relay"
                          value={eventForm.title}
                          onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Event Narrative Description</label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Describe what occurred, who won, or noteworthy occurrences..."
                          value={eventForm.description}
                          onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Event Image</label>
                        <input
                          type="url"
                          placeholder="https://images.unsplash.com/... or upload"
                          value={eventForm.image}
                          onChange={(e) => setEventForm({ ...eventForm, image: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <label className="flex-1 py-2 bg-slate-900 border border-dashed border-white/15 hover:border-white/35 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleGenericUpload(e, setEventUploading, (url) => setEventForm({ ...eventForm, image: url }))}
                              className="hidden"
                            />
                            <span>Upload Image</span>
                          </label>
                          {eventUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {editingEvent && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(null);
                              setEventForm({ date: '', title: '', description: '', image: '' });
                            }}
                            className="flex-1 py-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={savingEvent}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1"
                        >
                          {savingEvent && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{editingEvent ? 'Apply Changes' : 'Add Milestone'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* List */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4">Milestone Chronology History ({timelineEvents.length})</h3>

                      <div className="space-y-3">
                        {timelineEvents.map((evt) => (
                          <div key={evt.id} className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <img src={evt.image} alt="timeline" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/5" />
                              <div className="min-w-0 text-left">
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold">{evt.date}</span>
                                <h4 className="text-xs font-bold text-white mt-1">{evt.title}</h4>
                                <p className="text-[10px] text-slate-500 truncate">{evt.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleOpenChangeThumbnail({
                                  type: 'milestone',
                                  id: evt.id,
                                  title: evt.title,
                                  currentThumbnail: evt.image,
                                  itemData: evt
                                })}
                                className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                title="Change Cover Thumbnail"
                              >
                                <Camera className="w-3 h-3" />
                                <span>Change Thumbnail</span>
                              </button>
                              <button onClick={() => {
                                setEditingEvent(evt);
                                setEventForm({ date: evt.date, title: evt.title, description: evt.description, image: evt.image });
                              }} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors cursor-pointer" title="Edit timeline"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteTimeline(evt.id, evt.image)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer" title="Delete timeline"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------
                  TAB 5: REELS & VIDEOS
                  ---------------------------------------------------- */}
              {activeTab === 'videos' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Form */}
                  <div className="lg:col-span-1 bg-slate-950/40 border border-white/5 p-6 rounded-2xl h-fit space-y-5">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                      {editingVideo ? 'Modify Video Record' : 'Upload Video Memory'}
                    </h3>

                    <form onSubmit={handleSaveVideo} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Video / Clip Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Senior Prank compilation or Carol Recital"
                          value={videoForm.title}
                          onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Uploader Name</label>
                          <input
                            type="text"
                            required
                            placeholder="Liam Mercer"
                            value={videoForm.submittedBy}
                            onChange={(e) => setVideoForm({ ...videoForm, submittedBy: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Role / Relation</label>
                          <select
                            value={videoForm.role}
                            onChange={(e) => setVideoForm({ ...videoForm, role: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          >
                            <option value="Student">Student</option>
                            <option value="Parent">Parent</option>
                            <option value="Teacher">Teacher</option>
                            <option value="Alumni">Alumni</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Video Storage URL / file upload</label>
                        <input
                          type="url"
                          placeholder="https://res.cloudinary.com/...mp4 or upload"
                          value={videoForm.url}
                          onChange={(e) => setVideoForm({ ...videoForm, url: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <label className="flex-1 py-2 bg-slate-900 border border-dashed border-white/15 hover:border-white/35 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                            <input
                              type="file"
                              accept="video/*"
                              onChange={(e) => handleGenericUpload(e, setVideoUploading, (url) => setVideoForm({ ...videoForm, url }), 'video')}
                              className="hidden"
                            />
                            <span>Upload Video MP4</span>
                          </label>
                          {videoUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {editingVideo && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVideo(null);
                              setVideoForm({ title: '', submittedBy: '', role: 'Student', url: '' });
                            }}
                            className="flex-1 py-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={savingVideo}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1"
                        >
                          {savingVideo && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{editingVideo ? 'Apply Changes' : 'Publish Video'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* List */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4">Interactive Video Reels ({videos.length})</h3>

                      <div className="space-y-3">
                        {videos.map((vid) => (
                          <div key={vid.id} className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                            <div className="min-w-0 text-left">
                              <h4 className="text-xs font-bold text-white">{vid.title}</h4>
                              <p className="text-[10px] text-slate-500">By: {vid.submittedBy} ({vid.role}) | {new Date(vid.uploadedAt).toLocaleDateString()}</p>
                              <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">{vid.url}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleOpenChangeThumbnail({
                                  type: 'video',
                                  id: vid.id,
                                  title: vid.title,
                                  currentThumbnail: vid.thumbnailUrl || vid.url || '',
                                  itemData: vid
                                })}
                                className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                title="Change Video Thumbnail"
                              >
                                <Camera className="w-3 h-3" />
                                <span>Change Thumbnail</span>
                              </button>
                              <button onClick={() => {
                                setEditingVideo(vid);
                                setVideoForm({ title: vid.title, submittedBy: vid.submittedBy, role: vid.role, url: vid.url });
                              }} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors cursor-pointer" title="Edit video"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteVideo(vid.id, vid.url)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer" title="Delete video"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------
                  TAB 6: TRIBUTES & ACCOLADES
                  ---------------------------------------------------- */}
              {activeTab === 'tributes' && (
                <div className="space-y-8">
                  
                  {/* School Principal Profile Configuration */}
                  <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-6">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span>Configure School Principal Profile</span>
                    </h3>

                    <form onSubmit={handleSavePrincipal} className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
                      {/* Inputs Column */}
                      <div className="md:col-span-7 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Principal Full Name</label>
                            <input
                              type="text"
                              required
                              value={principalForm.name}
                              onChange={(e) => setPrincipalForm({ ...principalForm, name: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Position Title</label>
                            <input
                              type="text"
                              required
                              value={principalForm.title}
                              onChange={(e) => setPrincipalForm({ ...principalForm, title: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Portrait Photo URL</label>
                            <input
                              type="url"
                              required
                              value={principalForm.image}
                              onChange={(e) => setPrincipalForm({ ...principalForm, image: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2 mt-1.5">
                              <label className="flex-1 py-1.5 bg-slate-900 border border-dashed border-white/10 hover:border-white/30 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGenericUpload(e, setPrincipalUploading, (url) => setPrincipalForm({ ...principalForm, image: url }))}
                                  className="hidden"
                                />
                                <span>Upload portrait</span>
                              </label>
                              {principalUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Years of Service (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. 15 Years"
                              value={principalForm.yearsOfService}
                              onChange={(e) => setPrincipalForm({ ...principalForm, yearsOfService: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Welcome Message & Vision Statement</label>
                          <textarea
                            rows={3}
                            required
                            value={principalForm.welcomeMessage}
                            onChange={(e) => setPrincipalForm({ ...principalForm, welcomeMessage: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={savingPrincipal}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow disabled:opacity-55"
                        >
                          {savingPrincipal ? 'Saving...' : 'Save Principal Profile'}
                        </button>
                      </div>

                      {/* Live Preview Column */}
                      <div className="md:col-span-5 bg-slate-900/60 p-4.5 rounded-2xl border border-white/5 flex flex-col justify-between">
                        <div className="space-y-3">
                          <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">Live Portal Preview</span>
                          <div className="flex items-center gap-3 border-b border-white/5 pb-3 text-left">
                            <img src={principalForm.image || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=200'} alt="preview" className="w-12 h-16 object-contain rounded-lg border border-white/10 shrink-0 bg-slate-950 p-0.5" />
                            <div className="min-w-0">
                              <h4 className="text-xs font-extrabold text-white truncate">{principalForm.name || 'Unspecified Name'}</h4>
                              <p className="text-[10px] text-slate-400 truncate">{principalForm.title || 'Unspecified Title'}</p>
                              {principalForm.yearsOfService && (
                                <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold tracking-wider mt-1 inline-block uppercase">
                                  {principalForm.yearsOfService} Service
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-300 italic line-clamp-3 leading-relaxed text-left">
                            "{principalForm.welcomeMessage || 'No vision statement entered yet.'}"
                          </p>
                        </div>
                        <span className="text-[8px] text-slate-500 font-mono tracking-widest uppercase block mt-3 text-left">Verified Real-time Connection</span>
                      </div>
                    </form>
                  </div>

                  {/* Superlatives Segment */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Superlative Form */}
                    <div className="lg:col-span-1 bg-slate-950/40 border border-white/5 p-6 rounded-2xl h-fit space-y-5">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-1">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>{editingSuperlative ? 'Modify Superlative' : 'Add Superlative Accolade'}</span>
                      </h3>

                      <form onSubmit={handleSaveSuperlative} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Award Category</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Most Likely to Succeed"
                            value={superlativeForm.category}
                            onChange={(e) => setSuperlativeForm({ ...superlativeForm, category: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Description / Rationale</label>
                          <textarea
                            rows={2}
                            placeholder="For stellar technological innovations..."
                            value={superlativeForm.description}
                            onChange={(e) => setSuperlativeForm({ ...superlativeForm, description: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Awardee Name</label>
                          <input
                            type="text"
                            required
                            placeholder="Sarah Andrews"
                            value={superlativeForm.studentName}
                            onChange={(e) => setSuperlativeForm({ ...superlativeForm, studentName: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Awardee Portrait image</label>
                          <input
                            type="url"
                            placeholder="https://images.unsplash.com/... or upload"
                            value={superlativeForm.studentImage}
                            onChange={(e) => setSuperlativeForm({ ...superlativeForm, studentImage: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <label className="flex-1 py-2 bg-slate-900 border border-dashed border-white/15 hover:border-white/35 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleGenericUpload(e, setSuperlativeUploading, (url) => setSuperlativeForm({ ...superlativeForm, studentImage: url }))}
                                className="hidden"
                              />
                              <span>Upload Photo</span>
                            </label>
                            {superlativeUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={savingSuperlative}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                        >
                          {editingSuperlative ? 'Apply changes' : 'Assign Superlative'}
                        </button>
                      </form>
                    </div>

                    {/* Superlative List */}
                    <div className="lg:col-span-2 bg-slate-950/40 border border-white/5 p-6 rounded-2xl">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4">Class Superlatives ({superlatives.length})</h3>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {superlatives.map((sup) => (
                          <div key={sup.id} className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img src={sup.studentImage} alt={sup.studentName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/5" />
                              <div className="text-left">
                                <h4 className="text-xs font-bold text-amber-400">{sup.category}</h4>
                                <p className="text-[10px] text-slate-300">Awarded to: {sup.studentName}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => {
                                setEditingSuperlative(sup);
                                setSuperlativeForm({ category: sup.category, description: sup.description, studentName: sup.studentName, studentImage: sup.studentImage });
                              }} className="p-1.5 hover:bg-indigo-500/20 text-indigo-400 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteSuperlative(sup.id, sup.studentImage)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Teacher Tributes Segment */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Teacher Tributes Form */}
                    <div className="lg:col-span-1 bg-slate-950/40 border border-white/5 p-6 rounded-2xl h-fit space-y-5">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-1">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span>{editingTribute ? 'Modify Tribute' : 'Add Teacher Tribute'}</span>
                      </h3>

                      <form onSubmit={handleSaveTribute} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Teacher Name</label>
                          <input
                            type="text"
                            required
                            placeholder="Dr. Elizabeth Sterling"
                            value={tributeForm.name}
                            onChange={(e) => setTributeForm({ ...tributeForm, name: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Subject taught / Title</label>
                          <input
                            type="text"
                            required
                            placeholder="Ecology & Physics"
                            value={tributeForm.subject}
                            onChange={(e) => setTributeForm({ ...tributeForm, subject: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Teacher Portrait Image</label>
                          <input
                            type="url"
                            placeholder="https://images.unsplash.com/... or upload"
                            value={tributeForm.image}
                            onChange={(e) => setTributeForm({ ...tributeForm, image: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <label className="flex-1 py-2 bg-slate-900 border border-dashed border-white/15 hover:border-white/35 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleGenericUpload(e, setTributeUploading, (url) => setTributeForm({ ...tributeForm, image: url }))}
                                className="hidden"
                              />
                              <span>Upload file</span>
                            </label>
                            {tributeUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tribute / Message Body</label>
                          <textarea
                            rows={3}
                            required
                            placeholder="Never lose your wonder of how things work..."
                            value={tributeForm.message}
                            onChange={(e) => setTributeForm({ ...tributeForm, message: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1 pb-2 text-left">
                          <input
                            type="checkbox"
                            id="teacher-featured-admin"
                            checked={tributeForm.featured || false}
                            onChange={(e) => setTributeForm({ ...tributeForm, featured: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/10 cursor-pointer"
                          />
                          <label htmlFor="teacher-featured-admin" className="text-[10px] font-bold text-slate-300 cursor-pointer uppercase tracking-wider select-none">
                            Feature selected teacher on Homepage
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={savingTribute}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                        >
                          {editingTribute ? 'Apply changes' : 'Publish Tribute'}
                        </button>
                      </form>
                    </div>

                    {/* Teacher Tribute List */}
                    <div className="lg:col-span-2 bg-slate-950/40 border border-white/5 p-6 rounded-2xl">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4">Teacher Tributes ({teacherTributes.length})</h3>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {teacherTributes.map((tt) => (
                          <div key={tt.id} className="p-3 bg-slate-950/80 border border-white/5 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img src={tt.image} alt={tt.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/5" />
                              <div className="text-left">
                                <h4 className="text-xs font-bold text-emerald-400">{tt.name}</h4>
                                <p className="text-[10px] text-slate-300">Subject: {tt.subject}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => {
                                setEditingTribute(tt);
                                setTributeForm({ name: tt.name, subject: tt.subject, image: tt.image, message: tt.message, featured: tt.featured === true || tt.featured === 'true' });
                              }} className="p-1.5 hover:bg-indigo-500/20 text-indigo-400 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteTribute(tt.id, tt.image)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ----------------------------------------------------
                  TAB 7: BRAND & ADMINS
                  ---------------------------------------------------- */}
              {activeTab === 'admins' && (
                <div className="space-y-8">
                  
                  {/* Alert banner configuration */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-5">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">Celebration Ticker Banner</h3>

                      <form onSubmit={handleSaveBannerConfig} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ticker State</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={bannerActive} 
                              onChange={(e) => setBannerActive(e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            <span className="ml-2 text-xs font-bold text-slate-300 uppercase">
                              {bannerActive ? 'Active' : 'Disabled'}
                            </span>
                          </label>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Banner Text Content</label>
                          <textarea
                            rows={3}
                            placeholder="🎉 Congratulations Class of 2026! 🎉"
                            value={bannerText}
                            onChange={(e) => setBannerText(e.target.value)}
                            required
                            className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={savingBanner}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                        >
                          {savingBanner ? 'Saving...' : 'Deploy Banner Alert'}
                        </button>
                      </form>
                    </div>

                    {/* Logo & School identity branding */}
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-5">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">Official Brand Seal Logo</h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Logo Seal</label>
                          {logoUrlInput ? (
                            <div className="flex items-center gap-3 p-3 bg-slate-950 border border-white/5 rounded-xl">
                              <img src={logoUrlInput} alt="branding" className="w-10 h-10 object-contain bg-white rounded border p-1" />
                              <div className="min-w-0 flex-1 text-left">
                                <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Verified Custom Logo</span>
                                <span className="text-[10px] text-slate-500 block truncate mt-1">{logoUrlInput}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-950/40 rounded-xl text-xs text-slate-500 text-center border border-dashed border-white/5">
                              No custom brand logo configured. Default graduation cap emblem used in site headers.
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Upload New Official Brand Seal</label>
                          <div className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-white/30 rounded-xl p-6 bg-slate-950/50 cursor-pointer relative group">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              disabled={logoUploading}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <UploadCloud className="w-7 h-7 text-slate-500 mb-1 group-hover:scale-105 transition-all" />
                            <p className="text-xs font-bold text-slate-300">Click to upload official logo image</p>
                          </div>
                          {logoUploading && <div className="text-xs text-amber-400 animate-pulse text-center">Uploading new brand logo asset...</div>}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Secondary administrator accounts panel */}
                  <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-6">
                    <div className="border-b border-white/5 pb-2">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Secondary Administrator Directory</h3>
                      <p className="text-xs text-slate-500 mt-1">Enroll or revoke security credentials of co-administrators. The primary administrator email is immutable.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Form */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">Enroll New Administrator</h4>
                        
                        <form onSubmit={handleAddAdmin} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Registered Google Email Account</label>
                            <input
                              type="email"
                              required
                              placeholder="co-admin@gmail.com"
                              value={newAdminEmail}
                              onChange={(e) => setNewAdminEmail(e.target.value)}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={savingAdmin}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                          >
                            {savingAdmin ? 'Enrolling...' : 'Grant Security Clearance'}
                          </button>
                        </form>
                      </div>

                      {/* Directory */}
                      <div className="space-y-3 max-h-[350px] overflow-y-auto">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest text-left">Clearance Roster</h4>
                        
                        {/* Always display the hardcoded immutable ones */}
                        <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl flex items-center justify-between text-left">
                          <div>
                            <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Primary Admin</span>
                            <span className="text-xs font-semibold text-white block mt-1">{IMMUTABLE_ADMIN_EMAIL}</span>
                            <span className="text-[9px] text-indigo-400 font-medium block mt-0.5">Immutable System Guardian (Protected)</span>
                          </div>
                        </div>

                        {adminsList.map((admin) => {
                          if (admin.email === IMMUTABLE_ADMIN_EMAIL) return null;
                          return (
                            <div key={admin.email} className="p-3 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-between text-left">
                              <div className="min-w-0">
                                <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Secondary</span>
                                <span className="text-xs font-semibold text-white block mt-1 truncate">{admin.email}</span>
                                <span className="text-[9px] text-slate-500 block mt-0.5">Clearance: {new Date(admin.addedAt).toLocaleDateString()}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteAdmin(admin.email)}
                                className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer"
                                title="Revoke access"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ----------------------------------------------------
                  TAB 8: WEBSITE CONTENT MANAGEMENT (CMS)
                  ---------------------------------------------------- */}
              {activeTab === 'website_content' && (
                <div className="space-y-8">
                  {/* Tab Header Banner */}
                  <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-left">
                    <div>
                      <h2 className="text-lg font-black text-white flex items-center gap-2">
                        <Layout className="w-5 h-5 text-indigo-400 animate-pulse" />
                        <span>Website Content Management System (CMS)</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Configure official default school assets, images, and texts. This system manages website-owned content only. Parent submissions are reviewed under the Tributes or Gallery moderation queues.
                      </p>
                    </div>
                  </div>

                  {/* Horizontal pill navigation */}
                  <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
                    {[
                      { id: 'hero', label: 'Hero Slideshow', icon: Play },
                      { id: 'principal', label: 'Principal Message', icon: Award },
                      { id: 'teachers', label: 'Teachers Roster', icon: Users },
                      { id: 'history', label: 'School History', icon: History },
                      { id: 'events', label: 'Featured Events', icon: Calendar },
                      { id: 'footer', label: 'Footer Settings', icon: Info },
                      { id: 'branding', label: 'Identity & Banner', icon: Image },
                      { id: 'graduation_ceremony', label: 'Graduation Ceremony', icon: Camera },
                      { id: 'graduates', label: 'Graduates of the Year', icon: Award },
                    ].map((sub) => {
                      const isSubActive = cmsSubTab === sub.id;
                      const IconComponent = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setCmsSubTab(sub.id as any)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            isSubActive
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-850 hover:text-white border border-white/5'
                          }`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: HERO SLIDER
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'hero' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                      {/* Left: Add / Edit Slide Form */}
                      <div className="lg:col-span-5 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-5">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                          {heroSlideForm.id ? 'Edit Hero Slide' : 'Add New Hero Slide'}
                        </h3>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!heroSlideForm.url) {
                              triggerFeedback('error', 'Please upload or specify a background image.');
                              return;
                            }
                            let updated: any[] = [];
                            if (heroSlideForm.id) {
                              // Edit existing
                              updated = heroSlides.map(s => s.id === heroSlideForm.id ? heroSlideForm : s);
                              triggerFeedback('success', 'Hero slide modified in stack.');
                            } else {
                              // Add new
                              const newSlide = {
                                id: `slide-${Date.now()}`,
                                url: heroSlideForm.url,
                                label: heroSlideForm.label.trim() || 'School Memory Milestone',
                                desc: heroSlideForm.desc.trim() || 'Unlocking character and academic growth.',
                                date: heroSlideForm.date.trim() || 'Class of 2026'
                              };
                              updated = [...heroSlides, newSlide];
                            }
                            await handleSaveHeroSlides(updated);
                            setHeroSlideForm({ id: '', url: '', label: '', desc: '', date: '' });
                          }}
                          className="space-y-4"
                        >
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Slide Cover Image</label>
                            {heroSlideForm.url ? (
                              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-white/10 group mb-2 bg-slate-950">
                                <img src={heroSlideForm.url} alt="hero preview" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setHeroSlideForm({ ...heroSlideForm, url: '' })}
                                  className="absolute top-2.5 right-2.5 p-1.5 bg-red-600/95 hover:bg-red-500 rounded-lg text-white transition-colors"
                                  title="Remove image"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-white/30 rounded-xl p-8 bg-slate-950/50 cursor-pointer relative group">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGenericUpload(e, setHeroUploading, (url) => setHeroSlideForm({ ...heroSlideForm, url }))}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:scale-105 transition-all" />
                                <p className="text-xs font-bold text-slate-300">Drag or click to upload slide image</p>
                                <p className="text-[10px] text-slate-500 mt-1">Recommended: 1920x1080px (Landscape)</p>
                              </div>
                            )}
                            {heroUploading && <div className="text-xs text-amber-400 animate-pulse text-center">Uploading image to secure Cloudinary storage...</div>}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Slide Label (Title)</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g., The Triumphant Cap Toss"
                              value={heroSlideForm.label}
                              onChange={(e) => setHeroSlideForm({ ...heroSlideForm, label: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Date or Term Caption</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g., June 18, 2026 or Autumn 2025"
                              value={heroSlideForm.date}
                              onChange={(e) => setHeroSlideForm({ ...heroSlideForm, date: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Slide Subtitle (Description)</label>
                            <textarea
                              rows={3}
                              required
                              placeholder="Describe this milestone context..."
                              value={heroSlideForm.desc}
                              onChange={(e) => setHeroSlideForm({ ...heroSlideForm, desc: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={savingHero}
                              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow disabled:opacity-55"
                            >
                              {savingHero ? 'Saving config...' : heroSlideForm.id ? 'Modify Slide' : 'Add to Slideshow'}
                            </button>
                            {heroSlideForm.url && (
                              <button
                                type="button"
                                onClick={() => setHeroSlideForm({ id: '', url: '', label: '', desc: '', date: '' })}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </form>
                      </div>

                      {/* Right: Slides Roster & Reordering */}
                      <div className="lg:col-span-7 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                            Slides Stack ({heroSlides.length})
                          </h3>
                          <span className="text-[10px] text-indigo-400 font-bold uppercase font-mono bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                            Unlimited Slides Supported
                          </span>
                        </div>

                        {heroSlides.length === 0 ? (
                          <div className="py-16 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
                            No custom slideshow configured. The default high-quality Unsplash image slides are being shown.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                            {heroSlides.map((slide, index) => (
                              <div
                                key={slide.id}
                                className="p-3 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-between gap-4 text-left group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={slide.url}
                                    alt={slide.label}
                                    className="w-16 aspect-[16/10] object-cover rounded border border-white/10 bg-slate-900 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-extrabold text-white truncate">{slide.label}</h4>
                                    <span className="text-[9px] font-mono font-medium text-slate-400 block mt-0.5">{slide.date}</span>
                                    <p className="text-[10px] text-slate-500 truncate line-clamp-1 mt-1">{slide.desc}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Up / Down reordering buttons */}
                                  <button
                                    onClick={() => handleMoveSlide(index, 'up')}
                                    disabled={index === 0}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 hover:text-white rounded text-slate-400 disabled:opacity-25"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveSlide(index, 'down')}
                                    disabled={index === heroSlides.length - 1}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 hover:text-white rounded text-slate-400 disabled:opacity-25"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleStartEditSlide(slide)}
                                    className="p-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded transition-colors"
                                    title="Edit details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHeroSlide(slide.id, slide.url)}
                                    className="p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded transition-colors"
                                    title="Delete slide"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: PRINCIPAL MESSAGE
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'principal' && (
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-6 text-left">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span>Manage School Principal Profile Message</span>
                      </h3>

                      <form onSubmit={handleSavePrincipal} className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
                        {/* Inputs Column */}
                        <div className="md:col-span-7 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Principal Full Name</label>
                              <input
                                type="text"
                                required
                                value={principalForm.name}
                                onChange={(e) => setPrincipalForm({ ...principalForm, name: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Position Title</label>
                              <input
                                type="text"
                                required
                                value={principalForm.title}
                                onChange={(e) => setPrincipalForm({ ...principalForm, title: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Portrait Photo URL</label>
                              <input
                                type="url"
                                required
                                value={principalForm.image}
                                onChange={(e) => setPrincipalForm({ ...principalForm, image: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                              <div className="flex items-center gap-2 mt-1.5">
                                <label className="flex-1 py-1.5 bg-slate-900 border border-dashed border-white/10 hover:border-white/30 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleGenericUpload(e, setPrincipalUploading, (url) => setPrincipalForm({ ...principalForm, image: url }))}
                                    className="hidden"
                                  />
                                  <span>Upload custom portrait</span>
                                </label>
                                {principalUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                                {principalForm.image && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const old = principalForm.image;
                                      setPrincipalForm({ ...principalForm, image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=800' });
                                      triggerFeedback('success', "Portrait reset to default.");
                                      if (old && old.includes("cloudinary.com")) {
                                        fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: old }) }).catch(() => {});
                                      }
                                    }}
                                    className="p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-[9px] font-bold uppercase tracking-widest cursor-pointer"
                                    title="Reset photo"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Years of Service (Optional)</label>
                              <input
                                type="text"
                                placeholder="e.g. 15 Years"
                                value={principalForm.yearsOfService}
                                onChange={(e) => setPrincipalForm({ ...principalForm, yearsOfService: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Welcome Message & Vision Statement</label>
                            <textarea
                              rows={5}
                              required
                              value={principalForm.welcomeMessage}
                              onChange={(e) => setPrincipalForm({ ...principalForm, welcomeMessage: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={savingPrincipal}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow disabled:opacity-55"
                          >
                            {savingPrincipal ? 'Saving Message...' : 'Publish Principal Profile'}
                          </button>
                        </div>

                        {/* Live Preview Column */}
                        <div className="md:col-span-5 bg-slate-900/60 p-4.5 rounded-2xl border border-white/5 flex flex-col justify-between">
                          <div className="space-y-3">
                            <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">Live Website Principal Preview</span>
                            <div className="flex items-center gap-3 border-b border-white/5 pb-3 text-left">
                              <img src={principalForm.image} alt="preview" className="w-12 h-16 object-cover object-top rounded-lg border border-white/10 shrink-0 bg-slate-950" />
                              <div className="min-w-0">
                                <h4 className="text-xs font-extrabold text-white truncate">{principalForm.name}</h4>
                                <p className="text-[10px] text-slate-400 truncate">{principalForm.title}</p>
                                {principalForm.yearsOfService && (
                                  <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold tracking-wider mt-1 inline-block uppercase">
                                    {principalForm.yearsOfService} Service
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-300 italic line-clamp-5 leading-relaxed text-left">
                              "{principalForm.welcomeMessage || 'No vision statement entered yet.'}"
                            </p>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: TEACHERS ROSTER
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'teachers' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                      {/* Left form */}
                      <div className="lg:col-span-5 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-5">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                          {editingTribute ? 'Edit Teacher Profile' : 'Add New Teacher Profile'}
                        </h3>

                        <form onSubmit={handleSaveTribute} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Teacher Full Name</label>
                              <input
                                type="text"
                                required
                                value={tributeForm.name}
                                onChange={(e) => setTributeForm({ ...tributeForm, name: e.target.value })}
                                placeholder="e.g., Prof. Sarah Conner"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Core Subject / Specialty</label>
                              <input
                                type="text"
                                required
                                value={tributeForm.subject}
                                onChange={(e) => setTributeForm({ ...tributeForm, subject: e.target.value })}
                                placeholder="e.g., Advanced Calculus"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Department</label>
                              <input
                                type="text"
                                required
                                value={tributeForm.department}
                                onChange={(e) => setTributeForm({ ...tributeForm, department: e.target.value })}
                                placeholder="e.g., Mathematics & Computing"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Display Sort Order</label>
                              <input
                                type="number"
                                required
                                value={tributeForm.displayOrder || ''}
                                onChange={(e) => setTributeForm({ ...tributeForm, displayOrder: parseInt(e.target.value, 10) || 0 })}
                                placeholder="0"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Photo URL</label>
                            <input
                              type="url"
                              required
                              value={tributeForm.image}
                              onChange={(e) => setTributeForm({ ...tributeForm, image: e.target.value })}
                              placeholder="Photo URL or upload below..."
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                            <div className="flex items-center gap-2 mt-1.5">
                              <label className="flex-1 py-1.5 bg-slate-900 border border-dashed border-white/10 hover:border-white/30 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGenericUpload(e, setTributeUploading, (url) => setTributeForm({ ...tributeForm, image: url }))}
                                  className="hidden"
                                />
                                <span>Upload teacher photo</span>
                              </label>
                              {tributeUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Teacher Biography / Tribute Message</label>
                            <textarea
                              rows={3}
                              required
                              value={tributeForm.message}
                              onChange={(e) => setTributeForm({ ...tributeForm, message: e.target.value })}
                              placeholder="Write a warm biography about this teacher..."
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Featured Teacher Status</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={!!tributeForm.featured} 
                                onChange={(e) => setTributeForm({ ...tributeForm, featured: e.target.checked })}
                                className="sr-only peer" 
                              />
                              <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                              <span className="ml-2 text-xs font-bold text-slate-300 uppercase">
                                {tributeForm.featured ? 'Featured' : 'Standard'}
                              </span>
                            </label>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={savingTribute}
                              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow"
                            >
                              {savingTribute ? 'Saving...' : editingTribute ? 'Modify Teacher' : 'Publish Teacher'}
                            </button>
                            {(editingTribute || tributeForm.image) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTribute(null);
                                  setTributeForm({ name: '', subject: '', image: '', message: '', featured: false, department: '', displayOrder: 0 });
                                }}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </form>
                      </div>

                      {/* Right list */}
                      <div className="lg:col-span-7 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                            Official Teachers Roster ({teacherTributes.length})
                          </h3>
                        </div>

                        {teacherTributes.length === 0 ? (
                          <div className="py-16 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
                            No teachers configured. Click on left pane to add.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                            {teacherTributes.map((teacher) => (
                              <div
                                key={teacher.id}
                                className="p-3 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-between gap-4 text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={teacher.image || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=200'}
                                    alt={teacher.name}
                                    className="w-11 h-11 object-cover rounded-full border border-white/10 shrink-0 bg-slate-900"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="text-xs font-extrabold text-white truncate">{teacher.name}</h4>
                                      {teacher.featured && (
                                        <span className="text-[7px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded font-black uppercase tracking-widest">Featured</span>
                                      )}
                                    </div>
                                    <span className="text-[9px] text-slate-400 block truncate mt-0.5">{teacher.subject} • {teacher.department || 'General'}</span>
                                    {teacher.displayOrder !== undefined && (
                                      <span className="text-[8px] text-slate-500 font-mono">Sort Order: {teacher.displayOrder}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingTribute(teacher);
                                      setTributeForm({
                                        name: teacher.name,
                                        subject: teacher.subject,
                                        image: teacher.image,
                                        message: teacher.message,
                                        featured: teacher.featured === true || teacher.featured === 'true',
                                        department: teacher.department || '',
                                        displayOrder: teacher.displayOrder || 0
                                      });
                                    }}
                                    className="p-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded transition-colors"
                                    title="Edit teacher details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTribute(teacher.id, teacher.image)}
                                    className="p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded transition-colors"
                                    title="Delete teacher"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: SCHOOL HISTORY
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'history' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                      {/* Left Side: General Info Config */}
                      <div className="lg:col-span-5 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-5">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                          History Legacy Configuration
                        </h3>

                        <form onSubmit={handleSaveHistoryConfig} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">History Cover Image</label>
                            {historyConfig.coverImage ? (
                              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-white/10 mb-2">
                                <img src={historyConfig.coverImage} alt="history cover preview" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const old = historyConfig.coverImage;
                                    setHistoryConfig({ ...historyConfig, coverImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200' });
                                    triggerFeedback('success', "Cover reset to template image.");
                                    if (old && old.includes("cloudinary.com")) {
                                      fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: old }) }).catch(() => {});
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-500 rounded text-white"
                                  title="Reset image"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <label className="flex-1 py-1.5 bg-slate-900 border border-dashed border-white/10 hover:border-white/30 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGenericUpload(e, setHistoryCoverUploading, (url) => setHistoryConfig({ ...historyConfig, coverImage: url }))}
                                  className="hidden"
                                />
                                <span>Upload new cover photo</span>
                              </label>
                              {historyCoverUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">History Section Title</label>
                            <input
                              type="text"
                              required
                              value={historyConfig.title}
                              onChange={(e) => setHistoryConfig({ ...historyConfig, title: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">History Long Description</label>
                            <textarea
                              rows={5}
                              required
                              value={historyConfig.description}
                              onChange={(e) => setHistoryConfig({ ...historyConfig, description: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={savingHistory}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow"
                          >
                            {savingHistory ? 'Publishing...' : 'Save History Config'}
                          </button>
                        </form>
                      </div>

                      {/* Right Side: History Gallery Image Manager */}
                      <div className="lg:col-span-7 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                            School History Album Gallery ({historyConfig.gallery ? historyConfig.gallery.length : 0})
                          </h3>
                        </div>

                        {/* Add Gallery Image Upload Trigger */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Upload Custom Photo to history album</label>
                          <div className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-white/30 rounded-xl p-6 bg-slate-950/50 cursor-pointer relative group">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                handleGenericUpload(e, setHistoryGalleryUploading, async (url) => {
                                  const list = historyConfig.gallery || [];
                                  const updated = { ...historyConfig, gallery: [...list, url] };
                                  setHistoryConfig(updated);
                                  await setDoc(doc(db, "cms_content", "history"), updated);
                                  triggerFeedback('success', "Image added to history album successfully!");
                                });
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <UploadCloud className="w-7 h-7 text-slate-500 mb-1 group-hover:scale-105 transition-all" />
                            <p className="text-xs font-bold text-slate-300">Add Image to Gallery</p>
                          </div>
                          {historyGalleryUploading && <div className="text-xs text-amber-400 animate-pulse text-center">Uploading photo to archive...</div>}
                        </div>

                        {/* Gallery Image Grid */}
                        {(!historyConfig.gallery || historyConfig.gallery.length === 0) ? (
                          <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
                            The history gallery is empty. Upload images above.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto pr-1">
                            {historyConfig.gallery.map((imgUrl, index) => (
                              <div
                                key={`${imgUrl}-${index}`}
                                className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-slate-900 shadow"
                              >
                                <img src={imgUrl} alt={`gallery-${index}`} className="w-full h-full object-cover" />
                                
                                {/* Overlay controllers */}
                                <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2.5 transition-opacity duration-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-mono font-bold text-indigo-400 bg-white/10 px-1 py-0.2 rounded">Photo {index + 1}</span>
                                    <button
                                      onClick={async () => {
                                        if (!confirm("Permanently remove this image from the history album?")) return;
                                        const list = historyConfig.gallery.filter((_, idx) => idx !== index);
                                        const updated = { ...historyConfig, gallery: list };
                                        setHistoryConfig(updated);
                                        await setDoc(doc(db, "cms_content", "history"), updated);
                                        triggerFeedback('success', "Image removed.");
                                        if (imgUrl.includes("cloudinary.com")) {
                                          fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: imgUrl }) }).catch(() => {});
                                        }
                                      }}
                                      className="p-1 bg-red-600 rounded text-white hover:bg-red-500 cursor-pointer"
                                      title="Remove"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <div className="flex gap-1 justify-center">
                                    <button
                                      onClick={async () => {
                                        if (index === 0) return;
                                        const list = [...historyConfig.gallery];
                                        const temp = list[index];
                                        list[index] = list[index - 1];
                                        list[index - 1] = temp;
                                        const updated = { ...historyConfig, gallery: list };
                                        setHistoryConfig(updated);
                                        await setDoc(doc(db, "cms_content", "history"), updated);
                                      }}
                                      disabled={index === 0}
                                      className="p-1 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-20 text-[9px] flex items-center justify-center font-mono cursor-pointer"
                                    >
                                      ←
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (index === historyConfig.gallery.length - 1) return;
                                        const list = [...historyConfig.gallery];
                                        const temp = list[index];
                                        list[index] = list[index + 1];
                                        list[index + 1] = temp;
                                        const updated = { ...historyConfig, gallery: list };
                                        setHistoryConfig(updated);
                                        await setDoc(doc(db, "cms_content", "history"), updated);
                                      }}
                                      disabled={index === historyConfig.gallery.length - 1}
                                      className="p-1 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-20 text-[9px] flex items-center justify-center font-mono cursor-pointer"
                                    >
                                      →
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: FEATURED EVENTS
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'events' && (
                    <div className="space-y-6 text-left">
                      {/* Preserved Milestones Management Header Banner */}
                      <div className="bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-amber-500/15 border border-amber-400/30 p-4 sm:p-5 rounded-2xl flex items-start gap-3.5 shadow-lg">
                        <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-400/30 shrink-0">
                          <Sparkles className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                            <span>Preserved Milestones & School Events CMS</span>
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-200 text-[10px] rounded-full border border-amber-400/30 font-mono">Firestore Doc: cms_content/school_events</span>
                          </h4>
                          <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                            Upload or change cover thumbnails and details for any official school event (Graduation Ceremony, Sports Day, Cultural Day, Prize Giving, etc.). Any modified event or thumbnail is automatically saved to the Firestore database collection and instantly updates the live homepage sliding carousel.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left column: Add/Edit Event */}
                      <div className="lg:col-span-5 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-5">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                          {editingSchoolEvent ? 'Modify Event Entry' : 'Configure New Event'}
                        </h3>

                        <form onSubmit={handleSaveSchoolEvent} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Event Title</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Prize Giving & Speech Day"
                              value={schoolEventForm.title}
                              onChange={(e) => setSchoolEventForm({ ...schoolEventForm, title: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Date Category</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. June 15, 2026"
                                value={schoolEventForm.date}
                                onChange={(e) => setSchoolEventForm({ ...schoolEventForm, date: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">General Theme/Category</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. History, Academic"
                                value={schoolEventForm.category}
                                onChange={(e) => setSchoolEventForm({ ...schoolEventForm, category: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Event Cover Image URL</label>
                            <input
                              type="url"
                              value={schoolEventForm.image}
                              onChange={(e) => setSchoolEventForm({ ...schoolEventForm, image: e.target.value })}
                              placeholder="Event cover image URL..."
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none mb-1.5"
                            />
                            {schoolEventForm.image ? (
                              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-white/10 mb-2">
                                <img src={schoolEventForm.image} alt="event cover" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setSchoolEventForm({ ...schoolEventForm, image: '' })}
                                  className="absolute top-2 right-2 p-1 bg-red-600 rounded text-white text-xs"
                                >
                                  Clear
                                </button>
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <label className="flex-1 py-1.5 bg-slate-900 border border-dashed border-white/10 hover:border-white/30 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGenericUpload(e, setEventCoverUploading, (url) => setSchoolEventForm({ ...schoolEventForm, image: url }))}
                                  className="hidden"
                                />
                                <span>Upload cover image</span>
                              </label>
                              {eventCoverUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Brief Description</label>
                            <textarea
                              rows={3}
                              required
                              value={schoolEventForm.description}
                              onChange={(e) => setSchoolEventForm({ ...schoolEventForm, description: e.target.value })}
                              placeholder="Describe this official school event details..."
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          {/* Event Album Upload Trigger */}
                          {editingSchoolEvent && (
                            <div className="space-y-2 border-t border-white/5 pt-3">
                              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block font-sans">Add Image to Event Gallery Album</label>
                              <div className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-white/30 rounded-xl p-4 bg-slate-950/50 cursor-pointer relative group">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    handleGenericUpload(e, setEventGalleryUploading, (url) => {
                                      const currentList = schoolEventForm.gallery || [];
                                      setSchoolEventForm({ ...schoolEventForm, gallery: [...currentList, url] });
                                      triggerFeedback('success', "Image added to active event's working gallery. Save event details to publish.");
                                    });
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <UploadCloud className="w-6 h-6 text-slate-500 mb-1 group-hover:scale-105 transition-all" />
                                <span className="text-[10px] font-bold text-slate-300">Upload Album Photo</span>
                              </div>
                              {eventGalleryUploading && <div className="text-xs text-amber-400 animate-pulse text-center">Transferring asset...</div>}
                              
                              {/* Loaded Event working gallery */}
                              {schoolEventForm.gallery && schoolEventForm.gallery.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mt-2 max-h-[120px] overflow-y-auto">
                                  {schoolEventForm.gallery.map((gUrl, idx) => (
                                    <div key={`${gUrl}-${idx}`} className="relative aspect-square rounded overflow-hidden border border-white/5 group bg-slate-900">
                                      <img src={gUrl} alt="gallery" className="w-full h-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const filtered = schoolEventForm.gallery.filter((_, gIdx) => gIdx !== idx);
                                          setSchoolEventForm({ ...schoolEventForm, gallery: filtered });
                                          if (gUrl.includes("cloudinary.com")) {
                                            fetch("/api/delete-cloudinary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: gUrl }) }).catch(() => {});
                                          }
                                        }}
                                        className="absolute inset-0 bg-red-600/90 text-white text-[8px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={savingSchoolEvent}
                              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow"
                            >
                              {savingSchoolEvent ? 'Saving...' : editingSchoolEvent ? 'Modify Event details' : 'Register School Event'}
                            </button>
                            {(editingSchoolEvent || schoolEventForm.title) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSchoolEvent(null);
                                  setSchoolEventForm({ title: '', category: '', date: '', description: '', image: '', gallery: [] });
                                }}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </form>
                      </div>

                      {/* Right column: Events directory */}
                      <div className="lg:col-span-7 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                            Active Events Directory ({schoolEvents.length})
                          </h3>
                        </div>

                        {schoolEvents.length === 0 ? (
                          <div className="py-16 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
                            No custom events configured. Standard timeline/gallery placeholders will render.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                            {schoolEvents.map((evt) => (
                              <div
                                key={evt.title}
                                className="p-3 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-between gap-4 text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {evt.image ? (
                                    <img
                                      src={evt.image}
                                      alt={evt.title}
                                      className="w-16 aspect-[16/10] object-cover rounded border border-white/10 shrink-0 bg-slate-900"
                                    />
                                  ) : (
                                    <div className="w-16 aspect-[16/10] rounded border border-dashed border-white/10 flex items-center justify-center text-[8px] font-bold text-slate-500 uppercase font-mono shrink-0">No cover</div>
                                  )}
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-extrabold text-white truncate">{evt.title}</h4>
                                    <span className="text-[9px] font-mono font-medium text-slate-400 block mt-0.5">{evt.date} • {evt.category}</span>
                                    {evt.gallery && evt.gallery.length > 0 && (
                                      <span className="text-[8px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded font-black uppercase tracking-wider mt-1 inline-block">
                                        Album Album: {evt.gallery.length} Images
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleOpenChangeThumbnail({
                                      type: 'school_event',
                                      id: evt.title,
                                      title: evt.title,
                                      currentThumbnail: evt.image || '',
                                      itemData: evt
                                    })}
                                    className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                    title="Change Cover Thumbnail"
                                  >
                                    <Camera className="w-3 h-3" />
                                    <span>Change Thumbnail</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingSchoolEvent(evt);
                                      setSchoolEventForm({
                                        title: evt.title,
                                        category: evt.category,
                                        date: evt.date,
                                        description: evt.description,
                                        image: evt.image || '',
                                        gallery: evt.gallery || []
                                      });
                                      triggerFeedback('success', `Loaded details for "${evt.title}". Working album enabled.`);
                                    }}
                                    className="p-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded transition-colors"
                                    title="Edit event details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSchoolEvent(evt.title)}
                                    className="p-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded transition-colors"
                                    title="Delete event"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: FOOTER SETTINGS
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'footer' && (
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-6 text-left">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                        Official Site Footer Customization
                      </h3>

                      <form onSubmit={handleSaveFooterConfig} className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
                        {/* Left Inputs */}
                        <div className="md:col-span-7 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Footer Seal Logo URL</label>
                              <input
                                type="url"
                                value={footerConfig.logoUrl || ''}
                                onChange={(e) => setFooterConfig({ ...footerConfig, logoUrl: e.target.value })}
                                placeholder="Logo URL..."
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                              <div className="flex items-center gap-2 mt-1.5">
                                <label className="flex-1 py-1.5 bg-slate-900 border border-dashed border-white/10 hover:border-white/30 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleGenericUpload(e, setFooterLogoUploading, (url) => setFooterConfig({ ...footerConfig, logoUrl: url }))}
                                    className="hidden"
                                  />
                                  <span>Upload custom logo</span>
                                </label>
                                {footerLogoUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Footer Background Image</label>
                              <input
                                type="url"
                                required
                                value={footerConfig.backgroundImage}
                                onChange={(e) => setFooterConfig({ ...footerConfig, backgroundImage: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                              <div className="flex items-center gap-2 mt-1.5">
                                <label className="flex-1 py-1.5 bg-slate-900 border border-dashed border-white/10 hover:border-white/30 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white cursor-pointer transition-colors text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleGenericUpload(e, setFooterBgUploading, (url) => setFooterConfig({ ...footerConfig, backgroundImage: url }))}
                                    className="hidden"
                                  />
                                  <span>Upload Background</span>
                                </label>
                                {footerBgUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Contact Telephone</label>
                              <input
                                type="text"
                                required
                                value={footerConfig.phone}
                                onChange={(e) => setFooterConfig({ ...footerConfig, phone: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Contact Email</label>
                              <input
                                type="email"
                                required
                                value={footerConfig.email}
                                onChange={(e) => setFooterConfig({ ...footerConfig, email: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Physical Campus Address</label>
                            <input
                              type="text"
                              required
                              value={footerConfig.address}
                              onChange={(e) => setFooterConfig({ ...footerConfig, address: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Footer Mission Statement</label>
                            <textarea
                              rows={3}
                              required
                              value={footerConfig.description}
                              onChange={(e) => setFooterConfig({ ...footerConfig, description: e.target.value })}
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={savingFooter}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow"
                          >
                            {savingFooter ? 'Saving Footer...' : 'Deploy Footer Customization'}
                          </button>
                        </div>

                        {/* Right Preview */}
                        <div className="md:col-span-5 bg-slate-900/60 p-4.5 rounded-2xl border border-white/5 flex flex-col justify-between">
                          <div className="space-y-3">
                            <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">Footer Configuration previews</span>
                            {footerConfig.backgroundImage && (
                              <div className="relative aspect-[16/8] rounded-xl overflow-hidden border border-white/10">
                                <img src={footerConfig.backgroundImage} alt="bg cover" className="w-full h-full object-cover filter brightness-[0.4]" />
                                <div className="absolute inset-0 flex flex-col justify-end p-3 text-left">
                                  {footerConfig.logoUrl ? (
                                    <img src={footerConfig.logoUrl} alt="logo" className="w-8 h-8 object-contain bg-white rounded p-0.5 mb-1" />
                                  ) : (
                                    <div className="text-white text-xs font-black tracking-widest mb-1">THE WISDOM LINK MODEL COLLEGE</div>
                                  )}
                                  <p className="text-[8px] text-gray-300 line-clamp-2 leading-relaxed">"{footerConfig.description}"</p>
                                </div>
                              </div>
                            )}
                            <div className="space-y-1.5 text-left text-[10px] text-slate-400 border-t border-white/5 pt-3">
                              <div>📞 Phone: <span className="text-white font-semibold">{footerConfig.phone}</span></div>
                              <div>✉️ Email: <span className="text-white font-semibold">{footerConfig.email}</span></div>
                              <div>📍 Address: <span className="text-white font-semibold">{footerConfig.address}</span></div>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: IDENTITY & BANNER
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'branding' && (
                    <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-6 text-left">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-1.5">
                        <Settings className="w-4 h-4 text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
                        <span>Corporate School Branding Seal & Ticker Announcement Config</span>
                      </h3>

                      <form onSubmit={handleSaveBrandingConfig} className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
                        {/* Inputs */}
                        <div className="md:col-span-7 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Logo */}
                            <div className="space-y-1 bg-slate-950/20 p-3 rounded-xl border border-white/5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Official Brand Seal Logo</label>
                              <input
                                type="url"
                                value={brandingConfig.logoUrl || ''}
                                onChange={(e) => setBrandingConfig({ ...brandingConfig, logoUrl: e.target.value })}
                                className="w-full p-2 rounded text-[10px] bg-slate-950 border border-white/5 text-white mb-2"
                              />
                              <div className="flex items-center gap-2">
                                <label className="flex-1 py-1 bg-slate-900 border border-dashed border-white/10 rounded text-[9px] font-black uppercase text-slate-400 hover:text-white cursor-pointer text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleGenericUpload(e, setLogoUploading, (url) => setBrandingConfig({ ...brandingConfig, logoUrl: url }))}
                                    className="hidden"
                                  />
                                  <span>Upload Logo</span>
                                </label>
                                {logoUploading && <Loader2 className="w-3 animate-spin text-indigo-400" />}
                              </div>
                            </div>

                            {/* Favicon */}
                            <div className="space-y-1 bg-slate-950/20 p-3 rounded-xl border border-white/5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Site Favicon URL</label>
                              <input
                                type="url"
                                value={brandingConfig.faviconUrl || ''}
                                onChange={(e) => setBrandingConfig({ ...brandingConfig, faviconUrl: e.target.value })}
                                className="w-full p-2 rounded text-[10px] bg-slate-950 border border-white/5 text-white mb-2"
                              />
                              <div className="flex items-center gap-2">
                                <label className="flex-1 py-1 bg-slate-900 border border-dashed border-white/10 rounded text-[9px] font-black uppercase text-slate-400 hover:text-white cursor-pointer text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleGenericUpload(e, setBrandFaviconUploading, (url) => setBrandingConfig({ ...brandingConfig, faviconUrl: url }))}
                                    className="hidden"
                                  />
                                  <span>Upload Favicon</span>
                                </label>
                                {brandFaviconUploading && <Loader2 className="w-3 animate-spin text-indigo-400" />}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Share Image */}
                            <div className="space-y-1 bg-slate-950/20 p-3 rounded-xl border border-white/5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Social Metadata Share Image</label>
                              <input
                                type="url"
                                value={brandingConfig.shareImageUrl || ''}
                                onChange={(e) => setBrandingConfig({ ...brandingConfig, shareImageUrl: e.target.value })}
                                className="w-full p-2 rounded text-[10px] bg-slate-950 border border-white/5 text-white mb-2"
                              />
                              <div className="flex items-center gap-2">
                                <label className="flex-1 py-1 bg-slate-900 border border-dashed border-white/10 rounded text-[9px] font-black uppercase text-slate-400 hover:text-white cursor-pointer text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleGenericUpload(e, setBrandShareUploading, (url) => setBrandingConfig({ ...brandingConfig, shareImageUrl: url }))}
                                    className="hidden"
                                  />
                                  <span>Upload share img</span>
                                </label>
                                {brandShareUploading && <Loader2 className="w-3 animate-spin text-indigo-400" />}
                              </div>
                            </div>

                            {/* OpenGraph Image */}
                            <div className="space-y-1 bg-slate-950/20 p-3 rounded-xl border border-white/5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">OpenGraph OG Schema Image</label>
                              <input
                                type="url"
                                value={brandingConfig.ogImageUrl || ''}
                                onChange={(e) => setBrandingConfig({ ...brandingConfig, ogImageUrl: e.target.value })}
                                className="w-full p-2 rounded text-[10px] bg-slate-950 border border-white/5 text-white mb-2"
                              />
                              <div className="flex items-center gap-2">
                                <label className="flex-1 py-1 bg-slate-900 border border-dashed border-white/10 rounded text-[9px] font-black uppercase text-slate-400 hover:text-white cursor-pointer text-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleGenericUpload(e, setBrandOgUploading, (url) => setBrandingConfig({ ...brandingConfig, ogImageUrl: url }))}
                                    className="hidden"
                                  />
                                  <span>Upload OG Image</span>
                                </label>
                                {brandOgUploading && <Loader2 className="w-3 animate-spin text-indigo-400" />}
                              </div>
                            </div>
                          </div>

                          {/* Announcement Ticker Banner settings */}
                          <div className="border-t border-white/5 pt-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ticker Alert Banner State</label>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={brandingConfig.bannerActive} 
                                  onChange={(e) => setBrandingConfig({ ...brandingConfig, bannerActive: e.target.checked })}
                                  className="sr-only peer" 
                                />
                                <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                <span className="ml-2 text-xs font-bold text-slate-300 uppercase">
                                  {brandingConfig.bannerActive ? 'Active' : 'Muted'}
                                </span>
                              </label>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Announcement Text</label>
                              <textarea
                                rows={2}
                                value={brandingConfig.bannerText}
                                onChange={(e) => setBrandingConfig({ ...brandingConfig, bannerText: e.target.value })}
                                placeholder="🎉 Welcome message alert..."
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={savingBranding}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow"
                          >
                            {savingBranding ? 'Saving Configurations...' : 'Save Branding Identity'}
                          </button>
                        </div>

                        {/* Right: Brand Previews */}
                        <div className="md:col-span-5 bg-slate-900/60 p-4.5 rounded-2xl border border-white/5 space-y-4">
                          <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest block text-left">School Brand Identity Previews</span>
                          
                          <div className="space-y-4 text-xs text-slate-400 text-left">
                            <div className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center gap-3">
                              <span className="text-[10px] font-mono shrink-0">Logo:</span>
                              {brandingConfig.logoUrl ? (
                                <img src={brandingConfig.logoUrl} alt="logo" className="w-8 h-8 object-contain bg-white rounded border p-0.5" />
                              ) : (
                                <span className="text-[10px] text-slate-500">Not configured</span>
                              )}
                            </div>

                            <div className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center gap-3">
                              <span className="text-[10px] font-mono shrink-0">Favicon:</span>
                              {brandingConfig.faviconUrl ? (
                                <img src={brandingConfig.faviconUrl} alt="favicon" className="w-5 h-5 object-contain bg-white rounded p-0.5" />
                              ) : (
                                <span className="text-[10px] text-slate-500">Not configured</span>
                              )}
                            </div>

                            <div className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center gap-3">
                              <span className="text-[10px] font-mono shrink-0">Share Img:</span>
                              {brandingConfig.shareImageUrl ? (
                                <img src={brandingConfig.shareImageUrl} alt="share" className="w-12 aspect-video object-cover rounded border border-white/10" />
                              ) : (
                                <span className="text-[10px] text-slate-500">Not configured</span>
                              )}
                            </div>

                            {brandingConfig.bannerActive && (
                              <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 rounded-xl font-mono text-[9px] leading-relaxed">
                                📢 <span className="font-bold uppercase text-indigo-400">Live Ticker:</span> {brandingConfig.bannerText}
                              </div>
                            )}
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: GRADUATION CEREMONY
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'graduation_ceremony' && (
                    <AdminGraduationCeremonyCMS triggerFeedback={triggerFeedback} />
                  )}

                  {/* ----------------------------------------------------
                      CMS SUB-TAB: GRADUATES OF THE YEAR
                      ---------------------------------------------------- */}
                  {cmsSubTab === 'graduates' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
                      {/* Left form */}
                      <div className="lg:col-span-5 bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-5">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2">
                          {editingStudent ? 'Edit Graduate Profile' : 'Add New Graduate of the Year'}
                        </h3>

                        <form onSubmit={handleSaveStudent} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Graduate Full Name</label>
                              <input
                                type="text"
                                required
                                value={studentForm.name}
                                onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                                placeholder="e.g., Jennifer Lopez"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Class / Year / House</label>
                              <select
                                value={studentForm.house}
                                onChange={(e) => setStudentForm({ ...studentForm, house: e.target.value })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              >
                                <option value="Emerald House">Emerald House</option>
                                <option value="Ruby House">Ruby House</option>
                                <option value="Sapphire House">Sapphire House</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nickname</label>
                              <input
                                type="text"
                                value={studentForm.nickname}
                                onChange={(e) => setStudentForm({ ...studentForm, nickname: e.target.value })}
                                placeholder="e.g., Jenny"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">State of Origin</label>
                              <input
                                type="text"
                                value={studentForm.stateOfOrigin}
                                onChange={(e) => setStudentForm({ ...studentForm, stateOfOrigin: e.target.value })}
                                placeholder="e.g., California"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Yearbook Quote</label>
                              <input
                                type="text"
                                value={studentForm.quote}
                                onChange={(e) => setStudentForm({ ...studentForm, quote: e.target.value })}
                                placeholder="e.g., The best way to predict the future is to create it."
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Portrait Photo URL</label>
                            <input
                              type="url"
                              value={studentForm.image}
                              onChange={(e) => setStudentForm({ ...studentForm, image: e.target.value })}
                              placeholder="https://images.unsplash.com/photo-..."
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none mb-1"
                            />
                            <div className="flex items-center gap-2">
                              <label className="flex-1 py-2 bg-slate-900 border border-dashed border-white/10 rounded-xl text-[10px] font-extrabold uppercase text-slate-400 hover:text-white cursor-pointer text-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGenericUpload(e, setStudentUploading, (url) => setStudentForm({ ...studentForm, image: url }))}
                                  className="hidden"
                                />
                                <span>Upload Portrait</span>
                              </label>
                              {studentUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ambitions & Biography</label>
                            <textarea
                              rows={2}
                              value={studentForm.aspirations}
                              onChange={(e) => setStudentForm({ ...studentForm, aspirations: e.target.value })}
                              placeholder="e.g., Aspirations to study Computer Science at Stanford..."
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Favorite High School Memory</label>
                            <textarea
                              rows={2}
                              value={studentForm.favoriteMemory}
                              onChange={(e) => setStudentForm({ ...studentForm, favoriteMemory: e.target.value })}
                              placeholder="e.g., Winning the state volleyball championship..."
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Message to Classmates</label>
                            <textarea
                              rows={2}
                              value={studentForm.messageToClassmates}
                              onChange={(e) => setStudentForm({ ...studentForm, messageToClassmates: e.target.value })}
                              placeholder="e.g., Stay gold! Let's stay in touch!"
                              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none resize-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Instagram</label>
                              <input
                                type="text"
                                value={studentForm.instagram || ''}
                                onChange={(e) => setStudentForm({ ...studentForm, instagram: e.target.value })}
                                placeholder="@username"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Twitter / X</label>
                              <input
                                type="text"
                                value={studentForm.twitter || ''}
                                onChange={(e) => setStudentForm({ ...studentForm, twitter: e.target.value })}
                                placeholder="@username"
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 items-center">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Display Order Index</label>
                              <input
                                type="number"
                                value={studentForm.displayOrder || 0}
                                onChange={(e) => setStudentForm({ ...studentForm, displayOrder: parseInt(e.target.value) || 0 })}
                                className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-indigo-500 text-white focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-4">
                              <input
                                type="checkbox"
                                id="featured-student-chk"
                                checked={!!studentForm.featured}
                                onChange={(e) => setStudentForm({ ...studentForm, featured: e.target.checked })}
                                className="rounded text-indigo-600 bg-slate-950 border-white/10"
                              />
                              <label htmlFor="featured-student-chk" className="text-xs font-bold text-slate-300 uppercase tracking-wide cursor-pointer select-none">
                                Featured Graduate
                              </label>
                            </div>
                          </div>

                          <div className="flex gap-2.5 pt-2">
                            <button
                              type="submit"
                              disabled={savingStudent}
                              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow flex items-center justify-center gap-1.5"
                            >
                              {savingStudent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              <span>{editingStudent ? 'Update Profile' : 'Publish Profile'}</span>
                            </button>
                            {editingStudent && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStudent(null);
                                  setStudentForm({
                                    name: '', nickname: '', image: '', favoriteMemory: '', messageToClassmates: '', aspirations: '', house: 'Emerald House',
                                    quote: '', stateOfOrigin: '', bio: '', instagram: '', twitter: '', displayOrder: 0, featured: false
                                  });
                                }}
                                className="px-4 py-2.5 bg-slate-900 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </form>
                      </div>

                      {/* Right list */}
                      <div className="lg:col-span-7 bg-slate-900/40 p-6 rounded-2xl border border-white/5 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                            Roster ({students.length} Graduates)
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">
                            Featured and Order Index prioritize sequence
                          </span>
                        </div>

                        {students.length === 0 ? (
                          <div className="py-20 text-center space-y-2">
                            <p className="text-sm font-bold text-slate-400">No graduates in the system</p>
                            <p className="text-xs text-slate-500">Add graduate profiles using the form on the left</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                            {[...students]
                              .sort((a, b) => {
                                const aFeat = a.featured === true || a.featured === 'true' ? 1 : 0;
                                const bFeat = b.featured === true || b.featured === 'true' ? 1 : 0;
                                if (bFeat !== aFeat) return bFeat - aFeat;
                                if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
                                  return (a.displayOrder || 0) - (b.displayOrder || 0);
                                }
                                return a.name.localeCompare(b.name);
                              })
                              .map((stud, idx) => {
                                const isFeat = stud.featured === true || stud.featured === 'true';
                                return (
                                  <div
                                    key={stud.id}
                                    className="p-3 bg-slate-950/50 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-between gap-4"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-900 border border-white/10">
                                        {stud.image ? (
                                          <img src={stud.image} alt={stud.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-600">🎓</div>
                                        )}
                                        {isFeat && (
                                          <div className="absolute top-0 right-0 bg-amber-500 text-black text-[7px] font-black uppercase px-1 rounded-bl">
                                            Feat
                                          </div>
                                        )}
                                      </div>

                                      <div className="text-left space-y-0.5">
                                        <p className="text-xs font-extrabold text-white">{stud.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                          {stud.house} | Order: {stud.displayOrder || 0}
                                        </p>
                                        {stud.nickname && (
                                          <p className="text-[9px] text-slate-500 italic">"{stud.nickname}"</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action items */}
                                    <div className="flex items-center gap-1">
                                      {/* Move order up */}
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveStudent(idx, 'up')}
                                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors disabled:opacity-20 cursor-pointer"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      {/* Move order down */}
                                      <button
                                        type="button"
                                        disabled={idx === students.length - 1}
                                        onClick={() => handleMoveStudent(idx, 'down')}
                                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors disabled:opacity-20 cursor-pointer"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleEditStudent(stud)}
                                        className="p-1.5 hover:bg-indigo-500/20 text-indigo-400 rounded transition-colors cursor-pointer"
                                        title="Edit profile"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteStudent(stud.id, stud.image)}
                                        className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-colors cursor-pointer"
                                        title="Delete profile"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </main>
        </div>
      )}

      {/* ----------------------------------------------------
          GLOBAL MODALS (ACCESSIBLE FROM ANY TAB)
          ---------------------------------------------------- */}

      {/* MODAL OVERLAY 1: COMMUNITY MEMORY REJECTION REASON PROMPT */}
      {rejectingCommId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-slate-300">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl text-left space-y-4">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span>Specify Rejection Reason</span>
            </h4>
            <p className="text-xs text-slate-400 leading-normal">
              Please provide an optional rejection reason or internal reference explanation for rejecting this community submission.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Inappropriate file format or resolution. Please upload a high-quality yearbook photo."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 text-white focus:outline-none focus:border-red-500 animate-none"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setRejectingCommId(null);
                  setRejectionReasonInput('');
                }}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectCommMemory(rejectingCommId, rejectionReasonInput)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Reject Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OVERLAY 1B: PENDING SUBMISSION REJECTION REASON PROMPT */}
      {rejectingSubmissionId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-slate-300">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl text-left space-y-4">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span>Reject Submission</span>
            </h4>
            <p className="text-xs text-slate-400 leading-normal font-sans">
              Specify a rejection reason. This reason is stored in the database as auditable metadata and the associated Cloudinary asset is scrubbed.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Duplicate upload, contains inappropriate content, or image is too low-resolution."
              value={submissionRejectionReasonInput}
              onChange={(e) => setSubmissionRejectionReasonInput(e.target.value)}
              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 text-white focus:outline-none focus:border-red-500 animate-none"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setRejectingSubmissionId(null);
                  setSubmissionRejectionReasonInput('');
                }}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDoRejectSubmission}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Reject & Scrub Storage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OVERLAY 1C: MEDIA COMMENT REJECTION REASON PROMPT */}
      {rejectingCommentId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-slate-300">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl text-left space-y-4">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span>Reject Visitor Comment</span>
            </h4>
            <p className="text-xs text-slate-400 leading-normal font-sans">
              Provide an optional comment rejection explanation.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Advertising spam, profane language, off-topic, or duplicates."
              value={commentRejectionReasonInput}
              onChange={(e) => setCommentRejectionReasonInput(e.target.value)}
              className="w-full p-2.5 rounded-xl text-xs bg-slate-950 border border-white/5 text-white focus:outline-none focus:border-red-500 animate-none"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setRejectingCommentId(null);
                  setCommentRejectionReasonInput('');
                }}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDoRejectComment}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Reject Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          CHANGE THUMBNAIL MODAL
          ---------------------------------------------------- */}
      {thumbnailTarget && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 w-full max-w-2xl text-left shadow-2xl my-8 space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Change Thumbnail / Cover Image</h3>
                  <p className="text-xs text-amber-400/90 font-medium truncate max-w-sm">
                    {thumbnailTarget.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setThumbnailTarget(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Preview & Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Current Thumbnail
                </span>
                <div className="h-40 w-full bg-slate-950 rounded-xl overflow-hidden border border-white/10 relative">
                  {thumbnailTarget.currentThumbnail ? (
                    <img
                      src={thumbnailTarget.currentThumbnail}
                      alt="Current thumbnail"
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600 font-mono">
                      No Thumbnail
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  New Preview Selection
                </span>
                <div className="h-40 w-full bg-slate-950 rounded-xl overflow-hidden border border-amber-500/40 relative">
                  {thumbnailSourceMode === 'upload' && thumbnailFileToUpload ? (
                    <img
                      src={URL.createObjectURL(thumbnailFileToUpload)}
                      alt="Uploaded preview"
                      className="w-full h-full object-cover object-center"
                    />
                  ) : thumbnailChosenUrl ? (
                    <img
                      src={thumbnailChosenUrl}
                      alt="Chosen preview"
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500">
                      <ImageIcon className="w-8 h-8 mb-1 opacity-40 text-amber-400" />
                      <span>Select or upload a new image to see live preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Source Selection Mode Tabs */}
            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/10 gap-1">
              <button
                onClick={() => setThumbnailSourceMode('upload')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  thumbnailSourceMode === 'upload'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload New Image</span>
              </button>
              <button
                onClick={() => setThumbnailSourceMode('picker')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  thumbnailSourceMode === 'picker'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Pick From Existing ({existingImagePool.length})</span>
              </button>
            </div>

            {/* Source Tab 1: Upload */}
            {thumbnailSourceMode === 'upload' && (
              <div className="p-5 bg-slate-950/80 border border-dashed border-white/20 rounded-2xl text-center space-y-3">
                <input
                  type="file"
                  id="thumbnail-file-input"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setThumbnailFileToUpload(file);
                      setThumbnailChosenUrl(URL.createObjectURL(file));
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="thumbnail-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="p-3 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 transition-colors">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {thumbnailFileToUpload ? thumbnailFileToUpload.name : 'Click to select image file from computer'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Supports JPG, PNG, WEBP up to 10MB
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Source Tab 2: Existing Media Picker Grid */}
            {thumbnailSourceMode === 'picker' && (
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 block">
                  Select an image from existing website media:
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-white/10">
                  {existingImagePool.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setThumbnailFileToUpload(null);
                        setThumbnailChosenUrl(url);
                      }}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group cursor-pointer ${
                        thumbnailChosenUrl === url
                          ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105 z-10'
                          : 'border-transparent hover:border-white/40'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Media asset ${idx}`}
                        className="w-full h-full object-cover object-center"
                      />
                      {thumbnailChosenUrl === url && (
                        <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-amber-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setThumbnailTarget(null)}
                disabled={thumbnailUploading}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveThumbnailChange}
                disabled={thumbnailUploading}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {thumbnailUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving New Thumbnail...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Save New Thumbnail</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
