import React, { useEffect, useState } from 'react';
import { TouchInputState } from '../controls/InputManager';
import { TouchLayout, TouchVisibility } from '../systems/GameConfig';

interface MobileControlsProps {
  visible: boolean;
  layout: TouchLayout;
  visibilityMode: TouchVisibility;
  onControlChange: (control: keyof TouchInputState, pressed: boolean) => void;
}

interface TouchButtonProps {
  control: keyof TouchInputState;
  label: string;
  ariaLabel: string;
  accent?: 'throttle' | 'brake' | 'steer' | 'wheelie';
  onControlChange: (control: keyof TouchInputState, pressed: boolean) => void;
  children: React.ReactNode;
}

function TouchButton({
  control,
  label,
  ariaLabel,
  accent = 'steer',
  onControlChange,
  children,
}: TouchButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handleClear = () => {
      setActive(false);
      onControlChange(control, false);
    };
    window.addEventListener('blur', handleClear);
    return () => {
      window.removeEventListener('blur', handleClear);
      onControlChange(control, false);
    };
  }, [control, onControlChange]);

  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setActive(false);
    onControlChange(control, false);
  };

  const accentStyle =
    accent === 'throttle'
      ? active
        ? 'bg-emerald-500/80 border-emerald-300 text-zinc-950 scale-95'
        : 'bg-zinc-950/60 border-emerald-400/50 text-emerald-300'
      : accent === 'brake'
      ? active
        ? 'bg-rose-600/85 border-rose-300 text-white scale-95'
        : 'bg-zinc-950/60 border-rose-500/50 text-rose-300'
      : accent === 'wheelie'
      ? active
        ? 'bg-amber-400/85 border-amber-200 text-zinc-950 scale-95'
        : 'bg-zinc-950/60 border-amber-400/50 text-amber-300'
      : active
      ? 'bg-sky-400/80 border-sky-200 text-zinc-950 scale-95'
      : 'bg-zinc-950/55 border-white/25 text-white';

  const sizeStyle =
    accent === 'throttle'
      ? 'w-20 h-24 sm:w-24 sm:h-28'
      : accent === 'brake'
      ? 'w-18 h-20 sm:w-20 sm:h-24'
      : accent === 'wheelie'
      ? 'w-20 h-11 sm:w-24 sm:h-12'
      : 'w-18 h-18 sm:w-20 sm:h-20';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-touch-control={control}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
        onControlChange(control, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => {
        setActive(false);
        onControlChange(control, false);
      }}
      className={`pointer-events-auto touch-none select-none flex ${
        accent === 'wheelie' ? 'flex-row gap-1.5' : 'flex-col'
      } items-center justify-center rounded-2xl border-2 transition-transform duration-75 shadow-lg ${accentStyle} ${sizeStyle}`}
    >
      {children}
      <span className={`${accent === 'wheelie' ? '' : 'mt-1 '}text-[10px] font-semibold tracking-wider uppercase`}>
        {label}
      </span>
    </button>
  );
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  visible,
  layout,
  visibilityMode,
  onControlChange,
}) => {
  const [viewportNarrow, setViewportNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 960 : false
  );

  useEffect(() => {
    const onResize = () => setViewportNarrow(window.innerWidth <= 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!visible || visibilityMode === 'off') return null;

  const isTouchCapable =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0 || viewportNarrow);

  if (visibilityMode === 'auto' && !isTouchCapable) {
    return null;
  }

  const steerCluster = (
    <div className="flex items-end gap-3 sm:gap-4">
      <TouchButton
        control="steerLeft"
        label="Left"
        ariaLabel="Steer Left"
        onControlChange={onControlChange}
      >
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </TouchButton>
      <TouchButton
        control="steerRight"
        label="Right"
        ariaLabel="Steer Right"
        onControlChange={onControlChange}
      >
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </TouchButton>
    </div>
  );

  const pedalCluster = (
    <div className="flex flex-col items-end gap-2">
      <TouchButton
        control="wheelie"
        label="Wheelie"
        ariaLabel="Wheelie"
        accent="wheelie"
        onControlChange={onControlChange}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 17l7-10 7 4" />
        </svg>
      </TouchButton>
      <div className="flex items-end gap-3 sm:gap-4">
        <TouchButton
          control="brake"
          label="Brake"
          ariaLabel="Brake"
          accent="brake"
          onControlChange={onControlChange}
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.4">
            <rect x="6" y="5" width="12" height="14" rx="2" />
            <path strokeLinecap="round" d="M9 9h6M9 13h6" />
          </svg>
        </TouchButton>
        <TouchButton
          control="throttle"
          label="Gas"
          ariaLabel="Accelerate"
          accent="throttle"
          onControlChange={onControlChange}
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-5 5m5-5l5 5" />
          </svg>
        </TouchButton>
      </div>
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-4 sm:px-7 sm:pb-6">
      {layout === 'standard' ? (
        <>
          {steerCluster}
          {pedalCluster}
        </>
      ) : (
        <>
          {pedalCluster}
          {steerCluster}
        </>
      )}
    </div>
  );
};
