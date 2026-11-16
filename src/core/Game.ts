import * as THREE from 'three';
import { InputManager } from '../controls/InputManager';
import { Motorcycle } from '../motorcycle/Motorcycle';
import { MotorcycleCamera } from '../motorcycle/MotorcycleCamera';
import { AudioSystem } from '../systems/AudioSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
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
} from '../systems/GameConfig';
import { CAREER_MISSIONS, evaluateMissionProgress } from '../systems/MissionSystem';
import {
  BikePhysicsState,
  BikeSpec,
  computeBikeSpec,
  createInitialPhysicsState,
  stepMotorcyclePhysics,
} from '../systems/MotorcyclePhysics';
import { SaveSystem } from '../systems/SaveSystem';
import {
  applyCollisionPenalty,
  COMBO_DURATION_SEC,
  createInitialScoringState,
  registerNearMiss,
  registerOvertake,
  registerSlipstreamPass,
  ScoringState,
  updateDistanceAndSpeedScore,
} from '../systems/ScoringSystem';
import { TrafficManager } from '../traffic/TrafficManager';
import { TrafficVehicle } from '../traffic/TrafficVehicle';
import { World } from '../world/World';
import { AssetManager } from './AssetManager';
import { SceneManager } from './SceneManager';

export interface GameCallbacks {
  onLoadProgress: (progress01: number, label: string) => void;
  onLoadError: (message: string) => void;
  onStateChange: (state: GameState) => void;
  onHudUpdate: (hud: HUDState) => void;
  onSaveDataChange: (data: PlayerSaveData) => void;
  onRunFinished: (snapshot: RunSnapshot) => void;
}

export class Game {
  private container: HTMLElement;
  private callbacks: GameCallbacks;
  public readonly saveSystem = new SaveSystem();
  public readonly input = new InputManager();
  public readonly audio = new AudioSystem();

  private sceneManager: SceneManager | null = null;
  private world: World | null = null;
  private motorcycle: Motorcycle | null = null;
  private bikeCamera: MotorcycleCamera | null = null;
  private traffic: TrafficManager | null = null;
  private collision = new CollisionSystem();

  private gameState: GameState = 'loading';
  private showcaseMode: 'title' | 'garage' = 'title';
  private mode: GameMode = 'endless';
  private trafficMode: TrafficDirection = 'oneway';
  private activeMission: CareerMission | null = null;
  private activeTheme: EnvironmentTheme = 'sunset';

  private physics: BikePhysicsState = createInitialPhysicsState();
  private bikeSpec: BikeSpec;
  private scoring: ScoringState = createInitialScoringState();
  private highSpeedHeldSec = 0;
  private elapsedSec = 0;
  private lastGear = 2;
  private hornCooldown = 0;
  private crashFreezeTimer = 0;
  private pendingCrashOutcome: { reason: string; victory: boolean } | null = null;
  private draftRatio = 0;
  private lastDraftVehicle: TrafficVehicle | null = null;
  private wheelieBannerCooldown = 0;
  private garageRevTimer = 0;

  private hudEmitAccum = 0;
  private eventBanner: string | null = null;
  private eventBannerTimer = 0;
  private eventBannerId = 0;
  private crashFlash = 0;
  private nearMissFlash = 0;
  private pointerParallaxX = 0;

