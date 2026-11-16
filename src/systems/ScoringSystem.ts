export interface ScoringState {
  score: number;
  distanceM: number;
  overtakes: number;
  nearMisses: number;
  comboCount: number;
  maxCombo: number;
  comboTimer: number;
  cashEarned: number;
  topSpeedKmh: number;
  highSpeedTimeSec: number;
  wrongWayTimeSec: number;
  wheelieTimeSec: number;
}

export const COMBO_DURATION_SEC = 3.8;

export function createInitialScoringState(): ScoringState {
  return {
    score: 0,
    distanceM: 0,
    overtakes: 0,
    nearMisses: 0,
    comboCount: 0,
    maxCombo: 0,
    comboTimer: 0,
    cashEarned: 0,
    topSpeedKmh: 0,
    highSpeedTimeSec: 0,
    wrongWayTimeSec: 0,
    wheelieTimeSec: 0,
  };
}

export function updateDistanceAndSpeedScore(
  scoring: ScoringState,
  speedMs: number,
  dt: number,
  wrongWayActive = false,
  wheelieActive = false
): void {
  const speedKmh = speedMs * 3.6;
  if (speedKmh > scoring.topSpeedKmh) {
    scoring.topSpeedKmh = speedKmh;
  }

  const distDelta = speedMs * dt;
  scoring.distanceM += distDelta;

  const highSpeedMult = speedKmh >= 100 ? 1 + (speedKmh - 100) / 80 : 0.5;
  const wrongWayMult = wrongWayActive && speedKmh >= 95 ? 1.85 : 1.0;
  const wheelieMult = wheelieActive && speedKmh >= 60 ? 1.45 : 1.0;
  scoring.score += distDelta * 1.4 * highSpeedMult * wrongWayMult * wheelieMult;

  if (speedKmh >= 120) {
    scoring.highSpeedTimeSec += dt;
    scoring.cashEarned += dt * 4.5 * (speedKmh / 150);
  }

  if (wrongWayActive && speedKmh >= 95) {
    scoring.wrongWayTimeSec += dt;
    scoring.cashEarned += dt * 7.5 * (speedKmh / 150);
  }

  if (wheelieActive && speedKmh >= 60) {
    scoring.wheelieTimeSec += dt;
    scoring.cashEarned += dt * 6.5 * (speedKmh / 130);
  }

  if (scoring.comboTimer > 0) {
    scoring.comboTimer = Math.max(0, scoring.comboTimer - dt);
    if (scoring.comboTimer === 0) {
      scoring.comboCount = 0;
    }
  }
}

export function registerOvertake(
  scoring: ScoringState,
  speedKmh: number,
  isOncoming = false
): { points: number; cash: number } {
  scoring.overtakes += 1;
  const mult = isOncoming ? 1.6 : 1.0;
  const points = Math.round((45 + Math.max(0, speedKmh - 60) * 0.5) * mult);
  const cash = Math.round(12 * mult);
  scoring.score += points;
  scoring.cashEarned += cash;
  return { points, cash };
}

export function registerNearMiss(
  scoring: ScoringState,
  speedKmh: number,
  isOncoming = false
): {
  points: number;
  cash: number;
  combo: number;
} {
  scoring.nearMisses += 1;
  scoring.comboCount += 1;
  if (scoring.comboCount > scoring.maxCombo) {
    scoring.maxCombo = scoring.comboCount;
  }
  scoring.comboTimer = COMBO_DURATION_SEC;

  const comboMult = Math.min(6, scoring.comboCount);
  const speedBonus = speedKmh >= 150 ? 1.5 : 1.0;
  const oncomingBonus = isOncoming ? 1.75 : 1.0;
  const points = Math.round(120 * comboMult * speedBonus * oncomingBonus);
  const cash = Math.round(35 * comboMult * oncomingBonus);

  scoring.score += points;
  scoring.cashEarned += cash;
  return { points, cash, combo: scoring.comboCount };
}

export function registerSlipstreamPass(scoring: ScoringState): { points: number; cash: number } {
  const points = 160;
  const cash = 55;
  scoring.score += points;
  scoring.cashEarned += cash;
  return { points, cash };
}

export function applyCollisionPenalty(scoring: ScoringState): void {
  scoring.comboCount = 0;
  scoring.comboTimer = 0;
}
