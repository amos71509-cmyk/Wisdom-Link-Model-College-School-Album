import React, { useEffect, useState } from 'react';
import { UploadProgressStats, subscribeToUploadProgress } from '../utils/uploadHelper';
import { CloudUpload, CheckCircle, AlertTriangle, RefreshCw, Loader2, Minimize2, Maximize2, Zap, Clock } from 'lucide-react';

export const UploadProgressModal: React.FC = () => {
  const [stats, setStats] = useState<UploadProgressStats | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToUploadProgress((newStats) => {
      setStats(newStats);
      if (newStats) {
        setDismissed(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (stats?.status === 'completed') {
      const timer = setTimeout(() => {
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [stats?.status]);

  if (!stats || dismissed) {
    return null;
  }

  const {
    percent,
    speedFormatted,
    timeRemainingFormatted,
    status,
    statusText,
    fileName,
    uploadedBytes,
    totalBytes
  } = stats;

  const isCompleted = status === 'completed';
  const isError = status === 'error';
  const isRetrying = status === 'retrying';
  const isProcessing = status === 'processing';

  return (
    <div className={`fixed z-50 transition-all duration-300 ease-in-out ${
      minimized
        ? 'bottom-4 right-4 w-72 bg-slate-900/95 text-white shadow-2xl rounded-2xl p-3 border border-slate-700/80 backdrop-blur-md'
        : 'bottom-6 right-6 w-96 md:w-[420px] bg-slate-900/95 text-white shadow-2xl rounded-2xl p-5 border border-slate-700/80 backdrop-blur-lg'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl text-white ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400'
              : isError
              ? 'bg-rose-500/20 text-rose-400'
              : isRetrying
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-indigo-500/20 text-indigo-400'
          }`}>
            {isCompleted ? (
              <CheckCircle className="w-5 h-5" />
            ) : isError ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isRetrying ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CloudUpload className="w-5 h-5 animate-bounce" />
            )}
          </div>
          <div className="truncate">
            <h4 className="text-sm font-semibold tracking-wide text-slate-100 truncate">
              {fileName || 'Media File Upload'}
            </h4>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>{statusText || 'Uploading...'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          {isCompleted && (
            <button
              onClick={() => setDismissed(true)}
              className="text-xs font-medium px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Body Content */}
      {!minimized && (
        <div className="pt-4 space-y-3.5">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-medium">
              <span className="text-slate-300">
                {uploadedBytes && totalBytes ? `${(uploadedBytes / (1024 * 1024)).toFixed(1)} MB of ${(totalBytes / (1024 * 1024)).toFixed(1)} MB` : ''}
              </span>
              <span className="text-indigo-400 font-semibold">{percent}%</span>
            </div>
            
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : isError
                    ? 'bg-rose-500'
                    : isRetrying
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
          </div>

          {/* Stats Bar (Speed & ETA) */}
          {!isCompleted && !isError && (
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/50 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Speed</div>
                  <div className="font-semibold text-slate-200 truncate">{speedFormatted || 'Calculating...'}</div>
                </div>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/50 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Time Left</div>
                  <div className="font-semibold text-slate-200 truncate">{timeRemainingFormatted || 'Calculating...'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Background continuation notice */}
          {!isCompleted && (
            <p className="text-[11px] text-slate-400/90 italic text-center pt-1">
              ✨ Background upload active. Safe to switch tabs.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
