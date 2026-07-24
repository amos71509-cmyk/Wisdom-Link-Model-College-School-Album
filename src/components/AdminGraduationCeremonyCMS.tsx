import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Video, UploadCloud, CheckCircle2, Clock, XCircle, Trash2, 
  Edit2, Eye, Play, Sparkles, Filter, Search, Loader2, Image as ImageIcon, 
  MessageSquare, Check, X, ShieldCheck, Film, Award, Send
} from 'lucide-react';
import { GraduationMemory, GraduationMemoryComment } from '../types';
import { 
  subscribeAllGraduationMemories, 
  approveGraduationMemory, 
  rejectGraduationMemory, 
  deleteGraduationMemory, 
  updateGraduationMemoryThumbnail,
  submitGraduationCeremonyMemory,
  subscribeAllGraduationComments,
  approveGraduationComment,
  deleteGraduationComment
} from '../services/firebaseService';
import { auth } from '../firebase';
import { compressImage } from '../lib/imageCompressor';
import { getCloudinaryThumbnail } from '../utils/videoUtils';
import { uploadFileToCloudinary } from '../utils/uploadHelper';

interface AdminGraduationCeremonyCMSProps {
  triggerFeedback: (type: 'success' | 'error', message: string) => void;
}

type CMSSubTab = 'pending' | 'approved' | 'rejected' | 'upload' | 'comments';

