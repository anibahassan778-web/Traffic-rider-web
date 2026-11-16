import { useCallback, useEffect, useRef, useState } from 'react';
import { TouchInputState } from './controls/InputManager';
import { MobileControls } from './controls/MobileControls';
import { Game } from './core/Game';
import {
  CareerMission,
  EnvironmentTheme,
  GameMode,
  GameState,
  HUDState,
  PlayerSaveData,
  RunSnapshot,
  SettingsData,
  TrafficDirection,
  UpgradeLevels,
} from './systems/GameConfig';
import { CAREER_MISSIONS } from './systems/MissionSystem';
import { createDefaultSaveData } from './systems/SaveSystem';
import { GarageUI } from './ui/GarageUI';
import { HUD } from './ui/HUD';
import { MainMenu } from './ui/MainMenu';
import { OutcomeModal } from './ui/OutcomeModal';
import { PauseMenu } from './ui/PauseMenu';
import { SettingsUI } from './ui/SettingsUI';

const INITIAL_HUD: HUDState = {
  speedKmh: 0,
  rpmRatio: 0.2,
  gear: 1,
  distanceM: 0,
  score: 0,
  runMoney: 0,
  overtakes: 0,
  nearMisses: 0,
  comboCount: 0,
  comboTimer01: 0,
  timeRemainingSec: 0,
  elapsedSec: 0,
  missionProgress: 0,
  missionLabel: '0 m',
  eventBanner: null,
  eventBannerId: 0,
  crashFlash: 0,
  nearMissFlash: 0,
  wrongWayActive: false,
  wheelieActive: false,
  slipstreamRatio: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  const [gameState, setGameState] = useState<GameState>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadLabel, setLoadLabel] = useState('Initializing engine...');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saveData, setSaveData] = useState<PlayerSaveData>(() => createDefaultSaveData());
  const [hud, setHud] = useState<HUDState>(INITIAL_HUD);
  const [activeMode, setActiveMode] = useState<GameMode>('endless');
  const [trafficMode, setTrafficMode] = useState<TrafficDirection>('oneway');
  const [activeMission, setActiveMission] = useState<CareerMission | null>(null);
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);

  const [showGarage, setShowGarage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    document.body.dataset.state = 'loading';

    const game = new Game(container, {
      onLoadProgress: (p, label) => {
        setLoadProgress(p);
        setLoadLabel(label);
      },
      onLoadError: (msg) => {
        setLoadError(msg);
      },
      onStateChange: (nextState) => {
        setGameState(nextState);
        if (nextState === 'playing') {
          setShowGarage(false);
          setShowSettings(false);
          setRunSnapshot(null);
        }
      },
      onHudUpdate: (nextHud) => {
        setHud(nextHud);
      },
      onSaveDataChange: (data) => {
        setSaveData(data);
      },
      onRunFinished: (snapshot) => {
        setRunSnapshot(snapshot);
      },
    });

    gameRef.current = game;
    void game.init(autostart);

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const handleStartEndless = useCallback(() => {
    setActiveMode('endless');
    setActiveMission(null);
    setShowGarage(false);
    setShowSettings(false);
    gameRef.current?.startRun('endless', undefined, trafficMode);
  }, [trafficMode]);

  const handleStartCareerMission = useCallback((missionId: number) => {
    const mission = CAREER_MISSIONS.find((m) => m.id === missionId) ?? CAREER_MISSIONS[0];
    setActiveMode('career');
    setActiveMission(mission);
    setShowGarage(false);
    setShowSettings(false);
    gameRef.current?.startRun('career', mission.id);
  }, []);

  const handleOpenGarage = useCallback(() => {
    gameRef.current?.setShowcaseMode('garage');
    setShowGarage(true);
    setShowSettings(false);
  }, []);

  const handleCloseGarage = useCallback(() => {
    gameRef.current?.setShowcaseMode('title');
    setShowGarage(false);
  }, []);

  const handleTouchControl = useCallback((control: keyof TouchInputState, pressed: boolean) => {
    gameRef.current?.audio.unlock();
    gameRef.current?.input.setTouchControl(control, pressed);
  }, []);

  const handleUpgrade = useCallback((category: keyof UpgradeLevels) => {
    gameRef.current?.purchaseUpgrade(category);
  }, []);

  const handlePaint = useCallback((paintId: string) => {
    gameRef.current?.selectOrBuyPaint(paintId);
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<SettingsData>) => {
    gameRef.current?.updateSettings(partial);
  }, []);

  const handleChangeTheme = useCallback((theme: EnvironmentTheme) => {
    gameRef.current?.updateSettings({ environmentTheme: theme });
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-zinc-950">
      <div
        ref={canvasMountRef}
        data-testid="webgl-viewport"
        className="absolute inset-0 w-full h-full"
      />

      {gameState === 'loading' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl">
            <div className="font-display text-2xl font-extrabold text-white tracking-wide">
              TRAFFIC RIDER WEB 3D
            </div>
            {loadError ? (
              <div className="mt-4 rounded-xl bg-rose-950/70 border border-rose-500/40 p-4 text-left">
                <div className="text-xs font-bold uppercase text-rose-400">Asset Load Error</div>
                <p className="mt-1 text-sm text-rose-200 break-words">{loadError}</p>
              </div>
            ) : (
              <>
                <p className="mt-2 text-xs text-zinc-400">{loadLabel}</p>
                <div className="mt-4 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-transform duration-150 origin-left"
                    style={{ transform: `scaleX(${Math.max(0.05, loadProgress)})` }}
                  />
                </div>
                <div className="mt-2 font-mono-num text-xs text-zinc-300">
                  {Math.round(loadProgress * 100)}%
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {gameState === 'title' && !showGarage && (
        <MainMenu
          saveData={saveData}
          selectedTrafficMode={trafficMode}
          onChangeTrafficMode={setTrafficMode}
          onChangeTheme={handleChangeTheme}
          onStartEndless={handleStartEndless}
          onStartCareerMission={handleStartCareerMission}
          onOpenGarage={handleOpenGarage}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {showGarage && (
        <GarageUI
          saveData={saveData}
          onUpgrade={handleUpgrade}
          onSelectOrBuyPaint={handlePaint}
          onRevEngine={() => gameRef.current?.revEnginePreview()}
          onStartRide={handleStartEndless}
          onClose={handleCloseGarage}
        />
      )}

      {gameState === 'playing' && (
        <>
          <HUD
            hud={hud}
            mode={activeMode}
            mission={activeMission}
            totalMoney={saveData.money}
            muted={saveData.settings.muted}
            onHorn={() => gameRef.current?.triggerHorn()}
            onToggleMute={() => gameRef.current?.toggleMute()}
            onPause={() => gameRef.current?.pause()}
          />
          <MobileControls
            visible={true}
            layout={saveData.settings.touchLayout}
            visibilityMode={saveData.settings.touchVisibility}
            onControlChange={handleTouchControl}
          />
        </>
      )}

      {gameState === 'paused' && (
        <PauseMenu
          onResume={() => gameRef.current?.resume()}
          onRestart={() => gameRef.current?.restartRun()}
          onOpenSettings={() => setShowSettings(true)}
          onMainMenu={() => gameRef.current?.returnToTitle()}
        />
      )}

      {gameState === 'gameover' && runSnapshot && !showGarage && (
        <OutcomeModal
          snapshot={runSnapshot}
          onRetry={() => gameRef.current?.restartRun()}
          onNextMission={handleStartCareerMission}
          onOpenGarage={handleOpenGarage}
          onMainMenu={() => gameRef.current?.returnToTitle()}
        />
      )}

      {showSettings && (
        <SettingsUI
          settings={saveData.settings}
          onUpdate={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
