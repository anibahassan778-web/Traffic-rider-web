import { HIGHWAY_CONSTANTS, UpgradeLevels } from './GameConfig';

export interface BikeSpec {
  maxSpeedMs: number; // ~83 m/s = 300 km/h
  accelBase: number;
  brakeDecel: number;
  coastDecel: number;
  steerSpeed: number;
  maxLeanRad: number;
}

export interface BikePhysicsState {
  x: number;
  z: number; // advances in negative Z direction (forward = -Z)
  speedMs: number;
  lateralVel: number;
  steerInputSmoothed: number;
  leanAngle: number; // radians, negative = leaning right, positive = leaning left
  pitchAngle: number; // positive = wheelie/accel, negative = brake dive
  gear: number; // 1..6
  rpmRatio: number; // 0..1
  wheelRotationRad: number;
  crashCooldown: number;
  hitBarrier: boolean;
  wheelieActive: boolean;
  boostTimer: number;
}

export interface BikeControlInput {
  throttle: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  wheelie?: boolean;
  draftBoost?: number; // 0..1
  sensitivity: number;
}

export function computeBikeSpec(upgrades: UpgradeLevels): BikeSpec {
  const engineBonus = Math.max(0, Math.min(5, upgrades.engine));
  const brakeBonus = Math.max(0, Math.min(5, upgrades.brakes));
  const handlingBonus = Math.max(0, Math.min(5, upgrades.handling));

  return {
    // Stock BMW S1000RR ~295 km/h (82 m/s), upgraded up to ~340 km/h (94.5 m/s)
    maxSpeedMs: 82 + engineBonus * 2.5,
    accelBase: 23 + engineBonus * 2.1,
    brakeDecel: 34 + brakeBonus * 3.5,
    coastDecel: 4.5,
    steerSpeed: 7.4 + handlingBonus * 0.75,
    maxLeanRad: 0.44 + handlingBonus * 0.015,
  };
}

