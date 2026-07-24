import React, { useState, useRef } from 'react';
import { 
  UploadCloud, X, Loader2, Sparkles, Film, Image as ImageIcon, 
  CheckCircle, Calendar, ArrowLeft, AlertCircle, Info, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../lib/imageCompressor';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { getCloudinaryThumbnail } from '../utils/videoUtils';
import { uploadFileToCloudinary } from '../utils/uploadHelper';

interface ShareMemoryProps {
  onBackToHome: () => void;
}

const EVENT_CATEGORIES = [
  'Graduation Ceremony',
  'Sports Day',
  'Cultural Day',
  'Prize Giving Day',
  'Excursion',
  'Christmas Carol',
  'Science Fair',
  'Club Activities',
  'Other'
];

export default function ShareMemory({ onBackToHome }: ShareMemoryProps) {
  // Form fields
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [eventCategory, setEventCategory] = useState(EVENT_CATEGORIES[0]);
  const [eventDate, setEventDate] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');

  // Media states
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  
  // Status states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setUploadError("Unsupported format. Please upload a high-resolution image or a common video file.");
      return;
    }

    // Limit files to 15MB
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (selectedFile.size > maxSize) {
      setUploadError("File size exceeds 15MB. Please upload a smaller file.");
      return;
    }

    setUploadError('');
    setFile(selectedFile);
    setMediaType(isImage ? 'image' : 'video');

    // Create a local preview URL
    const previewUrl = URL.createObjectURL(selectedFile);
    setLocalPreview(previewUrl);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setMediaType(null);
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    setUploadError('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !caption.trim() || !file) {
      setUploadError("Please provide a Title, Story/Caption, and choose an Image or Video memory file.");
      return;
    }

    setSubmitting(true);
    setUploading(true);
    setUploadError("");
    setUploadProgress(10);

    try {
      console.log(`[COMMUNITY UPLOAD] Starting upload for ${file.name}...`);
      const uploadResult = await uploadFileToCloudinary(file, {
        folder: 'scholars_class_2026',
        onProgress: (pct) => {
          setUploadProgress(Math.min(90, 10 + Math.round(pct * 0.8)));
        }
      });

      const uploadedUrl = uploadResult.secure_url || uploadResult.url;
      if (!uploadedUrl || !uploadedUrl.startsWith('http')) {
        throw new Error("Upload did not return a valid HTTPS URL.");
      }

      setUploadProgress(92);

      // Save submission to community_memories collection as "Pending"
      const id = `comm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const memoryRef = doc(db, "community_memories", id);

      const payload = {
        id,
        title: title.trim(),
        caption: caption.trim(),
        contributorName: contributorName.trim() || "Anonymous Contributor",
        studentName: studentName.trim() || "N/A",
        className: className.trim() || "N/A",
        eventCategory,
        mediaType,
        mediaUrl: uploadedUrl,
        thumbnailUrl: mediaType === 'video' ? (getCloudinaryThumbnail(uploadedUrl) || uploadedUrl) : uploadedUrl,
        uploadDate: eventDate || new Date().toISOString().split('T')[0],
        status: 'Pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        featured: false
      };

      await setDoc(memoryRef, payload);
      setUploadProgress(100);
      setUploading(false);
      setSubmitted(true);
    } catch (err: any) {
      console.error("Community upload error:", err);
      setUploadError(err.message || "Failed to upload file to storage service.");
      setUploading(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setCaption('');
    setEventCategory(EVENT_CATEGORIES[0]);
    setEventDate('');
    setContributorName('');
    setStudentName('');
    setClassName('');
    handleRemoveFile();
    setSubmitted(false);
  };

  return (
    <div className="w-full min-h-screen py-16 px-4 sm:px-6 lg:px-8 relative z-10 text-left">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation Action */}
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-[var(--primary)] transition-colors cursor-pointer mb-8 bg-white/40 border border-white/60 px-4 py-2 rounded-xl backdrop-blur"
          id="share-back-to-archive-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Memory Archive</span>
        </button>

        {/* Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--primary-light)] text-[var(--primary)] rounded-full text-[10px] font-bold uppercase tracking-widest border border-[var(--primary)]/10 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
            <span>Community Contributions</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 font-display">
            Share a Cherished Memory
          </h1>
          <p className="text-sm text-gray-500 max-w-2xl leading-relaxed">
            Preserve your favorite moments, athletic wins, classroom jokes, or graduation photos. All contributions are safely moderated to keep our sanctuary trusted and clean for Wisdom Link families.
          </p>
        </div>

        {/* Multi-Screen Presentation */}
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="bg-white/80 border border-white/80 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl text-center space-y-6 max-w-2xl mx-auto"
              id="submission-success-pane"
            >
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-8 h-8 animate-bounce" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-gray-900 font-display">Memory Received!</h2>
                <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
                  Thank you for sharing your memory. Your submission has been received and will appear on the website after it has been reviewed and approved by the school administrator.
                </p>
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3 max-w-md mx-auto text-left">
                <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-500 leading-normal">
                  <strong className="text-gray-700 block mb-0.5">Note on Moderation:</strong>
                  Your uploads will remain securely private inside our moderation pipeline. Once the administrator authorizes it, your visual memories will display automatically on the timeline and public masonry grids.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleResetForm}
                  className="px-6 py-3 bg-[var(--primary)] text-white hover:opacity-90 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Share Another Memory
                </button>
                <button
                  onClick={onBackToHome}
                  className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Return to Archive
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="share-form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white/75 border border-white/70 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl grid grid-cols-1 md:grid-cols-12 gap-8 relative overflow-hidden"
              onDragEnter={handleDrag}
              id="memory-submission-form"
            >
              
              {/* Left Column: Drag & Drop Upload Zone (Grid Span 5) */}
              <div className="md:col-span-5 flex flex-col gap-4">
                <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest block">
                  Media Attachment (Required)
                </label>

                <div 
                  className={`flex-1 min-h-[250px] border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden ${
                    dragActive 
                      ? 'border-[var(--primary)] bg-[var(--primary-light)] scale-[0.98]' 
                      : localPreview 
                        ? 'border-gray-200 bg-gray-50/20' 
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  id="drag-drop-zone"
                >
                  {localPreview ? (
                    // Display Active Preview Panel
                    <div className="absolute inset-0 flex flex-col" id="preview-panel">
                      <div className="relative flex-1 w-full bg-slate-900 flex items-center justify-center">
                        {mediaType === 'image' ? (
                          <img 
                            src={localPreview} 
                            alt="Local upload preview" 
                            className="w-full h-full object-contain" 
                          />
                        ) : (
                          <video 
                            src={localPreview} 
                            className="w-full h-full object-contain" 
                            controls 
                          />
                        )}
                        
                        {/* Remove Attachment Overlay Button */}
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="absolute top-3 right-3 p-1.5 bg-gray-900/80 hover:bg-gray-900 text-white rounded-full transition-colors cursor-pointer border border-white/10"
                          title="Remove Attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* File Metadata summary */}
                      <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-500">
                        <span className="truncate max-w-[150px]">{file?.name}</span>
                        <span>{file ? (file.size / (1024 * 1024)).toFixed(2) : 0} MB</span>
                      </div>
                    </div>
                  ) : (
                    // Blank Placeholder upload state
                    <div className="space-y-4">
                      <div className="mx-auto w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-700">
                          Drag and drop your file here, or{' '}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[var(--primary)] hover:underline font-extrabold cursor-pointer"
                          >
                            browse
                          </button>
                        </p>
                        <p className="text-[10px] text-gray-400">
                          High-resolution images (PNG, JPG, JPEG, WEBP) or videos (MP4, MOV, WEBM) up to 15MB
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    className="hidden"
                    id="hidden-file-input"
                  />
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-[11px] text-red-600 leading-normal" id="upload-error-message">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Metadata details (Grid Span 7) */}
              <div className="md:col-span-7 flex flex-col gap-5">
                
                <div className="border-b border-gray-100 pb-3">
                  <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest block">Step 2 of 2</span>
                  <h3 className="text-base font-extrabold text-gray-900 font-display mt-0.5">Describe your memory</h3>
                </div>

                {/* Grid of details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Title */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block">
                      Memory Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Backstage Recital Jitters"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs border border-gray-200 focus:border-[var(--primary)] bg-white/60 focus:bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>

                  {/* Caption */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block">
                      Caption or Story <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Write a brief caption or tell the complete backstory behind this photo/video memory..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs border border-gray-200 focus:border-[var(--primary)] bg-white/60 focus:bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all resize-none"
                    />
                  </div>

                  {/* Category select */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block">
                      Event Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs border border-gray-200 focus:border-[var(--primary)] bg-white/60 focus:bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
                    >
                      {EVENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Event Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block">
                      Event Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs border border-gray-200 focus:border-[var(--primary)] bg-white/60 focus:bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>

                  {/* Contributor Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mrs. Abigail Vance"
                      value={contributorName}
                      onChange={(e) => setContributorName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs border border-gray-200 focus:border-[var(--primary)] bg-white/60 focus:bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>

                  {/* Student Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block">
                      Associated Student (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Marcus Vance"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs border border-gray-200 focus:border-[var(--primary)] bg-white/60 focus:bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>

                  {/* Class Name */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block">
                      Class or Graduation Year (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Class of 2026, Alumni, Grade 12"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs border border-gray-200 focus:border-[var(--primary)] bg-white/60 focus:bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
                    />
                  </div>

                </div>

                {/* Upload simulated progress indicator */}
                {uploading && (
                  <div className="space-y-2 mt-4" id="upload-progress-bar">
                    <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary)]" />
                        <span>Uploading files...</span>
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-3 mt-auto">
                  <button
                    type="button"
                    onClick={onBackToHome}
                    disabled={submitting}
                    className="px-5 py-3 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !file}
                    className="px-6 py-3 bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 min-w-[140px]"
                    id="submit-memory-btn"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Encrypting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        <span>Submit Memory</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

            </motion.form>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
