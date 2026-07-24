import { useState, useEffect, useRef } from 'react';
import { Calendar, ArrowRight, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { FEATURED_EVENTS } from '../data/schoolData';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getOptimizedImageUrl } from '../utils/imageUtils';

export default function FeaturedEvents() {
  const [events, setEvents] = useState<any[]>(FEATURED_EVENTS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cms_content", "school_events"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
        } else {
          setEvents(FEATURED_EVENTS);
        }
      }
    }, (err) => {
      console.warn("Using default school events due to:", err);
      setEvents(FEATURED_EVENTS);
    });
    return () => unsub();
  }, []);

  const handleScrollToGallery = (tag: string) => {
    if (tag.toLowerCase().includes('graduation')) {
      window.dispatchEvent(new CustomEvent('open-graduation-gallery'));
      return;
    }

    // Scroll to gallery
    const target = document.getElementById('gallery');
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

    // Attempt to set filter if active
    const event = new CustomEvent('filter-gallery-tag', { detail: tag });
    window.dispatchEvent(event);
  };

  return (
    <section id="events" className="py-20 bg-transparent relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] glass-pill px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Preserved Milestones</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Major Preserved School Events
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-xl mx-auto">
            Relive our primary annual milestones. Click on any event to view its fully cataloged digital image gallery.
          </p>
          <div className="h-1 w-20 bg-[var(--accent)] mx-auto mt-4 rounded-full" />
        </div>

        {/* Side Scrollable Events Container */}
        <div className="relative group/scroll px-2 sm:px-0">
          {/* Navigation Arrows for Desktop */}
          <button
            onClick={() => handleScroll('left')}
            className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-xl border border-gray-200 items-center justify-center transition-all hover:scale-110 active:scale-95"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          <button
            onClick={() => handleScroll('right')}
            className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-xl border border-gray-200 items-center justify-center transition-all hover:scale-110 active:scale-95"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>

          {/* Side Scroll Track */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 pt-2 px-1 scrollbar-none scroll-smooth"
            id="events-grid"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {events.map((event) => (
              <article
                key={event.title}
                onClick={() => handleScrollToGallery(event.title)}
                className="flex flex-col glass-card overflow-hidden shadow-xl border border-white/60 group hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 w-[82vw] sm:w-[320px] md:w-[340px] shrink-0 snap-start rounded-2xl cursor-pointer"
              >
                {/* Cover Image Container */}
                <div className="relative h-48 w-full overflow-hidden shrink-0 bg-slate-950">
                  <img
                    src={getOptimizedImageUrl(event.image, 500)}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Tag Overlay */}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider shadow-sm border border-white/50">
                    {event.category}
                  </div>
                </div>

                {/* Event Text Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    {/* Event Date */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>{event.date}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-snug group-hover:text-[var(--primary)] transition-colors">
                      {event.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-3">
                      {event.description}
                    </p>
                  </div>

                  {/* Footer Trigger */}
                  <div className="mt-5 pt-4 border-t border-gray-50">
                    <button
                      onClick={() => handleScrollToGallery(event.title)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors group/btn"
                    >
                      <span>View Gallery</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Swipe indicator hint on mobile */}
          <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-400 mt-2 sm:hidden">
            <span>Swipe sideways to view all milestones</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
          </div>
        </div>

      </div>
    </section>
  );
}