  private frameId = 0;
  private lastTimestamp = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: GameCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    const save = this.saveSystem.getData();
    this.bikeSpec = computeBikeSpec(save.upgrades);
    this.activeTheme = save.settings.environmentTheme;
    this.audio.setVolumeAndMute(save.settings.audioVolume, save.settings.muted);
  }

  async init(autostart: boolean): Promise<void> {
    const save = this.saveSystem.getData();
    const lowMem = save.settings.graphicsQuality === 'low';
    this.sceneManager = new SceneManager(
      this.container,
      save.settings.graphicsQuality,
      save.settings.environmentTheme
    );
    this.bikeCamera = new MotorcycleCamera(this.sceneManager.camera);

    const onResize = () => {
      if (!this.sceneManager) return;
      this.sceneManager.resize(this.container.clientWidth, this.container.clientHeight);
    };
    this.resizeObserver = new ResizeObserver(onResize);
    this.resizeObserver.observe(this.container);
    window.addEventListener('pointermove', this.handlePointerParallax);

    try {
      const assetMgr = new AssetManager((p, label) => {
        this.callbacks.onLoadProgress(p, label);
      });
      const maxAniso = this.sceneManager.renderer.capabilities.getMaxAnisotropy();
      const assets = await assetMgr.loadAll(
        maxAniso,
        save.settings.graphicsQuality,
        (p, label) => {
          this.callbacks.onLoadProgress(p, label);
        }
      );

      if (this.disposed) return;

      await this.collision.init();

      this.world = new World(assets.city, maxAniso, lowMem);
      this.sceneManager.scene.add(this.world.group);

      this.motorcycle = new Motorcycle(assets.bike);
      this.motorcycle.applyPaint(save.selectedPaintId);
      this.sceneManager.scene.add(this.motorcycle.group);

      this.traffic = new TrafficManager(assets.npcVehicles, lowMem);
      this.sceneManager.scene.add(this.traffic.group);

      this.applyVisualTheme(save.settings.environmentTheme);
      this.input.attach();
      this.resetRunState();
      this.sceneManager.precompile();

      this.callbacks.onSaveDataChange({ ...this.saveSystem.getData() });

      if (autostart) {
        this.startRun('endless', undefined, 'oneway');
      } else {
        this.bikeCamera.updateTitleOrGarage(this.motorcycle, 'title', 0.016, 0);
        this.sceneManager.render();
        this.setGameState('title');
      }

      this.lastTimestamp = performance.now();
      this.scheduleNextTick();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks.onLoadError(msg);
    }
  }

  private handlePointerParallax = (e: PointerEvent): void => {
    this.pointerParallaxX = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
  };

  private applyVisualTheme(theme: EnvironmentTheme): void {
    this.activeTheme = theme;
    this.sceneManager?.applyTheme(theme);
    this.world?.setTheme(theme);
    this.motorcycle?.setTheme(theme);
    this.traffic?.setNightMode(theme === 'night');
  }

  private setGameState(next: GameState): void {
    this.gameState = next;
    document.body.dataset.state = next;
    this.callbacks.onStateChange(next);
    this.audio.setEngineActive(next === 'playing');
  }

  setShowcaseMode(mode: 'title' | 'garage'): void {
    this.showcaseMode = mode;
    if (this.motorcycle && this.bikeCamera && this.sceneManager && (this.gameState === 'title' || this.gameState === 'gameover')) {
      this.bikeCamera.updateTitleOrGarage(this.motorcycle, mode, 0.016, this.pointerParallaxX);
      this.sceneManager.render();
    }
  }

  triggerHorn(): void {
    if (this.gameState !== 'playing' || this.hornCooldown > 0) return;
    this.hornCooldown = 0.45;
    this.audio.unlock();
    this.audio.playHorn();
    this.motorcycle?.triggerHighBeam();
    this.traffic?.honkAlert(this.physics.x, this.physics.z);
  }

  revEnginePreview(): void {
    this.audio.unlock();
    this.audio.playEngineRevPreview();
    this.motorcycle?.triggerHighBeam();
    this.garageRevTimer = 0.72;
  }

  startRun(mode: GameMode, missionId?: number, endlessTrafficMode: TrafficDirection = 'oneway'): void {
    this.audio.unlock();
    this.audio.playUiClick();

    this.mode = mode;
    const savedTheme = this.saveSystem.getData().settings.environmentTheme;

    if (mode === 'career') {
      const targetId = missionId ?? this.saveSystem.getData().highestUnlockedMission;
      this.activeMission = CAREER_MISSIONS.find((m) => m.id === targetId) ?? CAREER_MISSIONS[0];
      this.trafficMode = this.activeMission.trafficMode ?? 'oneway';
      this.applyVisualTheme(this.activeMission.theme ?? savedTheme);
    } else {
      this.activeMission = null;
      this.trafficMode = endlessTrafficMode;
      this.applyVisualTheme(savedTheme);
    }

    this.resetRunState();
    this.bikeCamera?.reset();
    this.input.clearAll();

    if (this.motorcycle && this.bikeCamera) {
      const settings = this.saveSystem.getData().settings;
      this.bikeCamera.updateFirstPerson(this.motorcycle, this.physics, 0.016, settings.cameraEffects);
      this.sceneManager?.render();
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.setGameState('playing');
    this.emitHudImmediate();
  }

  restartRun(): void {
    this.startRun(this.mode, this.activeMission?.id, this.trafficMode);
  }

  pause(): void {
    if (this.gameState !== 'playing') return;
    this.input.clearAll();
    this.setGameState('paused');
  }

  resume(): void {
    if (this.gameState !== 'paused') return;
    this.audio.unlock();
    this.input.clearAll();
    this.lastTimestamp = performance.now();
    this.setGameState('playing');
  }

  returnToTitle(): void {
    this.audio.playUiClick();
    this.input.clearAll();
    this.trafficMode = 'oneway';
    this.applyVisualTheme(this.saveSystem.getData().settings.environmentTheme);
    this.resetRunState();
    this.bikeCamera?.reset();
    this.showcaseMode = 'title';
    this.setGameState('title');
  }

  private resetRunState(): void {
    const save = this.saveSystem.getData();
    this.bikeSpec = computeBikeSpec(save.upgrades);
    this.physics = createInitialPhysicsState();
    // Start inside safe right-side lane (lane 2) when riding Two-Way traffic
    if (this.trafficMode === 'twoway') {
      this.physics.x = 1.85;
    }
    this.scoring = createInitialScoringState();
    this.highSpeedHeldSec = 0;
    this.elapsedSec = 0;
    this.lastGear = this.physics.gear;
    this.hornCooldown = 0;
    this.crashFreezeTimer = 0;
    this.pendingCrashOutcome = null;
    this.draftRatio = 0;
    this.lastDraftVehicle = null;
    this.wheelieBannerCooldown = 0;
    this.garageRevTimer = 0;
    this.eventBanner = null;
    this.eventBannerTimer = 0;
    this.crashFlash = 0;
    this.nearMissFlash = 0;

    this.motorcycle?.applyPaint(save.selectedPaintId);
    this.motorcycle?.updateFromPhysics(this.physics, 0.016);
    this.world?.setTrafficMode(this.trafficMode);
    this.traffic?.setTrafficMode(this.trafficMode);
    this.traffic?.setNightMode(this.activeTheme === 'night');
    this.traffic?.setDensity(this.activeMission ? this.activeMission.trafficDensity : 1.0);
    this.traffic?.reset(this.physics.z);
    this.world?.update(this.physics.z, this.physics.speedMs, 0.016);
    this.sceneManager?.updateSunFollow(this.physics.z);
  }

  purchaseUpgrade(category: keyof UpgradeLevels): boolean {
    this.audio.unlock();
    const ok = this.saveSystem.purchaseUpgrade(category);
    if (ok) {
      this.audio.playUiClick();
      this.bikeSpec = computeBikeSpec(this.saveSystem.getData().upgrades);
      this.callbacks.onSaveDataChange({ ...this.saveSystem.getData() });
    }
    return ok;
  }

  selectOrBuyPaint(paintId: string): boolean {
    this.audio.unlock();
    const ok = this.saveSystem.selectOrPurchasePaint(paintId);
    if (ok) {
      this.audio.playUiClick();
      this.motorcycle?.applyPaint(paintId);
      this.callbacks.onSaveDataChange({ ...this.saveSystem.getData() });
    }
    return ok;
  }

  updateSettings(partial: Partial<SettingsData>): void {
    this.saveSystem.updateSettings(partial);
    const s = this.saveSystem.getData().settings;
    this.audio.setVolumeAndMute(s.audioVolume, s.muted);
    this.sceneManager?.applyQuality(s.graphicsQuality);
    if (partial.environmentTheme) {
      this.applyVisualTheme(s.environmentTheme);
    }
    this.callbacks.onSaveDataChange({ ...this.saveSystem.getData() });
  }

  toggleMute(): void {
    const current = this.saveSystem.getData().settings.muted;
    this.updateSettings({ muted: !current });
  }

  private triggerEventBanner(text: string): void {
    this.eventBanner = text;
    this.eventBannerTimer = 1.6;
    this.eventBannerId += 1;
  }

  private finishRun(victory: boolean, reason: string): void {
    const missionBonus = victory && this.activeMission ? this.activeMission.rewardMoney : 0;
    const totalCash = Math.round(this.scoring.cashEarned + missionBonus);
    const finalScore = Math.round(this.scoring.score + (victory ? 1500 : 0));

    const isNewBest = this.saveSystem.recordRunResult({
      score: finalScore,
      distanceM: this.scoring.distanceM,
      overtakes: this.scoring.overtakes,
      cashEarned: totalCash,
      missionCompletedId: victory && this.activeMission ? this.activeMission.id : undefined,
    });

    const saveAfter = this.saveSystem.getData();
    this.callbacks.onSaveDataChange({ ...saveAfter });
    this.setGameState('gameover');

    if (victory) {
      this.audio.playVictory();
    }

    this.callbacks.onRunFinished({
      mode: this.mode,
      trafficMode: this.trafficMode,
      mission: this.activeMission,
      victory,
      reason,
      score: finalScore,
      highScore: saveAfter.highScore,
      isNewBest,
      distanceM: Math.round(this.scoring.distanceM),
      overtakes: this.scoring.overtakes,
      nearMisses: this.scoring.nearMisses,
      maxCombo: this.scoring.maxCombo,
      topSpeedKmh: Math.round(this.scoring.topSpeedKmh),
      cashEarned: totalCash,
      missionBonus,
      totalCashAfter: saveAfter.money,
    });
  }

  private scheduleNextTick(): void {
    if (this.disposed || !this.sceneManager) return;

    if (this.sceneManager.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick(performance.now());
      });
    } else {
      this.frameId = requestAnimationFrame((now) => this.tick(now));
    }
  }

  private afterDraw(cb: () => void): void {
    if (!this.sceneManager) return;
    const gl = this.sceneManager.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 16);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 4);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 16);
      }
    };
    this.frameId = window.setTimeout(poll, 4);
  }

  private tick(now: number): void {
    if (this.disposed || !this.sceneManager || !this.motorcycle || !this.bikeCamera || !this.world || !this.traffic) {
      return;
    }

    const rawDt = (now - this.lastTimestamp) / 1000;
    const settings = this.saveSystem.getData().settings;

    if (!this.sceneManager.isSoftwareGl && settings.fpsCap === 30 && rawDt < 0.031) {
      this.scheduleNextTick();
      return;
    }

    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.input.keyboard.consumeMute()) {
      this.toggleMute();
    }
    if (this.input.keyboard.consumePause()) {
      if (this.gameState === 'playing') {
        this.pause();
      } else if (this.gameState === 'paused') {
        this.resume();
      }
    }
    if (this.input.keyboard.consumeHorn()) {
      this.triggerHorn();
    }
    if (this.gameState === 'title' && this.showcaseMode === 'title' && this.input.keyboard.consumeStart()) {
      this.startRun('endless', undefined, this.trafficMode);
    } else {
      this.input.keyboard.consumeStart();
    }

    if (this.gameState === 'title' || this.gameState === 'gameover') {
      this.physics.z -= 12 * dt;
      this.physics.wheelRotationRad = (this.physics.wheelRotationRad + (12 / 0.31) * dt) % (Math.PI * 2);
      if (this.garageRevTimer > 0) {
        this.garageRevTimer = Math.max(0, this.garageRevTimer - dt);
        this.physics.pitchAngle = Math.sin((this.garageRevTimer / 0.72) * Math.PI) * 0.045;
        this.physics.rpmRatio = 0.32 + Math.sin((this.garageRevTimer / 0.72) * Math.PI) * 0.65;
      } else {
        this.physics.pitchAngle = THREE.MathUtils.damp(this.physics.pitchAngle, 0, 8, dt);
        this.physics.rpmRatio = 0.25;
      }
      this.motorcycle.updateFromPhysics(this.physics, dt);
      this.world.update(this.physics.z, 14, dt);
      this.traffic.update(this.physics.z, 0, dt);
      this.sceneManager.updateSunFollow(this.physics.z);
      this.bikeCamera.updateTitleOrGarage(this.motorcycle, this.showcaseMode, dt, this.pointerParallaxX);
    } else if (this.gameState === 'playing') {
      if (this.crashFreezeTimer > 0) {
        this.crashFreezeTimer -= dt;
        this.world.update(this.physics.z, 0, dt);
        this.bikeCamera.updateFirstPerson(this.motorcycle, this.physics, dt, settings.cameraEffects);
        if (this.crashFreezeTimer <= 0 && this.pendingCrashOutcome) {
          const outcome = this.pendingCrashOutcome;
          this.pendingCrashOutcome = null;
          this.finishRun(outcome.victory, outcome.reason);
        }
      } else {
        this.stepGameplay(dt, settings);
      }
    }

    this.sceneManager.render();
    this.scheduleNextTick();
  }

  private stepGameplay(dt: number, settings: SettingsData): void {
    if (!this.motorcycle || !this.bikeCamera || !this.world || !this.traffic || !this.sceneManager) return;

    this.elapsedSec += dt;
    if (this.hornCooldown > 0) {
      this.hornCooldown = Math.max(0, this.hornCooldown - dt);
    }
    if (this.wheelieBannerCooldown > 0) {
      this.wheelieBannerCooldown = Math.max(0, this.wheelieBannerCooldown - dt);
    }

    // Slipstream draft buildup & slingshot overtake boost
    const draftingVehicle =
      this.physics.speedMs >= 20
        ? this.traffic.getDraftingVehicle(this.physics.x, this.physics.z)
        : null;
    if (draftingVehicle) {
      this.draftRatio = Math.min(1, this.draftRatio + dt * 0.78);
      this.lastDraftVehicle = draftingVehicle;
    } else {
      if (this.draftRatio >= 0.72 && this.lastDraftVehicle && this.physics.speedMs >= 22) {
        this.physics.boostTimer = 1.65;
        const slip = registerSlipstreamPass(this.scoring);
        this.bikeCamera.triggerNearMissPulse();
        this.audio.playNearMiss();
        this.triggerEventBanner(`SLIPSTREAM BOOST +$${slip.cash}`);
      }
      this.lastDraftVehicle = null;
      this.draftRatio = Math.max(0, this.draftRatio - dt * 1.15);
    }

    const prevZ = this.physics.z;
    const throttle = this.input.getThrottle();
    const brake = this.input.getBrake();
    const steerLeft = this.input.getSteerLeft();
    const steerRight = this.input.getSteerRight();
    const wheelie = this.input.getWheelie();

    const wasWheelie = this.physics.wheelieActive;
    stepMotorcyclePhysics(
      this.physics,
      {
        throttle,
        brake,
        steerLeft,
        steerRight,
        wheelie,
        draftBoost: this.draftRatio,
        sensitivity: settings.steeringSensitivity,
      },
      this.bikeSpec,
      dt
    );

    if (!wasWheelie && this.physics.wheelieActive && this.wheelieBannerCooldown <= 0) {
      this.wheelieBannerCooldown = 3.5;
      this.triggerEventBanner('WHEELIE · 1.45X SCORE');
    }

    if (this.physics.gear > this.lastGear && throttle) {
      this.audio.playGearShift();
    }
    this.lastGear = this.physics.gear;

    if (this.physics.hitBarrier) {
      this.bikeCamera.addTrauma(0.45);
      this.crashFlash = Math.max(this.crashFlash, 0.45);
      this.audio.playBarrierScrape();
      this.world.emitSparks(this.physics.x + Math.sign(this.physics.x) * 0.4, 0.55, this.physics.z - 0.5, 16);
      this.triggerEventBanner('BARRIER SCRAPE!');
    }

    this.motorcycle.updateFromPhysics(this.physics, dt);
    this.world.update(this.physics.z, this.physics.speedMs, dt);
    this.traffic.update(this.physics.z, this.scoring.distanceM, dt);
    this.sceneManager.updateSunFollow(this.physics.z);
    this.bikeCamera.updateFirstPerson(this.motorcycle, this.physics, dt, settings.cameraEffects);
    this.audio.updateRidingAudio(this.physics.rpmRatio, this.physics.speedMs, throttle || this.physics.wheelieActive, brake);

    const wrongWayActive = this.trafficMode === 'twoway' && this.physics.x < 0;
    updateDistanceAndSpeedScore(
      this.scoring,
      this.physics.speedMs,
      dt,
      wrongWayActive,
      this.physics.wheelieActive
    );

    const speedKmh = this.physics.speedMs * 3.6;
    if (this.activeMission?.minSpeedKmh && speedKmh >= this.activeMission.minSpeedKmh) {
      this.highSpeedHeldSec += dt;
    }

    const col = this.collision.stepAndEvaluate(
      this.physics.x,
      this.physics.z,
      prevZ,
      this.physics.speedMs,
      this.traffic.getActiveVehicles()
    );

    if (col.crashed && col.hitVehicle) {
      applyCollisionPenalty(this.scoring);
      this.draftRatio = 0;
      this.lastDraftVehicle = null;
      this.physics.boostTimer = 0;
      this.bikeCamera.addTrauma(1.0);
      this.crashFlash = 1.0;
      this.audio.playCrash();
      this.audio.setEngineActive(false);
      this.world.emitSparks(this.physics.x, 0.75, this.physics.z - 0.8, 22);

      if (this.physics.speedMs > 18) {
        this.physics.speedMs *= 0.15;
        this.crashFreezeTimer = 0.55;
        this.pendingCrashOutcome = {
          victory: false,
          reason: `Collided with traffic at ${Math.round(speedKmh)} km/h`,
        };
        this.triggerEventBanner('CRASH!');
        this.emitHudImmediate();
        return;
      } else {
        this.physics.speedMs = Math.max(4, this.physics.speedMs * 0.35);
        this.physics.z = col.hitVehicle.z + col.hitVehicle.length * 0.5 + 1.8;
        this.triggerEventBanner('BUMP!');
      }
    }

    for (const v of col.overtakes) {
      registerOvertake(this.scoring, speedKmh, v.isOncoming);
    }

    for (const v of col.nearMisses) {
      const nm = registerNearMiss(this.scoring, speedKmh, v.isOncoming);
      this.nearMissFlash = 1.0;
      this.bikeCamera.triggerNearMissPulse();
      this.audio.playNearMiss();
      this.world.emitSparks(this.physics.x, 0.5, this.physics.z - 0.5, 8);
      const prefix = v.isOncoming ? 'ONCOMING NEAR MISS' : 'NEAR MISS';
      this.triggerEventBanner(
        nm.combo > 1 ? `${prefix} x${nm.combo} +$${nm.cash}` : `${prefix} +$${nm.cash}`
      );
    }

    if (this.eventBannerTimer > 0) {
      this.eventBannerTimer = Math.max(0, this.eventBannerTimer - dt);
      if (this.eventBannerTimer === 0) this.eventBanner = null;
    }
    this.crashFlash = Math.max(0, this.crashFlash - dt * 2.4);
    this.nearMissFlash = Math.max(0, this.nearMissFlash - dt * 2.8);

    if (this.activeMission) {
      const status = evaluateMissionProgress(
        this.activeMission,
        this.scoring,
        this.highSpeedHeldSec,
        this.elapsedSec
      );
      if (status.completed) {
        this.finishRun(true, `Mission Complete: ${this.activeMission.title}`);
        return;
      }
      if (status.failed) {
        this.finishRun(false, status.failReason || 'Time Expired');
        return;
      }
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHudImmediate();
    }
  }

  private emitHudImmediate(): void {
    const missionStatus = this.activeMission
      ? evaluateMissionProgress(this.activeMission, this.scoring, this.highSpeedHeldSec, this.elapsedSec)
      : null;

    const timeRemainingSec =
      this.activeMission && this.activeMission.timeLimitSec > 0
        ? Math.max(0, this.activeMission.timeLimitSec - this.elapsedSec)
        : 0;

    this.callbacks.onHudUpdate({
      speedKmh: Math.round(this.physics.speedMs * 3.6),
      rpmRatio: this.physics.rpmRatio,
      gear: this.physics.gear,
      distanceM: Math.round(this.scoring.distanceM),
      score: Math.round(this.scoring.score),
      runMoney: Math.round(this.scoring.cashEarned),
      overtakes: this.scoring.overtakes,
      nearMisses: this.scoring.nearMisses,
      comboCount: this.scoring.comboCount,
      comboTimer01: this.scoring.comboCount > 0 ? Math.min(1, this.scoring.comboTimer / COMBO_DURATION_SEC) : 0,
      timeRemainingSec,
      elapsedSec: this.elapsedSec,
      missionProgress: missionStatus ? missionStatus.ratio : 0,
      missionLabel: missionStatus ? missionStatus.label : `${Math.round(this.scoring.distanceM)} m`,
      eventBanner: this.eventBanner,
      eventBannerId: this.eventBannerId,
      crashFlash: this.crashFlash,
      nearMissFlash: this.nearMissFlash,
      wrongWayActive: this.trafficMode === 'twoway' && this.physics.x < 0 && this.physics.speedMs * 3.6 >= 95,
      wheelieActive: this.physics.wheelieActive,
      slipstreamRatio: this.physics.boostTimer > 0 ? 1 : this.draftRatio,
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('pointermove', this.handlePointerParallax);
    this.resizeObserver?.disconnect();
    this.input.detach();
    this.audio.dispose();
    this.world?.dispose();
    this.collision.dispose();
    this.sceneManager?.dispose();
  }
}
