import React, { useEffect, useState } from 'react';
import { 
  Search, ArrowLeft, Filter, RefreshCw, GraduationCap, MapPin, 
  Sparkles, Calendar, BookOpen, Heart, Image as ImageIcon, X, AlertCircle,
  Maximize2
} from 'lucide-react';
import { Student, GraduationStudent } from '../types';
import { subscribeStudents, subscribeApprovedGraduationStudents } from '../services/firebaseService';
import StudentAlbumImage from './StudentAlbumImage';
import { generateBioSummary } from '../utils/bioSummary';
import { getOptimizedImageUrl } from '../utils/imageUtils';

interface GraduatesDirectoryProps {
  onBackToHome: () => void;
  cleanUpMode: boolean;
}

interface CombinedStudent {
  id: string;
  name: string;
  nickname?: string;
  image: string;
  quote: string;
  favoriteMemory: string;
  aspirations: string;
  house: string; // Used for category/house
  stateOfOrigin?: string;
  instagram?: string;
  twitter?: string;
  graduationYear: string;
  isGraduationStudent: boolean;
  parentAppreciation?: string;
  gallery?: string[];
  attachedImages?: string[];
}

type SortType = 'alpha-az' | 'year-newest' | 'year-oldest' | 'shuffle';

export default function GraduatesDirectory({ onBackToHome, cleanUpMode }: GraduatesDirectoryProps) {
  const [legacyStudents, setLegacyStudents] = useState<Student[]>([]);
  const [graduationStudents, setGraduationStudents] = useState<GraduationStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortType>('alpha-az');
  
  // Modal for detail view
  const [activeStudent, setActiveStudent] = useState<CombinedStudent | null>(null);

  // Trigger local state shuffle count to force re-shuffle
  const [shuffleKey, setShuffleKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    const unsubLegacy = subscribeStudents((list) => {
      setLegacyStudents(list);
    });

    const unsubGrad = subscribeApprovedGraduationStudents((list) => {
      setGraduationStudents(list);
      setLoading(false);
    });

    return () => {
      unsubLegacy();
      unsubGrad();
    };
  }, []);

  // Sync active student with real-time Firestore updates
  useEffect(() => {
    if (activeStudent) {
      const updated = combinedStudents.find(s => s.id === activeStudent.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(activeStudent)) {
        setActiveStudent(updated);
      }
    }
  }, [graduationStudents, legacyStudents]);

  // Combine datasets
  const combinedStudents: CombinedStudent[] = [
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
        house: s.house || 'Senior Secondary Graduation',
        stateOfOrigin: s.stateOfOrigin || '',
        instagram: s.instagram,
        twitter: s.twitter,
        graduationYear: '2026',
        isGraduationStudent: false,
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
        parentAppreciation: s.parentAppreciation || '',
        gallery: album,
        attachedImages: album
      };
    })
  ];

  // Dynamic filter lists
  const availableYears = Array.from(new Set([
    'All', ...combinedStudents.map(s => s.graduationYear)
  ])).sort((a, b) => b.localeCompare(a));

  const availableCategories = Array.from(new Set([
    'All', ...combinedStudents.map(s => s.house)
  ])).filter(cat => cat && cat.trim() !== 'Gold House').sort();

  // Filter application
  let filteredList = combinedStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (student.nickname && student.nickname.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesYear = selectedYear === 'All' || student.graduationYear === selectedYear;
    const matchesCategory = selectedCategory === 'All' || student.house === selectedCategory;
    
    return matchesSearch && matchesYear && matchesCategory;
  });

  // Sort application
  if (sortBy === 'alpha-az') {
    filteredList.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'year-newest') {
    filteredList.sort((a, b) => {
      const yearCompare = b.graduationYear.localeCompare(a.graduationYear);
      if (yearCompare !== 0) return yearCompare;
      return a.name.localeCompare(b.name);
    });
  } else if (sortBy === 'year-oldest') {
    filteredList.sort((a, b) => {
      const yearCompare = a.graduationYear.localeCompare(b.graduationYear);
      if (yearCompare !== 0) return yearCompare;
      return a.name.localeCompare(b.name);
    });
  } else if (sortBy === 'shuffle') {
    // Generate a pseudorandom stable order using the shuffleKey
    const seededRandom = (str: string) => {
      let hash = 0;
      const combinedSeed = str + shuffleKey.toString();
      for (let i = 0; i < combinedSeed.length; i++) {
        hash = (hash << 5) - hash + combinedSeed.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash) / 2147483647;
    };
    filteredList.sort((a, b) => seededRandom(a.id) - seededRandom(b.id));
  }

  const triggerShuffle = () => {
    setSortBy('shuffle');
    setShuffleKey(prev => prev + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 relative z-10 text-left">
      
      {/* Back to Home Header */}
      <div className="mb-8">
        <button
          onClick={onBackToHome}
          className="px-4 py-2 bg-white/60 hover:bg-white backdrop-blur-md border border-gray-100 rounded-full text-xs font-bold text-gray-700 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
          <span>Back to Yearbook Homepage</span>
        </button>
      </div>

      {/* Main Title Block */}
      <div className="mb-12 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-display flex items-center justify-center sm:justify-start gap-3">
              <GraduationCap className="w-9 h-9 text-amber-500" />
              <span>Graduates Directory Archive</span>
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500 max-w-xl">
              Browse, search, and cherish the official memories, bio profiles, and pictures of our approved graduates.
            </p>
          </div>
          
          <div className="flex items-center justify-center sm:justify-end">
            <span className="text-xs font-black uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-4 py-2 rounded-2xl">
              Total Graduates Enrolled: {combinedStudents.length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Panel Card */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/80 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Search bar */}
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Search Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search student names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-gray-100 focus:border-[var(--primary)] text-xs text-gray-700 focus:outline-none"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Graduation Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-gray-100 focus:border-[var(--primary)] text-xs text-gray-700 font-bold focus:outline-none"
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Graduation Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-gray-100 focus:border-[var(--primary)] text-xs text-gray-700 font-bold focus:outline-none"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>{yr === 'All' ? 'All Years' : `Class of ${yr}`}</option>
              ))}
            </select>
          </div>

          {/* Sort Selection & Shuffle */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Sort Order</label>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="flex-1 p-2.5 rounded-xl bg-slate-50 border border-gray-100 focus:border-[var(--primary)] text-xs text-gray-700 font-bold focus:outline-none"
              >
                <option value="alpha-az">Alphabetical (A-Z)</option>
                <option value="year-newest">Year (Newest to Oldest)</option>
                <option value="year-oldest">Year (Oldest to Newest)</option>
                <option value="shuffle">Random Shuffle</option>
              </select>
              <button
                onClick={triggerShuffle}
                className="p-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl text-indigo-600 transition-all flex items-center justify-center shrink-0"
                title="Shuffle Randomly"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="text-center py-24 bg-white/40 rounded-3xl border border-white/50 shadow-sm max-w-md mx-auto">
          <RefreshCw className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-700">Loading Directory Archive...</h3>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-20 bg-white/40 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-gray-800">No matching graduates</h3>
          <p className="text-xs text-gray-500 mt-1 px-4">
            Try adjusting your search criteria, category filters, or selected graduation years.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredList.map((stud) => (
            <div
              key={stud.id}
              onClick={() => setActiveStudent(stud)}
              className="group relative bg-white/85 border border-white/70 rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer text-left"
            >
              {/* Photo */}
              <div className="relative h-60 overflow-hidden bg-slate-950 shrink-0">
                <img
                  src={getOptimizedImageUrl(stud.image, 400)}
                  alt={stud.name}
                  className="w-full h-full object-contain bg-slate-950 p-1 transition-all duration-700 group-hover:scale-104"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                
                {/* Labels */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  {stud.house && (
                    <span className="bg-amber-500 text-slate-950 text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block mb-1 border border-white/10" title={stud.house}>
                      {stud.house}
                    </span>
                  )}
                  <h3 className="text-base font-extrabold tracking-tight font-display text-white truncate drop-shadow-md">
                    {stud.name}
                  </h3>
                  {stud.nickname && (
                    <p className="text-[10px] text-amber-300 font-mono italic">
                      "{stud.nickname}"
                    </p>
                  )}
                </div>
              </div>

              {/* Card Summary Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                {/* Quote preview */}
                {stud.quote ? (
                  <p className="text-xs text-slate-600 italic line-clamp-2 leading-relaxed bg-slate-50 p-2 border-l-2 border-amber-400 rounded-r-lg">
                    “{stud.quote}”
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No quote submitted yet.</p>
                )}

                {/* Ambition / Memory Tags indicators */}
                <div className="space-y-1">
                  {stud.aspirations && (
                    <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">
                      <span className="font-bold text-slate-600 block text-[8px] uppercase tracking-wider">Aspiration:</span>
                      {stud.aspirations}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold uppercase tracking-widest text-slate-500">
                    Class of {stud.graduationYear}
                  </span>
                  
                  <span className="text-indigo-600 font-extrabold hover:underline flex items-center gap-1">
                    <span>View Bio</span>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                  </span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Graduate Full Bio Details Modal overlay */}
      {activeStudent && (() => {
        const albumItems = [
          {
            id: activeStudent.id,
            type: 'photo' as const,
            title: `${activeStudent.name} - Class of ${activeStudent.graduationYear}`,
            description: activeStudent.quote || activeStudent.favoriteMemory || activeStudent.aspirations || `${activeStudent.name}'s graduation profile`,
            imageUrl: activeStudent.image,
            tag: activeStudent.house || 'Graduation Portrait',
            author: activeStudent.name,
            date: `Class of ${activeStudent.graduationYear}`,
            attachedImages: activeStudent.attachedImages || activeStudent.gallery || [],
            gallery: activeStudent.gallery || activeStudent.attachedImages || []
          }
        ];

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-100 max-w-2xl w-full overflow-hidden shadow-2xl relative my-8 flex flex-col">
              
              {/* Close button */}
              <button
                onClick={() => setActiveStudent(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-slate-950/60 hover:bg-slate-950 text-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-12">
                
                {/* Profile Image & Year metadata column */}
                <div 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-fullscreen-media', {
                    detail: {
                      items: albumItems,
                      currentIndex: 0
                    }
                  }))}
                  className="md:col-span-5 bg-slate-950 text-white flex flex-col justify-between relative min-h-[300px] cursor-zoom-in group/portrait"
                >
                  <img
                    src={getOptimizedImageUrl(activeStudent.image, 800)}
                    alt={activeStudent.name}
                    className="absolute inset-0 w-full h-full object-contain bg-slate-950 p-2 filter brightness-[0.95] group-hover/portrait:scale-105 transition-transform duration-350"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                  
                  {/* Floating overlay to zoom portrait */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/portrait:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px] z-10">
                    <div className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all scale-95 hover:scale-105 shadow-xl">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>View Portrait</span>
                    </div>
                  </div>
                  
                  {/* Empty spacer for alignment */}
                  <div className="flex-1" />
                  
                  {/* Floating identity content */}
                  <div className="p-6 relative z-10 text-left">
                    <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block mb-2">
                      {activeStudent.house}
                    </span>
                    <h3 className="text-2xl font-extrabold tracking-tight font-display text-white">
                      {activeStudent.name}
                    </h3>
                    {activeStudent.nickname && (
                      <p className="text-sm text-amber-300 font-mono italic mt-0.5">
                        "{activeStudent.nickname}"
                      </p>
                    )}
                    <p className="text-[10px] font-mono tracking-widest text-slate-300 uppercase mt-2">
                      Class of {activeStudent.graduationYear}
                    </p>
                  </div>
                </div>

              {/* Bio Details Text Columns */}
              <div className="md:col-span-7 p-6 sm:p-8 space-y-5 text-left max-h-[500px] overflow-y-auto">
                
                {/* Quote block */}
                {activeStudent.quote && (
                  <div className="bg-slate-50 border-l-4 border-amber-400 p-3 rounded-r-2xl">
                    <span className="text-[8px] font-bold text-amber-600 uppercase tracking-widest block mb-1">Yearbook Quote</span>
                    <p className="text-xs text-slate-700 font-medium italic">
                      “{activeStudent.quote}”
                    </p>
                  </div>
                )}

                {/* Favorite Memory */}
                {activeStudent.favoriteMemory && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 block">Cherished Memory</span>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{activeStudent.favoriteMemory}"
                    </p>
                  </div>
                )}

                {/* Aspirations */}
                {activeStudent.aspirations && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block">Aspirations & Future Bio</span>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {activeStudent.aspirations}
                    </p>
                  </div>
                )}

                {/* Parents Appreciation */}
                {activeStudent.parentAppreciation && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4.5 space-y-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 block flex items-center gap-1.5">
                      <Heart className="w-3 h-3 fill-amber-500 text-amber-500 animate-pulse" />
                      <span>Proud Parent Tribute</span>
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {activeStudent.parentAppreciation}
                    </p>
                  </div>
                )}

                {/* Synthesized Bio Summary Box */}
                <div className="bg-gradient-to-r from-amber-50 via-indigo-50/50 to-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-1.5 shadow-sm">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-800 block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Graduand Profile Summary</span>
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed italic font-medium">
                    "{generateBioSummary({
                      fullName: activeStudent.name,
                      quote: activeStudent.quote,
                      favoriteMemory: activeStudent.favoriteMemory,
                      futureAmbition: activeStudent.aspirations,
                      parentAppreciation: activeStudent.parentAppreciation,
                      graduationYear: activeStudent.graduationYear,
                      graduationCategory: activeStudent.house
                    })}"
                  </p>
                </div>

                {/* Graduation Personal Gallery of memories */}
                {activeStudent.gallery && activeStudent.gallery.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>Personal Graduation Memories ({activeStudent.gallery.length})</span>
                    </span>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {activeStudent.gallery.map((imgUrl, index) => (
                        <StudentAlbumImage
                          key={`${imgUrl}-${index}`}
                          imageUrl={imgUrl}
                          studentName={activeStudent.name}
                          studentQuote={activeStudent.quote}
                          onOpenFullscreen={() => {
                            window.dispatchEvent(new CustomEvent('open-fullscreen-media', {
                              detail: {
                                items: albumItems,
                                currentIndex: 0
                              }
                            }));
                          }}
                          onOpenComments={() => {
                            window.dispatchEvent(new CustomEvent('open-fullscreen-media', {
                              detail: {
                                items: albumItems,
                                currentIndex: 0
                              }
                            }));
                            // Trigger scroll to comments on next tick
                            setTimeout(() => {
                              const commentForm = document.getElementById('global-media-viewer');
                              if (commentForm) {
                                commentForm.scrollTo({ top: commentForm.scrollHeight, behavior: 'smooth' });
                              }
                            }, 400);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>
        </div>
      )})()}

    </div>
  );
}
