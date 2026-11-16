import React from 'react';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-950/95 border border-white/15 p-6 shadow-2xl">
        <h2 className="font-display text-2xl font-bold text-white tracking-wide">PAUSED</h2>
        <p className="text-xs text-zinc-400 mt-1 mb-5">Press Esc or P to resume riding.</p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold py-3 transition-colors cursor-pointer"
          >
            Resume Ride
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white font-semibold py-2.5 transition-colors cursor-pointer"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white font-semibold py-2.5 transition-colors cursor-pointer"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-semibold py-2.5 transition-colors cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
