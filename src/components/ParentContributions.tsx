import React, { useState, useRef } from 'react';
import { Sparkles, MessageCircleHeart, Heart, Send, CheckCircle, Image, PlusCircle, AlertCircle, Film, UploadCloud, X, Loader2, Trash2 } from 'lucide-react';
import { ParentContribution, Memory } from '../types';
import { DEFAULT_PARENT_CONTRIBUTIONS } from '../data/schoolData';
import { compressImage } from '../lib/imageCompressor';
import { submitToModeration } from '../services/firebaseService';
import { stageOrUploadMedia, validateUploadFile } from '../utils/uploadHelper';

interface ParentContributionsProps {
  onAddMemory: (newMemory: Memory) => void;
  parentContributions: ParentContribution[];
  onAddContribution: (newCont: ParentContribution) => void;
  cleanUpMode: boolean;
}

export default function ParentContributions({
  onAddMemory,
  parentContributions,
  onAddContribution,
  cleanUpMode,
}: ParentContributionsProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('Parent of Class of 2026');
  const [event, setEvent] = useState('Graduation Ceremony');
  const [caption, setCaption] = useState('');
  const [selectedPhotoPresetIdx, setSelectedPhotoPresetIdx] = useState(0);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [particles, setParticles] = useState<{ id: number; left: number; color: string; size: number; delay: number }[]>([]);

  // Real upload states
  const [mediaMode, setMediaMode] = useState<'preset' | 'upload'>('preset');
  const [uploading, setUploading] = useState(false);
  const [customUploadedUrl, setCustomUploadedUrl] = useState('');
  const [uploadedMediaType, setUploadedMediaType] = useState<'image' | 'video' | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pattern to replace/cleanup an existing Cloudinary asset
  const replaceAssetInDatabase = async (newAssetUrl: string, oldAssetUrl: string) => {
    if (oldAssetUrl && oldAssetUrl.includes("cloudinary.com")) {
      try {
        await fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: oldAssetUrl })
        });
      } catch (err) {
        console.error("Cloud cleanup warning:", err);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);
    const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);

    if (!isImg && !isVid) {
      setUploadError("Unsupported media format. Please upload an image or video.");
      return;
    }

    const validation = validateUploadFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid file format or size.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      console.log(`[PARENT CONTRIBUTION] Staging upload for ${file.name}...`);
      const uploadResult = await stageOrUploadMedia(file, { folder: 'scholars_class_2026' });

      const newUrl = uploadResult.secure_url || uploadResult.url;
      if (!newUrl) {
        throw new Error("Upload did not return a valid media URL.");
      }

      if (customUploadedUrl) {
        await replaceAssetInDatabase(newUrl, customUploadedUrl);
      }

      setCustomUploadedUrl(newUrl);
      setUploadedMediaType(isImg ? 'image' : 'video');
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "An unexpected error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveUploadedFile = async () => {
    if (customUploadedUrl) {
      await replaceAssetInDatabase('', customUploadedUrl);
    }
    setCustomUploadedUrl('');
    setUploadedMediaType(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Preset photographic options parents can choose from for simulation
  const PHOTO_PRESETS = [
    {
      url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=600',
      label: 'Graduation Caps'
    },
    {
      url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600',
      label: 'Classroom Smiles'
    },
    {
      url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=600',
      label: 'Sports Finish Line'
    },
    {
      url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=600',
      label: 'Winter Orchestra'
    },
    {
      url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=600',
      label: 'Outdoor Excursion'
    }
  ];

  const handleConfetti = () => {
    // Generate flying particles
    const colors = ['#0f5132', '#d97706', '#3b82f6', '#ec4899', '#f59e0b', '#10b981'];
    const newParticles = Array.from({ length: 45 }).map((_, idx) => ({
      id: Math.random() + idx,
      left: Math.random() * 100, // percentage
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 6, // size in px
      delay: Math.random() * 0.5, // seconds delay
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 3500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !caption.trim() || !event.trim()) return;

    if (mediaMode === 'upload' && !customUploadedUrl) {
      setUploadError("Please upload an image or video file first, or switch back to Preset Cover Template.");
      return;
    }

    setIsSubmitting(true);
    setUploadError('');

    try {
      const selectedPhoto = PHOTO_PRESETS[selectedPhotoPresetIdx].url;
      const isVideo = mediaMode === 'upload' && uploadedMediaType === 'video';
      const finalPhotoUrl = (mediaMode === 'upload' && customUploadedUrl) 
        ? customUploadedUrl 
        : selectedPhoto;

      if (isVideo) {
        // Route as a dynamic Video submission to the moderation pipeline
        const videoPayload = {
          id: `video-${Date.now()}`,
          title: `${event} memory by ${name}`,
          url: customUploadedUrl,
          submittedBy: name,
          role: relation,
          submittedAt: new Date().toISOString()
        };
        await submitToModeration('video', videoPayload);
      } else {
        // Route as a dynamic Photo submission to the moderation pipeline
        const photoPayload = {
          id: `photo-${Date.now()}`,
          photoUrl: finalPhotoUrl,
          caption: caption,
          event: event,
          contributorName: name,
          relation: relation,
          date: new Date().toISOString().split('T')[0]
        };
        await submitToModeration('photo', photoPayload);
      }

      // Also submit a corresponding Guestbook greeting so they both appear for the administrator
      const guestbookPayload = {
        id: `gb-${Date.now()}`,
        name: name,
        role: relation,
        message: `Shared ${event} memory: "${caption}"`,
        timestamp: new Date().toISOString()
      };
      await submitToModeration('guestbook', guestbookPayload);

      handleConfetti();

      // Reset Form
      setName('');
      setCaption('');
      setCustomUploadedUrl('');
      setUploadedMediaType(null);
      setMediaMode('preset');
      setUploadError('');
      setShowForm(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4500);
    } catch (err: any) {
      console.error("Failed to submit to moderation collection:", err);
      setUploadError(`Failed to send submission to moderation deck: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contributions" className="py-20 bg-transparent relative overflow-hidden z-10">
      
      {/* Floating Confetti Particle Overlay */}
      {particles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute top-0 animate-bounce"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                borderRadius: '50%',
                animation: `fall 3s linear infinite`,
                animationDelay: `${p.delay}s`,
                opacity: 0.8
              }}
            />
          ))}
          <style>{`
            @keyframes fall {
              0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 pb-4 border-b border-white/20">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] glass-pill px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3">
              <MessageCircleHeart className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Community Sentiment</span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight text-left">
              Parent & Alumni Contributions
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-gray-500 max-w-xl text-left leading-normal">
              Heartwarming stories, letters of gratitude, and memories submitted directly by our beloved school community.
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--primary)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg hover:bg-[var(--accent)] hover:scale-105 transition-all duration-300 shrink-0"
            id="contribute-toggle-btn"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showForm ? 'Close Editor' : 'Submit Your Memory'}</span>
          </button>
        </div>

        {/* Success Toast */}
        {showSuccessToast && (
          <div className="mb-10 max-w-xl mx-auto p-4.5 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3.5 shadow-md animate-in slide-in-from-top duration-300 text-left">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-green-900 text-sm">Memory Preserved Successfully!</h4>
              <p className="text-xs text-green-700 leading-normal mt-1">
                Your memory has been authorized and injected into the live archive database! Scroll to the <strong>Memory Gallery</strong> section above to see it dynamically listed in the Parent feed!
              </p>
            </div>
          </div>
        )}

        {/* Form Slide-down Block */}
        {showForm && (
          <div
            id="parent-contribution-form"
            className="mb-16 glass-card-heavy p-6 sm:p-10 border border-white/60 shadow-2xl max-w-3xl mx-auto text-left animate-in slide-in-from-top duration-300"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-[var(--accent)] animate-pulse" />
              <h3 className="text-lg font-bold text-gray-900">Add to the Digital Memory Chest</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mrs. Abigail Vance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none glass-input text-gray-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Relationship to School
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Parent of Liam Vance (Grade 10)"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none glass-input text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Target Event
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Graduation Day, Sports Day 2026"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none glass-input text-gray-800"
                  />
                </div>

                <div className="sm:col-span-2 space-y-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    Memory Media
                  </label>
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl max-w-md">
                    <button
                      type="button"
                      onClick={() => setMediaMode('preset')}
                      className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                        mediaMode === 'preset'
                          ? 'bg-white text-[var(--primary)] shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Use Preset Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaMode('upload')}
                      className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                        mediaMode === 'upload'
                          ? 'bg-white text-[var(--primary)] shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Upload Image / Video
                    </button>
                  </div>

                  {mediaMode === 'preset' ? (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                        Choose Photo Template
                      </label>
                      <div className="flex gap-2 items-center p-2.5 rounded-xl border border-white/40 glass-input bg-white/50">
                        <Image className="w-4 h-4 text-gray-400 shrink-0" />
                        <select
                          value={selectedPhotoPresetIdx}
                          onChange={(e) => setSelectedPhotoPresetIdx(Number(e.target.value))}
                          className="w-full border-0 focus:outline-none text-xs sm:text-sm text-gray-700 bg-transparent"
                        >
                          {PHOTO_PRESETS.map((p, idx) => (
                            <option key={p.label} value={idx}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                        Select Custom Image or Video file
                      </label>
                      
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 bg-white/50 hover:bg-white transition-all relative group">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*,video/*"
                          onChange={handleFileChange}
                          disabled={uploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                          id="media-uploader-input"
                        />
                        
                        <div className="flex flex-col items-center text-center">
                          <UploadCloud className="w-8 h-8 text-gray-400 mb-2.5 group-hover:scale-105 transition-transform" />
                          <p className="text-xs font-bold text-gray-700">
                            Drag and drop or click to select image or video file
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Supports PNG, JPEG, MP4 files up to 15MB
                          </p>
                        </div>
                      </div>

                      {uploading && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-amber-600" />
                          <span>Uploading and compressing media...</span>
                        </div>
                      )}

                      {uploadError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium flex items-start gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>{uploadError}</span>
                        </div>
                      )}

                      {customUploadedUrl && (
                        <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-300">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {uploadedMediaType === 'video' ? (
                              <Film className="w-4 h-4 text-green-600 shrink-0" />
                            ) : (
                              <Image className="w-4 h-4 text-green-600 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="text-[10px] text-green-800 font-bold uppercase tracking-wider block">
                                {uploadedMediaType} uploaded successfully
                              </span>
                              <span className="text-xs text-gray-600 font-mono block truncate">
                                {customUploadedUrl}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={handleRemoveUploadedFile}
                            className="p-1.5 hover:bg-green-100 rounded-lg text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
                            title="Remove uploaded asset"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  Describe Your Beautiful Memory
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share details of the laughter, the pride, and the growth you witnessed..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none glass-input text-gray-800 leading-relaxed"
                />
              </div>

              {/* Informational Warning */}
              <p className="text-[11px] text-gray-400 flex items-start gap-1.5 leading-normal">
                <AlertCircle className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5 shrink-0" />
                <span>
                  By submitting, you authorize the custodian to display this visual asset on the public gallery trace. To ensure a safe community, your post will be routed to our secure moderation staging deck for teacher review before being displayed live.
                </span>
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3.5 bg-[var(--primary)] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg hover:bg-[var(--accent)] transition-all duration-300 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isSubmitting ? "Staging Submission..." : "Publish Memory"}</span>
              </button>
            </form>
          </div>
        )}

        {/* Contributions Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8" id="contributions-cards">
          {parentContributions.map((cont) => (
            <div
              key={cont.id}
              className="glass-card overflow-hidden shadow-lg border border-white/60 flex flex-col justify-between group hover:shadow-2xl transition-all duration-300 text-left relative"
            >
              {/* Visual deletion overlay for Clean Up Mode */}
              {cleanUpMode && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Are you sure you want to permanently delete parent contribution from "${cont.contributorName}"?`)) {
                      return;
                    }
                    try {
                      if (cont.id.startsWith('static-') || !cont.id.includes('-')) {
                        alert('This is a core template contribution. Custom parent uploads can be pruned directly.');
                        return;
                      }
                      
                      const { db } = await import('../firebase');
                      const { doc, deleteDoc } = await import('firebase/firestore');
                      await deleteDoc(doc(db, 'photos', cont.id));
                      
                      // Clean up Cloudinary asset if applicable
                      if (cont.photoUrl && cont.photoUrl.includes('cloudinary.com')) {
                        fetch('/api/delete-cloudinary', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: cont.photoUrl }),
                        }).catch((err) => console.error('Cloudinary asset cleanup error:', err));
                      }
                    } catch (err: any) {
                      alert(`Failed to delete contribution: ${err.message || err}`);
                    }
                  }}
                  className="absolute top-3 right-12 z-30 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-400 hover:scale-110 transition-transform animate-pulse cursor-pointer flex items-center justify-center"
                  title="Delete Contribution"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              
              {/* Cover Photo */}
              <div className="h-44 overflow-hidden relative shrink-0 bg-slate-950">
                {cont.photoUrl && (cont.photoUrl.includes('/video/upload/') || cont.photoUrl.endsWith('.mp4') || cont.photoUrl.startsWith('data:video')) ? (
                  <video
                    src={cont.photoUrl}
                    controls
                    className="w-full h-full object-contain bg-slate-950"
                  />
                ) : (
                  <img
                    src={cont.photoUrl}
                    alt={cont.event}
                    className="w-full h-full object-contain bg-slate-950 p-1 transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                )}
                
                {/* Event badge */}
                <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-bold text-[var(--primary)] uppercase tracking-wider shadow-sm border border-white/50">
                  {cont.event}
                </span>

                {/* Heart overlay decoration */}
                <div className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full shadow">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>

              {/* Text Body */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <blockquote className="text-xs sm:text-sm text-gray-600 leading-relaxed font-normal italic">
                  “{cont.caption}”
                </blockquote>

                {/* Contributor Card Details */}
                <div className="pt-4 border-t border-gray-50 flex items-center gap-3.5">
                  {/* Decorative Initials circle */}
                  <div className="h-10 w-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold flex items-center justify-center shrink-0 uppercase text-sm border border-white shadow-sm">
                    {cont.contributorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="truncate">
                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                      {cont.contributorName}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-semibold truncate leading-normal">
                      {cont.relation}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
