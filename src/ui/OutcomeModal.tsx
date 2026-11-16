import React from 'react';
import { RunSnapshot } from '../systems/GameConfig';
import { CAREER_MISSIONS } from '../systems/MissionSystem';

interface OutcomeModalProps {
  snapshot: RunSnapshot;
  onRetry: () => void;
  onNextMission: (missionId: number) => void;
  onOpenGarage: () => void;
  onMainMenu: () => void;
}

export const OutcomeModal: React.FC<OutcomeModalProps> = ({
  snapshot,
  onRetry,
  onNextMission,
  onOpenGarage,
  onMainMenu,
}) => {
  const nextMission =
    snapshot.victory && snapshot.mission
      ? CAREER_MISSIONS.find((m) => m.id === snapshot.mission!.id + 1) ?? null
      : null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950/96 border border-white/15 p-6 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider mb-1 text-zinc-400">
          {snapshot.mode === 'career' && snapshot.mission
            ? `Mission ${snapshot.mission.id} · ${snapshot.mission.title}`
            : snapshot.trafficMode === 'twoway'
            ? 'Two-Way Endless Run (2x Cash)'
            : 'Endless Highway Run'}
        </div>

        <h2
          className={`font-display text-3xl font-extrabold tracking-wide ${
            snapshot.victory ? 'text-emerald-400' : 'text-rose-500'
          }`}
        >
          {snapshot.victory ? 'MISSION COMPLETE' : 'RUN ENDED'}
        </h2>
        <p className="text-sm text-zinc-300 mt-1 mb-5">{snapshot.reason}</p>

        {/* Stat Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="rounded-xl bg-zinc-900 border border-white/10 p-3">
            <div className="text-[11px] uppercase text-zinc-400">
              Score {snapshot.isNewBest ? '· NEW BEST' : ''}
            </div>
            <div className="font-display text-2xl font-bold text-white tabular-nums">
              {snapshot.score.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-900 border border-white/10 p-3">
            <div className="text-[11px] uppercase text-zinc-400">Cash Earned</div>
            <div className="font-mono-num text-2xl font-bold text-amber-400">
              +${snapshot.cashEarned.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-900 border border-white/10 p-3">
            <div className="text-[11px] uppercase text-zinc-400">Distance</div>
            <div className="font-mono-num text-lg font-bold text-white">
              {snapshot.distanceM.toLocaleString()} m
            </div>
          </div>
          <div className="rounded-xl bg-zinc-900 border border-white/10 p-3">
            <div className="text-[11px] uppercase text-zinc-400">Top Speed</div>
            <div className="font-mono-num text-lg font-bold text-sky-400">
              {snapshot.topSpeedKmh} km/h
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 mb-5 px-1 tabular-nums">
          <span>Overtakes: <strong className="text-zinc-200">{snapshot.overtakes}</strong></span>
          <span>Near Miss: <strong className="text-zinc-200">{snapshot.nearMisses}</strong></span>
          <span>Max Combo: <strong className="text-amber-300">x{Math.max(1, snapshot.maxCombo)}</strong></span>
          <span>Best: <strong className="text-zinc-200">{snapshot.highScore.toLocaleString()}</strong></span>
        </div>

        <div className="flex flex-col gap-2.5">
          {nextMission ? (
            <button
              type="button"
              data-start="true"
              onClick={() => onNextMission(nextMission.id)}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-bold py-3 transition-colors cursor-pointer"
            >
              Next Mission: {nextMission.title}
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRetry}
              className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold py-3 transition-colors cursor-pointer"
            >
              {snapshot.victory ? 'Play Again' : 'Try Again'}
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenGarage}
              className="rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white font-semibold py-2.5 text-sm transition-colors cursor-pointer"
            >
              Garage
            </button>
            <button
              type="button"
              onClick={onMainMenu}
              className="rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-semibold py-2.5 text-sm transition-colors cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
