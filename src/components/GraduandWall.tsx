import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, Heart, Trash2, ArrowRight, UploadCloud, Sparkles, Maximize2, UserCheck, AlertCircle } from 'lucide-react';
import { Student, GraduationStudent } from '../types';
import StudentAlbumImage from './StudentAlbumImage';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { 
  subscribeStudents, 
  deleteApprovedStudent, 
  subscribeApprovedGraduationStudents, 
  deleteGraduationStudent 
} from '../services/firebaseService';

interface GraduandWallProps {
  cleanUpMode: boolean;
  onUploadClick: () => void;
  onViewAllClick: () => void;
}

interface CombinedStudent {
  id: string;
  name: string;
  nickname?: string;
  image: string;
  quote: string;
  favoriteMemory: string;
  aspirations: string;
  house: string; // Used for department/category
  stateOfOrigin?: string;
  graduationYear: string;
  isGraduationStudent: boolean;
  featured: boolean;
  gallery?: string[];
  attachedImages?: string[];
}

export default function GraduandWall({ cleanUpMode, onUploadClick, onViewAllClick }: GraduandWallProps) {
  const [legacyStudents, setLegacyStudents] = useState<Student[]>([]);
  const [graduationStudents, setGraduationStudents] = useState<GraduationStudent[]>([]);
  const [featuredStudents, setFeaturedStudents] = useState<CombinedStudent[]>([]);

  useEffect(() => {
    const unsubLegacy = subscribeStudents((list) => {
      setLegacyStudents(list);
    });

    const unsubGrad = subscribeApprovedGraduationStudents((list) => {
      setGraduationStudents(list);
    });

    return () => {
      unsubLegacy();
      unsubGrad();
    };
  }, []);

  // Compute the combined students list and select 4-5 featured ones
  useEffect(() => {
    const combined: CombinedStudent[] = [
      ...legacyStudents.map(s => {
        const album = Array.from(new Set([
          ...((s as any).gallery || []),
          ...((s as any).personalAlbum || []),
          ...((s as any).attachedImages || [])
        ].filter(Boolean)));
        return {
          id: s.id,
          name: s.name,
          nickname: s.nickname,
          image: s.image || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600',
          quote: s.quote || '',
          favoriteMemory: s.favoriteMemory || '',
          aspirations: s.aspirations || s.bio || '',
          house: s.house || 'Class of 2026',
          stateOfOrigin: s.stateOfOrigin || '',
          graduationYear: '2026',
          isGraduationStudent: false,
          featured: s.featured === true || (s as any).featured === 'true',
          gallery: album,
          attachedImages: album
        };
      }),
      ...graduationStudents.map(s => {
        const album = Array.from(new Set([
          ...(s.gallery || []),
          ...(s.personalAlbum || [])
        ].filter(Boolean)));
        return {
          id: s.studentId,
          name: s.fullName,
          nickname: s.class || '',
          image: s.profilePicture || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600',
          quote: s.quote || '',
          favoriteMemory: s.favoriteMemory || '',
          aspirations: s.futureAmbition || '',
          house: s.graduationCategory,
          stateOfOrigin: s.class || '',
          graduationYear: s.graduationYear,
          isGraduationStudent: true,
          featured: s.featured === true || (s as any).featured === 'true',
          gallery: album,
          attachedImages: album
        };
      })
    ];

    if (combined.length === 0) {
      setFeaturedStudents([]);
      return;
    }

    // Selection Logic:
    // 1. Get manually featured students first
    const manualFeatured = combined.filter(s => s.featured);
    const nonFeatured = combined.filter(s => !s.featured);

    let selected: CombinedStudent[] = [];

    if (manualFeatured.length >= 4) {
      // If we have 4 or more manually featured, take a random 4 of them
      selected = [...manualFeatured].sort(() => 0.5 - Math.random()).slice(0, 4);
    } else {
      // Take all manually featured first
      selected = [...manualFeatured];
      
      // Shuffle the rest and pick enough to reach 4 total
      const shuffledOthers = [...nonFeatured].sort(() => 0.5 - Math.random());
      const needed = 4 - selected.length;
      selected = [...selected, ...shuffledOthers.slice(0, needed)];
    }

    selected = selected.slice(0, 4);
    // Sort alphabetically by name for visual presentation consistency
    selected.sort((a, b) => a.name.localeCompare(b.name));
    setFeaturedStudents(selected);
  }, [legacyStudents, graduationStudents]);

  const handleDelete = async (stud: CombinedStudent) => {
    if (!confirm(`Are you sure you want to permanently delete graduand "${stud.name}" from the official Year-Book?`)) {
      return;
    }
    try {
      if (stud.isGraduationStudent) {
        await deleteGraduationStudent(stud.id);
      } else {
        await deleteApprovedStudent(stud.id);
      }
      
      // Clean up Cloudinary asset if applicable
      if (stud.image && stud.image.includes('cloudinary.com')) {
        fetch('/api/delete-cloudinary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: stud.image }),
        }).catch((err) => console.error('Cloudinary asset cleanup error:', err));
      }
    } catch (err: any) {
      alert(`Failed to delete student: ${err.message || err}`);
    }
  };

  return (
    <section id="graduation-highlights" className="py-24 bg-transparent relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500 glass-pill px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-4">
            <GraduationCap className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>Graduating Students Showcase</span>
          </span>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-display">
            Our Graduating Stars
          </h2>
          
          <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-xl mx-auto">
            Cherish the hard work, memories, and bright futures of The Wisdom Link Model College's graduates. Below is a featured selection of our class members.
          </p>
          <div className="h-1 w-20 bg-amber-500 mx-auto mt-4 rounded-full" />
        </div>

        {/* Upload Button & Graduand Notice Card Block */}
        <div className="max-w-2xl mx-auto mb-14 text-center">
          <div className="relative group p-6 sm:p-7 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-amber-500/10 border-2 border-amber-400/80 rounded-3xl shadow-2xl backdrop-blur-md space-y-4 transition-all hover:border-amber-500 hover:shadow-amber-500/20">
            
            {/* Top Restriction Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-full text-[11px] font-black uppercase tracking-widest shadow-md">
              <UserCheck className="w-4 h-4 text-amber-100 animate-pulse" />
              <span>Strictly Reserved For Graduating Class Members Only</span>
            </div>

            {/* Explanatory Message */}
            <p className="text-xs sm:text-sm text-slate-800 font-bold leading-relaxed max-w-lg mx-auto">
              Notice: This profile submission portal is strictly meant for <span className="text-amber-700 underline underline-offset-2">graduating students (graduands)</span> of the current graduating year to submit their official portrait photo, favorite memory, and aspirations.
            </p>

            {/* High Impact Action Button */}
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={onUploadClick}
                className="relative px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-600 hover:via-amber-700 hover:to-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-black tracking-wider uppercase transition-all shadow-xl hover:shadow-2xl hover:shadow-amber-500/30 hover:-translate-y-1 active:translate-y-0 cursor-pointer flex items-center justify-center gap-3 group ring-4 ring-amber-400/40 w-full sm:w-auto"
                id="homepage-upload-grad-profile-btn"
              >
                <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="block text-white font-black text-xs sm:text-sm tracking-wide">Upload Your Graduation Profile</span>
                  <span className="block text-[10px] text-amber-100 font-bold normal-case">Graduands Only • Year 2026 Profile Portal</span>
                </div>
                <Sparkles className="w-4 h-4 text-amber-200 animate-spin ml-1 hidden sm:inline-block" style={{ animationDuration: '4s' }} />
              </button>
            </div>
          </div>
        </div>

        {featuredStudents.length === 0 ? (
          <div className="text-center py-16 bg-white/40 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm max-w-md mx-auto">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
            <h3 className="text-base font-bold text-gray-800">No Enrolled Graduands</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto px-4">
              The Yearbook Graduand Wall is currently empty. Administrators can enroll graduates and approve student bios via the Gatekeeper Portal.
            </p>
          </div>
        ) : (
          <div>
            {/* Exactly 4-5 Featured Graduate Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 justify-center" id="featured-graduands-grid">
              {featuredStudents.map((stud, idx) => (
                <div
                  key={stud.id}
                  className="group relative bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 text-left"
                >
                  {/* Visual Deletion Overlay for Clean Up Mode */}
                  {cleanUpMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(stud);
                      }}
                      className="absolute top-4 right-4 z-30 p-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-400 hover:scale-115 transition-transform animate-pulse cursor-pointer flex items-center justify-center"
                      title="Delete Student Profile"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}

                  {/* Profile Picture Block */}
                  <div 
                    className="relative h-64 overflow-hidden bg-slate-900 shrink-0 cursor-pointer group/img"
                    onClick={() => {
                      const items = featuredStudents.map(s => ({
                        id: s.id,
                        type: 'photo' as const,
                        title: `${s.name} - Class of ${s.graduationYear}`,
                        description: s.quote || s.favoriteMemory || s.aspirations || `The Wisdom Link Model College Graduate`,
                        imageUrl: s.image,
                        tag: s.house || 'Graduating Stars',
                        author: s.name,
                        date: `Class of ${s.graduationYear}`,
                        attachedImages: s.attachedImages || s.gallery || [],
                        gallery: s.gallery || s.attachedImages || []
                      }));
                      window.dispatchEvent(new CustomEvent('open-fullscreen-media', {
                        detail: {
                          items,
                          currentIndex: idx
                        }
                      }));
                    }}
                  >
                    <img
                      src={getOptimizedImageUrl(stud.image, 450)}
                      alt={stud.name}
                      className="w-full h-full object-cover object-center transition-transform duration-500 group-hover/img:scale-105"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Card Details Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4 bg-white">
                    <div>
                      {/* House / Department / Category */}
                      {stud.house && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-200 inline-block mb-2" title={stud.house}>
                          {stud.house}
                        </span>
                      )}

                      {/* Name */}
                      <h3 className="text-lg font-extrabold tracking-tight font-display text-gray-900 line-clamp-1">
                        {stud.name}
                      </h3>
                      {stud.nickname && (
                        <p className="text-xs text-amber-600 font-mono italic mt-0.5">
                          "{stud.nickname}"
                        </p>
                      )}
                    </div>

                    {/* Graduation Year & View More Footer on White Background */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Class of {stud.graduationYear}
                      </span>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const items = featuredStudents.map(s => ({
                            id: s.id,
                            type: 'photo' as const,
                            title: `${s.name} - Class of ${s.graduationYear}`,
                            description: s.quote || s.favoriteMemory || s.aspirations || `The Wisdom Link Model College Graduate`,
                            imageUrl: s.image,
                            tag: s.house || 'Graduating Stars',
                            author: s.name,
                            date: `Class of ${s.graduationYear}`,
                            attachedImages: s.attachedImages || s.gallery || [],
                            gallery: s.gallery || s.attachedImages || []
                          }));
                          window.dispatchEvent(new CustomEvent('open-fullscreen-media', {
                            detail: {
                              items,
                              currentIndex: idx
                            }
                          }));
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer hover:scale-105"
                        title="View More (Fullscreen)"
                      >
                        <span>View More</span>
                        <Maximize2 className="w-3.5 h-3.5 font-black" />
                      </button>
                    </div>

                  </div>

                </div>
              ))}
            </div>

            {/* View All Graduates Archive Button at the Bottom of Section */}
            <div className="flex justify-center mt-12">
              <button
                onClick={onViewAllClick}
                className="px-6 py-3 bg-white/80 hover:bg-white text-indigo-600 border border-indigo-200 hover:border-indigo-300 rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer group"
                id="homepage-view-all-graduates-archive-btn"
              >
                <span>View All Graduates Archive</span>
                <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
