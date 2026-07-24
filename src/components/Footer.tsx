import React, { useState, useEffect } from 'react';
import { GraduationCap, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, Heart } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface FooterProps {
  onOpenAdmin?: () => void;
}

export default function Footer({ onOpenAdmin }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [logoTapCount, setLogoTapCount] = useState(0);
  const tapTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleLogoTap = () => {
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

  const [footer, setFooter] = useState({
    logoUrl: '',
    backgroundImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1920',
    description: 'Preserving the beautiful smiles, triumphs, and shared stories of our student families for generations to come. Every moment matters.',
    phone: '+1 (555) 345-0922',
    email: 'archives@wisdomlinkcollege.edu',
    address: '450 Wisdom Link Avenue, Victoria Island, Lagos'
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cms_content", "footer"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFooter({
          logoUrl: data.logoUrl || '',
          backgroundImage: data.backgroundImage || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1920',
          description: data.description || 'Preserving the beautiful smiles, triumphs, and shared stories of our student families for generations to come. Every moment matters.',
          phone: data.phone || '+1 (555) 345-0922',
          email: data.email || 'archives@wisdomlinkcollege.edu',
          address: data.address || '450 Wisdom Link Avenue, Victoria Island, Lagos'
        });
      }
    }, (err) => {
      console.warn("Using default footer due to:", err);
    });
    return () => unsub();
  }, []);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
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

  return (
    <footer id="contact" className="bg-black/75 backdrop-blur-xl text-gray-300 pt-16 pb-8 border-t border-white/10 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Core footer links and details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          
          {/* Column 1: School Identity */}
          <div className="space-y-4">
            <div
              onClick={handleLogoTap}
              className="flex items-center gap-2.5 cursor-pointer group"
              title="The Wisdom Link Model College (Tap 5 times for Admin Access)"
            >
              <div className="p-2 bg-white/10 rounded-xl text-white border border-white/10 backdrop-blur-md group-hover:scale-105 transition-transform">
                {footer.logoUrl ? (
                  <img src={footer.logoUrl} alt="School Logo" className="w-6 h-6 object-contain rounded-md" referrerPolicy="no-referrer" />
                ) : (
                  <GraduationCap className="w-6 h-6 text-[var(--accent)]" />
                )}
              </div>
              <div className="text-left">
                <span className="text-sm sm:text-base font-bold text-white tracking-tight block">
                  THE WISDOM LINK MODEL COLLEGE
                </span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--accent)] block">
                  Memories & Legacy
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-normal">
              {footer.description}
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3 pt-2">
              <a href="#" className="p-2 rounded-lg bg-white/5 hover:bg-[var(--accent)] hover:text-white transition-all border border-white/5" aria-label="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-white/5 hover:bg-[var(--accent)] hover:text-white transition-all border border-white/5" aria-label="Twitter">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-white/5 hover:bg-[var(--accent)] hover:text-white transition-all border border-white/5" aria-label="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-white/5 hover:bg-[var(--accent)] hover:text-white transition-all border border-white/5" aria-label="LinkedIn">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Contact Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Contact Info</h3>
            <ul className="space-y-3 text-xs sm:text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <span>{footer.address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>{footer.phone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>{footer.email}</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick Archives</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="#graduation-highlights" onClick={(e) => handleScrollTo(e, 'graduation-highlights')} className="hover:text-white transition-colors">
                  Graduation Highlights
                </a>
              </li>
              <li>
                <a href="#events" onClick={(e) => handleScrollTo(e, 'events')} className="hover:text-white transition-colors">
                  School Event Albums
                </a>
              </li>
              <li>
                <a href="#gallery" onClick={(e) => handleScrollTo(e, 'gallery')} className="hover:text-white transition-colors">
                  Digital Gallery
                </a>
              </li>
              <li>
                <a href="#timeline" onClick={(e) => handleScrollTo(e, 'timeline')} className="hover:text-white transition-colors">
                  Memory Timeline
                </a>
              </li>
              <li>
                <a href="#contributions" onClick={(e) => handleScrollTo(e, 'contributions')} className="hover:text-white transition-colors">
                  Community Guestbook
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Location Map Preview placeholder */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Our Campus Ground</h3>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5 h-28 relative">
              {/* Mock map graphic */}
              <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url('${footer.backgroundImage}')` }} />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-center p-3">
                <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  <span>Wisdom Link Campus</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 leading-normal font-normal">
              Located adjacent to Victoria Island Educational Sanctuary. Tours can be scheduled via our admissions office.
            </p>
          </div>

        </div>

        {/* Bottom footer credit & terms */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {currentYear} The Wisdom Link Model College. All Rights Reserved. Preserving memories permanently since 1991.</p>
          
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>Powered by</span>
            <span className="font-bold text-white hover:text-[var(--accent)] transition-colors">Crowns Digital</span>
            <Heart className="w-3 h-3 text-red-500 fill-current" />
          </div>
        </div>

      </div>
    </footer>
  );
}
