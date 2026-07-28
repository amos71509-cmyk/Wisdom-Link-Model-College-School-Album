import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import { PrincipalHonourSection, TeachersHonourSection } from './components/HonourSections';
import FeaturedEvents from './components/FeaturedEvents';
import MemoryGallery from './components/MemoryGallery';
import TimelineSection from './components/TimelineSection';
import GraduandWall from './components/GraduandWall';
import ParentContributions from './components/ParentContributions';
import GuestbookBoard from './components/GuestbookBoard';
import Footer from './components/Footer';
import BrandingControl from './components/BrandingControl';

import AdminPortal from './components/AdminPortal';
import DynamicCustomSections from './components/DynamicCustomSections';
import IntroAnimation from './components/IntroAnimation';
import ScrollReveal from './components/ScrollReveal';
import FullscreenMediaViewer, { MediaItem } from './components/FullscreenMediaViewer';
import ShareMemory from './components/ShareMemory';
import GraduationProfileForm from './components/GraduationProfileForm';
import GraduatesDirectory from './components/GraduatesDirectory';
import GraduationCeremonyGallery from './components/GraduationCeremonyGallery';
import { UploadProgressModal } from './components/UploadProgressModal';

import { SchoolPalette, Memory, ParentContribution, CustomSection } from './types';
import { PALETTES, DEFAULT_PARENT_CONTRIBUTIONS, MEMORIES } from './data/schoolData';
import { Sparkles, UserCheck, AlertCircle, Volume2, Star, Gift, Bell, Shield, X } from 'lucide-react';
import { seedDatabaseIfEmpty, subscribeActiveBannerEvent, subscribePhotos, subscribeVideos, subscribeCustomSections, subscribeCommunityMemories, purgeRejectedAndDeletedFromFirestore } from './services/firebaseService';
import { auth } from './firebase';
import { getCloudinaryThumbnail } from './utils/videoUtils';

