import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, Calendar, UploadCloud, Users, CheckCircle, Clock, 
  Settings2, Search, Plus, Trash2, Edit2, Check, X, AlertCircle, 
  Loader2, Sliders, FileText, Image as ImageIcon, Eye, RefreshCw, Save,
  XCircle, AlertTriangle, FileSpreadsheet, PlusCircle
} from 'lucide-react';
import { GraduationStudent, GraduationSettings, SchoolPalette } from '../types';
import { 
  saveGraduationStudent, 
  rejectGraduationStudent,
  deleteGraduationStudent, 
  subscribeAllGraduationStudents, 
  subscribeGraduationSettings, 
  saveGraduationSettings 
} from '../services/firebaseService';
import { auth } from '../firebase';
import { compressImage } from '../lib/imageCompressor';
import { uploadFileToCloudinary, getOptimizedMediaUrl, base64ToFile } from '../utils/uploadHelper';
import { generateBioSummary } from '../utils/bioSummary';

interface GraduationManagementTabProps {
  activePalette: SchoolPalette;
}

type SubTabId = 'import-ai' | 'import-manual' | 'roster' | 'pending' | 'approved' | 'rejected' | 'years' | 'settings';

export default function GraduationManagementTab({ activePalette }: GraduationManagementTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('pending');
  const [students, setStudents] = useState<GraduationStudent[]>([]);
  const [settings, setSettings] = useState<GraduationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // AI Import Page States
  const [dragActive, setDragActive] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importYear, setImportYear] = useState(new Date().getFullYear().toString());
  const [importCategory, setImportCategory] = useState('Senior Secondary Graduation');
  const [customCategory, setCustomCategory] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [extractedStudents, setExtractedStudents] = useState<any[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Manual Entry States
  const [manualNamesText, setManualNamesText] = useState('');
  const [manualYear, setManualYear] = useState(new Date().getFullYear().toString());
  const [manualCategory, setManualCategory] = useState('Senior Secondary Graduation');
  const [manualClass, setManualClass] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Manual Entry States - Single Student Form
  const [singleStudentName, setSingleStudentName] = useState('');
  const [singleStudentYear, setSingleStudentYear] = useState(new Date().getFullYear().toString());
  const [singleStudentCategory, setSingleStudentCategory] = useState('Senior Secondary Graduation');
  const [singleStudentClass, setSingleStudentClass] = useState('');
  const [singleStudentPhoto, setSingleStudentPhoto] = useState<string | null>(null); // base64 representation
  const [singleStudentFile, setSingleStudentFile] = useState<File | null>(null);
  const [singleStudentPhotoPreview, setSingleStudentPhotoPreview] = useState<string | null>(null);
  const [singleStudentQuote, setSingleStudentQuote] = useState('');
  const [singleStudentAmbition, setSingleStudentAmbition] = useState('');
  const [singleStudentParentMessage, setSingleStudentParentMessage] = useState('');
  const [manualEntryMode, setManualEntryMode] = useState<'batch' | 'single'>('single');

  // New Year Creation States
  const [newYearInput, setNewYearInput] = useState('');

  // Active Editing Student in Submissions/Review
  const [editingStudent, setEditingStudent] = useState<GraduationStudent | null>(null);
  const [previewStudent, setPreviewStudent] = useState<GraduationStudent | null>(null);
  const [albumStudent, setAlbumStudent] = useState<GraduationStudent | null>(null);
  const [uploadingAlbumPhoto, setUploadingAlbumPhoto] = useState(false);
  const [uploadingPhotoStudentId, setUploadingPhotoStudentId] = useState<string | null>(null);
  const [directPhotoStudent, setDirectPhotoStudent] = useState<GraduationStudent | null>(null);
  const directPhotoInputRef = useRef<HTMLInputElement>(null);

  // Settings form local state
  const [settingsForm, setSettingsForm] = useState<GraduationSettings>({
    id: 'settings',
    submissionsOpen: true,
    deadline: '',
    enabledCategories: [
      'Nursery Graduation',
      'Primary Graduation',
      'Junior Secondary Graduation',
      'Senior Secondary Graduation'
    ],
    maxImages: 5,
    acceptedFormats: ['.jpg', '.jpeg', '.png']
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load students and settings
  useEffect(() => {
    setLoading(true);
    const unsubStudents = subscribeAllGraduationStudents((list) => {
      setStudents(list);
      setLoading(false);
    });

    const unsubSettings = subscribeGraduationSettings((savedSettings) => {
      if (savedSettings) {
        setSettings(savedSettings);
        setSettingsForm(savedSettings);
      } else {
        // Seed default settings if none exist
        const defaults: GraduationSettings = {
          id: 'settings',
          submissionsOpen: true,
          deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          enabledCategories: [
            'Nursery Graduation',
            'Primary Graduation',
            'Junior Secondary Graduation',
            'Senior Secondary Graduation'
          ],
          maxImages: 5,
          acceptedFormats: ['.jpg', '.jpeg', '.png']
        };
        saveGraduationSettings(defaults).catch(err => console.error("Error saving default settings:", err));
      }
    });

    return () => {
      unsubStudents();
      unsubSettings();
    };
  }, []);

  // Unique Years available from current students
  const uniqueYears = Array.from(new Set(students.map(s => s.graduationYear))).sort((a, b) => (b as string).localeCompare(a as string));
  
  // Unique Categories
  const uniqueCategories = [
    'Nursery Graduation',
    'Primary Graduation',
    'Junior Secondary Graduation',
    'Senior Secondary Graduation'
  ];

  // Drag and Drop Handlers
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
      setImportFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  // Call Gemini AI Extraction route
  const handleExtractList = async () => {
    if (!importFile) return;

    setExtracting(true);
    setExtractionStatus('Uploading list to Gatekeeper Server...');

    const reader = new FileReader();
    reader.readAsDataURL(importFile);
    reader.onload = async () => {
      try {
        setExtractionStatus('Gemini is performing OCR & structured AI extraction...');
        const base64Data = reader.result as string;

        const response = await fetch('/api/gemini/extract-graduates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64Data,
            mimeType: importFile.type
          })
        });

        if (!response.ok) {
          throw new Error('Server extraction request failed.');
        }

        const data = await response.json();
        
        if (data && data.students) {
          setExtractedStudents(data.students.map((stud: any, idx: number) => ({
            tempId: `temp-${idx}-${Date.now()}`,
            fullName: stud.fullName || stud.originalName || '',
            originalName: stud.originalName || stud.fullName || '',
            possibleOcrError: !!stud.possibleOcrError,
            suggestedCorrection: stud.suggestedCorrection || '',
            class: stud.detectedClass || ''
          })));

          if (data.detectedCategory && uniqueCategories.includes(data.detectedCategory)) {
            setImportCategory(data.detectedCategory);
          }

          setExtractionStatus('Extraction complete! Loading review editor...');
          setIsReviewMode(true);
        } else {
          throw new Error('Invalid data format returned by AI Extractor.');
        }

      } catch (err: any) {
        console.error("Extraction error:", err);
        alert(`Extraction failed: ${err.message || err}. Reverting to manual entry helper.`);
        // Fallback: empty array to let them add manually
        setExtractedStudents([
          { tempId: `temp-0`, fullName: '', originalName: '', possibleOcrError: false, suggestedCorrection: '', class: '' }
        ]);
        setIsReviewMode(true);
      } finally {
        setExtracting(false);
      }
    };
  };

  // Save imported names to Firestore
  const handleConfirmImport = async () => {
    if (extractedStudents.length === 0) return;

    const finalCategory = importCategory === 'Custom' ? customCategory : importCategory;
    if (!finalCategory) {
      alert("Please specify a Graduation Category.");
      return;
    }

    setExtracting(true);
    setExtractionStatus('Writing graduating students to database...');

    try {
      for (const item of extractedStudents) {
        if (!item.fullName.trim()) continue;

        const studentId = `grad-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const record: GraduationStudent = {
          studentId,
          fullName: item.fullName.trim(),
          graduationYear: importYear,
          graduationCategory: finalCategory,
          class: item.class || '',
          profilePhoto: '',
          personalAlbum: [],
          futureAmbition: '',
          graduationQuote: '',
          parentMessage: '',
          status: 'Imported',
          profileCompleted: false,
          profileApproved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await saveGraduationStudent(record);
      }

      alert(`Successfully imported ${extractedStudents.length} graduating student records!`);
      // Reset
      setImportFile(null);
      setExtractedStudents([]);
      setIsReviewMode(false);
      setActiveSubTab('roster'); // Switch to view imported lists
    } catch (err: any) {
      console.error(err);
      alert(`Failed to complete import: ${err.message || err}`);
    } finally {
      setExtracting(false);
    }
  };

  // Add a blank row in the extraction review table
  const handleAddReviewRow = () => {
    setExtractedStudents([
      ...extractedStudents,
      {
        tempId: `temp-${Date.now()}`,
        fullName: '',
        originalName: '',
        possibleOcrError: false,
        suggestedCorrection: '',
        class: ''
      }
    ]);
  };

  // Remove a row from review list
  const handleRemoveReviewRow = (tempId: string) => {
    setExtractedStudents(extractedStudents.filter(s => s.tempId !== tempId));
  };

  // Handle value changes in review table
  const handleReviewCellChange = (tempId: string, field: string, val: any) => {
    setExtractedStudents(extractedStudents.map(s => {
      if (s.tempId === tempId) {
        return { ...s, [field]: val };
      }
      return s;
    }));
  };

  const handleSingleStudentPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSingleStudentFile(file);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const rawBase = reader.result as string;
        const compressed = await compressImage(rawBase, 400, 400, 0.85);
        setSingleStudentPhoto(compressed);
        setSingleStudentPhotoPreview(compressed);
      } catch (err: any) {
        alert("Failed to process image preview: " + err.message);
      }
    };
  };

  const handleSaveSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudentName.trim()) {
      alert("Student Full Name is required.");
      return;
    }
    if (!singleStudentClass.trim()) {
      alert("Class is required.");
      return;
    }
    if (!singleStudentPhoto && !singleStudentFile) {
      alert("Profile Picture is required. Please select a photo.");
      return;
    }

    setSavingManual(true);
    try {
      // 1. Upload photo to Cloudinary
      let imageUrl = singleStudentPhoto || '';
      if (singleStudentFile) {
        const uploadResult = await uploadFileToCloudinary(singleStudentFile, { folder: 'scholars_class_2026' });
        imageUrl = uploadResult.secure_url || uploadResult.url;
      }

      // 2. Create the student record in Firestore
      const studentId = `grad-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const record: GraduationStudent = {
        studentId,
        fullName: singleStudentName.trim(),
        graduationYear: singleStudentYear,
        graduationCategory: singleStudentCategory,
        class: singleStudentClass.trim(),
        profilePhoto: imageUrl,
        profilePicture: imageUrl,
        personalAlbum: [],
        gallery: [],
        futureAmbition: singleStudentAmbition.trim(),
        graduationQuote: singleStudentQuote.trim(),
        quote: singleStudentQuote.trim(),
        parentMessage: singleStudentParentMessage.trim(),
        parentAppreciation: singleStudentParentMessage.trim(),
        profileCompleted: true,
        profileApproved: true,
        status: 'Approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveGraduationStudent(record);

      alert(`Successfully enrolled and created approved profile for ${record.fullName}!`);
      
      // Reset form states
      setSingleStudentName('');
      setSingleStudentClass('');
      setSingleStudentPhoto(null);
      setSingleStudentPhotoPreview(null);
      setSingleStudentQuote('');
      setSingleStudentAmbition('');
      setSingleStudentParentMessage('');

    } catch (err: any) {
      alert("Error saving student profile: " + (err.message || err));
    } finally {
      setSavingManual(false);
    }
  };

  // Handle Manual batch name entries (METHOD 2)
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNamesText.trim()) {
      alert("Please enter at least one student name.");
      return;
    }

    setSavingManual(true);
    try {
      // Split by commas or newlines
      const names = manualNamesText
        .split(/[,\n]/)
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (names.length === 0) {
        alert("No valid student names found. Please type names separated by commas or new lines.");
        setSavingManual(false);
        return;
      }

      let count = 0;
      for (const name of names) {
        const studentId = `grad-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const record: GraduationStudent = {
          studentId,
          fullName: name,
          graduationYear: manualYear,
          graduationCategory: manualCategory,
          class: manualClass.trim(),
          profilePhoto: '',
          personalAlbum: [],
          futureAmbition: '',
          graduationQuote: '',
          parentMessage: '',
          profileCompleted: false,
          profileApproved: false,
          status: 'Imported',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await saveGraduationStudent(record);
        count++;
      }

      alert(`Successfully registered ${count} graduating student records manually into the yearbook database!`);
      setManualNamesText('');
      setManualClass('');
      setActiveSubTab('roster'); // Switch to search list to review
    } catch (err: any) {
      console.error(err);
      alert(`Manual entry batch failed: ${err.message || err}`);
    } finally {
      setSavingManual(false);
    }
  };

  // Approve a graduate's profile
  const handleApproveProfile = async (student: GraduationStudent) => {
    try {
      let image = student.image || '';
      let profilePhoto = student.profilePhoto || image;
      let profilePicture = student.profilePicture || image;

      if (image.startsWith('data:image/')) {
        console.log("[ADMIN APPROVAL] Uploading staged student avatar to Cloudinary...");
        const file = base64ToFile(image, `approved_student_${student.studentId}.jpg`);
        const res = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026', forceUpload: true });
        image = res.secure_url || res.url;
        profilePhoto = image;
        profilePicture = image;
      }

      const personalAlbum = Array.isArray(student.personalAlbum) ? [...student.personalAlbum] : [];
      for (let i = 0; i < personalAlbum.length; i++) {
        if (personalAlbum[i] && personalAlbum[i].startsWith('data:image/')) {
          const file = base64ToFile(personalAlbum[i], `approved_student_album_${student.studentId}_${i}.jpg`);
          const res = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026', forceUpload: true });
          personalAlbum[i] = res.secure_url || res.url;
        }
      }

      const gallery = Array.isArray(student.gallery) ? [...student.gallery] : [];
      for (let i = 0; i < gallery.length; i++) {
        if (gallery[i] && gallery[i].startsWith('data:image/')) {
          const file = base64ToFile(gallery[i], `approved_student_gallery_${student.studentId}_${i}.jpg`);
          const res = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026', forceUpload: true });
          gallery[i] = res.secure_url || res.url;
        }
      }

      const updated: GraduationStudent = {
        ...student,
        image,
        profilePhoto,
        profilePicture,
        personalAlbum,
        gallery,
        isStaged: false,
        status: 'Approved',
        profileApproved: true,
        profileCompleted: true,
        updatedAt: new Date().toISOString()
      };
      await saveGraduationStudent(updated);
      alert(`${student.fullName}'s profile is now Approved and published live to the Yearbook Wall!`);
    } catch (err: any) {
      alert(`Approval failed: ${err.message || err}`);
    }
  };

  // Reject a profile with feedback
  const handleRejectProfile = async (student: GraduationStudent) => {
    const reason = prompt(`Specify the rejection feedback/reason for ${student.fullName}'s yearbook profile (optional):`, "Please upload a high resolution robe portrait, or correct the typo in your quote.");
    if (reason === null) return; // user clicked Cancel

    try {
      const adminEmail = auth.currentUser?.email || 'Admin';
      await rejectGraduationStudent(student.studentId, reason, adminEmail);
      alert(`${student.fullName}'s profile has been rejected and automatically deleted from storage and database per cleanup rules.`);
    } catch (err: any) {
      alert(`Rejection failed: ${err.message || err}`);
    }
  };

  // Upload/change a student's profile picture directly
  const handleDirectProfilePhotoUpload = async (student: GraduationStudent, file: File) => {
    setUploadingPhotoStudentId(student.studentId);
    try {
      const uploadResult = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026' });
      const photoUrl = uploadResult.secure_url || uploadResult.url;

      // Save to Firestore
      const updated: GraduationStudent = {
        ...student,
        profilePhoto: photoUrl,
        profilePicture: photoUrl,
        updatedAt: new Date().toISOString()
      };
      await saveGraduationStudent(updated);

      alert(`Profile photo for ${student.fullName} has been updated successfully!`);
    } catch (err: any) {
      alert("Photo update failed: " + (err.message || err));
    } finally {
      setUploadingPhotoStudentId(null);
    }
  };

  const triggerDirectPhotoUpload = (student: GraduationStudent) => {
    setDirectPhotoStudent(student);
    directPhotoInputRef.current?.click();
  };

  const handleDirectPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && directPhotoStudent) {
      handleDirectProfilePhotoUpload(directPhotoStudent, file);
    }
    // Reset file input value so same file can be selected again
    e.target.value = '';
  };

  // Add a photo to a student's Personal Album
  const handleAddAlbumPhoto = async (student: GraduationStudent, file: File) => {
    setUploadingAlbumPhoto(true);
    try {
      const uploadResult = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026' });
      const photoUrl = uploadResult.secure_url || uploadResult.url;

      // Append to personalAlbum and gallery lists
      const currentAlbum = student.personalAlbum || student.gallery || [];
      const newAlbum = [...currentAlbum, photoUrl];

      const updated: GraduationStudent = {
        ...student,
        personalAlbum: newAlbum,
        gallery: newAlbum,
        updatedAt: new Date().toISOString()
      };
      await saveGraduationStudent(updated);

      // Keep albumStudent state up to date so the modal re-renders
      setAlbumStudent(updated);

      alert("New photo added to the Personal Graduation Album!");
    } catch (err: any) {
      alert("Failed to add photo to album: " + (err.message || err));
    } finally {
      setUploadingAlbumPhoto(false);
    }
  };

  // Delete a photo from a student's Personal Album
  const handleDeleteAlbumPhoto = async (student: GraduationStudent, photoUrl: string) => {
    if (!confirm("Are you sure you want to remove this memory from the student's personal album?")) {
      return;
    }
    
    try {
      const currentAlbum = student.personalAlbum || student.gallery || [];
      const newAlbum = currentAlbum.filter(url => url !== photoUrl);
      
      const updated: GraduationStudent = {
        ...student,
        personalAlbum: newAlbum,
        gallery: newAlbum,
        updatedAt: new Date().toISOString()
      };
      
      await saveGraduationStudent(updated);
      setAlbumStudent(updated);
      
      // Optional: call Cloudinary delete endpoint to clean up storage
      try {
        await fetch('/api/delete-cloudinary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: photoUrl })
        });
      } catch (cleanUpErr) {
        console.warn("Cloudinary cleanup failed but album photo was removed from database:", cleanUpErr);
      }
      
      alert("Photo successfully removed from the Personal Graduation Album.");
    } catch (err: any) {
      alert("Failed to delete photo: " + (err.message || err));
    }
  };

  // Save Settings Changes
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveGraduationSettings(settingsForm);
      alert("Graduation configuration settings successfully updated!");
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle category in settings
  const handleToggleSettingCategory = (cat: string) => {
    const current = [...settingsForm.enabledCategories];
    if (current.includes(cat)) {
      setSettingsForm({
        ...settingsForm,
        enabledCategories: current.filter(c => c !== cat)
      });
    } else {
      setSettingsForm({
        ...settingsForm,
        enabledCategories: [...current, cat]
      });
    }
  };

  // Delete student permanently
  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete student "${name}" from graduating class archives? This action is irreversible.`)) {
      return;
    }
    try {
      await deleteGraduationStudent(studentId);
      alert(`Successfully deleted ${name}.`);
    } catch (err: any) {
      alert(`Deletion failed: ${err.message || err}`);
    }
  };

  // Edit fields from pending queue directly
  const handleDirectEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const updated: GraduationStudent = {
        ...editingStudent,
        graduationQuote: editingStudent.quote || '',
        parentMessage: editingStudent.parentAppreciation || '',
        profilePhoto: editingStudent.profilePicture || '',
        personalAlbum: editingStudent.gallery || [],
        updatedAt: new Date().toISOString()
      };
      await saveGraduationStudent(updated);
      alert(`Student details synchronized and successfully saved!`);
      setEditingStudent(null);
    } catch (err: any) {
      alert(`Failed to update student: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* Tab Navigation header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between pb-4 border-b border-white/5 gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-5.5 h-5.5 text-amber-400" />
            <span>Graduation & Class Lists Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure semesters, import scanned graduation rosters via AI OCR, batch enroll students, and moderate parent-submitted yearbook profiles.
          </p>
        </div>

        {/* Subtab navigation cards */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'pending', label: 'Pending Profiles', icon: Clock, count: students.filter(s => s.status === 'Pending').length },
            { id: 'approved', label: 'Approved Profiles', icon: CheckCircle, count: students.filter(s => s.status === 'Approved').length },
            { id: 'rejected', label: 'Rejected Profiles', icon: XCircle, count: students.filter(s => s.status === 'Rejected').length },
            { id: 'roster', label: 'Graduation Students', icon: Users, count: students.length },
            { id: 'import-ai', label: 'Upload Class List', icon: UploadCloud },
            { id: 'import-manual', label: 'Manual Student Entry', icon: PlusCircle },
            { id: 'years', label: 'Graduation Years', icon: Calendar },
            { id: 'settings', label: 'Graduation Settings', icon: Settings2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as SubTabId);
                  setIsReviewMode(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                  isActive 
                    ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg' 
                    : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black font-mono ${isActive ? 'bg-slate-950 text-amber-400' : 'bg-red-500 text-white'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="text-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading graduation database...</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">

          {/* ----------------------------------------------------
              SUBTAB 1: UPLOAD CLASS LISTS (AI OCR ENGINE)
              ---------------------------------------------------- */}
          {activeSubTab === 'import-ai' && (
            <div className="space-y-6">
              {!isReviewMode ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Form config options */}
                  <div className="bg-slate-950/60 p-6 rounded-3xl border border-white/5 space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Import Configurations</h3>
                      
                      {/* Year Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduation Year</label>
                        <select
                          value={importYear}
                          onChange={(e) => setImportYear(e.target.value)}
                          className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                        >
                          <option value="2026">Class of 2026</option>
                          <option value="2025">Class of 2025</option>
                          <option value="2024">Class of 2024</option>
                          <option value="2027">Class of 2027</option>
                        </select>
                      </div>

                      {/* Category Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduation Category</label>
                        <select
                          value={importCategory}
                          onChange={(e) => setImportCategory(e.target.value)}
                          className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                        >
                          {uniqueCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="Custom">Custom Graduation Section</option>
                        </select>
                      </div>

                      {/* Custom Category Input */}
                      {importCategory === 'Custom' && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Category Title</label>
                          <input
                            type="text"
                            placeholder="e.g., Nursery Two Red Graduation"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-4.5 bg-amber-500/5 rounded-2xl border border-amber-500/10 text-[11px] text-amber-300 leading-relaxed flex gap-3 mt-4">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Automation Engine:</strong> Uploaded spreadsheets, text files, list photos, or scans of printed sheets are processed directly by Gemini. It intelligently maps names and provides structured correction suggestions for review.
                      </div>
                    </div>
                  </div>

                  {/* Drag and drop panel */}
                  <div className="lg:col-span-2">
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`h-full min-h-[300px] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all duration-300 text-center cursor-pointer relative group ${
                        dragActive 
                          ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                          : 'border-white/10 hover:border-amber-500/50 bg-slate-950/20 hover:bg-slate-950/40'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".xlsx,.csv,.pdf,.docx,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                      />

                      {importFile ? (
                        <div className="space-y-4 max-w-sm pointer-events-none">
                          <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 animate-pulse">
                            <FileText className="w-8 h-8" />
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-white truncate">{importFile.name}</h4>
                            <p className="text-xs text-slate-500 mt-1">{(importFile.size / 1024 / 1024).toFixed(2)} MB • File selected</p>
                          </div>
                          <div className="flex gap-2.5 justify-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImportFile(null);
                              }}
                              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold border border-white/5 cursor-pointer pointer-events-auto"
                            >
                              Clear File
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExtractList();
                              }}
                              className="px-5 py-2 bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-xl text-xs font-bold shadow-md cursor-pointer pointer-events-auto"
                            >
                              Process with Gemini OCR
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 max-w-md pointer-events-none">
                          <div className="mx-auto w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                            <UploadCloud className="w-8 h-8 text-amber-500" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">Drag and drop class roster lists</h4>
                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                              Supports Excel (.xlsx), CSV (.csv), Microsoft Word (.docx), Adobe PDF (.pdf), or photographed scans (.png, .jpg, .jpeg)
                            </p>
                          </div>
                          <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-block">
                            Browse Local Files
                          </span>
                        </div>
                      )}

                      {/* Extracting loader overlay */}
                      {extracting && (
                        <div className="absolute inset-0 bg-slate-950/90 rounded-3xl flex flex-col items-center justify-center p-8 z-30 space-y-4">
                          <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                          <h4 className="text-sm font-extrabold text-white">Gemini Extracting Class List</h4>
                          <p className="text-xs text-slate-400 max-w-xs">{extractionStatus}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* REVIEW WORKSPACE AND EDITOR TABLE */
                <div className="space-y-6 animate-fade-in text-left">
                  <div className="bg-slate-950/80 p-6 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-white">Roster Import Review Workspace</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Review names extracted from document. Correct any OCR spelling errors below.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (confirm("Discard extracted names and go back?")) {
                              setIsReviewMode(false);
                            }
                          }}
                          className="px-4 py-2 bg-slate-900 border border-white/5 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddReviewRow}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-white/5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Graduate</span>
                        </button>
                        <button
                          onClick={handleConfirmImport}
                          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Confirm Import ({extractedStudents.length})</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata details tag */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-900 rounded-2xl text-[11px] border border-white/5">
                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Target Year:</span>
                        <strong className="text-white">Class of {importYear}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Roster Category:</span>
                        <strong className="text-white">{importCategory === 'Custom' ? customCategory : importCategory}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Source File:</span>
                        <strong className="text-amber-400 truncate block max-w-xs">{importFile?.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px]">Roster Total:</span>
                        <strong className="text-emerald-400">{extractedStudents.length} Students detected</strong>
                      </div>
                    </div>

                    {/* Review table */}
                    <div className="overflow-x-auto max-h-[500px] border border-white/5 rounded-2xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="p-4 w-12">#</th>
                            <th className="p-4">Student Full Name</th>
                            <th className="p-4">Assigned Class / Division</th>
                            <th className="p-4">Extraction Details</th>
                            <th className="p-4 w-20 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {extractedStudents.map((stud, idx) => (
                            <tr key={stud.tempId} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-4 font-mono font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-4">
                                <input
                                  type="text"
                                  value={stud.fullName}
                                  onChange={(e) => handleReviewCellChange(stud.tempId, 'fullName', e.target.value)}
                                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/5 focus:border-amber-500 text-white text-xs focus:outline-none"
                                  placeholder="e.g. John Doe"
                                />
                              </td>
                              <td className="p-4">
                                <input
                                  type="text"
                                  value={stud.class}
                                  onChange={(e) => handleReviewCellChange(stud.tempId, 'class', e.target.value)}
                                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/5 focus:border-amber-500 text-white text-xs focus:outline-none"
                                  placeholder="e.g. SS3 Amber (Optional)"
                                />
                              </td>
                              <td className="p-4">
                                {stud.possibleOcrError ? (
                                  <div className="space-y-1">
                                    <span className="text-[9px] px-2 py-0.5 rounded uppercase font-black bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 tracking-wider inline-block">
                                      Scanning Typo Flagged
                                    </span>
                                    {stud.suggestedCorrection && (
                                      <div className="text-[10px] text-slate-400 leading-none">
                                        Found: <span className="text-yellow-200 font-mono italic">"{stud.originalName}"</span> → Suggest: <button type="button" onClick={() => handleReviewCellChange(stud.tempId, 'fullName', stud.suggestedCorrection)} className="text-amber-400 font-bold hover:underline">{stud.suggestedCorrection}</button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9px] px-2 py-0.5 rounded uppercase font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider inline-block">
                                    Clean OCR Name
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReviewRow(stud.tempId)}
                                  className="p-2 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer"
                                  title="Delete Student"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              SUBTAB 2: MANUAL STUDENT ENTRY (METHOD 2)
              ---------------------------------------------------- */}
          {activeSubTab === 'import-manual' && (
            <div className="max-w-3xl bg-slate-950/60 p-6 rounded-3xl border border-white/5 space-y-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4 gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {manualEntryMode === 'single' ? "Create Graduation Student Profile" : "Manual Batch Student Entry"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {manualEntryMode === 'single' 
                      ? "Create a detailed student graduation profile with a required profile photo."
                      : "Type student names one after another to quickly register them in the yearbook roster."}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setManualEntryMode('single')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      manualEntryMode === 'single'
                        ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Single Profile Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualEntryMode('batch')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      manualEntryMode === 'batch'
                        ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Batch Names List
                  </button>
                </div>
              </div>

              {manualEntryMode === 'single' ? (
                <form onSubmit={handleSaveSingleStudent} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Full Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="Enter student's full name"
                        value={singleStudentName}
                        onChange={(e) => setSingleStudentName(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class / Section <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SS3 Amber"
                        value={singleStudentClass}
                        onChange={(e) => setSingleStudentClass(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduation Year <span className="text-red-500">*</span></label>
                      <select
                        value={singleStudentYear}
                        onChange={(e) => setSingleStudentYear(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                      >
                        <option value="2026">Class of 2026</option>
                        <option value="2025">Class of 2025</option>
                        <option value="2024">Class of 2024</option>
                        <option value="2027">Class of 2027</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduation Category <span className="text-red-500">*</span></label>
                      <select
                        value={singleStudentCategory}
                        onChange={(e) => setSingleStudentCategory(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                      >
                        {uniqueCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profile Picture <span className="text-red-500">* (Required)</span></label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-900 rounded-2xl border border-white/5">
                      <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 relative group">
                        {singleStudentPhotoPreview ? (
                          <img 
                            src={singleStudentPhotoPreview} 
                            alt="preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-600 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSingleStudentPhotoChange}
                          className="hidden"
                          id="single-student-photo-file-input"
                        />
                        <label
                          htmlFor="single-student-photo-file-input"
                          className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <UploadCloud className="w-4 h-4 text-amber-400" />
                          <span>Select Profile Picture</span>
                        </label>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Robe portrait photo is required. Please upload a high resolution, well-lit photograph. Default placeholders are prohibited.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <h4 className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wider">Yearbook Personal Memory Details (Optional)</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yearbook Quote</label>
                          <input
                            type="text"
                            placeholder="e.g. Dream big and work hard."
                            value={singleStudentQuote}
                            onChange={(e) => setSingleStudentQuote(e.target.value)}
                            className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Future Ambition</label>
                          <input
                            type="text"
                            placeholder="e.g. Aerospace Engineer"
                            value={singleStudentAmbition}
                            onChange={(e) => setSingleStudentAmbition(e.target.value)}
                            className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Parent appreciation / message</label>
                        <textarea
                          rows={3}
                          placeholder="Type any message or appreciation dedicated from or to the parents."
                          value={singleStudentParentMessage}
                          onChange={(e) => setSingleStudentParentMessage(e.target.value)}
                          className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none h-20 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <button
                      type="submit"
                      disabled={savingManual}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save & Publish Profile</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSaveManual} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduation Year</label>
                      <select
                        value={manualYear}
                        onChange={(e) => setManualYear(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                      >
                        <option value="2026">Class of 2026</option>
                        <option value="2025">Class of 2025</option>
                        <option value="2024">Class of 2024</option>
                        <option value="2027">Class of 2027</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduation Category</label>
                      <select
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                      >
                        {uniqueCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Class / Division</label>
                      <input
                        type="text"
                        placeholder="e.g. SS3 Amber"
                        value={manualClass}
                        onChange={(e) => setManualClass(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduate Names List</label>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">
                        {manualNamesText.split(/[,\n]/).map(n => n.trim()).filter(n => n.length > 0).length} Graduates Detected
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      required
                      value={manualNamesText}
                      onChange={(e) => setManualNamesText(e.target.value)}
                      placeholder="e.g.&#10;John Doe&#10;Mary Johnson&#10;David James, Grace Samuel"
                      className="w-full p-4 rounded-2xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none font-mono leading-relaxed resize-none"
                    />
                    <span className="text-[9px] text-slate-500 block leading-normal mt-1">
                      Tip: You can paste a clean copy-paste block directly from any text roster, email, or WhatsApp registry. Separate entries either by starting on a new line or with commas.
                    </span>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingManual}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save & Enroll Graduates</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              SUBTAB 3: MASTER ROSTER (GRADUATION STUDENTS DATABASE)
              ---------------------------------------------------- */}
          {activeSubTab === 'roster' && (
            <div className="space-y-6">
              
              {/* Filtering bar */}
              <div className="bg-slate-950/60 p-4.5 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:max-w-xs">
                  <input
                    type="text"
                    placeholder="Search master roster name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-white/5 rounded-xl text-xs text-white focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="p-2.5 bg-slate-900 border border-white/5 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="All">All Years</option>
                    {uniqueYears.map(year => (
                      <option key={year} value={year}>Class of {year}</option>
                    ))}
                  </select>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="p-2.5 bg-slate-900 border border-white/5 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="All">All Categories</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Main table view */}
              <div className="bg-slate-950/80 rounded-3xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4 w-12">Photo</th>
                        <th className="p-4">Student Name</th>
                        <th className="p-4">Graduation Class Details</th>
                        <th className="p-4">Current Status</th>
                        <th className="p-4 w-24 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {students.filter(s => {
                        const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                        const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                        return matchSearch && matchYear && matchCat;
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-16 text-center text-slate-500">
                            No students found in the graduation master roster directory.
                          </td>
                        </tr>
                      ) : (
                        students.filter(s => {
                          const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                          const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                          return matchSearch && matchYear && matchCat;
                        }).map((student) => (
                          <tr key={student.studentId} className="hover:bg-white/[0.01] transition-colors">
                            <td className="p-4">
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-white/5">
                                <img 
                                  src={student.profilePhoto || student.profilePicture || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=150'} 
                                  alt={student.fullName}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </td>
                            <td className="p-4 font-bold text-white">{student.fullName}</td>
                            <td className="p-4">
                              <div>Class of {student.graduationYear}</div>
                              <div className="text-[10px] text-slate-500">{student.graduationCategory} {student.class ? `(${student.class})` : ''}</div>
                            </td>
                            <td className="p-4">
                              {student.status === 'Approved' ? (
                                <span className="text-[9px] px-2.5 py-0.5 rounded-full uppercase font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 animate-pulse" />
                                  <span>Approved & Live</span>
                                </span>
                              ) : student.status === 'Pending' ? (
                                <span className="text-[9px] px-2.5 py-0.5 rounded-full uppercase font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending Review</span>
                                </span>
                              ) : student.status === 'Rejected' ? (
                                <span className="text-[9px] px-2.5 py-0.5 rounded-full uppercase font-black bg-red-500/10 text-red-400 border border-red-500/20 tracking-wider inline-flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  <span>Rejected</span>
                                </span>
                              ) : (
                                <span className="text-[9px] px-2.5 py-0.5 rounded-full uppercase font-black bg-slate-800 text-slate-400 border border-slate-700 tracking-wider inline-flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  <span>Roster Imported</span>
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {/* View Profile */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewStudent(student)}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                  title="View Profile Card"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Edit Student */}
                                <button
                                  type="button"
                                  onClick={() => setEditingStudent(student)}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                  title="Edit Student Profile"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Upload Profile Picture */}
                                <button
                                  type="button"
                                  onClick={() => triggerDirectPhotoUpload(student)}
                                  disabled={uploadingPhotoStudentId === student.studentId}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-amber-400 hover:text-amber-300 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                  title="Upload Profile Picture"
                                >
                                  {uploadingPhotoStudentId === student.studentId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                  ) : (
                                    <UploadCloud className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {/* View Personal Album */}
                                <button
                                  type="button"
                                  onClick={() => setAlbumStudent(student)}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-teal-400 hover:text-teal-300 rounded-lg transition-all cursor-pointer"
                                  title="View Personal Graduation Album"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>

                                {/* Approve Profile (If not already Approved) */}
                                {student.status !== 'Approved' && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveProfile(student)}
                                    className="p-1.5 bg-emerald-950/20 hover:bg-emerald-900/40 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-lg transition-all cursor-pointer"
                                    title="Approve Profile"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Reject Profile (If not already Rejected) */}
                                {student.status !== 'Rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRejectProfile(student)}
                                    className="p-1.5 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-all cursor-pointer"
                                    title="Reject Profile"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Delete Profile */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudent(student.studentId, student.fullName)}
                                  className="p-1.5 bg-red-950/20 hover:bg-red-900/40 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all cursor-pointer"
                                  title="Delete Profile & Roster Student"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              SUBTAB 4: PENDING PROFILES QUEUE
              ---------------------------------------------------- */}
          {activeSubTab === 'pending' && (
            <div className="space-y-6">
              
              {/* Submission cards list */}
              {students.filter(s => {
                const matchStatus = s.status === 'Pending';
                const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                return matchStatus && matchSearch && matchYear && matchCat;
              }).length === 0 ? (
                <div className="text-center py-24 bg-slate-950/20 rounded-3xl border border-white/5">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Pending Submission Queue Clear!</h4>
                  <p className="text-xs text-slate-500 mt-1 font-sans">There are no graduate profile submissions awaiting verification at this time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {students.filter(s => {
                    const matchStatus = s.status === 'Pending';
                    const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                    const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                    return matchStatus && matchSearch && matchYear && matchCat;
                  }).map((student) => (
                    <div 
                      key={student.studentId}
                      className="bg-slate-950/60 rounded-3xl border border-white/5 p-5 hover:border-white/10 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        {/* Student header */}
                        <div className="flex gap-4">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border border-white/5 shrink-0">
                            <img 
                              src={student.profilePhoto || student.profilePicture || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=300'} 
                              alt={student.fullName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 block">
                              Class of {student.graduationYear} • {student.graduationCategory}
                            </span>
                            <h4 className="text-sm font-extrabold text-white mt-1">{student.fullName}</h4>
                            {student.class && <p className="text-[10px] text-slate-500 mt-0.5">Assigned Class: {student.class}</p>}
                          </div>
                        </div>

                        {/* Profile quotes and content */}
                        <div className="space-y-3 p-4 bg-slate-900/60 rounded-2xl border border-white/5 text-[11px] leading-relaxed">
                          {(student.quote || student.graduationQuote) && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Yearbook Quote</span>
                              <p className="text-white italic">“{student.quote || student.graduationQuote}”</p>
                            </div>
                          )}

                          {student.favoriteMemory && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Favorite Memory</span>
                              <p className="text-slate-300">{student.favoriteMemory}</p>
                            </div>
                          )}

                          {student.futureAmbition && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Future Ambition</span>
                              <p className="text-slate-300">{student.futureAmbition}</p>
                            </div>
                          )}

                          {(student.parentAppreciation || student.parentMessage) && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Parent Message</span>
                              <p className="text-slate-300">{student.parentAppreciation || student.parentMessage}</p>
                            </div>
                          )}

                          {/* Gallery Images thumbnails */}
                          {(student.gallery || student.personalAlbum) && (student.gallery || student.personalAlbum)!.length > 0 && (
                            <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Personal Album Memories ({(student.gallery || student.personalAlbum)!.length})</span>
                              <div className="flex flex-wrap gap-1.5">
                                {(student.gallery || student.personalAlbum)!.map((img, i) => (
                                  <div key={i} className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-white/5 cursor-pointer hover:border-amber-500 transition-colors" onClick={() => setPreviewStudent(student)}>
                                    <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Control buttons */}
                      <div className="flex items-center gap-2 mt-4.5 pt-4 border-t border-white/5">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleRejectProfile(student)}
                          className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ml-auto"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleApproveProfile(student)}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Publish</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              SUBTAB 5: APPROVED PROFILES
              ---------------------------------------------------- */}
          {activeSubTab === 'approved' && (
            <div className="space-y-6">
              {students.filter(s => {
                const matchStatus = s.status === 'Approved';
                const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                return matchStatus && matchSearch && matchYear && matchCat;
              }).length === 0 ? (
                <div className="text-center py-24 bg-slate-950/20 rounded-3xl border border-white/5">
                  <CheckCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Approved Profiles</h4>
                  <p className="text-xs text-slate-500 mt-1">There are no approved and published graduate profiles matching your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {students.filter(s => {
                    const matchStatus = s.status === 'Approved';
                    const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                    const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                    return matchStatus && matchSearch && matchYear && matchCat;
                  }).map((student) => (
                    <div 
                      key={student.studentId}
                      className="bg-slate-950/60 rounded-3xl border border-emerald-500/20 p-5 hover:border-emerald-500/40 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border border-white/5 shrink-0">
                            <img 
                              src={student.profilePhoto || student.profilePicture || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=300'} 
                              alt={student.fullName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block">
                              Class of {student.graduationYear} • Approved
                            </span>
                            <h4 className="text-sm font-extrabold text-white mt-1">{student.fullName}</h4>
                            {student.class && <p className="text-[10px] text-slate-500 mt-0.5">Class: {student.class}</p>}
                          </div>
                        </div>

                        <div className="space-y-3 p-4 bg-slate-900/60 rounded-2xl border border-white/5 text-[11px] leading-relaxed">
                          {(student.quote || student.graduationQuote) && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Yearbook Quote</span>
                              <p className="text-white italic">“{student.quote || student.graduationQuote}”</p>
                            </div>
                          )}

                          {student.favoriteMemory && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Favorite Memory</span>
                              <p className="text-slate-300">{student.favoriteMemory}</p>
                            </div>
                          )}

                          {student.futureAmbition && (
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Future Ambition</span>
                              <p className="text-slate-300">{student.futureAmbition}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4.5 pt-4 border-t border-white/5">
                        <button
                          onClick={() => setPreviewStudent(student)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Card</span>
                        </button>
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleRejectProfile(student)}
                          className="px-3.5 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ml-auto"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject / Unpublish</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              SUBTAB 6: REJECTED PROFILES
              ---------------------------------------------------- */}
          {activeSubTab === 'rejected' && (
            <div className="space-y-6">
              {students.filter(s => {
                const matchStatus = s.status === 'Rejected';
                const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                return matchStatus && matchSearch && matchYear && matchCat;
              }).length === 0 ? (
                <div className="text-center py-24 bg-slate-950/20 rounded-3xl border border-white/5">
                  <CheckCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Rejected Profiles</h4>
                  <p className="text-xs text-slate-500 mt-1">There are no rejected yearbook submissions in the staging database.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {students.filter(s => {
                    const matchStatus = s.status === 'Rejected';
                    const matchSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchYear = selectedYear === 'All' || s.graduationYear === selectedYear;
                    const matchCat = selectedCategory === 'All' || s.graduationCategory === selectedCategory;
                    return matchStatus && matchSearch && matchYear && matchCat;
                  }).map((student) => (
                    <div 
                      key={student.studentId}
                      className="bg-slate-950/60 rounded-3xl border border-red-500/20 p-5 hover:border-red-500/40 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border border-white/5 shrink-0">
                            <img 
                              src={student.profilePhoto || student.profilePicture || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=300'} 
                              alt={student.fullName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-400 block">
                              Class of {student.graduationYear} • Rejected Staging
                            </span>
                            <h4 className="text-sm font-extrabold text-white mt-1">{student.fullName}</h4>
                            {student.class && <p className="text-[10px] text-slate-500 mt-0.5">Class: {student.class}</p>}
                          </div>
                        </div>

                        <div className="p-3 bg-red-950/20 border border-red-500/10 rounded-xl text-[11px] text-red-300">
                          <strong>Rejection Note:</strong> The student/parent can locate their record card and resubmit with correct yearbook guidelines.
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4.5 pt-4 border-t border-white/5">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Direct Edit</span>
                        </button>
                        <button
                          onClick={() => handleApproveProfile(student)}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ml-auto"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Re-approve & Publish</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------
              SUBTAB 7: GRADUATION YEARS (SUMMARY COUNTS)
              ---------------------------------------------------- */}
          {activeSubTab === 'years' && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 p-6 rounded-3xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Active Graduation Semesters</h3>
                    <p className="text-xs text-slate-400 mt-1">Add or register new graduating calendar classes to the portal.</p>
                  </div>
                  
                  {/* Create New Year Inline Form */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g., 2027"
                      value={newYearInput}
                      onChange={(e) => setNewYearInput(e.target.value.replace(/\D/g, ''))}
                      className="p-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none w-24 text-center"
                      maxLength={4}
                    />
                    <button
                      onClick={async () => {
                        if (newYearInput.length !== 4) {
                          alert("Please specify a valid 4-digit Year.");
                          return;
                        }
                        // Create a seed student to establish this year
                        const tempId = `grad-${Date.now()}`;
                        const seedRecord: GraduationStudent = {
                          studentId: tempId,
                          fullName: `Yearbook Placeholder ${newYearInput}`,
                          graduationYear: newYearInput,
                          graduationCategory: 'Senior Secondary Graduation',
                          class: '',
                          status: 'Imported',
                          profilePhoto: '',
                          personalAlbum: [],
                          futureAmbition: '',
                          graduationQuote: '',
                          parentMessage: '',
                          profileCompleted: false,
                          profileApproved: false,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        };
                        try {
                          await saveGraduationStudent(seedRecord);
                          alert(`Class of ${newYearInput} registered! Delete placeholder once roster is imported.`);
                          setNewYearInput('');
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register Year</span>
                    </button>
                  </div>
                </div>

                {/* Years Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {uniqueYears.map((year) => {
                    const classStudents = students.filter(s => s.graduationYear === year);
                    const completed = classStudents.filter(s => s.profileCompleted).length;
                    const pending = classStudents.filter(s => s.status === 'Pending').length;
                    return (
                      <div key={year} className="p-5 bg-slate-900 rounded-2xl border border-white/5 space-y-4 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-white">Class of {year}</span>
                          <Calendar className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono leading-none">
                          <div className="p-2 bg-slate-950/60 rounded-xl border border-white/5">
                            <span className="text-slate-500 block mb-1 uppercase font-bold text-[8px]">Enrolled</span>
                            <strong className="text-white text-sm">{classStudents.length}</strong>
                          </div>
                          <div className="p-2 bg-slate-950/60 rounded-xl border border-white/5">
                            <span className="text-slate-500 block mb-1 uppercase font-bold text-[8px]">Published</span>
                            <strong className="text-emerald-400 text-sm">{completed}</strong>
                          </div>
                          <div className="p-2 bg-slate-950/60 rounded-xl border border-white/5">
                            <span className="text-slate-500 block mb-1 uppercase font-bold text-[8px]">Pending</span>
                            <strong className="text-amber-400 text-sm">{pending}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              SUBTAB 8: GRADUATION SYSTEM GLOBAL CONFIGS
              ---------------------------------------------------- */}
          {activeSubTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="bg-slate-950/60 p-6 rounded-3xl border border-white/5 space-y-6 text-left max-w-3xl">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-sm font-extrabold text-white">Global Yearbook Submissions Config</h3>
                <p className="text-xs text-slate-400 mt-1">Configure user-submission parameters, limits, and deadlines.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Toggle portal status */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submission Portal State</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, submissionsOpen: true })}
                      className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settingsForm.submissionsOpen 
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400' 
                          : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Open Submissions
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, submissionsOpen: false })}
                      className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        !settingsForm.submissionsOpen 
                          ? 'bg-red-500/10 border-red-500 text-red-400' 
                          : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Close Submissions
                    </button>
                  </div>
                </div>

                {/* Deadline */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submission Deadline Date</label>
                  <input
                    type="date"
                    value={settingsForm.deadline}
                    onChange={(e) => setSettingsForm({ ...settingsForm, deadline: e.target.value })}
                    className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                    required
                  />
                </div>

                {/* Maximum Images Limit */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Max Graduation Gallery Images</label>
                  <input
                    type="number"
                    value={settingsForm.maxImages}
                    onChange={(e) => setSettingsForm({ ...settingsForm, maxImages: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full p-3 rounded-xl text-xs bg-slate-900 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                    min={1}
                    max={20}
                    required
                  />
                  <span className="text-[9px] text-slate-500">Limits the maximum photos a parent or graduate can attach to their yearbook card.</span>
                </div>

                {/* Acceptable file types */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accepted Image Formats</span>
                  <div className="flex flex-wrap gap-2">
                    {['.jpg', '.jpeg', '.png', '.webp'].map((ext) => {
                      const isChecked = settingsForm.acceptedFormats.includes(ext);
                      return (
                        <button
                          key={ext}
                          type="button"
                          onClick={() => {
                            const updated = isChecked 
                              ? settingsForm.acceptedFormats.filter(f => f !== ext) 
                              : [...settingsForm.acceptedFormats, ext];
                            setSettingsForm({ ...settingsForm, acceptedFormats: updated });
                          }}
                          className={`px-3 py-1.5 border rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                            isChecked 
                              ? 'bg-amber-500 border-amber-500 text-slate-950 font-black' 
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {ext.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Supported Category toggles */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Enable Graduation Roster Divisions</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {uniqueCategories.map((cat) => {
                    const isEnabled = settingsForm.enabledCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleSettingCategory(cat)}
                        className={`p-3.5 border rounded-2xl text-xs font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
                          isEnabled 
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400' 
                            : 'bg-slate-900 border-white/5 text-slate-500 hover:text-white'
                        }`}
                      >
                        <span>{cat}</span>
                        {isEnabled ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4 text-slate-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Publish Configurations</span>
                </button>
              </div>
            </form>
          )}

        </div>
      )}

      {/* ----------------------------------------------------
          MODAL 1: PREVIEW PROFILE CARD PREVIEWER
          ---------------------------------------------------- */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 animate-fade-in text-slate-300">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-6 relative max-h-[90vh] overflow-y-auto text-left">
            <button 
              onClick={() => setPreviewStudent(null)} 
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="text-center pb-4 border-b border-white/5">
              <span className="text-[9px] uppercase tracking-widest text-amber-500 font-bold">Live Yearbook Preview</span>
              <h3 className="text-lg font-bold text-white mt-1">{previewStudent.fullName}</h3>
              <p className="text-[10px] text-slate-500">{previewStudent.graduationCategory} • Class of {previewStudent.graduationYear}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-full sm:w-1/3 aspect-square sm:aspect-auto sm:h-44 rounded-2xl overflow-hidden bg-slate-950 border border-white/5">
                <img 
                  src={previewStudent.profilePhoto || previewStudent.profilePicture || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=300'} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 space-y-4 text-xs leading-relaxed">
                {(previewStudent.quote || previewStudent.graduationQuote) && (
                  <div>
                    <strong className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Yearbook Quote:</strong>
                    <span className="text-white italic">“{previewStudent.quote || previewStudent.graduationQuote}”</span>
                  </div>
                )}
                {previewStudent.favoriteMemory && (
                  <div>
                    <strong className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Favourite Memory:</strong>
                    <span className="text-slate-300">{previewStudent.favoriteMemory}</span>
                  </div>
                )}
                {previewStudent.futureAmbition && (
                  <div>
                    <strong className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Future Ambition:</strong>
                    <span className="text-slate-300">{previewStudent.futureAmbition}</span>
                  </div>
                )}
                {(previewStudent.parentAppreciation || previewStudent.parentMessage) && (
                  <div>
                    <strong className="text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Parent Message:</strong>
                    <span className="text-slate-300">{previewStudent.parentAppreciation || previewStudent.parentMessage}</span>
                  </div>
                )}
                
                {/* Synthesized Bio Summary Box */}
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 space-y-1">
                  <strong className="text-amber-400 block text-[9px] uppercase tracking-wider">Synthesized Bio Narrative Summary:</strong>
                  <p className="text-xs text-amber-100/90 italic font-medium leading-relaxed">
                    "{generateBioSummary({
                      fullName: previewStudent.fullName,
                      quote: previewStudent.quote || previewStudent.graduationQuote,
                      favoriteMemory: previewStudent.favoriteMemory,
                      futureAmbition: previewStudent.futureAmbition,
                      parentAppreciation: previewStudent.parentAppreciation || previewStudent.parentMessage,
                      graduationYear: previewStudent.graduationYear,
                      graduationCategory: previewStudent.graduationCategory
                    })}"
                  </p>
                </div>
              </div>
            </div>

            {/* Gallery full view */}
            {(previewStudent.gallery || previewStudent.personalAlbum) && (previewStudent.gallery || previewStudent.personalAlbum)!.length > 0 && (() => {
              const previewAlbumItems = [
                {
                  id: previewStudent.image || '',
                  type: 'photo' as const,
                  title: `${previewStudent.name}'s Portrait`,
                  description: previewStudent.quote || `${previewStudent.name}'s graduation portrait`,
                  imageUrl: previewStudent.image || '',
                  tag: 'Graduation Portrait'
                },
                ...(previewStudent.gallery || previewStudent.personalAlbum || []).map(url => ({
                  id: url,
                  type: 'photo' as const,
                  title: `${previewStudent.name}'s Graduation Memory`,
                  description: previewStudent.quote || 'Personal graduation memory',
                  imageUrl: url,
                  tag: 'Graduation Album'
                }))
              ];

              return (
                <div className="space-y-2.5 pt-4 border-t border-white/5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Class Gallery Images</span>
                  <div className="grid grid-cols-4 gap-2">
                    {(previewStudent.gallery || previewStudent.personalAlbum)!.map((img, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => window.dispatchEvent(new CustomEvent('open-fullscreen-media', {
                          detail: {
                            items: previewAlbumItems,
                            currentIndex: idx + 1
                          }
                        }))}
                        className="aspect-square rounded-xl overflow-hidden bg-slate-950 border border-white/5 relative group cursor-zoom-in hover:border-amber-500 transition-colors"
                      >
                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL 2: EDIT STUDENT PROFILE FORM
          ---------------------------------------------------- */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 animate-fade-in text-slate-300">
          <form onSubmit={handleDirectEditSave} className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-5 relative max-h-[90vh] overflow-y-auto text-left">
            <button 
              type="button"
              onClick={() => setEditingStudent(null)} 
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-white/5 pb-3 text-center">
              <span className="text-[9px] uppercase tracking-widest text-amber-500 font-bold block">Yearbook Editor</span>
              <h3 className="text-base font-extrabold text-white">Edit Profile: {editingStudent.fullName}</h3>
            </div>

            <div className="space-y-4">
              
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Name</label>
                <input
                  type="text"
                  value={editingStudent.fullName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                  className="w-full p-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                  required
                />
              </div>

              {/* Class */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class / Division Section</label>
                <input
                  type="text"
                  value={editingStudent.class || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, class: e.target.value })}
                  className="w-full p-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                  placeholder="e.g. SS3 Amber"
                />
              </div>

              {/* Quote */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yearbook Quote</label>
                <input
                  type="text"
                  value={editingStudent.quote || editingStudent.graduationQuote || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, quote: e.target.value, graduationQuote: e.target.value })}
                  className="w-full p-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                  placeholder="Graduation quote"
                />
              </div>

              {/* Favorite memory */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Favorite memory</label>
                <textarea
                  value={editingStudent.favoriteMemory || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, favoriteMemory: e.target.value })}
                  className="w-full p-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-amber-500 text-white focus:outline-none h-20 resize-none"
                  placeholder="What was the best moment?"
                />
              </div>

              {/* Future Ambitions */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Future Ambition</label>
                <input
                  type="text"
                  value={editingStudent.futureAmbition || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, futureAmbition: e.target.value })}
                  className="w-full p-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-amber-500 text-white focus:outline-none"
                  placeholder="What is your future ambition?"
                />
              </div>

              {/* Parent Message */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Parent Message</label>
                <textarea
                  value={editingStudent.parentAppreciation || editingStudent.parentMessage || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parentAppreciation: e.target.value, parentMessage: e.target.value })}
                  className="w-full p-3 rounded-xl text-xs bg-slate-950 border border-white/5 focus:border-amber-500 text-white focus:outline-none h-20 resize-none"
                  placeholder="Appreciation messages from parents (optional)"
                />
              </div>

            </div>

            <div className="pt-4 border-t border-white/5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 bg-slate-950 border border-white/5 text-slate-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL 3: PERSONAL GRADUATION ALBUM
          ---------------------------------------------------- */}
      {albumStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 animate-fade-in text-slate-300">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl p-6 space-y-5 relative max-h-[90vh] overflow-y-auto text-left">
            <button 
              type="button"
              onClick={() => setAlbumStudent(null)} 
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-white/5 pb-3">
              <span className="text-[9px] uppercase tracking-widest text-amber-500 font-bold block">Personal Memories Vault</span>
              <h3 className="text-base font-extrabold text-white">Graduation Album: {albumStudent.fullName}</h3>
              <p className="text-[10px] text-slate-400 mt-1">
                Manage the specific personal graduation memories of {albumStudent.fullName}. Keep it strictly limited to personal moments.
              </p>
            </div>

            {/* Instruction Warning Block based on Requirements */}
            <div className="p-3.5 bg-amber-500/5 rounded-2xl border border-amber-500/10 space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Permitted Album Guidelines</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] leading-relaxed font-sans">
                <div>
                  <span className="text-emerald-400 font-bold block mb-1">✓ DO INCLUDE PERSONAL MOMENTS:</span>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                    <li>Graduation gown portrait</li>
                    <li>Receiving certificate on stage</li>
                    <li>Standing alone / with parents / with principal</li>
                    <li>Giving a speech or close personal moments</li>
                  </ul>
                </div>
                <div>
                  <span className="text-rose-400 font-bold block mb-1">✗ DO NOT INCLUDE:</span>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                    <li>Class group photos / choir performances</li>
                    <li>Drama / dance staging moments</li>
                    <li>Event crowd or general graduation photos</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Upload Album Photo Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950 rounded-2xl border border-white/5">
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-xs font-bold text-white">Add Graduation Memory</h4>
                <p className="text-[10px] text-slate-500">Upload high resolution personal graduation memory images.</p>
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleAddAlbumPhoto(albumStudent, file);
                    }
                    e.target.value = '';
                  }}
                  id="album-photo-file-input"
                  className="hidden"
                />
                <label
                  htmlFor="album-photo-file-input"
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition-colors inline-flex"
                >
                  {uploadingAlbumPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>Upload Album Photo</span>
                </label>
              </div>
            </div>

            {/* Album Images Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Album Memories ({(albumStudent.personalAlbum || albumStudent.gallery || []).length})</h4>
              
              {(albumStudent.personalAlbum || albumStudent.gallery || []).length === 0 ? (
                <div className="text-center py-12 bg-slate-950/20 rounded-2xl border border-white/5 text-slate-500 text-xs font-sans">
                  This student's personal album is currently empty. Upload their first graduation memory above.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(albumStudent.personalAlbum || albumStudent.gallery || []).map((imgUrl, idx) => (
                    <div key={idx} className="aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-white/5 relative group">
                      <img 
                        src={imgUrl} 
                        alt={`Memory ${idx + 1}`} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteAlbumPhoto(albumStudent, imgUrl)}
                          className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all cursor-pointer shadow-lg flex items-center gap-1 text-[10px] font-bold"
                          title="Delete memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setAlbumStudent(null)}
                className="px-5 py-2 bg-slate-950 border border-white/5 text-slate-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Album
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for direct profile photo uploads */}
      <input 
        type="file" 
        ref={directPhotoInputRef} 
        onChange={handleDirectPhotoFileChange} 
        accept="image/*" 
        className="hidden" 
      />

    </div>
  );
}