export function createInitialPhysicsState(): BikePhysicsState {
  return {
    x: -1.85,
    z: 0,
    speedMs: 14,
    lateralVel: 0,
    steerInputSmoothed: 0,
    leanAngle: 0,
    pitchAngle: 0,
    gear: 2,
    rpmRatio: 0.35,
    wheelRotationRad: 0,
    crashCooldown: 0,
    hitBarrier: false,
    wheelieActive: false,
    boostTimer: 0,
  };
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

const GEAR_SPEED_THRESHOLDS_MS = [0, 22, 36, 50, 64, 77, 105];

export function stepMotorcyclePhysics(
  state: BikePhysicsState,
  input: BikeControlInput,
  spec: BikeSpec,
  dt: number
): BikePhysicsState {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  state.hitBarrier = false;

  if (state.crashCooldown > 0) {
    state.crashCooldown = Math.max(0, state.crashCooldown - clampedDt);
  }
  if (state.boostTimer > 0) {
    state.boostTimer = Math.max(0, state.boostTimer - clampedDt);
  }

  // Wheelie requires >= 50 km/h (~14 m/s), not braking, and modest lean angle
  const canWheelie = Boolean(input.wheelie) && !input.brake && state.speedMs >= 14;
  state.wheelieActive = canWheelie;

  const boostMult = state.boostTimer > 0 ? 1.07 : 1.0;
  const draftRatio = Math.max(0, Math.min(1, input.draftBoost ?? 0));
  const effectiveMaxSpeed = spec.maxSpeedMs * boostMult * (1 + draftRatio * 0.05);

  const speedRatio = Math.min(1, state.speedMs / effectiveMaxSpeed);
  let longAccel = 0;

  if ((input.throttle || canWheelie) && !input.brake) {
    const torqueFactor = 1.05 - 0.62 * Math.pow(speedRatio, 1.35);
    const wheelieBonus = canWheelie ? 1.12 : 1.0;
    const slipstreamBonus = 1 + draftRatio * 0.16 + (state.boostTimer > 0 ? 0.18 : 0);
    longAccel = spec.accelBase * Math.max(0.18, torqueFactor) * wheelieBonus * slipstreamBonus;
  } else if (input.brake) {
    longAccel = -spec.brakeDecel;
  } else {
    longAccel = -(spec.coastDecel + 0.0028 * state.speedMs * state.speedMs);
  }

  state.speedMs = Math.max(0, Math.min(effectiveMaxSpeed, state.speedMs + longAccel * clampedDt));

  const rawSteer = (input.steerLeft ? -1 : 0) + (input.steerRight ? 1 : 0);
  const steerResponsiveness = 9.0 * input.sensitivity;
  state.steerInputSmoothed = damp(state.steerInputSmoothed, rawSteer, steerResponsiveness, clampedDt);

  const minRollFactor = state.speedMs < 2 ? state.speedMs / 2 : 1;
  const highSpeedStability = 1 - 0.25 * speedRatio;
  const wheelieSteerTrim = canWheelie ? 0.82 : 1.0;
  const targetLatVel =
    state.steerInputSmoothed *
    spec.steerSpeed *
    input.sensitivity *
    minRollFactor *
    highSpeedStability *
    wheelieSteerTrim;

  state.lateralVel = damp(state.lateralVel, targetLatVel, 10.5, clampedDt);

  state.x += state.lateralVel * clampedDt;
  state.z -= state.speedMs * clampedDt;

  // Barrier containment
  const maxX = HIGHWAY_CONSTANTS.HALF_ROAD_BOUND;
  if (state.x < -maxX) {
    state.x = -maxX;
    if (state.lateralVel < -0.8) {
      state.hitBarrier = true;
      state.speedMs *= 0.86;
      state.wheelieActive = false;
    }
    state.lateralVel = Math.max(0, -state.lateralVel * 0.25);
  } else if (state.x > maxX) {
    state.x = maxX;
    if (state.lateralVel > 0.8) {
      state.hitBarrier = true;
      state.speedMs *= 0.86;
      state.wheelieActive = false;
    }
    state.lateralVel = Math.min(0, -state.lateralVel * 0.25);
  }

  const normalizedLat = state.lateralVel / Math.max(1, spec.steerSpeed);
  const targetLean = -normalizedLat * spec.maxLeanRad * (0.45 + 0.55 * minRollFactor);
  state.leanAngle = damp(state.leanAngle, targetLean, 9.5, clampedDt);

  // Pitch: pronounced nose-up for wheelies, subtle squat on accel, dive under braking
  let targetPitch = 0;
  if (state.wheelieActive) {
    targetPitch = 0.165;
  } else if (input.throttle && state.speedMs > 5 && state.speedMs < effectiveMaxSpeed * 0.9) {
    targetPitch = 0.032 * (1 - speedRatio * 0.5);
  } else if (input.brake && state.speedMs > 4) {
    targetPitch = -0.048;
  }
  state.pitchAngle = damp(state.pitchAngle, targetPitch, state.wheelieActive ? 6.2 : 8.0, clampedDt);

  // 6-speed gearbox & RPM simulation
  let gear = 1;
  for (let g = 1; g <= 6; g++) {
    if (state.speedMs >= GEAR_SPEED_THRESHOLDS_MS[g - 1]) {
      gear = g;
    }
  }
  state.gear = gear;
  const lowBound = gear === 1 ? 0 : GEAR_SPEED_THRESHOLDS_MS[gear - 1] * 0.72;
  const highBound = GEAR_SPEED_THRESHOLDS_MS[gear];
  const rawRpm = (state.speedMs - lowBound) / Math.max(1, highBound - lowBound);
  const idleFloor = input.throttle || state.wheelieActive ? 0.28 : 0.14;
  state.rpmRatio = Math.max(idleFloor, Math.min(0.99, rawRpm));

  state.wheelRotationRad = (state.wheelRotationRad + (state.speedMs / 0.31) * clampedDt) % (Math.PI * 2);

  return state;
}