export default function AdminGraduationCeremonyCMS({ triggerFeedback }: AdminGraduationCeremonyCMSProps) {
  const [activeSubTab, setActiveSubTab] = useState<CMSSubTab>('pending');
  const [allMemories, setAllMemories] = useState<GraduationMemory[]>([]);
  const [allComments, setAllComments] = useState<GraduationMemoryComment[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');

  // Direct Admin Upload Form State
  const [adminUploadTitle, setAdminUploadTitle] = useState('');
  const [adminUploadCaption, setAdminUploadCaption] = useState('');
  const [adminUploadYear, setAdminUploadYear] = useState('2026');
  const [adminUploadRole, setAdminUploadRole] = useState<'Parent' | 'Student' | 'Teacher' | 'Photographer' | 'School Staff' | 'Visitor'>('School Staff');
  const [adminUploadType, setAdminUploadType] = useState('Award Presentation');
  const [adminUploadFile, setAdminUploadFile] = useState<File | null>(null);
  const [adminUploadPreview, setAdminUploadPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Custom Thumbnail Editing State for Videos
  const [editingThumbnailMemory, setEditingThumbnailMemory] = useState<GraduationMemory | null>(null);
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Subscriptions
  useEffect(() => {
    setLoading(true);
    const unsubMemories = subscribeAllGraduationMemories((memories) => {
      setAllMemories(memories);
      setLoading(false);
    });

    const unsubComments = subscribeAllGraduationComments((comments) => {
      setAllComments(comments);
    });

    return () => {
      unsubMemories();
      unsubComments();
    };
  }, []);

  const pendingMemories = allMemories.filter(m => m.status === 'Pending');
  const approvedMemories = allMemories.filter(m => m.status === 'Approved');
  const rejectedMemories = allMemories.filter(m => m.status === 'Rejected');
  const pendingComments = allComments.filter(c => c.status === 'Pending');

  const adminEmail = auth.currentUser?.email || 'Administrator';

  // Handle Approve Memory
  const handleApprove = async (id: string) => {
    try {
      await approveGraduationMemory(id, adminEmail);
      triggerFeedback('success', 'Ceremony memory approved! Now live on public gallery.');
    } catch (err) {
      triggerFeedback('error', 'Failed to approve memory.');
    }
  };

  // Handle Reject Memory
  const handleReject = async (id: string) => {
    try {
      await rejectGraduationMemory(id, adminEmail, 'Does not meet ceremony archiving criteria');
      triggerFeedback('success', 'Ceremony memory rejected.');
    } catch (err) {
      triggerFeedback('error', 'Failed to reject memory.');
    }
  };

  // Handle Delete Memory
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this ceremony memory?')) return;
    try {
      await deleteGraduationMemory(id);
      triggerFeedback('success', 'Ceremony memory permanently deleted.');
    } catch (err) {
      triggerFeedback('error', 'Failed to delete memory.');
    }
  };

  // Direct Admin File Selection
  const handleAdminFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const isImg = f.type.startsWith('image/');
      const isVid = f.type.startsWith('video/');

      if (!isImg && !isVid) {
        triggerFeedback('error', 'Please select a valid image or video file.');
        return;
      }

      setAdminUploadFile(f);
      setMediaType(isImg ? 'image' : 'video');
      setAdminUploadPreview(URL.createObjectURL(f));
    }
  };

  // Direct Admin Upload Submit
  const handleAdminUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUploadFile || !adminUploadCaption.trim()) {
      triggerFeedback('error', 'Please select a file and provide a caption.');
      return;
    }

    setUploading(true);
    setUploadProgress(20);

    try {
      setUploadProgress(40);
      console.log(`[ADMIN UPLOAD] Starting upload for file ${adminUploadFile.name}...`);
      const uploadResult = await uploadFileToCloudinary(adminUploadFile, {
        folder: 'scholars_class_2026',
        onProgress: (pct) => {
          setUploadProgress(Math.min(95, 20 + Math.round(pct * 0.75)));
        }
      });

      const finalUrl = uploadResult.secure_url || uploadResult.url;
      if (!finalUrl || !finalUrl.startsWith('http')) {
        throw new Error("Cloudinary upload did not return a valid HTTPS URL.");
      }

      let thumbnailUrl = '';
      if (mediaType === 'video') {
        thumbnailUrl = getCloudinaryThumbnail(finalUrl) || 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800';
      }

      await submitGraduationCeremonyMemory({
        title: adminUploadTitle.trim() || adminUploadCaption.substring(0, 30),
        eventName: 'Graduation Ceremony ' + adminUploadYear,
        graduationYear: adminUploadYear,
        uploadedByType: adminUploadRole,
        memoryType: adminUploadType,
        mediaType,
        mediaUrl: finalUrl,
        thumbnailUrl,
        caption: adminUploadCaption,
        uploaderName: 'School Administrator (' + adminEmail + ')',
        status: 'Approved',
        approvedBy: adminEmail,
        approvedAt: new Date().toISOString()
      });

      setUploadProgress(100);
      setUploading(false);
      setAdminUploadCaption('');
      setAdminUploadTitle('');
      setAdminUploadFile(null);
      setAdminUploadPreview(null);

      triggerFeedback('success', 'Official Graduation Ceremony memory uploaded and approved!');
      setActiveSubTab('approved');

    } catch (err: any) {
      console.error(err);
      triggerFeedback('error', err.message || 'Failed to upload ceremony memory.');
      setUploading(false);
    }
  };

  // Thumbnail Customization Save
  const handleSaveThumbnail = async () => {
    if (!editingThumbnailMemory) return;

    setThumbnailUploading(true);
    try {
      let finalThumb = customThumbnailUrl.trim();

      if (thumbnailFile) {
        const uploadResult = await uploadFileToCloudinary(thumbnailFile, { folder: 'scholars_class_2026' });
        if (uploadResult.url) finalThumb = uploadResult.url;

        await updateGraduationMemoryThumbnail(editingThumbnailMemory.id, finalThumb);
        triggerFeedback('success', 'Video thumbnail updated successfully!');
        setEditingThumbnailMemory(null);
        setThumbnailUploading(false);
        return;
      }

      if (finalThumb) {
        await updateGraduationMemoryThumbnail(editingThumbnailMemory.id, finalThumb);
        triggerFeedback('success', 'Video thumbnail updated successfully!');
        setEditingThumbnailMemory(null);
      } else {
        triggerFeedback('error', 'Please select an image file or provide an image URL.');
      }
    } catch (err: any) {
      console.error("Failed to update thumbnail:", err);
      triggerFeedback('error', err.message || 'Failed to update thumbnail');
    } finally {
      setThumbnailUploading(false);
    }
  };

  // Filter memories
  const filterList = (list: GraduationMemory[]) => {
    return list.filter(m => {
      if (selectedYear !== 'All' && m.graduationYear !== selectedYear) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCap = m.caption?.toLowerCase().includes(q);
        const matchUploader = m.uploaderName?.toLowerCase().includes(q);
        const matchType = m.memoryType?.toLowerCase().includes(q);
        if (!matchCap && !matchUploader && !matchType) return false;
      }
      return true;
    });
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* Header Info Banner */}
      <div className="bg-slate-950/60 border border-white/10 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <span>Graduation Ceremony Content Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage public graduation ceremony videos, photos, speeches, and choir performances. Moderate submissions, edit thumbnails, or upload official ceremony media.
          </p>
        </div>

        <button
          onClick={() => setActiveSubTab('upload')}
          className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Admin Direct Upload</span>
        </button>
      </div>

      {/* Sub-Tabs Pill Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        {[
          { id: 'pending', label: 'Pending Approval', count: pendingMemories.length, color: 'bg-amber-500' },
          { id: 'approved', label: 'Approved Ceremony Archive', count: approvedMemories.length, color: 'bg-emerald-500' },
          { id: 'rejected', label: 'Rejected Items', count: rejectedMemories.length, color: 'bg-red-500' },
          { id: 'comments', label: 'Comments Moderation', count: pendingComments.length, color: 'bg-indigo-500' },
          { id: 'upload', label: 'Direct Admin Upload', count: undefined }
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as CMSSubTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-white/5'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono text-white ${tab.color}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Filter controls */}
      {activeSubTab !== 'upload' && activeSubTab !== 'comments' && (
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-950 p-3 rounded-xl border border-white/5">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by caption, uploader, or type..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="py-2 px-3 bg-slate-900 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
            >
              {['All', '2026', '2025', '2024', '2023', '2022'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: PENDING SUBMISSIONS */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          {filterList(pendingMemories).length === 0 ? (
            <div className="p-12 text-center bg-slate-950/40 border border-white/5 rounded-2xl">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No pending ceremony submissions in moderation queue.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterList(pendingMemories).map(item => (
                <div key={item.id} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-xl">
                  
                  <div className="space-y-2">
                    <div className="relative aspect-video w-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-1">
                      {item.mediaType === 'video' ? (
                        <video src={item.mediaUrl} controls className="w-full h-full object-contain" />
                      ) : (
                        <img src={item.mediaUrl} alt={item.caption} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500 text-slate-950">
                        {item.memoryType}
                      </span>
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-900 text-slate-200">
                        {item.graduationYear}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium line-clamp-2">"{item.caption}"</p>
                    <p className="text-[10px] text-slate-400">
                      Uploader: <span className="text-amber-400 font-bold">{item.uploaderName} ({item.uploadedByType})</span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="flex-1 py-2 px-3 bg-red-900/60 hover:bg-red-800 text-red-200 font-extrabold text-[10px] uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-red-500/30"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 rounded-xl transition-colors cursor-pointer border border-white/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: APPROVED CEREMONY GALLERY */}
      {activeSubTab === 'approved' && (
        <div className="space-y-4">
          {filterList(approvedMemories).length === 0 ? (
            <div className="p-12 text-center bg-slate-950/40 border border-white/5 rounded-2xl">
              <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No approved ceremony memories yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterList(approvedMemories).map(item => (
                <div key={item.id} className="bg-slate-950 border border-white/10 rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-xl">
                  
                  <div className="space-y-2">
                    <div className="relative aspect-video w-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-1">
                      {item.mediaType === 'video' ? (
                        <video
                          src={item.mediaUrl}
                          poster={item.thumbnailUrl || getCloudinaryThumbnail(item.mediaUrl)}
                          controls
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img src={item.mediaUrl} alt={item.caption} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500 text-slate-950">
                        {item.memoryType}
                      </span>
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-900 text-slate-200">
                        {item.graduationYear}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium line-clamp-2">"{item.caption}"</p>
                    <p className="text-[10px] text-slate-400">
                      Shared by <span className="text-amber-400 font-bold">{item.uploaderName}</span>
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    {item.mediaType === 'video' && (
                      <button
                        onClick={() => {
                          setEditingThumbnailMemory(item);
                          setCustomThumbnailUrl(item.thumbnailUrl || '');
                        }}
                        className="py-1.5 px-2.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold text-[10px] uppercase rounded-xl border border-indigo-500/30 flex items-center gap-1 transition-all cursor-pointer"
                        title="Edit Video Thumbnail"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>Thumbnail</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleReject(item.id)}
                      className="py-1.5 px-2.5 bg-slate-900 hover:bg-amber-950 text-slate-400 hover:text-amber-300 font-bold text-[10px] uppercase rounded-xl border border-white/10 transition-colors cursor-pointer"
                    >
                      Unapprove
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 rounded-xl transition-colors cursor-pointer border border-white/10 ml-auto"
                      title="Delete Memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: REJECTED ITEMS */}
      {activeSubTab === 'rejected' && (
        <div className="space-y-4">
          {filterList(rejectedMemories).length === 0 ? (
            <div className="p-12 text-center bg-slate-950/40 border border-white/5 rounded-2xl">
              <XCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No rejected ceremony items.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterList(rejectedMemories).map(item => (
                <div key={item.id} className="bg-slate-950 border border-red-500/20 rounded-2xl p-4 space-y-3 shadow-xl">
                  <div className="relative aspect-video w-full bg-slate-900 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-1">
                    <img src={item.mediaUrl} alt={item.caption} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <p className="text-xs text-slate-300 font-medium">"{item.caption}"</p>
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Re-Approve</span>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 rounded-xl transition-colors cursor-pointer border border-white/10"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: PENDING COMMENTS MODERATION */}
      {activeSubTab === 'comments' && (
        <div className="space-y-4">
          {pendingComments.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/40 border border-white/5 rounded-2xl">
              <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No pending comments on ceremony memories.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingComments.map(comment => (
                <div key={comment.id} className="p-4 bg-slate-950 border border-indigo-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-amber-400">{comment.authorName}</span>
                      <span className="text-[10px] text-slate-500">• {new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white">"{comment.text}"</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await approveGraduationComment(comment.id, adminEmail);
                        triggerFeedback('success', 'Comment approved!');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={async () => {
                        await deleteGraduationComment(comment.id);
                        triggerFeedback('success', 'Comment deleted.');
                      }}
                      className="p-2 bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 rounded-xl transition-colors cursor-pointer border border-white/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 5: DIRECT ADMIN CONTENT UPLOAD */}
      {activeSubTab === 'upload' && (
        <div className="bg-slate-950 border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-amber-400" />
              <span>Upload Official Graduation Ceremony Media</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Directly upload high-resolution ceremony photos, full highlight videos, speeches, or award presentations.
            </p>
          </div>

          <form onSubmit={handleAdminUploadSubmit} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Uploader Role</label>
                <select
                  value={adminUploadRole}
                  onChange={(e) => setAdminUploadRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
                >
                  <option value="School Staff">School Staff</option>
                  <option value="Photographer">Official Photographer</option>
                  <option value="Teacher">Faculty Teacher</option>
                  <option value="Parent">Parent</option>
                  <option value="Student">Student</option>
                  <option value="Visitor">Visitor</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Graduation Year</label>
                <select
                  value={adminUploadYear}
                  onChange={(e) => setAdminUploadYear(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
                >
                  {['2026', '2025', '2024', '2023', '2022'].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Category / Event Tag</label>
              <select
                value={adminUploadType}
                onChange={(e) => setAdminUploadType(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none"
              >
                {[
                  'Award Presentation',
                  'Graduation Speech',
                  "Principal's Speech",
                  'Teacher Moment',
                  'Group Photo',
                  'Dance Performance',
                  'Drama Performance',
                  'Choir Performance',
                  'Celebration',
                  'Graduation Gown',
                  'Video Highlight',
                  'Family Photo',
                  'Graduation Portrait',
                  'Other'
                ].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* File Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ceremony Media File</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAdminFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />

              {adminUploadPreview ? (
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/10 group flex items-center justify-center p-2">
                  {mediaType === 'video' ? (
                    <video src={adminUploadPreview} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={adminUploadPreview} alt="Preview" className="w-full h-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAdminUploadFile(null);
                      setAdminUploadPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950 text-white hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-white/15 rounded-2xl hover:border-amber-400/50 bg-slate-900/50 transition-all cursor-pointer text-center space-y-2 group"
                >
                  <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-amber-400 transition-colors mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">Click to upload ceremony photo or video</p>
                  <p className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP, MP4, MOV</p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ceremony Caption / Description</label>
              <textarea
                required
                rows={3}
                value={adminUploadCaption}
                onChange={(e) => setAdminUploadCaption(e.target.value)}
                placeholder="Describe the ceremony highlight..."
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publish to Public Ceremony Gallery</span>
                </>
              )}
            </button>

          </form>
        </div>
      )}

      {/* ==========================================================
          VIDEO THUMBNAIL EDITING MODAL
          ========================================================== */}
      {editingThumbnailMemory && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 text-left shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <span>Customize Video Thumbnail</span>
              </h3>
              <button
                onClick={() => setEditingThumbnailMemory(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Editing thumbnail for: <span className="font-bold text-amber-400">"{editingThumbnailMemory.caption}"</span>
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Upload Custom Thumbnail Image</label>
                <input
                  type="file"
                  ref={thumbnailInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setThumbnailFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-slate-300 bg-slate-950 p-2 rounded-xl border border-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Or Paste Image URL</label>
                <input
                  type="text"
                  value={customThumbnailUrl}
                  onChange={(e) => setCustomThumbnailUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              {customThumbnailUrl && (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 p-1 flex items-center justify-center">
                  <img src={customThumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-contain rounded-lg" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-white/10">
              <button
                onClick={handleSaveThumbnail}
                disabled={thumbnailUploading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {thumbnailUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Thumbnail'}
              </button>
              <button
                onClick={() => setEditingThumbnailMemory(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
