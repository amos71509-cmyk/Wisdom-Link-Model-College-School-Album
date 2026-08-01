export interface MajorSchoolEvent {
  id: string;
  title: string;
  category: string;
  description: string;
  date: string;
  image: string;
}

export const MAJOR_SCHOOL_EVENTS: MajorSchoolEvent[] = [
  {
    id: 'graduation-ceremony',
    title: 'Graduation Ceremony',
    category: 'Ceremony',
    description: 'Celebrating the academic excellence, resilient spirit, and soaring futures of our senior class as they embark on global careers.',
    date: 'June 15, 2026',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'inter-house-sports',
    title: 'Inter-House Sports',
    category: 'Athletics',
    description: 'From high jumps to record-breaking relays, Houses clashed in mutual respect, culminating in a historic triumph for Emerald House.',
    date: 'May 12, 2026',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'cultural-day',
    title: 'Cultural Day',
    category: 'Festival',
    description: 'A vivid, sensory journey across 40 countries, celebrating international cuisines, heritage dances, and historic regional stories.',
    date: 'April 20, 2026',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'prize-giving-day',
    title: 'Prize Giving Day',
    category: 'Honors',
    description: 'Our annual ceremony honoring academic pioneers, athletic legends, creative designers, and selfless community volunteers.',
    date: 'July 2, 2026',
    image: 'https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'speech-and-prize-giving',
    title: 'Speech and Prize Giving Ceremony',
    category: 'Honors',
    description: 'Keynote addresses from distinguished guests and recognition of exceptional scholastic and leadership achievements.',
    date: 'July 5, 2026',
    image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'orientation-day',
    title: 'Orientation Day',
    category: 'Academic',
    description: 'Welcoming new scholars, families, and faculty to our campus community with guided tours, mentorship, and traditions.',
    date: 'September 8, 2025',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'matriculation-ceremony',
    title: 'Matriculation Ceremony',
    category: 'Ceremony',
    description: 'Formal induction of incoming scholars into the academic registry and signing of the school honor pledge.',
    date: 'October 2, 2025',
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'convocation-ceremony',
    title: 'Convocation Ceremony',
    category: 'Ceremony',
    description: 'Gathering of the complete academic body to open the academic year, honor faculty chairs, and ignite curiosity.',
    date: 'September 15, 2025',
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'science-exhibition',
    title: 'Science Exhibition',
    category: 'Innovation',
    description: 'Interactive displays showcasing robotics prototypes, environmental engineering models, and biochemistry breakthroughs.',
    date: 'April 5, 2026',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'stem-fair',
    title: 'STEM Fair',
    category: 'Innovation',
    description: 'Student-led inventions, artificial intelligence demonstrations, competitive hackathons, and green energy innovations.',
    date: 'March 18, 2026',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'debate-competition',
    title: 'Debate Competition',
    category: 'Forensics',
    description: 'Intellectual tournaments covering international ethics, technology policy, and environmental philosophies.',
    date: 'February 14, 2026',
    image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'quiz-competition',
    title: 'Quiz Competition',
    category: 'Academic',
    description: 'Fast-paced inter-school intellectual battles testing general knowledge, literature, mathematics, and global history.',
    date: 'November 20, 2025',
    image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'independence-day',
    title: 'Independence Day Celebration',
    category: 'Patriotic',
    description: 'Parades, historical reenactments, cultural exhibitions, and patriotic musical tributes celebrating national heritage.',
    date: 'October 1, 2025',
    image: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'childrens-day',
    title: 'Children\'s Day',
    category: 'Festival',
    description: 'A joy-filled carnival of games, bouncy castles, talent showcases, and treats dedicated to our younger scholars.',
    date: 'May 27, 2026',
    image: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'christmas-carol',
    title: 'Christmas Carol',
    category: 'Music',
    description: 'An emotional, candlelit evening of sacred carols, classical choral scores, and symphonic orchestra performances.',
    date: 'December 18, 2025',
    image: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'easter-celebration',
    title: 'Easter Celebration',
    category: 'Festival',
    description: 'Spring choir performances, Easter drama pageants, community outreach drives, and festive family luncheons.',
    date: 'March 29, 2026',
    image: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'founders-day',
    title: 'Founder’s Day',
    category: 'Heritage',
    description: 'Honoring the visionaries who laid the foundation of our institution with memorial lectures, historical exhibits, and galas.',
    date: 'November 10, 2025',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'school-anniversary',
    title: 'School Anniversary',
    category: 'Heritage',
    description: 'Commemorating years of scholastic excellence, alumni reunions, historical retrospectives, and campus unveilings.',
    date: 'January 15, 2026',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'pta-events',
    title: 'PTA Events',
    category: 'Community',
    description: 'Collaborative parent-teacher conferences, fundraising galas, educational workshops, and family fun fairs.',
    date: 'Monthly',
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'excursion-educational-trips',
    title: 'Excursion / Educational Trips',
    category: 'Adventure',
    description: 'Outdoor ecological research, botanical exploration, historical museum visits, and geographical field surveys.',
    date: 'October 10, 2025',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'club-activities',
    title: 'Club Activities',
    category: 'Co-Curricular',
    description: 'Weekly meetings, projects, and exhibitions by the Drama Guild, Robotics Club, Chess League, and Art Society.',
    date: 'Weekly',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'music-and-arts-festival',
    title: 'Music and Arts Festival',
    category: 'Arts',
    description: 'Stage drama productions, orchestral recitals, fine art exhibitions, and musical solo competitions.',
    date: 'May 30, 2026',
    image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'career-day',
    title: 'Career Day',
    category: 'Guidance',
    description: 'Industry experts, university admissions officers, and alumni sharing career pathways, resume workshops, and mentorship.',
    date: 'February 28, 2026',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'prefect-inauguration',
    title: 'Prefect Inauguration',
    category: 'Leadership',
    description: 'Formal pinning and oath-taking ceremony for the newly elected student council leaders and house captains.',
    date: 'October 15, 2025',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'welcome-ceremony',
    title: 'Welcome Ceremony',
    category: 'Community',
    description: 'Heartfelt reception for new students, exchange scholars, and visiting international delegations.',
    date: 'September 10, 2025',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'farewell-ceremony',
    title: 'Farewell Ceremony',
    category: 'Ceremony',
    description: 'Sentimental send-off dinner, memory slide shows, and speeches honoring departing staff and graduating seniors.',
    date: 'June 10, 2026',
    image: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'academic-awards',
    title: 'Academic Awards',
    category: 'Honors',
    description: 'Special convocation honoring honor roll scholars, subject champions, and Olympiad gold medalists.',
    date: 'December 5, 2025',
    image: 'https://images.unsplash.com/photo-1567168544813-cc03465b4fa8?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'community-service-projects',
    title: 'Community Service Projects',
    category: 'Outreach',
    description: 'Volunteer drives, environmental cleanups, book donations, and community health awareness initiatives.',
    date: 'Quarterly',
    image: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'school-projects',
    title: 'School Projects',
    category: 'Innovation',
    description: 'Cross-disciplinary capstone projects, architectural model designs, coding showcases, and research papers.',
    date: 'Bi-Annual',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 'other-major-events',
    title: 'Other Major Events',
    category: 'Events',
    description: 'Preserved archives for special guest lectures, international summits, campus dedications, and unique milestones.',
    date: 'Ongoing',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=1200'
  }
];
