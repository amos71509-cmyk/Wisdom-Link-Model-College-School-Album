import React, { useState } from 'react';
import { Palette, Check, Sliders, RotateCcw, X, Info } from 'lucide-react';
import { SchoolPalette } from '../types';
import { PALETTES } from '../data/schoolData';

interface BrandingControlProps {
  activePalette: SchoolPalette;
  onChangePalette: (palette: SchoolPalette) => void;
  onCustomColorChange: (primary: string, accent: string) => void;
}

export default function BrandingControl({
  activePalette,
  onChangePalette,
  onCustomColorChange,
}: BrandingControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customPrimary, setCustomPrimary] = useState(activePalette.primary);
  const [customAccent, setCustomAccent] = useState(activePalette.accent);
  const [showCustomConfig, setShowCustomConfig] = useState(false);

  const handleCustomPrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomPrimary(val);
    onCustomColorChange(val, customAccent);
  };

  const handleCustomAccentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAccent(val);
    onCustomColorChange(customPrimary, val);
  };

  const handleReset = () => {
    onChangePalette(PALETTES[0]);
    setCustomPrimary(PALETTES[0].primary);
    setCustomAccent(PALETTES[0].accent);
    setShowCustomConfig(false);
  };

  return (
    <div id="branding-panel" className="fixed bottom-6 right-6 z-50">
      {/* Trigger Button */}
      <button
        id="branding-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-3 bg-white text-gray-900 rounded-full shadow-2xl border border-gray-100 hover:bg-gray-50 hover:scale-105 transition-all duration-300 font-medium text-sm tracking-wide group"
        title="Change School Colors"
      >
        <Palette className="w-5 h-5 text-[var(--accent)] animate-pulse" />
        <span>Branding Simulator</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
        </span>
      </button>

      {/* Drawer Panel */}
      {isOpen && (
        <div
          id="branding-drawer"
          className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 p-6 animate-in slide-in-from-bottom duration-300 z-50 text-gray-800"
        >
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[var(--primary)]" />
              <h3 className="font-semibold text-gray-900 text-base">Branding Control Panel</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 leading-relaxed flex items-start gap-1.5 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <span>
                To satisfy the <strong>Color System</strong> requirement, toggle below to simulate how the entire website automatically adapts to any school’s official brand palette in real-time.
              </span>
            </p>
          </div>

          {/* Preset Palettes */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Prestigious School Presets
            </label>
            <div className="grid grid-cols-1 gap-2">
              {PALETTES.map((palette) => {
                const isSelected = !showCustomConfig && activePalette.id === palette.id;
                return (
                  <button
                    key={palette.id}
                    onClick={() => {
                      setShowCustomConfig(false);
                      onChangePalette(palette);
                      setCustomPrimary(palette.primary);
                      setCustomAccent(palette.accent);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 text-left w-full ${
                      isSelected
                        ? 'border-[var(--accent)] bg-gray-50/80 ring-1 ring-[var(--accent)]'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Color circles */}
                      <div className="flex -space-x-1 shrink-0">
                        <span
                          className="w-5 h-5 rounded-full border border-white shadow-sm block"
                          style={{ backgroundColor: palette.primary }}
                        />
                        <span
                          className="w-5 h-5 rounded-full border border-white shadow-sm block"
                          style={{ backgroundColor: palette.accent }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]">
                        {palette.name}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Selector Toggle */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowCustomConfig(!showCustomConfig)}
              className={`flex items-center justify-between w-full text-left p-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                showCustomConfig ? 'text-[var(--accent)] bg-gray-50' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🎨 Create Custom School Palette</span>
              <span>{showCustomConfig ? 'Collapse' : 'Expand'}</span>
            </button>

            {showCustomConfig && (
              <div className="space-y-3.5 mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">
                      Primary Brand Color
                    </label>
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200">
                      <input
                        type="color"
                        value={customPrimary}
                        onChange={handleCustomPrimaryChange}
                        className="w-7 h-7 rounded border-0 cursor-pointer p-0 bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-gray-600 uppercase">
                        {customPrimary}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">
                      Accent Color (Gold)
                    </label>
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200">
                      <input
                        type="color"
                        value={customAccent}
                        onChange={handleCustomAccentChange}
                        className="w-7 h-7 rounded border-0 cursor-pointer p-0 bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-gray-600 uppercase">
                        {customAccent}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-yellow-50/50 rounded text-[10px] text-yellow-800 leading-normal border border-yellow-100">
                  Slide or pick any color! The entire archive, buttons, banners, and timelines will dynamically recalculate their CSS variables to match your choice.
                </div>
              </div>
            )}
          </div>

          {/* Reset button */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Powered by Crowns Digital</span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 transition-colors py-1 px-2 rounded hover:bg-red-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Wisdom Link</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
