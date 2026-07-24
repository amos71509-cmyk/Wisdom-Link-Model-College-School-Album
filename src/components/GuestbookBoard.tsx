import React, { useEffect, useState } from 'react';
import { StickyNote, Send, Sparkles, User, MessageSquareCode, Trash2, Heart, AlertCircle, Loader2 } from 'lucide-react';
import { GuestbookEntry } from '../types';
import { subscribeGuestbook, submitToModeration } from '../services/firebaseService';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

interface GuestbookBoardProps {
  cleanUpMode: boolean;
}

const STICKY_COLORS = [
  'bg-amber-100 border-amber-200 text-amber-950',
  'bg-emerald-50 border-emerald-100 text-emerald-950',
  'bg-sky-100 border-sky-200 text-sky-950',
  'bg-pink-100 border-pink-200 text-pink-950',
  'bg-violet-100 border-violet-200 text-violet-950',
];

const STICKY_ROTATIONS = [
  'rotate-1',
  '-rotate-1',
  'rotate-2',
  '-rotate-2',
  'rotate-3',
  '-rotate-3',
];

export default function GuestbookBoard({ cleanUpMode }: GuestbookBoardProps) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Student' | 'Parent' | 'Teacher' | 'Alumni' | 'Well-wisher'>('Well-wisher');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const unsub = subscribeGuestbook((list) => {
      setEntries(list);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        id: `gb-${Date.now()}`,
        name: name,
        role: role,
        message: message,
        timestamp: new Date().toISOString(),
      };
      // Submit to moderation (which can auto-approve or queue depending on config, let's submit to moderation so teachers review, or let's allow it to go directly if we want instant pin. The instruction says: "also submit a corresponding Guestbook greeting so they both appear...". Let's route guestbook entries to moderation and display approved guestbook entries!)
      await submitToModeration('guestbook', payload);
      
      setName('');
      setMessage('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4500);
    } catch (err: any) {
      console.error('Failed to submit guestbook entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this sticky note from the digital guestbook board?')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'guestbook', id));
    } catch (err: any) {
      console.error('Failed to delete guestbook note:', err);
    }
  };

  return (
    <section id="guestbook-board" className="py-24 bg-transparent relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-500 glass-pill px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-3">
            <StickyNote className="w-3.5 h-3.5 text-emerald-500" />
            <span>Digital Sentiment Wall</span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-display">
            Guestbook Sticky Note Board
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-xl mx-auto font-normal">
            Leave a note, share high-fives, and celebrate the milestones. Write a greeting below to pin your sticky note to the digital corkboard!
          </p>
          <div className="h-1 w-20 bg-emerald-500 mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Create Note Form */}
          <div className="lg:col-span-4" id="guestbook-form-card">
            <div className="glass-card-heavy p-6 sm:p-8 border border-white/60 shadow-2xl text-left space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                <h3 className="text-base font-bold text-gray-900">Pin a Sticky Note</h3>
              </div>

              {showSuccess && (
                <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 leading-normal font-semibold">
                  🎉 Sticky note submitted successfully! It has been dispatched to the moderation queue and will appear here shortly!
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grandma Rose Sterling"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm focus:outline-none glass-input text-gray-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">
                    Your Community Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm focus:outline-none glass-input text-gray-700 bg-white"
                  >
                    <option value="Well-wisher">Well-wisher</option>
                    <option value="Student">Student</option>
                    <option value="Parent">Parent</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Alumni">Alumni</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5">
                    Sticky Note Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    maxLength={220}
                    placeholder="Leave a short, beautiful, or inspiring message for the Class of 2026... (max 220 chars)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm focus:outline-none glass-input text-gray-800 leading-relaxed"
                  />
                  <div className="text-right text-[10px] text-gray-400 mt-1">
                    {message.length}/220 characters
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    To maintain our safe digital environment, new sticky notes are routed to the moderation console for quick authorization by teachers.
                  </span>
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 disabled:bg-gray-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg hover:bg-emerald-700 hover:scale-103 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Pinning...' : 'Pin Greeting'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Corkboard grid */}
          <div className="lg:col-span-8 bg-amber-900/10 rounded-3xl p-6 md:p-8 border border-amber-900/10 min-h-[500px]" id="guestbook-corkboard-wrapper">
            {/* Real cork pattern background styling */}
            <div className="relative w-full h-full">
              {entries.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                  <MessageSquareCode className="w-12 h-12 text-gray-300 mb-2 animate-pulse" />
                  <h4 className="text-sm font-bold text-gray-700">Digital Corkboard Empty</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    Pin your congrats! Be the first to share an inspiring message for our wonderful graduates!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="sticky-notes-list">
                  {entries.map((note, idx) => {
                    const colorClass = STICKY_COLORS[idx % STICKY_COLORS.length];
                    const rotationClass = STICKY_ROTATIONS[idx % STICKY_ROTATIONS.length];
                    return (
                      <div
                        key={note.id}
                        className={`group relative p-5 rounded-lg border shadow-lg ${colorClass} ${rotationClass} hover:rotate-0 hover:scale-105 hover:z-20 transition-all duration-300 text-left min-h-[170px] flex flex-col justify-between`}
                      >
                        {/* Red visual deletion button in Clean Up Mode */}
                        {cleanUpMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(note.id);
                            }}
                            className="absolute top-2 right-2 z-30 p-1.5 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 animate-pulse cursor-pointer border border-red-300"
                            title="Delete Sticky Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Push Pin decorative icon */}
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-600 border border-red-700 shadow-md flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        </div>

                        <p className="text-xs sm:text-sm leading-relaxed font-sans font-medium italic mt-1 select-none">
                          “{note.message}”
                        </p>

                        <div className="pt-3 border-t border-black/5 mt-3 flex items-center justify-between select-none">
                          <div className="truncate pr-2">
                            <span className="font-bold text-xs truncate block">{note.name}</span>
                            <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">
                              {note.role}
                            </span>
                          </div>
                          <div className="h-6 w-6 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 opacity-60" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
