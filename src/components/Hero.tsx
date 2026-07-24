import { useState, useEffect, useRef } from 'react';
import { Camera, Calendar, ArrowDown, ChevronLeft, ChevronRight, Shuffle, HardDrive, Users, FolderHeart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Memory } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface HeroSlide {
  id: string;
  url: string;
  label: string;
  desc: string;
  date: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-graduation',
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1920',
    label: 'The Triumphant Cap Toss',
    desc: 'The Wisdom Link Model College Class of 2026 takes their final bow, celebrating a shared path and timeless friendships.',
    date: 'June 18, 2026'
  },
  {
    id: 'slide-innovators',
    url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1920',
    label: 'Classroom Innovations',
    desc: 'Unlocking raw logic and creative thinking inside modern research labs and seminar circles.',
    date: 'Autumn 2025'
  },
  {
    id: 'slide-athletics',
    url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1920',
    label: 'Sports Championships',
    desc: 'Moments of pure sweat, sportsmanship, and historic team records under the stadium lights.',
    date: 'Spring 2025'
  },
  {
    id: 'slide-symphony',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1920',
    label: 'Annual Orchestra Gala',
    desc: 'A magnificent winter evening of musical harmonies, student solos, and choir composition.',
    date: 'Winter 2025'
  },
  {
    id: 'slide-reunions',
    url: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=1920',
    label: 'Yearbook Signing Circles',
    desc: 'Tears, laughs, and final vows written on the margins of fresh yearbooks and canvas shirts.',
    date: 'June 17, 2026'
  }
];

// Fallback high-quality Unsplash images for different categories to enrich the Shuffle collage if Firestore has few images
const FALLBACK_COLLAGE_POOL: HeroSlide[] = [
  {
    id: 'f-grad',
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800',
    label: 'Graduation Ceremony',
    desc: 'wisdom link commencement capping',
    date: 'June 15, 2026'
  },
  {
    id: 'f-sports',
    url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=800',
    label: 'Sports Day 2026',
    desc: '100m sprint photo finish',
    date: 'May 12, 2026'
  },
  {
    id: 'f-science',
    url: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=800',
    label: 'Science & Robotics',
    desc: 'coding autonomous eco-sensors',
    date: 'March 20, 2026'
  },
  {
    id: 'f-arts',
    url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=800',
    label: 'Cultural Day Fest',
    desc: 'vibrant theatrical performances',
    date: 'Feb 14, 2026'
  },
  {
    id: 'f-excursion',
    url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800',
    label: 'Museum Field Trip',
    desc: 'discovering deep archaeology',
    date: 'Nov 08, 2025'
  },
  {
    id: 'f-music',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800',
    label: 'Candlelight Choir',
    desc: 'winter music recital choir',
    date: 'Dec 18, 2025'
  },
  {
    id: 'f-chemistry',
    url: 'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&q=80&w=800',
    label: 'Chemistry Lab Trials',
    desc: 'precision molecule synthesis',
    date: 'Oct 15, 2025'
  },
  {
    id: 'f-clubs',
    url: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800',
    label: 'Yearbook Editorial',
    desc: 'class of 2026 signature desk',
    date: 'June 17, 2026'
  }
];

