import { Memory, TimelineYear, Achievement, ParentContribution, CampusLifeArea, SchoolPalette } from '../types';

export const PALETTES: SchoolPalette[] = [
  {
    id: 'wisdomlink',
    name: 'Wisdom Link Forest (Emerald & Ruby)',
    primary: '#0f5132', // Deep emerald
    primaryLight: '#d1e7dd',
    primaryDark: '#082a1a',
    accent: '#d97706', // Amber gold
    accentHover: '#b45309',
    bgSecondary: '#f8f9fa',
  },
  {
    id: 'pinecrest',
    name: 'Pinecrest Academic (Royal Blue & Amber)',
    primary: '#1e3a8a', // Royal blue
    primaryLight: '#dbeafe',
    primaryDark: '#172554',
    accent: '#eab308', // Amber gold
    accentHover: '#ca8a04',
    bgSecondary: '#f4f6fc',
  },
  {
    id: 'stjudes',
    name: 'St. Jude Burgundy (Crimson & Antique Gold)',
    primary: '#7f1d1d', // Deep burgundy red
    primaryLight: '#fee2e2',
    primaryDark: '#450a0a',
    accent: '#b45309', // Dark gold/bronze
    accentHover: '#92400e',
    bgSecondary: '#fafaf9',
  },
  {
    id: 'trinity',
    name: 'Trinity Collegiate (Deep Navy & Bronze)',
    primary: '#0f172a', // Deep slate navy
    primaryLight: '#f1f5f9',
    primaryDark: '#020617',
    accent: '#ca8a04', // Bronze gold
    accentHover: '#a16207',
    bgSecondary: '#f8fafc',
  },
  {
    id: 'canterbury',
    name: 'Canterbury Cathedral (Deep Amethyst & Gold)',
    primary: '#4c1d95', // Rich purple
    primaryLight: '#f3e8ff',
    primaryDark: '#2e1065',
    accent: '#f59e0b', // Bright gold
    accentHover: '#d97706',
    bgSecondary: '#fafafa',
  }
];

export const PRINCIPAL_INFO = {
  name: 'Dr. Elizabeth Sterling, PhD',
  title: 'Principal, The Wisdom Link Model College',
  image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=800',
  welcomeMessage: `Welcome to The Wisdom Link Model College Digital Memory Archive. For over three decades, our institution has stood as a beacon of academic excellence, character building, and creative growth. This digital sanctuary is designed to celebrate our students, immortalize our collective achievements, and keep our rich heritage alive for generations of Wisdom Link families. 

Here, every laughter in our corridors, every triumphant goal on our athletic fields, and every milestone cap thrown under the graduation sky is captured, treasured, and preserved. Whether you are an alumnus revisiting your roots, a parent reliving your child’s proudest day, or a prospective student starting your journey, we invite you to explore, remember, and feel the heartbeat of our beloved college.`,
  vision: 'To nurture compassionate, forward-thinking leaders who respect their heritage, strive for academic mastery, and make an indelible mark on the global community.',
  mission: 'To provide a stimulating learning environment where academic excellence, creative discovery, athletic vigor, and social responsibility are woven together, preserving our traditions while pioneering future innovations.'
};

export const STATISTICS = [
  { value: '35+', label: 'Years of Excellence', suffix: '' },
  { value: '1450', label: 'Active Students', suffix: '+' },
  { value: '8200', label: 'Alumni Worldwide', suffix: '' },
  { value: '450', label: 'Events Archived', suffix: '+' },
  { value: '15.4K', label: 'Photos Preserved', suffix: '' },
  { value: '1.2K', label: 'Videos Preserved', suffix: '' },
  { value: '128', label: 'Major Awards Won', suffix: '' }
];

export const CORE_VALUES = [
  {
    title: 'Excellence',
    description: 'Striving for masterclass execution in academics, creative pursuits, and leadership development.'
  },
  {
    title: 'Heritage',
    description: 'Valuing our history and stories, ensuring past milestones guide and fuel future achievements.'
  },
  {
    title: 'Community',
    description: 'Creating a lifelong network of supportive parents, teachers, alumni, and inspired students.'
  },
  {
    title: 'Integrity',
    description: 'Instilling accountability, ethics, and deep empathy within every individual.'
  }
];

