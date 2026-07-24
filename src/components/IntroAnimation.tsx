import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, ArrowRight } from 'lucide-react';

interface IntroAnimationProps {
  onComplete: () => void;
}

interface PrintPhoto {
  id: string;
  url: string;
  title: string;
  date: string;
  rotation: number;
  xOffset: number;
  yOffset: number;
}

const INTRO_PHOTOS: PrintPhoto[] = [
  {
    id: 'intro-1',
    url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=800',
    title: 'Classroom Innovators',
    date: 'Autumn 2023',
    rotation: -6,
    xOffset: -80,
    yOffset: -40,
  },
  {
    id: 'intro-2',
    url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=800',
    title: 'Athletic Spirit',
    date: 'Spring 2024',
    rotation: 5,
    xOffset: 90,
    yOffset: -60,
  },
  {
    id: 'intro-3',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800',
    title: 'Symphonious Choirs',
    date: 'Winter 2025',
    rotation: -3,
    xOffset: -40,
    yOffset: 80,
  },
  {
    id: 'intro-4',
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800',
    title: 'The Triumphant Cap Toss',
    date: 'June 2026',
    rotation: 4,
    xOffset: 30,
    yOffset: 20,
  },
];

export default function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(-1);
  const [showMessage, setShowMessage] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the intro
    const hasSeen = localStorage.getItem('has_seen_memory_intro');
    if (hasSeen === 'true') {
      onComplete();
      return;
    }

    // Play staggered reveal of photos
    const photoTimers: NodeJS.Timeout[] = [];
    
    INTRO_PHOTOS.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setActivePhotoIndex(idx);
      }, 500 + idx * 600); // Appear every 600ms
      photoTimers.push(timer);
    });

    // Show message after last photo
    const messageTimer = setTimeout(() => {
      setShowMessage(true);
    }, 500 + INTRO_PHOTOS.length * 600 + 200);

    // Initiate automatic exit
    const exitTimer = setTimeout(() => {
      handleExit();
    }, 4500);

    return () => {
      photoTimers.forEach(clearTimeout);
      clearTimeout(messageTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  const handleExit = () => {
    setIsExiting(true);
    localStorage.setItem('has_seen_memory_intro', 'true');
    setTimeout(() => {
      onComplete();
    }, 800); // Let exit animations play out
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          id="cinematic-intro-overlay"
          className="fixed inset-0 z-50 bg-[#090b11] text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden"
          exit={{ opacity: 0, filter: 'blur(15px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Top Bar with brand and skip option */}
          <div className="flex items-center justify-between w-full max-w-7xl mx-auto z-10">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[var(--accent)] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                Wisdom Link Digital Archive
              </span>
            </div>
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-white transition-all duration-300"
            >
              <span>Skip Experience</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Central Interactive Memory Table Stage */}
          <div className="relative flex-1 w-full max-w-4xl mx-auto flex items-center justify-center">
            {INTRO_PHOTOS.map((photo, index) => {
              const isVisible = index <= activePhotoIndex;
              return (
                <motion.div
                  key={photo.id}
                  style={{
                    x: photo.xOffset,
                    y: photo.yOffset,
                    rotate: photo.rotation,
                  }}
                  initial={{ 
                    opacity: 0, 
                    scale: 1.3,
                    y: photo.yOffset - 150, 
                    rotate: photo.rotation - 10,
                    filter: 'blur(4px)'
                  }}
                  animate={isVisible ? { 
                    opacity: 1, 
                    scale: 1,
                    y: photo.yOffset, 
                    rotate: photo.rotation,
                    filter: 'blur(0px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.45)'
                  } : {}}
                  transition={{
                    type: 'spring',
                    damping: 24,
                    stiffness: 90,
                  }}
                  className="absolute w-44 sm:w-60 md:w-64 bg-white p-3 pb-5 sm:p-4 sm:pb-7 rounded-sm border border-gray-100 shadow-2xl pointer-events-none"
                >
                  {/* Photo Container */}
                  <div className="aspect-[4/3] w-full bg-gray-50 overflow-hidden relative">
                    <img
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover grayscale-[0.1] contrast-[1.05]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent" />
                  </div>
                  {/* Title and Date Label (Polaroid Style) */}
                  <div className="mt-3.5 sm:mt-4 text-left">
                    <p className="font-mono text-[10px] sm:text-xs font-bold text-gray-900 tracking-tight leading-none">
                      {photo.title}
                    </p>
                    <p className="font-mono text-[8px] sm:text-[9px] text-gray-400 mt-1 leading-none font-medium">
                      {photo.date}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom message */}
          <div className="w-full max-w-2xl mx-auto text-center pb-6 sm:pb-10 z-10">
            <AnimatePresence>
              {showMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="text-sm sm:text-base font-serif italic text-gray-300">
                    "Every laugh, every challenge, every shared path."
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-[var(--accent)] uppercase mt-2.5 font-display">
                    These memories are being preserved.
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
