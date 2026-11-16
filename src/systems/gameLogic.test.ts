import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBikeSpec,
  createInitialPhysicsState,
  stepMotorcyclePhysics,
} from './MotorcyclePhysics';
import {
  applyCollisionPenalty,
  COMBO_DURATION_SEC,
  createInitialScoringState,
  registerNearMiss,
  registerOvertake,
  registerSlipstreamPass,
  updateDistanceAndSpeedScore,
} from './ScoringSystem';
import { CAREER_MISSIONS, evaluateMissionProgress } from './MissionSystem';
import { createDefaultSaveData, getUpgradeCost, sanitizeSaveData } from './SaveSystem';

test('motorcycle physics accelerates progressively and obeys maxSpeed cap', () => {
  const spec = computeBikeSpec({ engine: 0, brakes: 0, handling: 0 });
  const state = createInitialPhysicsState();
  const initialSpeed = state.speedMs;

  for (let i = 0; i < 60; i++) {
    stepMotorcyclePhysics(
      state,
      { throttle: true, brake: false, steerLeft: false, steerRight: false, sensitivity: 1 },
      spec,
      0.016
    );
  }
  assert.ok(state.speedMs > initialSpeed, 'bike should accelerate when throttle is held');
  assert.ok(state.z < 0, 'bike should advance forward along -Z');

  // Long run should cap at maxSpeedMs
  for (let i = 0; i < 1200; i++) {
    stepMotorcyclePhysics(
      state,
      { throttle: true, brake: false, steerLeft: false, steerRight: false, sensitivity: 1 },
      spec,
      0.05
    );
  }
  assert.ok(state.speedMs <= spec.maxSpeedMs + 0.001);

  // Wheelie lift above 50 km/h raises pitchAngle smoothly
  for (let i = 0; i < 20; i++) {
    stepMotorcyclePhysics(
      state,
      { throttle: true, brake: false, steerLeft: false, steerRight: false, wheelie: true, sensitivity: 1 },
      spec,
      0.02
    );
  }
  assert.equal(state.wheelieActive, true);
  assert.ok(state.pitchAngle > 0.08, 'wheelie must pitch front wheel up');
});

test('motorcycle physics brakes, steers, leans, and clamps to road barriers', () => {
  const spec = computeBikeSpec({ engine: 2, brakes: 2, handling: 2 });
  const state = createInitialPhysicsState();
  state.speedMs = 50;

  // Steer right and brake
  for (let i = 0; i < 20; i++) {
    stepMotorcyclePhysics(
      state,
      { throttle: false, brake: true, steerLeft: false, steerRight: true, sensitivity: 1 },
      spec,
      0.02
    );
  }
  assert.ok(state.speedMs < 50, 'braking must slow motorcycle');
  assert.ok(state.x > -1.85, 'steering right must move +X');
  assert.ok(state.leanAngle < 0, 'steering right must lean right (negative Z roll)');

  // Force against right barrier
  state.speedMs = 40;
  for (let i = 0; i < 200; i++) {
    stepMotorcyclePhysics(
      state,
      { throttle: true, brake: false, steerLeft: false, steerRight: true, sensitivity: 1 },
      spec,
      0.03
    );
  }
  assert.ok(state.x <= 7.1 + 1e-6, 'bike must stay within highway barrier bounds');
});

test('scoring system tracks distance, overtakes, near-miss combos, and collision reset', () => {
  const scoring = createInitialScoringState();
  updateDistanceAndSpeedScore(scoring, 45, 1.0); // 162 km/h for 1s
  assert.equal(Math.round(scoring.distanceM), 45);
  assert.ok(scoring.score > 0);
  assert.ok(scoring.cashEarned > 0);

  const ot = registerOvertake(scoring, 140);
  assert.equal(scoring.overtakes, 1);
  assert.ok(ot.points > 0 && ot.cash > 0);

  const nm1 = registerNearMiss(scoring, 160, false);
  const nm2 = registerNearMiss(scoring, 160, false);
  const nmOncoming = registerNearMiss(scoring, 160, true);
  assert.equal(nm1.combo, 1);
  assert.equal(nm2.combo, 2);
  assert.equal(nmOncoming.combo, 3);
  assert.equal(scoring.maxCombo, 3);
  assert.equal(scoring.comboTimer, COMBO_DURATION_SEC);
  assert.ok(nm2.cash > nm1.cash, 'combo should scale cash rewards');
  assert.ok(nmOncoming.cash > nm2.cash, 'oncoming near miss should award bonus multiplier');

  const beforeSlip = scoring.cashEarned;
  const slip = registerSlipstreamPass(scoring);
  assert.ok(slip.cash > 0 && scoring.cashEarned > beforeSlip);

  const beforeWheelie = scoring.score;
  updateDistanceAndSpeedScore(scoring, 40, 1.0, false, true);
  assert.ok(scoring.score > beforeWheelie && scoring.wheelieTimeSec > 0);

  applyCollisionPenalty(scoring);
  assert.equal(scoring.comboCount, 0);
  assert.equal(scoring.maxCombo, 3, 'maxCombo should persist after collision reset');
});

test('career missions evaluate completion and time-out failure accurately', () => {
  const m1 = CAREER_MISSIONS[0];
  const scoring = createInitialScoringState();
  scoring.distanceM = 450;
  let status = evaluateMissionProgress(m1, scoring, 0, 15);
  assert.equal(status.completed, false);
  assert.equal(status.failed, false);
  assert.equal(status.ratio, 0.5);

  scoring.distanceM = m1.targetValue;
  status = evaluateMissionProgress(m1, scoring, 0, 20);
  assert.equal(status.completed, true);
  assert.equal(status.failed, false);

  scoring.distanceM = 200;
  status = evaluateMissionProgress(m1, scoring, 0, m1.timeLimitSec + 0.5);
  assert.equal(status.completed, false);
  assert.equal(status.failed, true);
});

test('save sanitization preserves bounds and upgrade pricing scales properly', () => {
  const def = createDefaultSaveData();
  const sanitized = sanitizeSaveData({
    money: -500,
    upgrades: { engine: 99, brakes: 2, handling: 'bad' },
    settings: { graphicsQuality: 'ultra', environmentTheme: 'invalid', audioVolume: 5 },
  });
  assert.equal(sanitized.money, 0);
  assert.equal(sanitized.upgrades.engine, 5);
  assert.equal(sanitized.upgrades.brakes, 2);
  assert.equal(sanitized.upgrades.handling, 0);
  assert.equal(sanitized.settings.graphicsQuality, def.settings.graphicsQuality);
  assert.equal(sanitized.settings.environmentTheme, def.settings.environmentTheme);
  assert.equal(sanitized.settings.audioVolume, 1);
  assert.ok(getUpgradeCost('engine', 1) > getUpgradeCost('engine', 0));
});
