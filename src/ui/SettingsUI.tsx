import React from 'react';
import {
  GraphicsQuality,
  SettingsData,
  TouchLayout,
  TouchVisibility,
} from '../systems/GameConfig';

interface SettingsUIProps {
  settings: SettingsData;
  onUpdate: (partial: Partial<SettingsData>) => void;
  onClose: () => void;
}

export const SettingsUI: React.FC<SettingsUIProps> = ({ settings, onUpdate, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-zinc-950/96 border border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl font-bold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 cursor-pointer"
          >
            Done
          </button>
        </div>

        <div className="flex flex-col gap-4 text-sm">
          {/* Graphics Quality */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Graphics & Memory Profile
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'low', label: 'Low · 500MB' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'high', label: 'High' },
                ] as Array<{ id: GraphicsQuality; label: string }>
              ).map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onUpdate({ graphicsQuality: q.id })}
                  className={`rounded-lg py-2 px-1 text-xs font-bold uppercase border cursor-pointer ${
                    settings.graphicsQuality === q.id
                      ? 'bg-sky-500 border-sky-400 text-zinc-950'
                      : 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Highway Sky Theme */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Highway Atmosphere
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['day', 'sunset', 'night'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onUpdate({ environmentTheme: t })}
                  className={`rounded-lg py-2 text-xs font-bold uppercase border cursor-pointer ${
                    settings.environmentTheme === t
                      ? 'bg-amber-400 border-amber-300 text-zinc-950'
                      : 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* FPS Target */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Frame Rate Target
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([30, 60] as const).map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => onUpdate({ fpsCap: fps })}
                  className={`rounded-lg py-2 text-xs font-bold border cursor-pointer ${
                    settings.fpsCap === fps
                      ? 'bg-sky-500 border-sky-400 text-zinc-950'
                      : 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Audio Volume */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="audio-vol" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Audio Volume
              </label>
              <span className="font-mono-num text-xs text-white">
                {settings.muted ? 'Muted' : `${Math.round(settings.audioVolume * 100)}%`}
              </span>
            </div>
            <input
              id="audio-vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.audioVolume}
              onChange={(e) => onUpdate({ audioVolume: parseFloat(e.target.value), muted: false })}
              className="w-full accent-sky-400"
            />
          </div>

          {/* Steering Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="steer-sens" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Steering Sensitivity
              </label>
              <span className="font-mono-num text-xs text-white">
                {settings.steeringSensitivity.toFixed(2)}x
              </span>
            </div>
            <input
              id="steer-sens"
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={settings.steeringSensitivity}
              onChange={(e) => onUpdate({ steeringSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-sky-400"
            />
          </div>

          {/* Touch Controls Layout */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Touch Control Layout
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'standard', label: 'Steer Left · Gas Right' },
                { id: 'swapped', label: 'Gas Left · Steer Right' },
              ] as Array<{ id: TouchLayout; label: string }>).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ touchLayout: opt.id })}
                  className={`rounded-lg py-2 px-2 text-xs font-semibold border cursor-pointer ${
                    settings.touchLayout === opt.id
                      ? 'bg-sky-500 border-sky-400 text-zinc-950'
                      : 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Touch Controls Visibility */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              On-Screen Touch Buttons
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['always', 'auto', 'off'] as TouchVisibility[]).map((vis) => (
                <button
                  key={vis}
                  type="button"
                  onClick={() => onUpdate({ touchVisibility: vis })}
                  className={`rounded-lg py-2 text-xs font-bold uppercase border cursor-pointer ${
                    settings.touchVisibility === vis
                      ? 'bg-sky-500 border-sky-400 text-zinc-950'
                      : 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {vis}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Effects Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-sm font-semibold text-white">Camera Speed & Shake FX</div>
              <div className="text-xs text-zinc-400">Dynamic FOV, lean roll, and impact shake</div>
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ cameraEffects: !settings.cameraEffects })}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold border cursor-pointer ${
                settings.cameraEffects
                  ? 'bg-emerald-500 border-emerald-400 text-zinc-950'
                  : 'bg-zinc-900 border-white/15 text-zinc-400'
              }`}
            >
              {settings.cameraEffects ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
