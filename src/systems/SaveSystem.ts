import {
  BIKE_PAINTS,
  DEFAULT_SETTINGS,
  PlayerSaveData,
  SettingsData,
  UpgradeLevels,
} from './GameConfig';

const STORAGE_KEY = 'traffic_rider_web_3d_save_v1';

export function createDefaultSaveData(): PlayerSaveData {
  return {
    money: 1200,
    highScore: 0,
    bestDistanceM: 0,
    totalOvertakes: 0,
    highestUnlockedMission: 1,
    completedMissionIds: [],
    upgrades: {
      engine: 0,
      brakes: 0,
      handling: 0,
    },
    selectedPaintId: BIKE_PAINTS[0].id,
    ownedPaintIds: [BIKE_PAINTS[0].id],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function sanitizeSaveData(raw: unknown): PlayerSaveData {
  const def = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;

  const num = (val: unknown, fallback: number, min = 0): number =>
    typeof val === 'number' && Number.isFinite(val) ? Math.max(min, val) : fallback;

  const rawUpgrades = (r.upgrades && typeof r.upgrades === 'object' ? r.upgrades : {}) as Record<string, unknown>;
  const upgrades: UpgradeLevels = {
    engine: Math.min(5, Math.floor(num(rawUpgrades.engine, 0))),
    brakes: Math.min(5, Math.floor(num(rawUpgrades.brakes, 0))),
    handling: Math.min(5, Math.floor(num(rawUpgrades.handling, 0))),
  };

  const rawSettings = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const settings: SettingsData = {
    graphicsQuality:
      rawSettings.graphicsQuality === 'low' ||
      rawSettings.graphicsQuality === 'medium' ||
      rawSettings.graphicsQuality === 'high'
        ? rawSettings.graphicsQuality
        : def.settings.graphicsQuality,
    environmentTheme:
      rawSettings.environmentTheme === 'day' ||
      rawSettings.environmentTheme === 'sunset' ||
      rawSettings.environmentTheme === 'night'
        ? rawSettings.environmentTheme
        : def.settings.environmentTheme,
    audioVolume: Math.min(1, num(rawSettings.audioVolume, def.settings.audioVolume)),
    muted: typeof rawSettings.muted === 'boolean' ? rawSettings.muted : def.settings.muted,
    steeringSensitivity: Math.max(0.5, Math.min(1.8, num(rawSettings.steeringSensitivity, def.settings.steeringSensitivity, 0.5))),
    touchLayout: rawSettings.touchLayout === 'swapped' ? 'swapped' : 'standard',
    touchVisibility:
      rawSettings.touchVisibility === 'auto' ||
      rawSettings.touchVisibility === 'always' ||
      rawSettings.touchVisibility === 'off'
        ? rawSettings.touchVisibility
        : def.settings.touchVisibility,
    cameraEffects:
      typeof rawSettings.cameraEffects === 'boolean' ? rawSettings.cameraEffects : def.settings.cameraEffects,
    fpsCap: rawSettings.fpsCap === 30 ? 30 : 60,
  };

  const ownedPaintIds = Array.isArray(r.ownedPaintIds)
    ? r.ownedPaintIds.filter((x): x is string => typeof x === 'string')
    : [BIKE_PAINTS[0].id];
  if (!ownedPaintIds.includes(BIKE_PAINTS[0].id)) {
    ownedPaintIds.unshift(BIKE_PAINTS[0].id);
  }

  const selectedPaintId =
    typeof r.selectedPaintId === 'string' && ownedPaintIds.includes(r.selectedPaintId)
      ? r.selectedPaintId
      : BIKE_PAINTS[0].id;

  const completedMissionIds = Array.isArray(r.completedMissionIds)
    ? r.completedMissionIds.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
    : [];

  return {
    money: Math.round(num(r.money, def.money)),
    highScore: Math.round(num(r.highScore, def.highScore)),
    bestDistanceM: Math.round(num(r.bestDistanceM, def.bestDistanceM)),
    totalOvertakes: Math.round(num(r.totalOvertakes, def.totalOvertakes)),
    highestUnlockedMission: Math.max(1, Math.floor(num(r.highestUnlockedMission, 1, 1))),
    completedMissionIds,
    upgrades,
    selectedPaintId,
    ownedPaintIds,
    settings,
  };
}

export function getUpgradeCost(category: keyof UpgradeLevels, currentLevel: number): number {
  const base = category === 'engine' ? 700 : category === 'brakes' ? 500 : 600;
  return Math.round(base * Math.pow(1.65, currentLevel));
}

export class SaveSystem {
  private data: PlayerSaveData;

  constructor() {
    this.data = this.load();
  }

  load(): PlayerSaveData {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.data = sanitizeSaveData(JSON.parse(raw));
          return this.data;
        }
      }
    } catch {
      // Ignore storage errors and return defaults
    }
    this.data = createDefaultSaveData();
    return this.data;
  }

  save(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch {
      // Ignore quota/storage errors
    }
  }

  getData(): PlayerSaveData {
    return this.data;
  }

  addMoney(amount: number): void {
    this.data.money = Math.max(0, Math.round(this.data.money + amount));
    this.save();
  }

  recordRunResult(params: {
    score: number;
    distanceM: number;
    overtakes: number;
    cashEarned: number;
    missionCompletedId?: number;
  }): boolean {
    const isNewBest = params.score > this.data.highScore;
    if (isNewBest) {
      this.data.highScore = Math.round(params.score);
    }
    if (params.distanceM > this.data.bestDistanceM) {
      this.data.bestDistanceM = Math.round(params.distanceM);
    }
    this.data.totalOvertakes += params.overtakes;
    this.data.money += Math.round(params.cashEarned);

    if (params.missionCompletedId !== undefined) {
      if (!this.data.completedMissionIds.includes(params.missionCompletedId)) {
        this.data.completedMissionIds.push(params.missionCompletedId);
      }
      if (params.missionCompletedId >= this.data.highestUnlockedMission) {
        this.data.highestUnlockedMission = params.missionCompletedId + 1;
      }
    }

    this.save();
    return isNewBest;
  }

  purchaseUpgrade(category: keyof UpgradeLevels): boolean {
    const level = this.data.upgrades[category];
    if (level >= 5) return false;
    const cost = getUpgradeCost(category, level);
    if (this.data.money < cost) return false;
    this.data.money -= cost;
    this.data.upgrades[category] = level + 1;
    this.save();
    return true;
  }

  selectOrPurchasePaint(paintId: string): boolean {
    const paint = BIKE_PAINTS.find((p) => p.id === paintId);
    if (!paint) return false;
    if (this.data.ownedPaintIds.includes(paintId)) {
      this.data.selectedPaintId = paintId;
      this.save();
      return true;
    }
    if (this.data.money < paint.price) return false;
    this.data.money -= paint.price;
    this.data.ownedPaintIds.push(paintId);
    this.data.selectedPaintId = paintId;
    this.save();
    return true;
  }

  updateSettings(partial: Partial<SettingsData>): void {
    this.data.settings = { ...this.data.settings, ...partial };
    this.save();
  }
}
