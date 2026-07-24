import React, { useState, useEffect } from 'react';
import { Menu, X, ShieldAlert, GraduationCap, Compass, BookOpen, Key } from 'lucide-react';
import { subscribeSchoolLogo } from '../services/firebaseService';
import { motion } from 'motion/react';

interface NavbarProps {
  currentView: 'home' | 'share-memory' | 'graduation-profile' | 'graduates';
  setCurrentView: (view: 'home' | 'share-memory' | 'graduation-profile' | 'graduates') => void;
  onOpenAdmin?: () => void;
}

export default function Navbar({ currentView, setCurrentView, onOpenAdmin }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [logoTapCount, setLogoTapCount] = useState(0);
  const tapTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = (e: React.MouseEvent) => {
    handleScrollTo(e, 'home');

    const newCount = logoTapCount + 1;
    setLogoTapCount(newCount);

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (newCount >= 5) {
      setLogoTapCount(0);
      if (onOpenAdmin) {
        onOpenAdmin();
      }
    } else {
      tapTimerRef.current = setTimeout(() => {
        setLogoTapCount(0);
      }, 2500);
    }
  };

  useEffect(() => {
    // Sync activeSection with currentView
    if (currentView === 'share-memory') {
      setActiveSection('share-memory');
    } else if (currentView === 'graduation-profile') {
      setActiveSection('graduation-profile');
    } else if (currentView === 'graduates') {
      setActiveSection('graduates');
    } else if (activeSection === 'share-memory' || activeSection === 'graduation-profile' || activeSection === 'graduates') {
      setActiveSection('home');
    }
  }, [currentView]);

  useEffect(() => {
    // Real-time school logo subscription
    const unsubscribe = subscribeSchoolLogo((logo) => {
      setCustomLogoUrl(logo);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (currentView === 'share-memory' || currentView === 'graduation-profile' || currentView === 'graduates') {
        setActiveSection(currentView);
        if (window.scrollY > 50) {
          setIsScrolled(true);
        } else {
          setIsScrolled(false);
        }
        return;
      }

      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      // Basic intersection observer simulation for active section
      const sections = ['home', 'graduation-highlights', 'events', 'gallery', 'timeline', 'contributions'];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom >= 120) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentView, activeSection]);

  const menuItems = [
    { label: 'Home', href: '#home', id: 'home' },
    { label: 'Graduates', href: '#graduates', id: 'graduates' },
    { label: 'Graduation Ceremony', href: '#graduation-highlights', id: 'graduation-highlights' },
    { label: 'Submit Bio', href: '#graduation-profile', id: 'graduation-profile' },
    { label: 'Events', href: '#events', id: 'events' },
    { label: 'Gallery', href: '#gallery', id: 'gallery' },
    { label: 'Timeline', href: '#timeline', id: 'timeline' },
    { label: 'Share a Memory', href: '#share-memory', id: 'share-memory' },
    { label: 'Contributions', href: '#contributions', id: 'contributions' },
  ];

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string, label?: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (id === 'graduation-profile') {
      setCurrentView('graduation-profile');
      setActiveSection('graduation-profile');
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      return;
    }

    if (id === 'graduation-highlights' || id === 'gallery') {
      if (currentView !== 'home') {
        setCurrentView('home');
      }
      window.dispatchEvent(new CustomEvent('open-graduation-gallery'));
      return;
    }

    if (id === 'graduates') {
      setCurrentView('graduates');
      setActiveSection('graduates');
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      return;
    }

    if (id === 'share-memory') {
      setCurrentView('share-memory');
      setActiveSection('share-memory');
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      return;
    }

    if (currentView !== 'home') {
      setCurrentView('home');
      setActiveSection(id);
      setTimeout(() => {
        const target = document.getElementById(id);
        if (target) {
          const offset = 80; // height of navbar
          const bodyRect = document.body.getBoundingClientRect().top;
          const elementRect = target.getBoundingClientRect().top;
          const elementPosition = elementRect - bodyRect;
          const offsetPosition = elementPosition - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 150);
    } else {
      const target = document.getElementById(id);
      if (target) {
        const offset = 80; // height of navbar
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = target.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <nav
      id="main-navigation"
      className={`fixed left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'top-4 mx-4 md:mx-8 bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl py-3 rounded-2xl md:rounded-full'
          : 'top-0 bg-gradient-to-b from-black/50 to-transparent py-5 text-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Brand Logo */}
          <a
            href="#home"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 group cursor-pointer"
            id="nav-logo"
            title="The Wisdom Link Model College (Tap 5 times for Admin Access)"
          >
            <div className={`rounded-xl transition-all duration-300 flex items-center justify-center overflow-hidden ${
              customLogoUrl ? 'p-1 w-10 h-10' : 'p-2'
            } ${
              isScrolled ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-white/15 text-white'
            }`}>
              {customLogoUrl ? (
                <img src={customLogoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
              ) : (
                <GraduationCap className="w-6 h-6 group-hover:scale-110 transition-transform" />
              )}
            </div>
            <div>
              <span className={`text-sm sm:text-base font-bold tracking-tight block ${isScrolled ? 'text-gray-900' : 'text-white'}`}>
                THE WISDOM LINK MODEL COLLEGE
              </span>
              <span className={`text-[10px] uppercase tracking-widest font-semibold block ${isScrolled ? 'text-gray-400' : 'text-gray-300'}`}>
                Digital Memory Archive
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-2" id="nav-desktop-links">
            {menuItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleScrollTo(e, item.id, item.label)}
                  className={`relative px-4 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-colors duration-300 group ${
                    isScrolled
                      ? isActive
                        ? 'text-[var(--primary)]'
                        : 'text-gray-600 hover:text-[var(--primary)]'
                      : isActive
                        ? 'text-white'
                        : 'text-gray-200 hover:text-white'
                  }`}
                >
                  <span className="relative z-10 transition-transform duration-300 group-hover:-translate-y-[1px] block">
                    {item.label}
                  </span>
                  
                  {isActive && (
                    <motion.span
                      layoutId="navActiveIndicator"
                      className={`absolute inset-0 rounded-full z-0 ${
                        isScrolled 
                          ? 'bg-white/70 shadow-sm border border-white/45' 
                          : 'bg-white/10 border border-white/10'
                      }`}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  
                  {/* Subtle hover underline */}
                  {!isActive && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-[1.5px] bg-current transition-all duration-300 group-hover:w-4/12 opacity-70" />
                  )}
                </a>
              );
            })}
          </div>

          {/* Right Action and Hamburger */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-xl lg:hidden focus:outline-none transition-colors ${
                isScrolled ? 'text-gray-800 hover:bg-gray-100' : 'text-white hover:bg-white/10'
              }`}
              aria-label="Toggle menu"
              id="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          id="nav-mobile-drawer"
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/98 text-white flex flex-col p-6 overflow-y-auto animate-in fade-in duration-200 shadow-2xl backdrop-blur-2xl"
        >
          {/* Mobile Drawer Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                {customLogoUrl ? (
                  <img src={customLogoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <GraduationCap className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div className="text-left">
                <span className="text-xs font-black tracking-tight text-white block">WISDOM LINK COLLEGE</span>
                <span className="text-[9px] uppercase tracking-widest text-amber-400 font-bold block">Digital Memory Archive</span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/10"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Links List */}
          <div className="flex flex-col gap-2 mt-6 text-left flex-1">
            {menuItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleScrollTo(e, item.id, item.label)}
                  className={`px-5 py-4 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 shadow-lg shadow-amber-500/20'
                      : 'text-gray-200 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />}
                </a>
              );
            })}
          </div>

          {/* Admin Portal Quick Access Button & Copyright */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-4 text-left">
            {onOpenAdmin && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="w-full py-3.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl border border-indigo-400/30 cursor-pointer"
              >
                <Key className="w-4 h-4 text-amber-300" />
                <span>Admin Dashboard Portal</span>
              </button>
            )}

            <div className="text-center text-[10px] text-gray-400 font-mono">
              © {new Date().getFullYear()} The Wisdom Link Model College. All Rights Reserved.
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
