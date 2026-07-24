import React, { useState, useEffect } from 'react';
import { CalendarDays, Flag, Milestone, ArrowUpRight, Trash2 } from 'lucide-react';
import { TIMELINE_DATA } from '../data/schoolData';
import { TimelineEvent } from '../types';
import { subscribeTimeline } from '../services/firebaseService';
import { db } from '../firebase';
import { doc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface TimelineSectionProps {
  cleanUpMode: boolean;
}

export default function TimelineSection({ cleanUpMode }: TimelineSectionProps) {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [dbEvents, setDbEvents] = useState<TimelineEvent[]>([]);
  const [history, setHistory] = useState({
    coverImage: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
    title: 'A Legacy of Excellence Since 1991',
    description: 'The Wisdom Link Model College was founded with a singular vision: to cultivate character, champion intellectual rigor, and foster an environment of continuous growth. Over the last three decades, our campus has expanded, but our core devotion to family, academic brilliance, and athletic triumph remains unaltered.',
    gallery: [] as string[]
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cms_content", "history"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHistory({
          coverImage: data.coverImage || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
          title: data.title || 'A Legacy of Excellence Since 1991',
          description: data.description || 'The Wisdom Link Model College was founded with a singular vision: to cultivate character, champion intellectual rigor, and foster an environment of continuous growth. Over the last three decades, our campus has expanded, but our core devotion to family, academic brilliance, and athletic triumph remains unaltered.',
          gallery: data.gallery || []
        });
      }
    }, (err) => {
      console.warn("Using default history config due to:", err);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeTimeline((events) => {
      setDbEvents(events);
    });
    return () => unsub();
  }, []);

  // Parse year from event date string (e.g. "2026-06-15" -> 2026, or if just "2026" -> 2026)
  const getEventYear = (dateStr: string): number => {
    if (!dateStr) return 2026;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      const y = parseInt(parts[0], 10);
      return isNaN(y) ? 2026 : y;
    }
    const y = parseInt(dateStr, 10);
    return isNaN(y) ? 2026 : y;
  };

  // Filter Firestore events for the active year
  const activeDbEvents = dbEvents.filter(evt => getEventYear(evt.date) === selectedYear);

  // Fallback / original timeline data
  const staticTimelineGroup = TIMELINE_DATA.find((t) => t.year === selectedYear) || TIMELINE_DATA[0];

  // Map static milestones to uniform TimelineEvent structure so we can render them together
  const mappedStaticEvents: TimelineEvent[] = staticTimelineGroup.milestones.map((m, idx) => ({
    id: `static-${selectedYear}-${idx}`,
    date: `${selectedYear}-06-15`,
    title: m.title,
    description: m.description,
    image: m.image,
  }));

  // Combine them, filtering out any static items if we have exact duplicates (by title)
  const combinedEvents = [
    ...activeDbEvents,
    ...mappedStaticEvents.filter(se => !activeDbEvents.some(de => de.title.toLowerCase() === se.title.toLowerCase()))
  ];

  const handleDelete = async (evt: TimelineEvent) => {
    if (!confirm(`Are you sure you want to permanently delete milestone "${evt.title}" from the history timeline?`)) {
      return;
    }
    try {
      if (evt.id.startsWith('static-')) {
        // Static item: just alert that it's a seeded layout item or filter it out, or delete it from firestore if they create it there
        alert('This is a core template milestone. To prune it, use the administrative panel to register custom entries.');
        return;
      }
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'timeline', evt.id));
      
      // Clean up Cloudinary asset if applicable
      if (evt.image && evt.image.includes('cloudinary.com')) {
        fetch('/api/delete-cloudinary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: evt.image }),
        }).catch((err) => console.error('Cloudinary asset cleanup error:', err));
      }
    } catch (err: any) {
      console.error('Failed to delete timeline milestone:', err);
    }
  };

  return (
    <section id="timeline" className="py-20 bg-transparent relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] glass-pill px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3">
            <Milestone className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Interactive History</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Wisdom Link Memory Timeline
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-xl mx-auto">
            Travel back in time. Select a year to unfold the historic themes and major milestones that defined our academy.
          </p>
          <div className="h-1 w-20 bg-[var(--accent)] mx-auto mt-4 rounded-full" />
        </div>

        {/* School Legacy Intro Card */}
        <div className="glass-card overflow-hidden border border-white/60 shadow-2xl mb-16 grid grid-cols-1 md:grid-cols-12 gap-0 text-left">
          <div className="md:col-span-5 h-64 md:h-auto min-h-[250px] relative">
            <img 
              src={history.coverImage} 
              alt={history.title} 
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/50 to-transparent" />
          </div>
          <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-4">
            <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest block">Our Foundations</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-snug">
              {history.title}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed font-normal">
              {history.description}
            </p>
            {history.gallery && history.gallery.length > 0 && (
              <div className="pt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Historical Snapshot Gallery</p>
                <div className="flex flex-wrap gap-2">
                  {history.gallery.map((img: string, i: number) => (
                    <img 
                      key={i} 
                      src={img} 
                      alt="Legacy Gallery" 
                      className="w-12 h-12 rounded-lg object-cover border border-gray-100 hover:scale-105 transition-transform cursor-pointer shadow-sm"
                      referrerPolicy="no-referrer"
                      onClick={() => {
                        const event = new CustomEvent('open-fullscreen-media', {
                          detail: {
                            items: history.gallery.map((url: string) => ({
                              id: `legacy-g-${url}`,
                              type: 'photo',
                              url: url,
                              title: 'Legacy Gallery Asset',
                              description: 'Historical archive asset managed by Administrator.',
                              author: 'School Archivist',
                              date: 'Archive'
                            })),
                            currentIndex: i
                          }
                        });
                        window.dispatchEvent(event);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Horizontal Year Picker Navigation */}
        <div className="relative mb-14 max-w-2xl mx-auto overflow-x-auto pb-3 no-scrollbar scrollbar-none" id="timeline-navigation-container">
          {/* Horizontal Trace Line connector */}
          <div className="absolute top-6 left-6 right-6 h-0.5 bg-white/40 z-0 hidden sm:block" />
          
          {/* Active indicator colored slide (simulated) */}
          <div className="relative flex justify-between items-center z-10 gap-6 sm:gap-0 min-w-[480px] sm:min-w-0 px-4 sm:px-0">
            {TIMELINE_DATA.map((t) => {
              const isSelected = selectedYear === t.year;
              return (
                <button
                  key={t.year}
                  onClick={() => setSelectedYear(t.year)}
                  className={`flex flex-col items-center gap-2 group cursor-pointer focus:outline-none shrink-0 ${
                    isSelected ? 'scale-110' : 'hover:scale-105'
                  } transition-all duration-300`}
                >
                  {/* Circle Pin */}
                  <div
                    className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-sm tracking-tight transition-all shadow-md ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white border-[var(--accent)] scale-110'
                        : 'bg-white/40 backdrop-blur-md text-gray-600 border-white/50 hover:bg-white/60'
                    }`}
                  >
                    {t.year}
                  </div>
                  
                  {/* Label tag */}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      isSelected ? 'text-[var(--primary)]' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    Class of {t.year}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Year Milestone View Card */}
        <div className="glass-card-heavy p-6 sm:p-10 border border-white/60 shadow-2xl" id="timeline-content-panel">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Year Cover Details */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-5xl font-extrabold text-[var(--primary)] font-serif">
                  {selectedYear}
                </span>
                <span className="h-8 w-1 bg-[var(--accent)] rounded" />
                <div className="text-left">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Year Theme</p>
                  <p className="text-sm font-bold text-gray-800 uppercase tracking-wide truncate max-w-[150px]">
                    {staticTimelineGroup.theme}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-500 leading-relaxed pt-2 text-left">
                {staticTimelineGroup.description}
              </p>

              <div className="p-4 bg-white/45 border border-white/50 backdrop-blur-md rounded-xl flex items-start gap-3 text-left">
                <Flag className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-gray-800">Historical Archives Log</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    This year contains {combinedEvents.length} certified core historical logs in database.
                  </p>
                </div>
              </div>
            </div>

            {/* Milestones Cards List */}
            <div className="lg:col-span-8 space-y-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
                <span>Certified Milestone Records</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {combinedEvents.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="glass-card overflow-hidden border border-white/50 shadow-md group hover:shadow-2xl transition-all duration-300 flex flex-col justify-between relative text-left"
                  >
                    {/* Visual deletion overlay in Clean Up Mode */}
                    {cleanUpMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(milestone);
                        }}
                        className="absolute top-3 right-3 z-30 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg border border-red-400 animate-pulse hover:scale-110 transition-transform cursor-pointer"
                        title="Delete Milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Media */}
                    <div className="h-40 overflow-hidden relative shrink-0 bg-slate-950">
                      <img
                        src={milestone.image}
                        alt={milestone.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-bold text-[var(--primary)] uppercase tracking-wider shadow-sm border border-white/50">
                        Chrono Milestone
                      </span>
                    </div>

                    {/* Text */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-sm sm:text-base text-gray-900 leading-snug tracking-tight">
                          {milestone.title}
                        </h4>
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                          {milestone.description}
                        </p>
                      </div>

                      {/* Accent Arrow Link */}
                      <div className="mt-4 pt-3.5 border-t border-gray-50 flex items-center justify-between text-gray-400 text-xs">
                        <span className="font-semibold text-gray-300">Wisdom Link Chrono Files</span>
                        <ArrowUpRight className="w-4 h-4 group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