// Image Optimization Utility
function getOptimizedImageUrl(url: string | undefined | null, width = 500): string {
  if (!url) return '';
  if (url.includes('cloudinary.com') && url.includes('/image/upload/')) {
    return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`);
  }
  if (url.includes('images.unsplash.com')) {
    if (url.includes('w=')) {
      return url.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, 'q=80');
    }
    return `${url}&w=${width}&q=80&auto=format&fit=crop`;
  }
  return url;
}

interface ImagePayload {
  id: string;
  url: string;
  label: string;
  desc: string;
  date: string;
}

interface HeroProps {
  customMemories?: Memory[];
}

export default function Hero({ customMemories = [] }: HeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isShufflingAll, setIsShufflingAll] = useState(false);
  const [slides, setSlides] = useState<HeroSlide[]>(HERO_SLIDES);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cms_content", "hero"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.slides && data.slides.length > 0) {
          setSlides(data.slides);
        } else {
          setSlides(HERO_SLIDES);
        }
      }
    }, (err) => {
      console.warn("Using default hero slides due to:", err);
      setSlides(HERO_SLIDES);
    });
    return () => unsub();
  }, []);
  
  // 5 active polaroid card slots on screen
  const [slots, setSlots] = useState<ImagePayload[]>([]);
  const recentlyUsedRef = useRef<string[]>([]);
  const allAvailableImagesRef = useRef<ImagePayload[]>([]);

  // Statistics dynamically based on live collections + some default base
  const [liveStats, setLiveStats] = useState({
    files: 1420,
    graduands: 186,
    stories: 42
  });

  // 1. Compute and track all approved images from Firestore + fallsbacks
  useEffect(() => {
    // Collect all unique approved image memories
    const liveImages: ImagePayload[] = customMemories
      .filter(m => m.category !== 'video' && m.imageUrl)
      .map(m => ({
        id: m.id,
        url: m.imageUrl,
        label: m.title || m.tag || 'School Memory',
        desc: m.description || 'Approved school memories archive.',
        date: m.date || 'Class of 2026'
      }));

    // Merge with high-quality fallback pool to ensure rich selection and prevent empty states
    const combined: ImagePayload[] = [];
    const URLs = new Set<string>();

    liveImages.forEach(img => {
      if (!URLs.has(img.url)) {
        URLs.add(img.url);
        combined.push(img);
      }
    });

    FALLBACK_COLLAGE_POOL.forEach(img => {
      if (!URLs.has(img.url)) {
        URLs.add(img.url);
        combined.push(img);
      }
    });

    allAvailableImagesRef.current = combined;

    // Update Live stats dynamically
    setLiveStats({
      files: 1420 + liveImages.length,
      graduands: 186,
      stories: 42 + liveImages.length
    });

    // Initialize Slots if empty
    if (slots.length === 0 && combined.length > 0) {
      const initialSlots: ImagePayload[] = [];
      const shuffled = [...combined].sort(() => 0.5 - Math.random());
      for (let i = 0; i < Math.min(5, shuffled.length); i++) {
        initialSlots.push(shuffled[i]);
        recentlyUsedRef.current.push(shuffled[i].url);
      }
      setSlots(initialSlots);
    }
  }, [customMemories]);

  // 2. Preload upcoming images in the background to ensure high performance
  useEffect(() => {
    if (allAvailableImagesRef.current.length > 0) {
      allAvailableImagesRef.current.slice(0, 15).forEach(img => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = getOptimizedImageUrl(img.url, 500);
        document.head.appendChild(link);
      });
    }
  }, [slots]);

  // 3. Auto rotation for Ken Burns Background Slideshow
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 9000);
    return () => clearInterval(timer);
  }, [currentSlide]);

  // 4. Continuous, progressive individual card swapping timer (every 3.8 seconds)
  useEffect(() => {
    const swapTimer = setInterval(() => {
      if (allAvailableImagesRef.current.length <= 5 || isShufflingAll) return;

      // Pick a random slot index (0 to 4) to swap
      const slotIndexToSwap = Math.floor(Math.random() * 5);
      
      // Get all currently visible URLs in other slots to prevent duplicate display
      const visibleUrls = slots.map(s => s.url);

      // Candidate pool: not currently visible
      let candidates = allAvailableImagesRef.current.filter(img => !visibleUrls.includes(img.url));

      // Prioritize candidates not recently displayed
      let priorityCandidates = candidates.filter(img => !recentlyUsedRef.current.includes(img.url));

      let selected: ImagePayload;
      if (priorityCandidates.length > 0) {
        selected = priorityCandidates[Math.floor(Math.random() * priorityCandidates.length)];
      } else {
        // If all candidates were recently used, clear history excluding visible ones, and pick
        recentlyUsedRef.current = recentlyUsedRef.current.filter(url => visibleUrls.includes(url));
        selected = candidates[Math.floor(Math.random() * candidates.length)];
      }

      if (selected) {
        // Swap this slot dynamically
        setSlots(prev => {
          const nextSlots = [...prev];
          nextSlots[slotIndexToSwap] = selected;
          return nextSlots;
        });

        // Add to recently used
        recentlyUsedRef.current.push(selected.url);
        if (recentlyUsedRef.current.length > allAvailableImagesRef.current.length * 0.6) {
          recentlyUsedRef.current.shift(); // keep it fresh
        }
      }
    }, 3800);

    return () => clearInterval(swapTimer);
  }, [slots, isShufflingAll]);

  const handleNext = () => {
    if (slides.length === 0) return;
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    if (slides.length === 0) return;
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // 5. Scramble all 5 slots simultaneously on click with premium visual effect
  const handleShuffleDeck = () => {
    if (isShufflingAll || allAvailableImagesRef.current.length < 5) return;
    setIsShufflingAll(true);

    // Scramble completely
    const scrambled: ImagePayload[] = [];
    const pool = [...allAvailableImagesRef.current].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < 5; i++) {
      scrambled.push(pool[i]);
    }

    setSlots(scrambled);
    
    // Clear and replenish recently used
    recentlyUsedRef.current = scrambled.map(s => s.url);

    setTimeout(() => {
      setIsShufflingAll(false);
    }, 600);
  };

  // Open Fullscreen media view when clicking polaroid
  const handleCardClick = (url: string, label: string, desc: string, date: string) => {
    const event = new CustomEvent('open-fullscreen-media', {
      detail: {
        items: [{
          id: `hero-f-${Date.now()}`,
          type: 'photo',
          url: url,
          title: label,
          description: desc,
          author: 'Archived Memory',
          date: date
        }],
        currentIndex: 0
      }
    });
    window.dispatchEvent(event);
  };

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = target.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Coordinate configurations for the 5-slot scattered polaroid collage
  const slotStyles = [
    // Slot 1: Top Left
    { class: 'top-2 left-2 rotate-[-5deg] w-[140px] sm:w-[160px] md:w-[170px]', delay: 0 },
    // Slot 2: Top Right
    { class: 'top-8 right-2 rotate-[6deg] w-[150px] sm:w-[170px] md:w-[180px]', delay: 0.15 },
    // Slot 3: Center focus overlap
    { class: 'top-[115px] left-[75px] sm:left-[95px] md:left-[110px] rotate-[3deg] w-[170px] sm:w-[190px] md:w-[210px] z-20 scale-102 shadow-2xl', delay: 0.3 },
    // Slot 4: Bottom Left
    { class: 'bottom-1 left-4 rotate-[-4deg] w-[135px] sm:w-[155px] md:w-[165px]', delay: 0.45 },
    // Slot 5: Bottom Right
    { class: 'bottom-2 right-4 rotate-[5deg] w-[145px] sm:w-[165px] md:w-[175px]', delay: 0.6 }
  ];

  return (
    <header id="home" className="relative min-h-screen w-full overflow-hidden bg-slate-950 flex flex-col justify-between py-24 px-4 sm:px-6 lg:px-8">
      
      {/* 1. Cinematic Background Slideshow with Ken Burns Effect */}
      <div id="hero-slideshow-container" className="absolute inset-0 z-0">
        <AnimatePresence mode="popLayout">
          {slides[currentSlide] && (
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full"
            >
              <motion.img
                src={getOptimizedImageUrl(slides[currentSlide].url, 1400)}
                alt={slides[currentSlide].label}
              initial={{ scale: 1.01, x: 0, y: 0 }}
              animate={{ 
                scale: 1.07, 
                x: [-3, 3, -3],
                y: [-2, 2, -2]
              }}
              transition={{ 
                duration: 9, 
                ease: 'linear',
                repeat: Infinity,
                repeatType: 'reverse'
              }}
              className="w-full h-full object-cover filter brightness-[0.22] saturate-[0.7] contrast-[1.05]"
              referrerPolicy="no-referrer"
            />
            {/* Soft, rich dark gradient overlays for enhanced legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-transparent to-slate-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-transparent to-slate-950/65" />
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Nostalgic Overlays: Vintage Film Grain & Ambient Warm Light Leaks */}
      <div className="absolute inset-0 pointer-events-none z-10 mix-blend-screen opacity-[0.12] bg-radial-gradient from-amber-400/20 via-transparent to-transparent blur-[120px]" />
      <div className="absolute top-[10%] right-[15%] w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-[130px] pointer-events-none z-10 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none z-10 animate-pulse" style={{ animationDuration: '10s' }} />

      {/* 3. Main Split-Screen Layout (Archive Title & Stats vs. Interactive Collage) */}
      <div className="relative z-20 max-w-7xl w-full mx-auto flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8 mt-4">
        
        {/* LEFT COLUMN: Premium Editorial Archive Title & Call to Actions */}
        <div className="flex-1 text-left max-w-2xl space-y-8 lg:pr-6">
          
          {/* Custom Capsule Badge */}
          <motion.div 
            className="inline-flex"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-[10px] sm:text-xs font-bold text-amber-400 tracking-widest uppercase shadow-2xl">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Wisdom Link Memory Showcase</span>
            </span>
          </motion.div>

          {/* Epic Main Header */}
          <div className="space-y-4">
            <motion.h1 
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.08] font-display"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <span className="block text-gray-400 font-medium text-lg sm:text-xl font-mono uppercase tracking-[0.25em] mb-3">
                Digital Memory Archive
              </span>
              <span className="block">Preserving the</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-white">
                Class of 2026.
              </span>
            </motion.h1>

            <motion.p 
              className="text-sm sm:text-base text-gray-300 leading-relaxed font-normal max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
            >
              Welcome to our living scrapbook. This interactive gallery automatically aggregates, verifies, and showcases approved media contributions from graduation days, athletic triumphs, and scientific exhibits in real time.
            </motion.p>
          </div>

          {/* Interactive Live Archive Statistics Board */}
          <motion.div 
            className="grid grid-cols-3 gap-4.5 p-4.5 rounded-2xl bg-slate-900/65 backdrop-blur-md border border-white/5 shadow-xl max-w-lg"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <div className="space-y-1 text-left">
              <span className="font-mono text-[9px] text-gray-500 uppercase tracking-widest font-bold block">Archived Files</span>
              <span className="text-xl sm:text-2xl font-black text-white font-display flex items-center gap-1.5 justify-start">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span>{liveStats.files.toLocaleString()}</span>
              </span>
              <span className="text-[9px] text-emerald-400 font-semibold block">● Live Stream</span>
            </div>
            <div className="space-y-1 border-x border-white/5 px-4 text-left">
              <span className="font-mono text-[9px] text-gray-500 uppercase tracking-widest font-bold block">Graduands</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-display flex items-center gap-1.5 justify-start">
                <Users className="w-4 h-4 text-white" />
                <span>{liveStats.graduands}</span>
              </span>
              <span className="text-[9px] text-slate-400 block">Enrolled profiles</span>
            </div>
            <div className="space-y-1 text-left">
              <span className="font-mono text-[9px] text-gray-500 uppercase tracking-widest font-bold block">Shared Hearts</span>
              <span className="text-xl sm:text-2xl font-black text-white font-display flex items-center gap-1.5 justify-start">
                <FolderHeart className="w-4 h-4 text-pink-400" />
                <span>{liveStats.stories}+</span>
              </span>
              <span className="text-[9px] text-slate-400 block">Parent stories</span>
            </div>
          </motion.div>

          {/* Action Call buttons removed to keep hero layout clean and spacious as requested */}


        </div>

        {/* RIGHT COLUMN: The Interactive Dynamic Floating Collage */}
        <div className="flex-1 w-full max-w-md lg:max-w-xl flex flex-col items-center justify-center relative min-h-[440px] md:min-h-[480px]">
          
          <div className="relative w-full h-[370px] sm:h-[400px]">
            {slots.map((img, idx) => {
              if (!img) return null;
              const config = slotStyles[idx] || slotStyles[0];

              return (
                <motion.div
                  key={`${img.id}-${idx}`}
                  style={{ zIndex: idx === 2 ? 30 : 10 + idx }}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    y: [0, -10, 0], // Floating motion
                  }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  whileHover={{ 
                    scale: 1.05, 
                    zIndex: 40,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' 
                  }}
                  transition={{
                    y: {
                      repeat: Infinity,
                      duration: 4 + (idx % 3),
                      ease: "easeInOut",
                    },
                    scale: { type: 'spring', stiffness: 120, damping: 15 },
                    opacity: { duration: 0.4 }
                  }}
                  onClick={() => handleCardClick(img.url, img.label, img.desc, img.date)}
                  className={`absolute ${config.class} bg-white p-2.5 pb-5 rounded-sm border border-slate-100 shadow-xl cursor-pointer select-none`}
                >
                  {/* Photo Canvas */}
                  <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden relative group">
                    <img 
                      src={getOptimizedImageUrl(img.url, 400)} 
                      alt={img.label} 
                      className="w-full h-full object-cover filter saturate-[1.02] contrast-[1.03]"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="px-2 py-1 bg-amber-400 text-slate-950 font-mono text-[7px] font-black uppercase tracking-widest rounded-full shadow">
                        View
                      </span>
                    </div>
                  </div>

                  {/* Handwriting text line */}
                  <div className="mt-2.5 text-left border-t border-slate-100 pt-2">
                    <h5 className="font-mono text-[9px] font-black text-slate-800 tracking-tight leading-none uppercase truncate">
                      {img.label}
                    </h5>
                    <p className="font-mono text-[7px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                      {img.date}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Album Shuffle and navigation buttons */}
          <div className="flex items-center gap-4.5 mt-4 relative z-30">
            <button
              onClick={handlePrev}
              className="p-3 rounded-full border border-white/10 bg-slate-900/65 text-white hover:bg-white hover:text-slate-950 active:scale-95 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 cursor-pointer flex items-center justify-center shadow-md"
              title="Previous Slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleShuffleDeck}
              disabled={isShufflingAll}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-slate-900 hover:bg-slate-850 text-amber-400 border border-amber-400/30 hover:border-amber-400 font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all duration-300 cursor-pointer shadow-md disabled:opacity-55"
            >
              <Shuffle className={`w-3.5 h-3.5 ${isShufflingAll ? 'animate-spin' : ''}`} />
              <span>Shuffle Album</span>
            </button>

            <button
              onClick={handleNext}
              className="p-3 rounded-full border border-white/10 bg-slate-900/65 text-white hover:bg-white hover:text-slate-950 active:scale-95 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 cursor-pointer flex items-center justify-center shadow-md"
              title="Next Slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* 4. Elegant Scrolling Down Indicator */}
      <div className="relative z-20 w-full flex justify-center items-center mt-6">
        <button
          onClick={() => scrollToSection('graduation-highlights')}
          className="flex flex-col items-center gap-1 text-white/50 hover:text-amber-400 transition-all duration-300 animate-bounce group cursor-pointer"
          aria-label="Scroll Down"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-gray-400 group-hover:text-amber-400 transition-colors">
            Enter Vault
          </span>
          <ArrowDown className="w-4 h-4 text-gray-400 group-hover:text-amber-400 transition-colors" />
        </button>
      </div>

    </header>
  );
}