export const MEMORIES: Memory[] = [
  {
    id: 'mem-1',
    title: 'Class of 2026 Triumphant Hat Toss',
    description: 'The crowning moment of our 34th Graduation Ceremony. 250 students turning their dreams into milestones as families look on with tears of joy.',
    category: 'photo',
    tag: 'Graduation',
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200',
    date: '2026-06-15',
    featured: true,
  },
  {
    id: 'mem-2',
    title: 'Sports Day 100m Dash Photo-Finish',
    description: 'A thrilling, historic finish during the annual Track & Field championships. Marcus Vance clinches the gold for Emerald House by a fraction of a second.',
    category: 'photo',
    tag: 'Sports',
    imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1200',
    date: '2026-05-12',
    featured: true,
  },
  {
    id: 'mem-3',
    title: 'Annual Orchestral Winter Concert',
    description: 'Watch the magnificent symphonic performance of our students playing Beethoven’s Symphony No. 9. A winter night of pure auditory harmony.',
    category: 'video',
    tag: 'Music',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', // Safe sample video
    date: '2025-12-18',
    featured: true,
  },
  {
    id: 'mem-4',
    title: 'Science Fair Smart-Grid Prototype',
    description: 'Grade 11 students explaining their working model of an eco-friendly local smart energy grid, capturing the Academic Innovation Shield.',
    category: 'photo',
    tag: 'Science',
    imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1200',
    date: '2026-04-05',
    featured: false,
  },
  {
    id: 'mem-5',
    title: 'Interactive Art Studio Class',
    description: 'Visual arts majors working on their term murals. Expressing heritage, biodiversity, and future-gazing in strokes of vivid acrylics.',
    category: 'photo',
    tag: 'Arts',
    imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=1200',
    date: '2026-03-22',
    featured: false,
  },
  {
    id: 'mem-6',
    title: 'National School Debate Finals',
    description: 'Our senior team presenting their winning defense of Sustainable AI Governance during the Grand National Debate Championships.',
    category: 'archive',
    tag: 'Academic',
    imageUrl: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80&w=1200',
    date: '2026-02-14',
    featured: false,
  },
  {
    id: 'mem-7',
    title: 'Lakeside Geography Field Trip',
    description: 'A spectacular afternoon of mapping river deltas and collecting water specimens for environmental analysis at Blue Ridge Reserve.',
    category: 'teacher',
    tag: 'Excursion',
    imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1200',
    author: 'Mr. Davis, Department of Sciences',
    date: '2025-10-10',
    featured: false,
  },
  {
    id: 'mem-8',
    title: 'My Son’s First Day in Prep',
    description: 'Seeing him march up the marble steps of The Wisdom Link Model College with his oversized backpack was a core memory for our family. So proud!',
    category: 'parent',
    tag: 'First Day',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1200',
    author: 'Mrs. Abigail Vance (Parent)',
    date: '2025-09-01',
    featured: false,
  },
  {
    id: 'mem-9',
    title: 'Vintage Photo: Wisdom Link Library Opening (1991)',
    description: 'A dive into our historical files! This retro snapshot captures our founding Principal cutting the ribbon to the Wisdom Link Central Library.',
    category: 'archive',
    tag: 'History',
    imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
    date: '1991-09-15',
    featured: true,
  }
];

