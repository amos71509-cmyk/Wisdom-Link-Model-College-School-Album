import React from 'react';
import { Sparkles, Star, Gift, Bell, Play, FileText, Mic, Award, Quote } from 'lucide-react';
import { CustomSection } from '../types';

interface DynamicCustomSectionsProps {
  sections: CustomSection[];
}

export default function DynamicCustomSections({ sections }: DynamicCustomSectionsProps) {
  if (!sections || sections.length === 0) return null;

  return (
    <div id="dynamic-custom-sections-wrapper" className="space-y-16 py-12">
      {sections.map((section) => {
        const hasMedia = section.mediaUrl && section.mediaType !== 'none';
        const isVideo = section.mediaType === 'video';

        // ----------------------------------------------------
        // LAYOUT: SPOTLIGHT
        // ----------------------------------------------------
        if (section.layoutType === 'spotlight') {
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
              id={`custom-section-spotlight-${section.id}`}
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950/80 via-slate-900 to-amber-950/60 p-8 md:p-12 shadow-2xl border border-amber-500/20 text-left">
                {/* Floating ambient gold glow */}
                <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-amber-400/10 blur-[100px] pointer-events-none" />
                
                {/* Massive transparent quotation marks */}
                <div className="absolute -top-6 -left-4 text-[180px] font-serif text-amber-400/10 pointer-events-none select-none">
                  “
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
                  {hasMedia && (
                    <div className="relative shrink-0 flex flex-col items-center">
                      <div className="relative w-40 h-40 md:w-52 md:h-52 rounded-full overflow-hidden border-4 border-amber-400 shadow-2xl bg-slate-800">
                        {isVideo ? (
                          <video
                            src={section.mediaUrl}
                            controls
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={section.mediaUrl}
                            alt={section.title}
                            className="w-full h-full object-cover scale-[1.03] hover:scale-110 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg border border-white whitespace-nowrap flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 fill-current" />
                        <span>Yearbook Icon</span>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-400/10 text-amber-400 text-xs font-black uppercase tracking-wider border border-amber-400/20 shadow-inner">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>🏆 Featured Commendation</span>
                      </span>
                    </div>

                    <div className="space-y-4">
                      <h2 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-white leading-tight">
                        {section.title}
                      </h2>
                      <div className="relative">
                        <p className="text-amber-100/90 text-lg md:text-xl font-serif italic leading-relaxed pl-4 border-l-2 border-amber-400/30">
                          “{section.subtext}”
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // ----------------------------------------------------
        // LAYOUT: BIRTHDAY / CONGRATULATIONS
        // ----------------------------------------------------
        if (section.layoutType === 'birthday') {
          return (
            <section
              key={section.id}
              className="max-w-5xl mx-auto px-4 sm:px-6"
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950 via-pink-900 to-amber-950 p-8 md:p-10 shadow-2xl border border-pink-500/20 flex flex-col md:flex-row items-center gap-8 text-left text-white">
                
                {/* Floating animated emojis */}
                <div className="absolute top-4 left-6 text-2xl animate-bounce" style={{ animationDuration: '3s' }}>🎈</div>
                <div className="absolute top-1/4 right-8 text-2xl animate-pulse" style={{ animationDuration: '4s' }}>✨</div>
                <div className="absolute bottom-4 left-1/3 text-2xl animate-bounce" style={{ animationDelay: '1s', animationDuration: '2.5s' }}>🎉</div>
                <div className="absolute bottom-6 right-10 text-2xl animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '3.5s' }}>⭐</div>
                
                {/* Polaroid Frame */}
                {hasMedia && (
                  <div className="relative bg-white p-3 pb-6 shadow-2xl rotate-3 transform hover:rotate-0 transition-all duration-300 border border-gray-100 max-w-[180px] shrink-0">
                    <div className="aspect-square w-full overflow-hidden bg-gray-100">
                      <img
                        src={section.mediaUrl}
                        alt={section.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Heart badge overlay */}
                    <div className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full text-xs shadow-md animate-pulse">
                      ❤️
                    </div>
                    
                    {/* Polaroid handwritten vibe caption */}
                    <div className="text-[10px] text-gray-500 text-center font-mono mt-2 tracking-tighter truncate">
                      Yearbook Memory
                    </div>
                  </div>
                )}

                <div className="space-y-4 flex-1 relative z-10">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 text-pink-300 text-[10px] font-bold uppercase tracking-wider border border-pink-500/20">
                    <Gift className="w-3.5 h-3.5 text-pink-400" />
                    Celebratory Milestone
                  </span>
                  <h3 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-200 via-amber-200 to-white">
                    {section.title}
                  </h3>
                  <p className="text-pink-100/85 text-sm sm:text-base leading-relaxed font-light">
                    {section.subtext}
                  </p>
                </div>
              </div>
            </section>
          );
        }

        // ----------------------------------------------------
        // LAYOUT: ANNOUNCEMENT
        // ----------------------------------------------------
        if (section.layoutType === 'announcement') {
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
              id={`custom-section-announcement-${section.id}`}
            >
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/40 via-orange-950/25 to-red-950/30 p-6 md:p-8 shadow-[0_0_25px_rgba(239,68,68,0.15)] border-2 border-dashed border-red-500/60 ring-8 ring-amber-500/5 flex flex-col md:flex-row items-center gap-6 text-left">
                {/* Pulsing red mic icon */}
                <div className="p-4 bg-red-600 text-white rounded-full shrink-0 flex items-center justify-center shadow-lg shadow-red-600/30 border border-red-400 animate-pulse">
                  <Mic className="w-6 h-6" />
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-md animate-bounce flex items-center gap-1">
                      <span>📢</span> <span>High Priority Announcement</span>
                    </span>
                    <span className="bg-amber-400/15 text-amber-300 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border border-amber-400/20">
                      Live Broadcast
                    </span>
                  </div>
                  
                  <h4 className="text-xl font-display font-extrabold text-white tracking-tight">
                    {section.title}
                  </h4>
                  <p className="text-gray-300 text-sm sm:text-base leading-relaxed font-normal">
                    {section.subtext}
                  </p>
                </div>

                {hasMedia && (
                  <div className="w-full md:w-56 h-36 shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-lg relative group">
                    {isVideo ? (
                      <video
                        src={section.mediaUrl}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={section.mediaUrl}
                        alt={section.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        }

        // ----------------------------------------------------
        // LAYOUT: STANDARD (FALLBACK)
        // ----------------------------------------------------
        return (
          <section
            key={section.id}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          >
            <div className="glass-card overflow-hidden shadow-xl border border-white/60 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center text-left">
              <div className="flex-1 space-y-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold uppercase tracking-wider">
                  <FileText className="w-3 h-3" />
                  Dynamic Announcement
                </span>
                <h3 className="text-2xl font-bold tracking-tight text-gray-900">
                  {section.title}
                </h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  {section.subtext}
                </p>
              </div>

              {hasMedia && (
                <div className="w-full md:w-80 h-52 shrink-0 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                  {isVideo ? (
                    <video
                      src={section.mediaUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={section.mediaUrl}
                      alt={section.title}
                      className="w-full h-full object-cover object-center"
                    />
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
