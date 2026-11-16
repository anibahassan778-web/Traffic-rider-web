import React from 'react';
import { BIKE_PAINTS, PlayerSaveData, UpgradeLevels } from '../systems/GameConfig';
import { computeBikeSpec } from '../systems/MotorcyclePhysics';
import { getUpgradeCost } from '../systems/SaveSystem';

interface GarageUIProps {
  saveData: PlayerSaveData;
  onUpgrade: (category: keyof UpgradeLevels) => void;
  onSelectOrBuyPaint: (paintId: string) => void;
  onRevEngine: () => void;
  onStartRide: () => void;
  onClose: () => void;
}

export const GarageUI: React.FC<GarageUIProps> = ({
  saveData,
  onUpgrade,
  onSelectOrBuyPaint,
  onRevEngine,
  onStartRide,
  onClose,
}) => {
  const spec = computeBikeSpec(saveData.upgrades);
  const topSpeedKmh = Math.round(spec.maxSpeedMs * 3.6);
  const specBars = [
    { label: 'Top Speed', value: `${topSpeedKmh} km/h`, pct: Math.min(1, topSpeedKmh / 350) },
    { label: 'Acceleration', value: `${spec.accelBase.toFixed(1)} m/s²`, pct: Math.min(1, spec.accelBase / 35) },
    { label: 'Braking', value: `${spec.brakeDecel.toFixed(0)} m/s²`, pct: Math.min(1, spec.brakeDecel / 53) },
    { label: 'Agility', value: `${spec.steerSpeed.toFixed(1)}`, pct: Math.min(1, spec.steerSpeed / 11.5) },
  ];

  const upgradeItems: Array<{ key: keyof UpgradeLevels; label: string; desc: string }> = [
    { key: 'engine', label: 'Engine & Exhaust', desc: 'Increases top speed and acceleration' },
    { key: 'brakes', label: 'Carbon Brakes', desc: 'Shortens stopping distance in traffic' },
    { key: 'handling', label: 'Suspension & Steering', desc: 'Faster lane flicks and lean control' },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col md:flex-row justify-between p-4 sm:p-6">
      {/* Top-Left Bike Info Header leaving center-left 3D showcase clear */}
      <div className="pointer-events-auto self-start rounded-2xl bg-zinc-950/90 border border-white/15 px-5 py-4 shadow-xl">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
          Superbike Garage
        </div>
        <h2 className="font-display text-2xl font-bold text-white">BMW S1000RR (2019)</h2>
        <div className="mt-2 flex items-center gap-4 text-xs text-zinc-300 tabular-nums">
          <span>Top Speed: <strong className="text-white">{topSpeedKmh} km/h</strong></span>
          <span>Cash: <strong className="text-amber-400">${saveData.money.toLocaleString()}</strong></span>
        </div>
        <button
          type="button"
          onClick={onRevEngine}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-rose-500/45 px-3 py-1.5 text-xs font-bold text-rose-300 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          </svg>
          Rev Engine
        </button>
      </div>

      {/* Right Tuning & Paint Panel */}
      <div className="pointer-events-auto w-full md:w-[390px] max-h-[78vh] overflow-y-auto self-end md:self-center rounded-2xl bg-zinc-950/94 border border-white/15 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-white">Performance & Paint</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 cursor-pointer"
          >
            Back
          </button>
        </div>

        {/* Live Performance Spec Bars */}
        <div className="grid grid-cols-2 gap-2.5 mb-4 rounded-xl bg-zinc-900/75 border border-white/10 p-3">
          {specBars.map((bar) => (
            <div key={bar.label}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-zinc-400">{bar.label}</span>
                <span className="font-mono-num font-bold text-zinc-100">{bar.value}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 origin-left transition-transform duration-150"
                  style={{ transform: `scaleX(${Math.max(0.1, bar.pct)})` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Upgrades */}
        <div className="flex flex-col gap-3 mb-5">
          {upgradeItems.map((item) => {
            const level = saveData.upgrades[item.key];
            const isMax = level >= 5;
            const cost = getUpgradeCost(item.key, level);
            const canAfford = saveData.money >= cost;

            return (
              <div key={item.key} className="rounded-xl bg-zinc-900/90 border border-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <div className="text-[11px] text-zinc-400">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    disabled={isMax || !canAfford}
                    onClick={() => onUpgrade(item.key)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold tabular-nums transition-colors ${
                      isMax
                        ? 'bg-emerald-900/60 text-emerald-300 cursor-default'
                        : canAfford
                        ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'MAX' : `$${cost.toLocaleString()}`}
                  </button>
                </div>

                <div className="mt-2.5 flex gap-1.5">
                  {[0, 1, 2, 3, 4].map((pip) => (
                    <div
                      key={pip}
                      className={`h-1.5 flex-1 rounded-sm ${
                        pip < level ? 'bg-sky-400' : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Paint Customization */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Fairing Paint
          </div>
          <div className="grid grid-cols-1 gap-2">
            {BIKE_PAINTS.map((paint) => {
              const owned = saveData.ownedPaintIds.includes(paint.id);
              const selected = saveData.selectedPaintId === paint.id;
              const affordable = saveData.money >= paint.price;
              return (
                <button
                  key={paint.id}
                  type="button"
                  disabled={!owned && !affordable}
                  onClick={() => onSelectOrBuyPaint(paint.id)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-zinc-800 border-sky-400'
                      : owned || affordable
                      ? 'bg-zinc-900/80 hover:bg-zinc-800 border-white/10 cursor-pointer'
                      : 'bg-zinc-950 border-white/5 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full border border-white/30"
                      style={{ backgroundColor: paint.hex }}
                    />
                    <span className="text-xs font-semibold text-white">{paint.name}</span>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-amber-400">
                    {selected ? 'EQUIPPED' : owned ? 'SELECT' : `$${paint.price.toLocaleString()}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onStartRide}
          className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold py-3 transition-colors cursor-pointer"
        >
          Take It To The Highway
        </button>
      </div>
    </div>
  );
};