export const FEATURED_EVENTS = [
  {
    title: 'Graduation Ceremony',
    date: 'June 15, 2026',
    description: 'Celebrating the academic excellence, resilient spirit, and soaring futures of our senior class as they embark on global careers.',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=1200',
    category: 'Ceremony',
  },
  {
    title: 'Sports Day',
    date: 'May 12, 2026',
    description: 'From high jumps to record-breaking relays, Houses clashed in mutual respect, culminating in a historic triumph for Emerald House.',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1200',
    category: 'Athletics',
  },
  {
    title: 'Cultural Day',
    date: 'April 20, 2026',
    description: 'A vivid, sensory journey across 40 countries, celebrating international cuisines, heritage dances, and historic regional stories.',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200',
    category: 'Festival',
  },
  {
    title: 'Christmas Carol',
    date: 'December 18, 2025',
    description: 'An emotional, candlelit evening of sacred carols, classical choral scores, and symphonic orchestra performances.',
    image: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=1200',
    category: 'Music',
  },
  {
    title: 'Prize Giving Day',
    date: 'July 2, 2026',
    description: 'Our annual ceremony honoring academic pioneers, athletic legends, creative designers, and selfless community volunteers.',
    image: 'https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&q=80&w=1200',
    category: 'Honors',
  },
  {
    title: 'Science Fair',
    date: 'April 5, 2026',
    description: 'A dazzling showcase of student creativity, featuring hydrogen car engines, AI study guides, and innovative water filtration models.',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1200',
    category: 'Innovation',
  },
  {
    title: 'Excursions',
    date: 'October 10, 2025',
    description: 'Outdoor ecological research, mapping pristine river basins, and gathering geographical soil specimens at Blue Ridge Reserve.',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1200',
    category: 'Adventure',
  },
  {
    title: 'Debate Competition',
    date: 'February 14, 2026',
    description: 'Intellectual tournaments covering international ethics, technology policy, and environmental philosophies, judged by Ivy alumni.',
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80&w=1200',
    category: 'Forensics',
  }
];

export const TIMELINE_DATA: TimelineYear[] = [
  {
    year: 2026,
    theme: 'Innovating for Tomorrow',
    description: 'A year centered on smart infrastructure, academic masteries, and eco-sustainable student projects.',
    milestones: [
      {
        title: 'Launch of the Smart Green Campus Initiative',
        description: 'Installed interactive solar trees and student-designed bio-composters, turning green energy into dynamic classroom lessons.',
        image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=600',
        tag: 'Sustainability'
      },
      {
        title: 'State Volleyball Champions',
        description: 'The Wisdom Link Eagles girls squad completes an undefeated 22-0 season, taking home the state championship trophy.',
        image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=600',
        tag: 'Athletics'
      }
    ]
  },
  {
    year: 2025,
    theme: 'Resilience & Connection',
    description: 'Strengthening community links with the launch of parent-teacher collaborative circles and hybrid labs.',
    milestones: [
      {
        title: 'New High-Tech Multimedia Studio',
        description: 'The Wisdom Link Digital Lounge is completed, equipping student podcasters, video-editors, and digital painters with industry-standard tech.',
        image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=600',
        tag: 'Facility'
      },
      {
        title: 'National Spelling Bee Finalist',
        description: 'Evelyn Harris, a Grade 8 prodigy, ranks 3rd nationwide, bringing pride to our English Language Guild.',
        image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600',
        tag: 'Academic'
      }
    ]
  },
  {
    year: 2024,
    theme: 'Creative Renaissance',
    description: 'A spectacular year for cultural activities, theatrical productions, and the revitalization of fine arts programs.',
    milestones: [
      {
        title: 'Grand Performing Arts Amphitheater Completed',
        description: 'A state-of-the-art open-air theater seating 600, giving our theater guild a premium venue for classical and modern plays.',
        image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=600',
        tag: 'Art'
      },
      {
        title: 'Wisdom Link Choir Sings at City Hall',
        description: 'An emotional festive evening as 50 of our students harmonized classical carols for regional charities at the Metropolitan Civic Hall.',
        image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=600',
        tag: 'Music'
      }
    ]
  },
  {
    year: 2023,
    theme: 'Global Classrooms',
    description: 'Expanding horizons with international sister-school exchanges, digital guest-lectures, and global debate leagues.',
    milestones: [
      {
        title: 'First Foreign Exchange Program with Kyoto Academy',
        description: 'Ten students traveled to Japan to learn historic cultural arts, while we welcomed Japanese peers into our coding circles.',
        image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=600',
        tag: 'International'
      }
    ]
  },
  {
    year: 2022,
    theme: 'Foundational Masteries',
    description: 'Upgrading primary mathematics and core science structures to bolster STEM leadership.',
    milestones: [
      {
        title: 'Interactive Robotics Lab Inaugurated',
        description: 'Our primary students began coding basic microcontrollers and building automated maze-navigating vehicles.',
        image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=600',
        tag: 'Robotics'
      }
    ]
  }
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach-1',
    title: 'Outstanding STEM School of the Year',
    category: 'academic',
    value: 'Ranked #1',
    description: 'Awarded by the State Academic Alliance for our innovative Robotics and Ecology curricula.',
    year: '2026',
    icon: 'Cpu'
  },
  {
    id: 'ach-2',
    title: 'State Championship Track & Field Shield',
    category: 'sports',
    value: 'Gold Medallists',
    description: 'Claimed 14 individual gold medals and established two new state relay records.',
    year: '2026',
    icon: 'Trophy'
  },
  {
    id: 'ach-3',
    title: 'Ivy League Admissions Rate',
    category: 'academic',
    value: '18% Admitted',
    description: 'Graduating seniors secured placements at Harvard, Yale, Princeton, and Columbia, our highest rate in a decade.',
    year: '2025',
    icon: 'Award'
  },
  {
    id: 'ach-4',
    title: 'National School Choir Grand Prize',
    category: 'arts',
    value: 'Grand Champion',
    description: 'Beautified the national choral finals in classical orchestration and contemporary harmony.',
    year: '2024',
    icon: 'Music'
  }
];

