export interface SchoolPalette {
  id: string;
  name: string;
  primary: string; // Tailwind-friendly hex or css variable
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentHover: string;
  bgSecondary: string;
}

export interface Memory {
  id: string;
  title: string;
  description: string;
  category: 'photo' | 'video' | 'archive' | 'parent' | 'teacher';
  tag: string; // e.g., 'Graduation', 'Sports', 'Science'
  imageUrl: string;
  videoUrl?: string; // Optional if video category
  date: string;
  author?: string;
  featured?: boolean;
}

export interface TimelineYear {
  year: number;
  theme: string;
  description: string;
  milestones: {
    title: string;
    description: string;
    image: string;
    tag: string;
  }[];
}

export interface Achievement {
  id: string;
  title: string;
  category: 'academic' | 'sports' | 'arts' | 'community';
  value: string; // e.g. "98.5%" or "1st Place"
  description: string;
  year: string;
  icon: string; // lucide icon name
}

export interface ParentContribution {
  id: string;
  photoUrl: string;
  caption: string;
  event: string;
  contributorName: string;
  relation: string; // e.g. "Parent of Class of 2025"
  date: string;
  approved: boolean;
}

export interface CampusLifeArea {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  activities: string[];
}

// Firebase Database interfaces
export interface Student {
  id: string;
  name: string;
  nickname: string;
  image: string;
  favoriteMemory: string;
  messageToClassmates: string;
  aspirations?: string;
  house?: string;
  quote?: string;
  stateOfOrigin?: string;
  bio?: string;
  instagram?: string;
  twitter?: string;
  displayOrder?: number;
  featured?: boolean | string;
}

export interface Superlative {
  id: string;
  category: string;
  description: string;
  studentName: string;
  studentImage: string;
}

export interface TeacherTribute {
  id: string;
  name: string;
  subject: string;
  image: string;
  message: string;
  department?: string;
  displayOrder?: number;
  featured?: boolean | string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  image: string;
}

export interface GuestbookEntry {
  id: string;
  name: string;
  role: 'Student' | 'Parent' | 'Teacher' | 'Alumni' | 'Well-wisher';
  message: string;
  timestamp: string;
  imageUrl?: string;
}

export interface VideoMemory {
  id: string;
  title: string;
  submittedBy: string;
  role: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface Photo {
  id: string;
  url: string;
  title: string;
  submittedBy: string;
  role: string;
  uploadedAt: string;
}

export interface AdminUser {
  email: string;
  addedAt: string;
  addedBy: string;
}

export interface CustomSection {
  id: string;
  title: string;
  subtext: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'none';
  orderIndex: number;
  layoutType?: 'standard' | 'birthday' | 'announcement' | 'spotlight';
}

export interface PendingSubmission {
  id: string;
  type: string;
  submittedAt: string;
  data: any;
  status?: 'Pending' | 'Approved' | 'Rejected';
  approved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  updatedAt?: string;
}

export interface CommunityMemory {
  id: string;
  title: string;
  caption: string;
  contributorName: string;
  studentName: string;
  className: string;
  eventCategory: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  uploadDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaComment {
  id: string;
  mediaId: string;
  mediaTitle: string;
  mediaType: 'photo' | 'video';
  authorName: string;
  text: string;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export interface GraduationStudent {
  studentId: string;
  fullName: string;
  graduationYear: string;
  graduationCategory: string;
  class: string;
  profilePhoto: string;
  personalAlbum: string[];
  futureAmbition: string;
  graduationQuote: string;
  parentMessage: string;
  profileCompleted: boolean;
  profileApproved: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'Imported' | 'Pending' | 'Approved' | 'Rejected';
  profilePicture?: string;
  gallery?: string[];
  favoriteMemory?: string;
  quote?: string;
  parentAppreciation?: string;
}

export interface GraduationSettings {
  id: string;
  submissionsOpen: boolean;
  deadline: string;
  enabledCategories: string[];
  maxImages: number;
  acceptedFormats: string[];
}

export interface GraduationMemory {
  id: string;
  title?: string;
  eventName?: string;
  graduationYear: string;
  uploadedByType: 'Parent' | 'Student' | 'Teacher' | 'Photographer' | 'School Staff' | 'Visitor';
  memoryType: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  caption: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  likesCount?: number;
  commentsCount?: number;
  uploaderName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraduationMemoryComment {
  id: string;
  memoryId: string;
  authorName: string;
  authorRole?: string;
  text: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}



