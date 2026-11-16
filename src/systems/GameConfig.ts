export type GameState = 'loading' | 'title' | 'playing' | 'paused' | 'gameover';
export type GameMode = 'career' | 'endless';
export type TrafficDirection = 'oneway' | 'twoway';
export type EnvironmentTheme = 'day' | 'sunset' | 'night';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type TouchLayout = 'standard' | 'swapped';
export type TouchVisibility = 'auto' | 'always' | 'off';

export interface UpgradeLevels {
  engine: number; // 0..5
  brakes: number; // 0..5
  handling: number; // 0..5
}

export interface BikePaintOption {
  id: string;
  name: string;
  hex: string;
  accentHex: string;
  price: number;
}

export const BIKE_PAINTS: BikePaintOption[] = [
  { id: 'motorsport_white', name: 'M Motorsport White', hex: '#f4f4f5', accentHex: '#2563eb', price: 0 },
  { id: 'racing_red', name: 'Racing Red', hex: '#dc2626', accentHex: '#18181b', price: 1200 },
  { id: 'obsidian_carbon', name: 'Black Storm Metallic', hex: '#18181b', accentHex: '#e11d48', price: 2400 },
  { id: 'cyan_apex', name: 'Apex Cyan', hex: '#0284c7', accentHex: '#facc15', price: 3200 },
  { id: 'acid_yellow', name: 'Sao Paulo Yellow', hex: '#eab308', accentHex: '#18181b', price: 4500 },
];

export interface SettingsData {
  graphicsQuality: GraphicsQuality;
  environmentTheme: EnvironmentTheme;
  audioVolume: number; // 0..1
  muted: boolean;
  steeringSensitivity: number; // 0.6..1.6
  touchLayout: TouchLayout;
  touchVisibility: TouchVisibility;
  cameraEffects: boolean;
  fpsCap: 30 | 60;
}

export function detectConstrainedDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) {
    return true;
  }
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 8;
  const hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  if (hasTouch && cores <= 4) {
    return true;
  }
  return false;
}

export const DEFAULT_SETTINGS: SettingsData = {
  graphicsQuality: detectConstrainedDevice() ? 'low' : 'medium',
  environmentTheme: 'sunset',
  audioVolume: 0.75,
  muted: false,
  steeringSensitivity: 1.0,
  touchLayout: 'standard',
  touchVisibility: 'always',
  cameraEffects: true,
  fpsCap: 60,
};

export interface PlayerSaveData {
  money: number;
  highScore: number;
  bestDistanceM: number;
  totalOvertakes: number;
  highestUnlockedMission: number;
  completedMissionIds: number[];
  upgrades: UpgradeLevels;
  selectedPaintId: string;
  ownedPaintIds: string[];
  settings: SettingsData;
}

export interface CareerMission {
  id: number;
  title: string;
  type: 'distance' | 'overtake' | 'time_trial' | 'speed_endurance';
  description: string;
  targetValue: number;
  timeLimitSec: number; // 0 = no time limit
  minSpeedKmh?: number;
  rewardMoney: number;
  trafficDensity: number; // 0.5..1.5
  trafficMode?: TrafficDirection;
  theme?: EnvironmentTheme;
}

export interface HUDState {
  speedKmh: number;
  rpmRatio: number; // 0..1
  gear: number; // 1..6
  distanceM: number;
  score: number;
  runMoney: number;
  overtakes: number;
  nearMisses: number;
  comboCount: number;
  comboTimer01: number; // 0..1
  timeRemainingSec: number;
  elapsedSec: number;
  missionProgress: number; // 0..1
  missionLabel: string;
  eventBanner: string | null;
  eventBannerId: number;
  crashFlash: number; // 0..1
  nearMissFlash: number; // 0..1
  wrongWayActive: boolean;
  wheelieActive: boolean;
  slipstreamRatio: number; // 0..1
}

export interface RunSnapshot {
  mode: GameMode;
  trafficMode: TrafficDirection;
  mission: CareerMission | null;
  victory: boolean;
  reason: string;
  score: number;
  highScore: number;
  isNewBest: boolean;
  distanceM: number;
  overtakes: number;
  nearMisses: number;
  maxCombo: number;
  topSpeedKmh: number;
  cashEarned: number;
  missionBonus: number;
  totalCashAfter: number;
}

export const HIGHWAY_CONSTANTS = {
  LANE_COUNT: 4,
  LANE_WIDTH: 3.7,
  ROAD_WIDTH: 16.0, // 4 * 3.7 = 14.8 + shoulders
  HALF_ROAD_BOUND: 7.1, // lateral limit before barrier
  SEGMENT_LENGTH: 80,
  SEGMENT_COUNT: 9,
} as const;

export function getLaneCenterX(laneIndex: number): number {
  // Lanes 0..3 centered symmetrically around X=0: -5.55, -1.85, +1.85, +5.55
  return (laneIndex - (HIGHWAY_CONSTANTS.LANE_COUNT - 1) / 2) * HIGHWAY_CONSTANTS.LANE_WIDTH;
}