export const CAMPUS_LIFE_AREAS: CampusLifeArea[] = [
  {
    id: 'campus-1',
    title: 'Modern Classrooms',
    description: 'Dynamic learning studios equipped with multi-touch smart boards, ergonomic seating, and individual collaborative workspaces.',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1200',
    activities: ['Smart Board Lectures', 'Project-Based Learning Groupings', 'Interactive Quizzes']
  },
  {
    id: 'campus-2',
    title: 'Central Oak Library',
    description: 'A massive multi-level reading ecosystem housing 35,000 physical volumes, digital journal networks, and quiet study alcoves.',
    imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200',
    activities: ['Silent Reading', 'Group Research Circles', 'Book Author Club Meets', 'Historical Document Archives']
  },
  {
    id: 'campus-3',
    title: 'Discovery Science Hub',
    description: 'Advanced chemistry, physics, and bio-engineering facilities allowing safe, rigorous experimentation using modern sensory tools.',
    imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1200',
    activities: ['Molecular Compound Analysis', 'Robotics Hardware Design', 'Microscopic Culture Research']
  },
  {
    id: 'campus-4',
    title: 'Sports & Wellness Arena',
    description: 'An expansive facility with a heated indoor Olympic pool, standard basketball courts, indoor track, and gymnastics mats.',
    imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1200',
    activities: ['Owl Athletics Training', 'Inter-School Basketball Leagues', 'Yoga & Core Balance Electives']
  }
];

export const DEFAULT_PARENT_CONTRIBUTIONS: ParentContribution[] = [
  {
    id: 'pc-1',
    photoUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=600',
    caption: 'My daughter Sarah during her valedictorian address. Words cannot express how grateful we are for the mentor teachers of The Wisdom Link Model College!',
    event: 'Graduation Day',
    contributorName: 'Gregory Andrews',
    relation: 'Proud Father of Sarah Andrews (Class of 2026)',
    date: '2026-06-16',
    approved: true
  },
  {
    id: 'pc-2',
    photoUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=600',
    caption: 'Capturing the final sprint during Sports Day! The camaraderie between Emerald House and Ruby House was the real winner here.',
    event: 'Sports Day 2026',
    contributorName: 'Helena Mercer',
    relation: 'Mother of Liam Mercer (Grade 10)',
    date: '2026-05-13',
    approved: true
  },
  {
    id: 'pc-3',
    photoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=600',
    caption: 'The winter concert was sensational! Liam played violin for the first time on stage. Exceptional musical leadership at Wisdom Link!',
    event: 'Winter Orchestral Recital',
    contributorName: 'Arthur Zhao',
    relation: 'Father of Liam Zhao (Grade 7)',
    date: '2025-12-19',
    approved: true
  }
];
