import React from 'react';
import { CareerMission, GameMode, HUDState } from '../systems/GameConfig';

interface HUDProps {
  hud: HUDState;
  mode: GameMode;
  mission: CareerMission | null;
  totalMoney: number;
  muted: boolean;
  onHorn: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  mode,
  mission,
  totalMoney,
  muted,
  onHorn,
  onToggleMute,
  onPause,
}) => {
  const rpmSegments = 16;
  const activeSegments = Math.round(hud.rpmRatio * rpmSegments);

  const highSpeedRatio = Math.max(0, Math.min(1, (hud.speedKmh - 175) / 135));
  const slipBoostOpacity = Math.max(highSpeedRatio * 0.38, hud.slipstreamRatio > 0.75 ? 0.3 : 0);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {slipBoostOpacity > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            opacity: slipBoostOpacity,
            background:
              'radial-gradient(circle at 50% 55%, rgba(0,0,0,0) 54%, rgba(56,189,248,0.28) 88%, rgba(14,165,233,0.48) 100%)',
          }}
        />
      )}
      {hud.crashFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-8 border-rose-500/80"
          style={{ opacity: Math.min(0.85, hud.crashFlash) }}
        />
      )}
      {hud.nearMissFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-4 border-amber-400/70"
          style={{ opacity: Math.min(0.65, hud.nearMissFlash) }}
        />
      )}

      {/* Top Row: Left Mission/Distance & Right Score/Utility */}
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-zinc-950/80 border border-white/12 px-3.5 py-2.5 shadow-lg min-w-[175px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {mode === 'career' && mission ? mission.title : 'Distance'}
            </span>
            <span className="font-mono-num text-xs font-bold text-amber-400">
              ${(totalMoney + hud.runMoney).toLocaleString()}
            </span>
          </div>

          <div className="mt-0.5 flex items-baseline gap-3">
            <span className="font-display text-xl font-bold text-white tabular-nums">
              {hud.distanceM.toLocaleString()} m
            </span>
            {mode === 'career' && mission && mission.timeLimitSec > 0 && (
              <span
                className={`font-mono-num text-sm font-bold ${
                  hud.timeRemainingSec <= 8 ? 'text-rose-400' : 'text-sky-400'
                }`}
              >
                {hud.timeRemainingSec.toFixed(1)}s
              </span>
            )}
          </div>

          {mode === 'career' && mission && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-300 tabular-nums mb-1">
                <span>Objective</span>
                <span className="font-mono-num font-semibold">{hud.missionLabel}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-transform duration-100 origin-left"
                  style={{ transform: `scaleX(${Math.max(0.02, hud.missionProgress)})` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Center Event / Wrong-Way Callout */}
        <div className="hidden sm:flex flex-col items-center gap-1.5">
          {hud.wrongWayActive && (
            <div className="rounded-xl bg-amber-500/95 border border-amber-300 px-3.5 py-1 font-display text-xs font-extrabold tracking-wider text-zinc-950 shadow-lg">
              ONCOMING LANE · 2X CASH
            </div>
          )}
          {hud.eventBanner && (
            <div
              key={hud.eventBannerId}
              className="rounded-xl bg-zinc-950/88 border border-amber-400/50 px-4 py-1.5 font-display text-sm font-bold tracking-wider text-amber-300 shadow-lg"
            >
              {hud.eventBanner}
            </div>
          )}
        </div>

        {/* Top-Right Cluster: Score + Horn, Mute & Pause */}
        <div className="flex items-start gap-2">
          <div className="rounded-xl bg-zinc-950/80 border border-white/12 px-3.5 py-2 text-right shadow-lg min-w-[148px]">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Score{' '}
              {hud.comboCount > 1 && (
                <span className="text-amber-400 font-bold">· x{hud.comboCount}</span>
              )}
            </div>
            <div className="font-display text-xl font-bold text-white tabular-nums">
              {hud.score.toLocaleString()}
            </div>
            {hud.comboCount > 0 && hud.comboTimer01 > 0 && (
              <div className="mt-1 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-amber-400 origin-right transition-transform duration-75"
                  style={{ transform: `scaleX(${Math.max(0.03, hud.comboTimer01)})` }}
                />
              </div>
            )}
            <div className="mt-0.5 text-[11px] text-zinc-400 tabular-nums">
              Overtakes {hud.overtakes} · Near {hud.nearMisses}
            </div>
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Horn and High Beam"
            onClick={(e) => {
              e.currentTarget.blur();
              onHorn();
            }}
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-950/85 border border-amber-400/35 text-amber-300 hover:bg-zinc-900 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-950/85 border border-white/15 text-white hover:bg-zinc-900 cursor-pointer"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Game"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-950/85 border border-white/15 text-white hover:bg-zinc-900 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Event / Wrong-Way Callout */}
      <div className="sm:hidden flex flex-col items-center gap-1">
        {hud.wrongWayActive && (
          <div className="rounded-lg bg-amber-500/95 px-2.5 py-0.5 font-display text-[11px] font-extrabold text-zinc-950">
            ONCOMING 2X
          </div>
        )}
        {hud.eventBanner && (
          <div className="rounded-xl bg-zinc-950/88 border border-amber-400/50 px-3.5 py-1 font-display text-xs font-bold tracking-wider text-amber-300">
            {hud.eventBanner}
          </div>
        )}
      </div>

      {/* Bottom-Center Digital Cockpit Cluster */}
      <div className="self-center mb-0 sm:mb-1 rounded-2xl bg-zinc-950/88 border border-white/15 px-4 py-2 shadow-xl min-w-[200px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-1.5">
            <span
              data-testid="hud-speed"
              className="font-display text-2xl sm:text-3xl font-extrabold text-white tabular-nums leading-none"
            >
              {hud.speedKmh}
            </span>
            <span className="text-[10px] font-semibold uppercase text-zinc-400">KM/H</span>
          </div>
          <div className="flex items-center gap-2.5">
            {hud.wheelieActive && (
              <span className="rounded-md bg-amber-400/20 border border-amber-400/60 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                WHEELIE
              </span>
            )}
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-zinc-400">Gear</div>
              <div className="font-display text-lg font-bold text-sky-400 tabular-nums leading-none">
                {hud.gear}
              </div>
            </div>
          </div>
        </div>

        {/* RPM Shift Bar */}
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: rpmSegments }).map((_, idx) => {
            const lit = idx < activeSegments;
            const color =
              idx >= 13 ? 'bg-rose-500' : idx >= 10 ? 'bg-amber-400' : 'bg-sky-400';
            return (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-xs ${lit ? color : 'bg-zinc-800'}`}
              />
            );
          })}
        </div>

        {/* Slipstream Draft Indicator */}
        {hud.slipstreamRatio > 0.04 && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-sky-300">
              {hud.slipstreamRatio >= 0.99 ? 'BOOST' : 'DRAFT'}
            </span>
            <div className="h-1 flex-1 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full origin-left transition-transform duration-75 ${
                  hud.slipstreamRatio >= 0.72 ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ transform: `scaleX(${Math.min(1, hud.slipstreamRatio)})` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