export default function App() {
  // Brand Coloring State
  const [activePalette, setActivePalette] = useState<SchoolPalette>(PALETTES[0]);

  // Admin Portal state
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);

  // Active View System
  const [currentView, setCurrentView] = useState<'home' | 'share-memory' | 'graduation-profile' | 'graduates'>('home');

  // Clean Up Mode visual state
  const [cleanUpMode, setCleanUpMode] = useState(false);

  // Real-time source streams to prevent state clobbering/race conditions
  const [photoMemoriesList, setPhotoMemoriesList] = useState<Memory[]>([]);
  const [videoMemoriesList, setVideoMemoriesList] = useState<Memory[]>([]);
  const [commMemoriesList, setCommMemoriesList] = useState<Memory[]>([]);
  
  const [photoContributions, setPhotoContributions] = useState<ParentContribution[]>([]);
  const [commContributions, setCommContributions] = useState<ParentContribution[]>([]);

  // Gallery Memories State (Supports real-time parent submissions!)
  const [customMemories, setCustomMemories] = useState<Memory[]>(MEMORIES);

  // Parent Contributions State (Supports real-time submissions!)
  const [parentContributions, setParentContributions] = useState<ParentContribution[]>(DEFAULT_PARENT_CONTRIBUTIONS);



  // Active Dynamic Celebration Banner State
  const [activeBanner, setActiveBanner] = useState<{ text: string; active: boolean; type?: string } | null>(null);

  // Custom Dynamic Sections State
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);

  // Graduation Ceremony Gallery Modal state
  const [isGraduationGalleryOpen, setIsGraduationGalleryOpen] = useState(false);

  // Fullscreen Media Viewer state
  const [fullscreenMedia, setFullscreenMedia] = useState<{
    items: MediaItem[];
    currentIndex: number;
  } | null>(null);

  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const handleOpenMedia = (e: Event) => {
      const customEvent = e as CustomEvent<{ items: MediaItem[]; currentIndex: number }>;
      if (customEvent.detail) {
        scrollPositionRef.current = window.scrollY;
        setFullscreenMedia({
          items: customEvent.detail.items,
          currentIndex: customEvent.detail.currentIndex
        });
      }
    };

    const handleOpenGraduationGallery = () => {
      setIsGraduationGalleryOpen(true);
    };

    window.addEventListener('open-fullscreen-media', handleOpenMedia);
    window.addEventListener('open-graduation-gallery', handleOpenGraduationGallery);
    return () => {
      window.removeEventListener('open-fullscreen-media', handleOpenMedia);
      window.removeEventListener('open-graduation-gallery', handleOpenGraduationGallery);
    };
  }, []);

  const handleCloseFullscreenMedia = () => {
    setFullscreenMedia(null);
    // Restore scroll position after un-hiding content
    setTimeout(() => {
      window.scrollTo(0, scrollPositionRef.current);
    }, 50);
  };

  // Cinematic Intro Animation completion tracker
  const [introCompleted, setIntroCompleted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('has_seen_memory_intro') === 'true';
    }
    return true;
  });

  // Unified state combiner to prevent state clobbering/race conditions
  useEffect(() => {
    // 1. Combine default MEMORIES with all live sources
    const defaultOnes = MEMORIES.filter(m => !m.id.startsWith('photo-') && !m.id.startsWith('video-') && !m.id.startsWith('comm-') && !m.id.startsWith('cust-'));
    setCustomMemories([...photoMemoriesList, ...videoMemoriesList, ...commMemoriesList, ...defaultOnes]);

    // 2. Combine default parent contributions with all live sources
    setParentContributions([...photoContributions, ...commContributions, ...DEFAULT_PARENT_CONTRIBUTIONS]);
  }, [photoMemoriesList, videoMemoriesList, commMemoriesList, photoContributions, commContributions]);

  useEffect(() => {
    // 1. Run database seeding once during applet initialization
    seedDatabaseIfEmpty();

    // 2. Subscribe to real-time celebration banners
    const unsubscribeBanner = subscribeActiveBannerEvent((banner) => {
      setActiveBanner(banner);
    });

    // 3. Subscribe to real-time approved photos
    const unsubscribePhotos = subscribePhotos((photos) => {
      if (photos && photos.length > 0) {
        // Map photos to Memory format
        const photoMemories: Memory[] = photos.map((p: any) => {
          const title = p.title || p.caption || "Student Photo";
          const desc = p.caption || p.title || "";
          const imageUrl = p.url || p.photoUrl || "";
          const date = p.date || p.uploadedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
          const author = p.submittedBy ? `${p.submittedBy} (${p.role || 'Parent'})` : (p.contributorName ? `${p.contributorName} (${p.relation || 'Parent'})` : "Anonymous");
          const isGrad = (p.event && p.event.toLowerCase().includes('grad')) || (p.category && p.category.toLowerCase().includes('grad')) || (p.tag && p.tag.toLowerCase().includes('grad'));
          const tag = isGrad ? 'Graduation' : (p.event || p.tag || "Parent");
          const featured = p.featured === true || p.featured === 'true';
          
          return {
            id: p.id,
            title,
            description: desc,
            category: "parent",
            tag,
            imageUrl,
            date,
            author,
            featured
          };
        });

        // Map photos to ParentContribution format
        const photoConts: ParentContribution[] = photos.map((p: any) => {
          const photoUrl = p.url || p.photoUrl || "";
          const caption = p.caption || p.title || "";
          const event = p.event || p.tag || "Class Memory";
          const contributorName = p.submittedBy || p.contributorName || "Anonymous";
          const relation = p.role || p.relation || "Parent";
          const date = p.date || p.uploadedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
          return {
            id: p.id,
            photoUrl,
            caption,
            event,
            contributorName,
            relation,
            date,
            approved: true
          };
        });

        setPhotoMemoriesList(photoMemories);
        setPhotoContributions(photoConts);
      } else {
        setPhotoMemoriesList([]);
        setPhotoContributions([]);
      }
    });

    // 4. Subscribe to real-time approved videos
    const unsubscribeVideos = subscribeVideos((videos) => {
      if (videos && videos.length > 0) {
        const videoMemories: Memory[] = videos.map((v: any) => {
          const title = v.title || "Video Memory";
          const isGrad = (title.toLowerCase().includes('grad')) || (v.category && v.category.toLowerCase().includes('grad')) || (v.tag && v.tag.toLowerCase().includes('grad'));
          const tag = isGrad ? 'Graduation' : (v.tag || "Video");
          const featured = v.featured === true || v.featured === 'true';
          return {
            id: v.id,
            title,
            description: title,
            category: "video",
            tag,
            imageUrl: v.thumbnailUrl || getCloudinaryThumbnail(v.url) || v.url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600',
            videoUrl: v.url,
            date: v.date || v.uploadedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            author: v.submittedBy ? `${v.submittedBy} (${v.role || 'Contributor'})` : "Anonymous",
            featured
          };
        });

        setVideoMemoriesList(videoMemories);
      } else {
        setVideoMemoriesList([]);
      }
    });

    // 5. Subscribe to approved community memories
    const unsubscribeCommMemories = subscribeCommunityMemories((commMemories) => {
      if (commMemories && commMemories.length > 0) {
        const mappedMemories: Memory[] = commMemories.map(comm => ({
          id: comm.id,
          title: comm.title,
          description: comm.caption,
          category: comm.mediaType === 'video' ? 'video' : 'parent',
          tag: comm.eventCategory,
          imageUrl: comm.mediaType === 'video' 
            ? (comm.thumbnailUrl || getCloudinaryThumbnail(comm.mediaUrl) || comm.mediaUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600')
            : comm.mediaUrl,
          videoUrl: comm.mediaType === 'video' ? comm.mediaUrl : undefined,
          date: comm.uploadDate,
          author: `${comm.contributorName} (${comm.className})`,
          featured: comm.featured || false
        }));

        const mappedContributions: ParentContribution[] = commMemories.map(comm => ({
          id: comm.id,
          photoUrl: comm.mediaType === 'image' ? comm.mediaUrl : 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600',
          caption: comm.caption,
          event: comm.eventCategory,
          contributorName: comm.contributorName,
          relation: comm.className || "Community Member",
          date: comm.uploadDate,
          approved: true
        }));

        setCommMemoriesList(mappedMemories);
        setCommContributions(mappedContributions);
      } else {
        setCommMemoriesList([]);
        setCommContributions([]);
      }
    });

    // 6. Subscribe to dynamic custom sections created by administrators
    const unsubscribeCustomSections = subscribeCustomSections((sections) => {
      setCustomSections(sections);
    });

    return () => {
      unsubscribeBanner();
      unsubscribePhotos();
      unsubscribeVideos();
      unsubscribeCommMemories();
      unsubscribeCustomSections();
    };
  }, []);

  // Ticker animation state: only pop up every 20 seconds
  const [isTickerVisible, setIsTickerVisible] = useState(true);

  useEffect(() => {
    if (!activeBanner?.active) return;
    let timer: NodeJS.Timeout;
    if (isTickerVisible) {
      // Stay visible for 14 seconds while moving across from left to right
      timer = setTimeout(() => {
        setIsTickerVisible(false);
      }, 14000);
    } else {
      // Pop up every 20 seconds
      timer = setTimeout(() => {
        setIsTickerVisible(true);
      }, 20000);
    }
    return () => clearTimeout(timer);
  }, [isTickerVisible, activeBanner?.active]);

  // Purge any rejected or deleted records automatically when admin is signed in
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        purgeRejectedAndDeletedFromFirestore();
      }
    });
    return () => unsubscribeAuth();
  }, []);



  // Color modification handler (Preset click)
  const handleChangePalette = (palette: SchoolPalette) => {
    setActivePalette(palette);
  };

  // Color modification handler (Custom color picker sliders)
  const handleCustomColorChange = (primary: string, accent: string) => {
    setActivePalette({
      id: 'custom',
      name: 'Custom Tailored School Palette',
      primary,
      primaryLight: primary + '20', // Add hex opacity of 12% for light variant
      primaryDark: '#0b0f19',
      accent,
      accentHover: accent,
      bgSecondary: '#f8fafc',
    });
  };

  // Memory additions
  const handleAddMemory = (newMemory: Memory) => {
    setCustomMemories((prev) => [newMemory, ...prev]);
  };

  const handleAddContribution = (newCont: ParentContribution) => {
    setParentContributions((prev) => [newCont, ...prev]);
  };



  // Build root style mapping CSS variables dynamically to the active school palette
  const activeStyles = {
    '--primary': activePalette.primary,
    '--primary-light': activePalette.primaryLight,
    '--primary-dark': activePalette.primaryDark,
    '--accent': activePalette.accent,
    '--accent-hover': activePalette.accentHover,
    '--bg-secondary': activePalette.bgSecondary,
  } as React.CSSProperties;

  if (!introCompleted) {
    return (
      <div style={activeStyles}>
        <IntroAnimation onComplete={() => setIntroCompleted(true)} />
      </div>
    );
  }

  return (
    <div
      style={activeStyles}
      className="min-h-screen bg-[#fafbfc]/80 font-sans text-gray-800 antialiased selection:bg-[var(--accent)] selection:text-white transition-colors duration-500 relative overflow-x-hidden"
      id="root-theme-wrapper"
    >
      {/* Fullscreen Media Viewer */}
      {fullscreenMedia && (
        <FullscreenMediaViewer
          isOpen={!!fullscreenMedia}
          items={fullscreenMedia.items}
          initialIndex={fullscreenMedia.currentIndex}
          onClose={handleCloseFullscreenMedia}
        />
      )}

      {/* Main Homepage Content Wrapper */}
      <div
        id="homepage-content-wrapper"
        className={fullscreenMedia ? "hidden" : "w-full pt-[44px]"}
      >
        {/* Visual Clean Up Mode Active notice banner across top of viewport */}
        {cleanUpMode && (
          <div
            id="cleanup-active-banner"
            className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white font-bold text-xs sm:text-sm py-3 px-6 shadow-2xl flex items-center justify-between border-b border-red-500 animate-pulse text-left"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-white animate-ping shrink-0" />
              <span>🧹 VISUAL CLEAN UP MODE ACTIVE — Click any pulsing red trash icon to delete records instantly.</span>
            </div>
            <button
              onClick={() => setCleanUpMode(false)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-[10px] font-extrabold uppercase tracking-widest rounded-lg border border-white/20 transition-all cursor-pointer shrink-0"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Dynamic Celebration Ticker/Announcement Banner - Pops up every 20s and moves sideways from left to right */}
        {activeBanner && activeBanner.active && isTickerVisible && (
          <div 
            id="realtime-celebration-banner"
            className="bg-gradient-to-r from-[var(--primary)] via-[var(--primary-dark)] to-[var(--accent)] text-white py-3 relative z-50 border-b border-white/10 shadow-lg animate-in fade-in slide-in-from-top duration-500 overflow-hidden w-full flex items-center"
          >
            <div className="w-full overflow-hidden whitespace-nowrap flex items-center">
              <div className="animate-marquee-ltr flex items-center gap-4 font-poppins font-bold text-sm sm:text-base tracking-wide px-4">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white shadow-sm shrink-0 animate-bounce">🎉</span>
                <span>{activeBanner.text}</span>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white shadow-sm shrink-0 animate-bounce">🎓</span>
              </div>
            </div>
          </div>
        )}

        {/* Absolute Ambient Glow Backdrops (Frosted Glass Theme) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[3%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-100/40 blur-[130px] animate-pulse-slow" />
          <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-100/30 blur-[150px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[45%] left-[-15%] w-[550px] h-[550px] rounded-full bg-blue-50/50 blur-[120px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
          <div className="absolute top-[70%] right-[-5%] w-[500px] h-[500px] rounded-full bg-amber-50/30 blur-[130px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-[2%] left-[10%] w-[600px] h-[600px] rounded-full bg-blue-100/30 blur-[140px] animate-pulse-slow" style={{ animationDelay: '3s' }} />
        </div>
        
        {/* Floating Interactive Branding Control Panel */}
        <BrandingControl
          activePalette={activePalette}
          onChangePalette={handleChangePalette}
          onCustomColorChange={handleCustomColorChange}
        />

        {/* Sticky Navigation Bar */}
        <Navbar currentView={currentView} setCurrentView={setCurrentView} onOpenAdmin={() => setIsAdminPortalOpen(true)} />

        {/* Main Content Sections */}
        <main className="w-full">
          {currentView === 'home' ? (
            <>
              {/* cinematic Slideshow Hero with Live Memory Showcase */}
              <Hero customMemories={customMemories} />

              {/* Principal Honour Section & Teachers Section */}
              <ScrollReveal variant="fade-up" duration={0.95}>
                <PrincipalHonourSection onCommentSubmitted={() => {}} />
              </ScrollReveal>

              <ScrollReveal variant="fade-up" duration={0.95}>
                <TeachersHonourSection onCommentSubmitted={() => {}} />
              </ScrollReveal>

              {/* Graduation 2026 Memorial (Official Year-Book Graduand Wall) */}
              <ScrollReveal variant="blur-reveal" duration={1.1}>
                <GraduandWall
                  cleanUpMode={cleanUpMode}
                  onUploadClick={() => {
                    setCurrentView('graduation-profile');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onViewAllClick={() => {
                    setCurrentView('graduates');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </ScrollReveal>

              {/* School Event Albums (Graduation, Sports, Carol, Science etc.) */}
              <ScrollReveal variant="fade-up" duration={0.9}>
                <FeaturedEvents />
              </ScrollReveal>

              {/* Graduation Ceremony Digital Memory Gallery Modal (Opened by clicking Graduation Ceremony Card) */}
              {isGraduationGalleryOpen && (
                <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300">
                  <div className="relative min-h-screen py-6 sm:py-10 px-2 sm:px-6">
                    {/* Sticky top bar for quick navigation */}
                    <div className="sticky top-4 z-[10000] max-w-7xl mx-auto px-4 flex justify-between items-center bg-slate-900/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/10 shadow-2xl mb-8">
                      <div className="flex items-center gap-3 text-white">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-white font-display leading-tight">
                            Graduation Ceremony Archive
                          </h3>
                          <p className="text-xs text-slate-400 hidden sm:block">
                            Explore photo & video highlights, or submit your own graduation memory
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsGraduationGalleryOpen(false)}
                        className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
                      >
                        <X className="w-4 h-4 shrink-0" />
                        <span>Close Gallery</span>
                      </button>
                    </div>

                    <GraduationCeremonyGallery onClose={() => setIsGraduationGalleryOpen(false)} />
                  </div>
                </div>
              )}

              {/* Masonry Memory Gallery on Main Page */}
              <ScrollReveal variant="fade-up" duration={0.95}>
                <MemoryGallery customMemories={customMemories} cleanUpMode={cleanUpMode} />
              </ScrollReveal>

              {/* Interactive Chronological Memory Timeline (2022 -> 2026) */}
              <ScrollReveal variant="blur-reveal" duration={1.1}>
                <TimelineSection cleanUpMode={cleanUpMode} />
              </ScrollReveal>

              {/* Dynamic Custom Board Sections managed in Real-Time by Admins */}
              <ScrollReveal variant="fade-up" duration={0.9}>
                <DynamicCustomSections sections={customSections} />
              </ScrollReveal>

              {/* Parent / Teacher Contribution Grid + interactive form */}
              <ScrollReveal variant="fade-up" duration={0.95}>
                <ParentContributions
                  onAddMemory={handleAddMemory}
                  parentContributions={parentContributions}
                  onAddContribution={handleAddContribution}
                  cleanUpMode={cleanUpMode}
                />
              </ScrollReveal>

              {/* Digital Guestbook Sentiment Sticky Notes Wall */}
              <ScrollReveal variant="fade-up" duration={0.95}>
                <GuestbookBoard cleanUpMode={cleanUpMode} />
              </ScrollReveal>
            </>
          ) : currentView === 'graduation-profile' ? (
            <GraduationProfileForm onBackToHome={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          ) : currentView === 'graduates' ? (
            <GraduatesDirectory onBackToHome={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} cleanUpMode={cleanUpMode} />
          ) : (
            <ShareMemory onBackToHome={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          )}
        </main>

        {/* Professional Contacts and Map Footer */}
        <Footer onOpenAdmin={() => setIsAdminPortalOpen(true)} />

        {/* Immersive Full-Screen Admin Portal */}
        <AdminPortal
          isOpen={isAdminPortalOpen}
          onClose={() => setIsAdminPortalOpen(false)}
          activePalette={activePalette}
          cleanUpMode={cleanUpMode}
          setCleanUpMode={setCleanUpMode}
        />

        {/* Global Live Resumable Upload Progress Modal */}
        <UploadProgressModal />
      </div>
    </div>
  );
}
