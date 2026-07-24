import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, Calendar, Search, UploadCloud, Check, AlertCircle, 
  Loader2, Trash2, ArrowLeft, ArrowRight, Save, Image as ImageIcon, 
  Sparkles, BookOpen, Compass, School, Award, Heart
} from 'lucide-react';
import { GraduationStudent, GraduationSettings } from '../types';
import { 
  subscribeAllGraduationStudents, 
  subscribeGraduationSettings, 
  saveGraduationStudent 
} from '../services/firebaseService';
import { compressImage } from '../lib/imageCompressor';
import { generateBioSummary } from '../utils/bioSummary';

interface GraduationProfileFormProps {
  onBackToHome: () => void;
}

export default function GraduationProfileForm({ onBackToHome }: GraduationProfileFormProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [students, setStudents] = useState<GraduationStudent[]>([]);
  const [settings, setSettings] = useState<GraduationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedCategory, setSelectedCategory] = useState('Senior Secondary Graduation');
  const [searchNameQuery, setSearchNameQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<GraduationStudent | null>(null);

  // Profile Fields Form State
  const [quote, setQuote] = useState('');
  const [favoriteMemory, setFavoriteMemory] = useState('');
  const [futureAmbition, setFutureAmbition] = useState('');
  const [parentAppreciation, setParentAppreciation] = useState('');
  
  // Media Upload States
  const [profilePicture, setProfilePicture] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  
  // Progress & Loading overlays
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load students & settings
  useEffect(() => {
    setLoading(true);
    const unsubStudents = subscribeAllGraduationStudents((list) => {
      setStudents(list);
      setLoading(false);
    });

    const unsubSettings = subscribeGraduationSettings((saved) => {
      if (saved) {
        setSettings(saved);
        setSelectedYear(new Date().getFullYear().toString());
        if (saved.enabledCategories && saved.enabledCategories.length > 0) {
          setSelectedCategory(saved.enabledCategories[0]);
        }
      }
    });

    return () => {
      unsubStudents();
      unsubSettings();
    };
  }, []);

  // Filter students whose names have been imported, matching Year & Category, and whose profiles are NOT completed/approved/pending
  const filteredStudents = students.filter(s => {
    const matchYear = s.graduationYear === selectedYear;
    const matchCat = s.graduationCategory === selectedCategory;
    const matchStatus = s.status === 'Imported' || s.status === 'Rejected'; // Only show if they need to complete it
    const matchSearch = s.fullName.toLowerCase().includes(searchNameQuery.toLowerCase());
    return matchYear && matchCat && matchStatus && matchSearch;
  });

  // Unique Graduation Years dynamically fetched from DB, fallback to 2026/2025
  const yearOptions = Array.from(new Set([
    '2026', '2025', '2024', ...students.map(s => s.graduationYear)
  ])).sort((a, b) => b.localeCompare(a));

  // Category Options based on Admin Enabled Categories
  const categoryOptions = settings?.enabledCategories || [
    'Nursery Graduation',
    'Primary Graduation',
    'Junior Secondary Graduation',
    'Senior Secondary Graduation'
  ];

  // Map categories to descriptions and custom design elements
  const categoryMetas: Record<string, { desc: string; color: string; icon: any }> = {
    'Nursery Graduation': {
      desc: 'Early milestones, little steps, and joyful beginnings.',
      color: 'from-pink-500 to-rose-500 bg-pink-50 hover:border-pink-300 text-pink-600',
      icon: Heart
    },
    'Primary Graduation': {
      desc: 'Foundational accomplishments, friends, and rising intelligence.',
      color: 'from-sky-500 to-blue-500 bg-sky-50 hover:border-sky-300 text-sky-600',
      icon: BookOpen
    },
    'Junior Secondary Graduation': {
      desc: 'Developing creativity, key learnings, and middle school memories.',
      color: 'from-teal-500 to-emerald-500 bg-emerald-50 hover:border-emerald-300 text-emerald-600',
      icon: Compass
    },
    'Senior Secondary Graduation': {
      desc: 'Outstanding achievements, mature aspirations, and beautiful finishes.',
      color: 'from-amber-500 to-orange-500 bg-amber-50 hover:border-amber-300 text-amber-600',
      icon: GraduationCap
    }
  };

  const getCategoryMeta = (cat: string) => {
    return categoryMetas[cat] || {
      desc: 'Celebrate graduation achievement honors.',
      color: 'from-indigo-500 to-purple-500 bg-indigo-50 hover:border-indigo-300 text-indigo-600',
      icon: School
    };
  };

  // Profile picture upload change
  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPic(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const raw = reader.result as string;
        const compressed = await compressImage(raw, 500, 500, 0.85);

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: compressed })
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Upload failed');
        setProfilePicture(data.url);
      } catch (err: any) {
        alert(`Failed to upload avatar: ${err.message}`);
      } finally {
        setIsUploadingPic(false);
      }
    };
  };

  // Gallery multi-image upload change
  const handleGalleryUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxLimit = settings?.maxImages || 5;
    if (galleryImages.length + files.length > maxLimit) {
      alert(`You can only upload up to ${maxLimit} gallery images according to school yearbook configurations.`);
      return;
    }

    setIsUploadingGallery(true);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
        });

        const compressed = await compressImage(base64, 800, 800, 0.75);

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: compressed })
        });

        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setGalleryImages([...galleryImages, ...uploadedUrls]);
    } catch (err: any) {
      alert(`Some files failed to transfer: ${err.message}`);
    } finally {
      setIsUploadingGallery(false);
    }
  };

  // Form submit handler
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!profilePicture) {
      alert("Please upload a high-resolution graduation profile photo.");
      return;
    }

    setSubmitting(true);
    try {
      const computedSummary = generateBioSummary({
        fullName: selectedStudent.fullName,
        quote,
        favoriteMemory,
        futureAmbition,
        parentAppreciation,
        graduationYear: selectedYear,
        graduationCategory: selectedCategory
      });

      const updatedStudent: GraduationStudent = {
        ...selectedStudent,
        quote,
        graduationQuote: quote,
        favoriteMemory,
        futureAmbition,
        parentAppreciation,
        parentMessage: parentAppreciation,
        bioSummary: computedSummary,
        profilePicture,
        profilePhoto: profilePicture,
        gallery: galleryImages,
        personalAlbum: galleryImages,
        status: 'Pending', // Awaiting admin approval
        profileCompleted: false, // Remains false until admin approves
        profileApproved: false,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveGraduationStudent(updatedStudent);
      alert(`Yearbook profile card for ${selectedStudent.fullName} successfully submitted! It will appear live on the wall as soon as an administrator verifies your submission.`);
      onBackToHome();
    } catch (err: any) {
      alert(`Submission failed: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-32 text-center bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-3xl shadow-xl mt-24">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--accent)] mx-auto mb-4" />
        <h3 className="text-sm font-extrabold text-gray-900 tracking-wider uppercase">Loading Roster Directory...</h3>
        <p className="text-xs text-gray-500 mt-1">Establishing secure database connections...</p>
      </div>
    );
  }

  // Submissions closed check
  if (settings && !settings.submissionsOpen) {
    return (
      <div className="max-w-xl mx-auto py-16 px-8 text-center bg-white border border-gray-100 rounded-3xl shadow-xl mt-24 space-y-5">
        <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Submissions Closed</h3>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            The Graduation Profile Submission System for this academic block is currently closed or has passed the official deadline ({settings.deadline}). 
          </p>
          <p className="text-xs text-gray-400 mt-1">If you require corrections or late entry, please contact the administrative principal office.</p>
        </div>
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-xs font-black transition-all cursor-pointer"
        >
          Return to Homepage
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-24 mb-16 px-4 animate-fade-in text-left">
      
      {/* Interactive Top Header Banner */}
      <div className="bg-gradient-to-tr from-[var(--primary)] to-[var(--accent)] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/15 px-3 py-1 rounded-full border border-white/10 inline-block">
            Student & Parent Yearbook Portal
          </span>
          <h2 className="text-xl sm:text-2xl font-black font-display">Graduate Profile submission</h2>
          <p className="text-xs text-white/80 leading-relaxed max-w-lg">
            Complete your graduation memory profile in 3 simple steps to join the official Yearbook Digital Archive.
          </p>
        </div>
      </div>

      {/* Stepper Progress bar indicators */}
      <div className="flex items-center justify-between mb-8 px-2">
        {[
          { num: 1, label: 'Category' },
          { num: 2, label: 'Year' },
          { num: 3, label: 'Identify Name' },
          { num: 4, label: 'Bio Card' }
        ].map((s) => {
          const isDone = step > s.num;
          const isActive = step === s.num;
          return (
            <div key={s.num} className="flex flex-col items-center gap-1.5 flex-1 relative">
              {/* Stepper line */}
              {s.num < 4 && (
                <div className={`absolute top-4 left-[60%] right-[-40%] h-[2px] -z-10 ${step > s.num ? 'bg-indigo-600' : 'bg-gray-100'}`} />
              )}
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs transition-all ${
                isDone 
                  ? 'bg-indigo-600 border-indigo-600 text-white' 
                  : isActive 
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-md scale-105' 
                    : 'bg-white border-gray-200 text-gray-400'
              }`}>
                {isDone ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-[var(--primary)]' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* STEP 1: CATEGORY SELECTION */}
      {step === 1 && (
        <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-widest flex items-center gap-2">
              <span>Step 1: Select Your Graduation Category</span>
            </h3>
            <p className="text-xs text-gray-500">Choose the appropriate educational level or milestone category below to locate your name list.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categoryOptions.map((cat) => {
              const meta = getCategoryMeta(cat);
              const isSelected = selectedCategory === cat;
              const IconComp = meta.icon;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedStudent(null);
                  }}
                  className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between h-36 cursor-pointer relative group ${
                    isSelected 
                      ? 'bg-white border-indigo-600 ring-2 ring-indigo-600/20 shadow-lg scale-[1.02]' 
                      : 'bg-white/50 border-gray-100 hover:border-gray-200 hover:bg-white shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'}`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">
                      {cat}
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-normal mt-1 line-clamp-2">
                      {meta.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={onBackToHome}
              className="px-5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cancel</span>
            </button>
            <button
              onClick={() => {
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
            >
              <span>Next: Select Year</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: YEAR SELECTION */}
      {step === 2 && (
        <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-widest flex items-center gap-2">
              <span>Step 2: Select Graduation Year</span>
            </h3>
            <p className="text-xs text-gray-500">Pick your graduating academic yearbook cycle to filter correct class records.</p>
          </div>

          {/* Grid of Year Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {yearOptions.map((yr) => {
              const isSelected = selectedYear === yr;
              return (
                <button
                  key={yr}
                  onClick={() => {
                    setSelectedYear(yr);
                    setSelectedStudent(null);
                  }}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 h-28 ${
                    isSelected
                      ? 'bg-white border-indigo-600 ring-2 ring-indigo-600/20 shadow-md scale-102 text-indigo-600'
                      : 'bg-white/50 border-gray-100 hover:border-gray-200 hover:bg-white shadow-sm text-slate-600'
                  }`}
                >
                  <Calendar className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-black tracking-wide">Class of {yr}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                setStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                setStep(3);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
            >
              <span>Next: Identify Name</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SEARCH & SELECT NAME */}
      {step === 3 && (
        <div className="bg-white/80 backdrop-blur-xl border border-white/80 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-widest flex items-center gap-2">
              <span>Step 3: Search & Select Your Name</span>
            </h3>
            <p className="text-xs text-gray-500">
              Locate your official pre-imported record card for <span className="font-bold text-slate-800">{selectedCategory} ({selectedYear})</span>.
            </p>
          </div>

          {/* Search name bar */}
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Search Your Full Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type your name to filter..."
                value={searchNameQuery}
                onChange={(e) => setSearchNameQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-gray-100 focus:border-indigo-600 text-xs text-gray-700 focus:outline-none focus:bg-white transition-all"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[10px] text-gray-400">If your name does not appear, please contact the administrative principal office to be pre-imported.</p>
          </div>

          {/* Students Match List */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Select Your Name below ({filteredStudents.length} available)</span>
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-gray-100 rounded-2xl">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-gray-800">No Pending Student Roster Found</h4>
                <p className="text-[10px] text-gray-500 mt-1 max-w-sm mx-auto leading-normal">
                  Make sure you selected the correct category/year in the previous steps. Alternatively, your profile might have already been completed or is awaiting administrative approval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto p-1.5 border border-gray-100 rounded-2xl">
                {filteredStudents.map((stud) => {
                  const isSelected = selectedStudent?.studentId === stud.studentId;
                  return (
                    <button
                      key={stud.studentId}
                      onClick={() => setSelectedStudent(stud)}
                      className={`p-3.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-600' 
                          : 'bg-slate-50 border-gray-100 text-gray-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{stud.fullName}</span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                if (!selectedStudent) {
                  alert("Please select your student record card from the list to continue.");
                  return;
                }
                setStep(4);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={!selectedStudent}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
            >
              <span>Continue to Profile Editor</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PROFILE CARD EDITOR FORM */}
      {step === 4 && (
        <form onSubmit={handleSubmitProfile} className="bg-white/90 backdrop-blur-xl border border-white/80 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-widest flex items-center gap-2">
              <span>Step 4: Complete Your Yearbook Details ({selectedStudent?.fullName})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Left Side: Photo upload */}
            <div className="md:col-span-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Graduation Portrait</span>
                <span className="text-[8px] text-gray-400 block mt-0.5">Please upload a high-resolution face photo in graduation robe.</span>
              </div>
              
              <div className="aspect-[3/4] w-full rounded-2xl bg-slate-50 border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden group">
                {profilePicture ? (
                  <>
                    <img src={profilePicture} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setProfilePicture('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg transition-colors cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer p-4 h-full w-full">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleProfilePicChange}
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-600 mb-2 group-hover:scale-105 transition-transform" />
                    <span className="text-[10px] text-gray-700 font-bold">Upload Portrait</span>
                    <span className="text-[8px] text-gray-400 mt-1.5 text-center">Clear image of your face</span>
                  </label>
                )}

                {isUploadingPic && (
                  <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center p-4">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <span className="text-[9px] text-gray-600 font-bold mt-1">Uploading...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Bio Inputs */}
            <div className="md:col-span-8 space-y-4">
              
              {/* Quote */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Yearbook Quote</label>
                <input
                  type="text"
                  placeholder="e.g. The future belongs to those who believe in their dreams!"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 border border-gray-100 focus:border-indigo-600 text-xs text-gray-700 focus:outline-none"
                  required
                />
              </div>

              {/* Favourite School Memory */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Favourite School Memory</label>
                <textarea
                  placeholder="Describe your absolute best school memory. Note: A student's profile should ONLY contain that student's personal graduation memories (exclude unrelated topics)."
                  value={favoriteMemory}
                  onChange={(e) => setFavoriteMemory(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 border border-gray-100 focus:border-indigo-600 text-xs text-gray-700 focus:outline-none h-24 resize-none"
                  required
                />
              </div>

              {/* Future Ambitions */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Future Ambition & Bio Details</label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer, Medical Surgeon, Creative Entrepreneur"
                  value={futureAmbition}
                  onChange={(e) => setFutureAmbition(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 border border-gray-100 focus:border-indigo-600 text-xs text-gray-700 focus:outline-none"
                  required
                />
              </div>

            </div>
          </div>

          {/* Parent Message */}
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Parent appreciation / congratulatory message</label>
            <textarea
              placeholder="A brief congratulatory note from parents to the graduating student (optional but highly recommended)..."
              value={parentAppreciation}
              onChange={(e) => setParentAppreciation(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 border border-gray-100 focus:border-indigo-600 text-xs text-gray-700 focus:outline-none h-20 resize-none"
            />
          </div>

          {/* Live Synthesized Bio Narrative Summary Card */}
          <div className="pt-2 border-t border-gray-100">
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider">Synthesized Bio Narrative Card Summary</span>
              </div>
              <p className="text-xs text-amber-950 font-medium leading-relaxed italic">
                "{generateBioSummary({
                  fullName: selectedStudent?.fullName,
                  quote,
                  favoriteMemory,
                  futureAmbition,
                  parentAppreciation,
                  graduationYear: selectedYear,
                  graduationCategory: selectedCategory
                })}"
              </p>
              <span className="text-[9px] text-amber-600/90 block font-semibold">
                This personalized summary is automatically synthesized from your responses and will describe you on your official yearbook profile!
              </span>
            </div>
          </div>

          {/* Graduation Gallery upload */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Attach gallery memories</span>
                <span className="text-[8px] text-gray-400 block mt-0.5">Attach up to {settings?.maxImages || 5} photos showing beautiful school milestones.</span>
              </div>
              <label className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-full text-[10px] font-black cursor-pointer transition-colors shrink-0">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryUploadChange}
                  disabled={isUploadingGallery || galleryImages.length >= (settings?.maxImages || 5)}
                />
                <span>Attach Photos</span>
              </label>
            </div>

            {/* Gallery grid previews */}
            {galleryImages.length > 0 || isUploadingGallery ? (
              <div className="grid grid-cols-5 gap-3 p-3 bg-slate-50 border border-gray-100 rounded-2xl">
                {galleryImages.map((img, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-200 border border-gray-200 relative group animate-in zoom-in-50 duration-250">
                    <img src={img} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setGalleryImages(galleryImages.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-red-600/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {isUploadingGallery && (
                  <div className="aspect-square rounded-xl bg-slate-200 border border-gray-200 flex flex-col items-center justify-center animate-pulse">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Bottom navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Name Search</span>
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-55 text-white rounded-full text-xs font-black shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Submit Yearbook Bio Card</span>
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
