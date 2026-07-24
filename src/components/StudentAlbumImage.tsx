import React from 'react';
import { Maximize2 } from 'lucide-react';
import { getOptimizedImageUrl } from '../utils/imageUtils';

export interface StudentAlbumImageProps {
  imageUrl: string;
  studentName: string;
  studentQuote?: string;
  index?: number;
  caption?: string;
  className?: string;
  onOpenFullscreen: () => void;
  onOpenComments?: () => void;
}

const StudentAlbumImage: React.FC<StudentAlbumImageProps> = ({
  imageUrl,
  studentName,
  studentQuote,
  index,
  caption,
  className,
  onOpenFullscreen
}) => {
  return (
    <div className={className || "flex flex-col bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group/album text-left"}>
      {/* Primary Image (Clean, No Overlay Icons) */}
      <div 
        className="relative aspect-square overflow-hidden bg-slate-950 cursor-pointer"
        onClick={onOpenFullscreen}
      >
        <img 
          src={getOptimizedImageUrl(imageUrl, 600)} 
          alt={`${studentName} graduation memory`}
          className="w-full h-full object-contain bg-slate-950 p-1 group-hover/album:scale-104 transition-transform duration-300"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* White Background Footer with "View More" button */}
      <div className="p-2.5 bg-white flex items-center justify-between border-t border-slate-100">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[120px]">
          {caption || (index !== undefined ? `Memory #${index + 1}` : 'Graduation Photo')}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenFullscreen(); }}
          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer hover:scale-105"
          title="View More (Fullscreen)"
        >
          <span>View More</span>
          <Maximize2 className="w-3 h-3 font-black" />
        </button>
      </div>
    </div>
  );
};

export default StudentAlbumImage;
