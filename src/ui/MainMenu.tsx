import React, { useState } from 'react';
import {
  CareerMission,
  EnvironmentTheme,
  PlayerSaveData,
  TrafficDirection,
} from '../systems/GameConfig';
import { CAREER_MISSIONS } from '../systems/MissionSystem';

interface MainMenuProps {
  saveData: PlayerSaveData;
  selectedTrafficMode: TrafficDirection;
  onChangeTrafficMode: (mode: TrafficDirection) => void;
  onChangeTheme: (theme: EnvironmentTheme) => void;
  onStartEndless: () => void;
  onStartCareerMission: (missionId: number) => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  selectedTrafficMode,
  onChangeTrafficMode,
  onChangeTheme,
  onStartEndless,
  onStartCareerMission,
  onOpenGarage,
  onOpenSettings,
}) => {
  const [showCareerList, setShowCareerList] = useState(false);

  const nextMission: CareerMission =
    CAREER_MISSIONS.find((m) => m.id === saveData.highestUnlockedMission) ??
    CAREER_MISSIONS[CAREER_MISSIONS.length - 1];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar: Bank & Records */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex items-center gap-4 sm:gap-5 rounded-xl bg-zinc-950/88 border border-white/12 px-4 py-2.5 shadow-xl">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">Cash</div>
            <div className="font-mono-num text-lg font-bold text-amber-400">
              ${saveData.money.toLocaleString()}
            </div>
          </div>
          <div className="h-7 w-px bg-white/12" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">Best Score</div>
            <div className="font-mono-num text-lg font-bold text-white">
              {saveData.highScore.toLocaleString()}
            </div>
          </div>
          <div className="hidden sm:block h-7 w-px bg-white/12" />
          <div className="hidden sm:block">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">Best Distance</div>
            <div className="font-mono-num text-lg font-bold text-sky-400">
              {saveData.bestDistanceM.toLocaleString()} m
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open Settings"
          className="pointer-events-auto flex items-center gap-2 rounded-xl bg-zinc-950/88 border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-white/30 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>

      {/* Left-Anchored Title Lockup + Actions over calm negative space */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 my-auto">
        <div className="pointer-events-auto max-w-md rounded-2xl bg-zinc-950/84 border border-white/12 p-5 sm:p-6 shadow-2xl">
          <svg viewBox="0 0 360 88" className="w-full max-w-[300px] h-auto mb-2.5" role="img" aria-label="Traffic Rider Web 3D">
            <path d="M8 14 L54 14 L42 30 L2 30 Z" fill="#e11d48" />
            <path d="M46 14 L68 14 L56 30 L34 30 Z" fill="#0ea5e9" />
            <text
              x="76"
              y="28"
              fill="#a1a1aa"
              fontFamily="Oxanium, sans-serif"
              fontSize="13"
              fontWeight="700"
              letterSpacing="4"
            >
              BMW S1000RR EDITION
            </text>
            <text
              x="2"
              y="66"
              fill="#ffffff"
              fontFamily="Oxanium, sans-serif"
              fontSize="36"
              fontWeight="800"
              letterSpacing="1"
            >
              TRAFFIC RIDER
            </text>
            <text
              x="4"
              y="84"
              fill="#e11d48"
              fontFamily="Oxanium, sans-serif"
              fontSize="14"
              fontWeight="700"
              letterSpacing="5"
            >
              WEB 3D HIGHWAY
            </text>
          </svg>

          {/* Compact Highway Mode & Time-of-Day Selectors */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => onChangeTrafficMode('oneway')}
              className={`rounded-lg py-1.5 px-2 text-xs font-bold border transition-colors cursor-pointer ${
                selectedTrafficMode === 'oneway'
                  ? 'bg-sky-500 border-sky-400 text-zinc-950'
                  : 'bg-zinc-900/90 border-white/12 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              One-Way Traffic
            </button>
            <button
              type="button"
              onClick={() => onChangeTrafficMode('twoway')}
              className={`rounded-lg py-1.5 px-2 text-xs font-bold border transition-colors cursor-pointer ${
                selectedTrafficMode === 'twoway'
                  ? 'bg-amber-400 border-amber-300 text-zinc-950'
                  : 'bg-zinc-900/90 border-white/12 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              Two-Way · 2x Cash
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {(['day', 'sunset', 'night'] as EnvironmentTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChangeTheme(t)}
                className={`rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                  saveData.settings.environmentTheme === t
                    ? 'bg-white border-white text-zinc-950'
                    : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onStartEndless}
              className="w-full flex items-center justify-between rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-display font-bold text-lg tracking-wide px-5 py-3.5 shadow-lg transition-colors cursor-pointer"
            >
              <span>PLAY ENDLESS</span>
              <span className="text-xs font-sans font-semibold text-rose-100">Enter</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowCareerList((v) => !v)}
                className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white font-semibold text-sm px-4 py-3 transition-colors cursor-pointer"
              >
                Career ({saveData.completedMissionIds.length}/{CAREER_MISSIONS.length})
              </button>
              <button
                type="button"
                onClick={onOpenGarage}
                className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white font-semibold text-sm px-4 py-3 transition-colors cursor-pointer"
              >
                Garage
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
            <span>Next Mission: {nextMission.title}</span>
            <button
              type="button"
              onClick={() => onStartCareerMission(nextMission.id)}
              className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
            >
              Launch →
            </button>
          </div>
        </div>

        {/* Career Mission Drawer */}
        {showCareerList && (
          <div className="pointer-events-auto w-full md:w-[420px] max-h-[62vh] overflow-y-auto rounded-2xl bg-zinc-950/94 border border-white/15 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-bold text-white">Career Missions</h2>
              <button
                type="button"
                onClick={() => setShowCareerList(false)}
                className="text-xs font-semibold text-zinc-400 hover:text-white px-2 py-1 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {CAREER_MISSIONS.map((mission) => {
                const unlocked = mission.id <= saveData.highestUnlockedMission;
                const completed = saveData.completedMissionIds.includes(mission.id);
                return (
                  <button
                    key={mission.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onStartCareerMission(mission.id)}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      unlocked
                        ? 'bg-zinc-900/90 hover:bg-zinc-800 border-white/15 cursor-pointer'
                        : 'bg-zinc-950/60 border-white/5 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white">
                        {mission.id}. {mission.title}
                      </span>
                      <span className="font-mono-num text-xs font-bold text-amber-400">
                        {completed ? 'DONE · ' : !unlocked ? 'LOCKED · ' : ''}+${mission.rewardMoney}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{mission.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-xs tracking-wide text-zinc-300 hud-text-shadow">
        W / ↑ Gas · S / ↓ Brake · A / D Steer · Space / Shift Wheelie · H Horn/Flash · Esc Pause
      </div>
    </div>
  );
};
