import * as THREE from 'three';
import { VehicleTemplate } from '../core/AssetManager';
import { getLaneCenterX, HIGHWAY_CONSTANTS, TrafficDirection } from '../systems/GameConfig';
import { TrafficVehicle } from './TrafficVehicle';

export class TrafficManager {
  public readonly group = new THREE.Group();
  private pool: TrafficVehicle[] = [];
  private activeVehicles: TrafficVehicle[] = [];
  private densityMultiplier = 1.0;
  private trafficMode: TrafficDirection = 'oneway';
  private nightMode = false;

  constructor(templates: VehicleTemplate[], lowMem = false) {
    this.group.name = 'TrafficManager';
    // Cap pool size on 500MB RAM mode while keeping vehicle variety high
    const poolSize = lowMem ? Math.min(20, templates.length) : Math.max(28, templates.length);
    for (let i = 0; i < poolSize; i++) {
      const tpl = templates[i % templates.length];
      const vehicle = new TrafficVehicle(tpl);
      this.pool.push(vehicle);
      this.group.add(vehicle.mesh);
    }
  }

  setDensity(multiplier: number): void {
    this.densityMultiplier = THREE.MathUtils.clamp(multiplier, 0.5, 1.6);
  }

  setTrafficMode(mode: TrafficDirection): void {
    this.trafficMode = mode;
  }

  setNightMode(night: boolean): void {
    this.nightMode = night;
  }

  reset(playerZ: number): void {
    for (const v of this.pool) {
      v.despawn();
    }
    this.activeVehicles.length = 0;

    const initialCount = Math.round((this.pool.length <= 20 ? 10 : 14) * this.densityMultiplier);
    for (let i = 0; i < initialCount; i++) {
      this.trySpawnAhead(playerZ, 58 + i * 24 + Math.random() * 14);
    }
  }

  honkAlert(playerX: number, playerZ: number): void {
    // Cars directly ahead in the player's lane try to yield safely if adjacent same-way lane is open
    for (const v of this.activeVehicles) {
      if (v.isOncoming) continue;
      const dz = playerZ - v.z; // positive = vehicle is ahead (-Z)
      if (dz > 6 && dz < 42 && Math.abs(v.x - playerX) < 1.9 && v.laneChangeCooldown <= 0) {
        const minLane = this.trafficMode === 'twoway' ? 2 : 0;
        const dirs = Math.random() < 0.5 ? [1, -1] : [-1, 1];
        for (const d of dirs) {
          const nextLane = v.lane + d;
          if (nextLane < minLane || nextLane >= HIGHWAY_CONSTANTS.LANE_COUNT) continue;
          if (this.isLaneClearForChange(v, nextLane)) {
            v.targetLane = nextLane;
            v.laneChangeCooldown = 3.5;
            break;
          }
        }
      }
    }
  }

  private trySpawnAhead(playerZ: number, aheadDist: number): boolean {
    const candidate = this.pool.find((v) => !v.active);
    if (!candidate) return false;

    const z = playerZ - aheadDist;
    const laneOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    for (const lane of laneOrder) {
      const isOncoming = this.trafficMode === 'twoway' && lane < 2;
      let safe = true;
      for (const other of this.activeVehicles) {
        if (other.lane === lane || other.targetLane === lane) {
          const minGap = (candidate.length + other.length) * 0.5 + (isOncoming ? 22 : 16);
          if (Math.abs(other.z - z) < minGap) {
            safe = false;
            break;
          }
        }
      }
      if (safe) {
        const laneBase = isOncoming ? 18 + lane * 2.5 : 17 + (3 - lane) * 3.8;
        const speedOffset =
          candidate.category === 'truck' ? -5.0 : candidate.category === 'van' ? -2.0 : Math.random() * 4.2;
        const speedMs = THREE.MathUtils.clamp(laneBase + speedOffset, 13, 32);
        candidate.spawn(lane, z, speedMs, isOncoming, this.nightMode);
        this.activeVehicles.push(candidate);
        return true;
      }
    }
    return false;
  }

  update(playerZ: number, distanceM: number, dt: number): void {
    const baseTarget = this.pool.length <= 20 ? 10 : 13;
    const targetActive = Math.min(
      this.pool.length - 1,
      Math.round((baseTarget + Math.min(8, distanceM / 450)) * this.densityMultiplier)
    );

    // Despawn vehicles that fall behind camera (+Z)
    for (let i = this.activeVehicles.length - 1; i >= 0; i--) {
      const v = this.activeVehicles[i];
      if (v.z > playerZ + 22) {
        v.despawn();
        this.activeVehicles.splice(i, 1);
      }
    }

    // Spawn new traffic ahead (-Z)
    let attempts = 0;
    while (this.activeVehicles.length < targetActive && attempts < 8) {
      attempts++;
      const spawnDist = this.trafficMode === 'twoway' ? 210 + Math.random() * 140 : 185 + Math.random() * 130;
      this.trySpawnAhead(playerZ, spawnDist);
    }

    // Highway AI: maintain headway & signal lane changes
    for (let i = 0; i < this.activeVehicles.length; i++) {
      const v = this.activeVehicles[i];
      let aheadDist = Infinity;
      let aheadVehicle: TrafficVehicle | null = null;

      for (let j = 0; j < this.activeVehicles.length; j++) {
        if (i === j) continue;
        const other = this.activeVehicles[j];
        if (other.isOncoming !== v.isOncoming) continue;
        if (other.lane === v.targetLane || other.targetLane === v.targetLane) {
          // Oncoming moves +Z (ahead has larger z), same-way moves -Z (ahead has smaller z)
          const rawGap = v.isOncoming ? other.z - v.z : v.z - other.z;
          const gap = rawGap - (v.length + other.length) * 0.5;
          if (gap > -2 && gap < aheadDist) {
            aheadDist = gap;
            aheadVehicle = other;
          }
        }
      }

      if (aheadVehicle && aheadDist < 18) {
        v.braking = true;
        const matchSpeed = Math.max(10, aheadVehicle.speedMs - (aheadDist < 8 ? 3.5 : 0.5));
        v.speedMs = THREE.MathUtils.damp(v.speedMs, matchSpeed, 4.5, dt);

        if (!v.isOncoming && v.laneChangeCooldown <= 0 && v.z < playerZ - 38 && Math.random() < 0.04) {
          const minLane = this.trafficMode === 'twoway' ? 2 : 0;
          const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
          for (const d of dirs) {
            const nextLane = v.lane + d;
            if (nextLane < minLane || nextLane >= HIGHWAY_CONSTANTS.LANE_COUNT) continue;
            if (this.isLaneClearForChange(v, nextLane)) {
              v.targetLane = nextLane;
              v.laneChangeCooldown = 4.0;
              break;
            }
          }
        }
      } else {
        v.braking = false;
        v.speedMs = THREE.MathUtils.damp(v.speedMs, v.baseSpeedMs, 2.0, dt);
      }

      v.update(dt, this.nightMode);
    }

    // Also keep center divider spawn check clean for oncoming vs same-way
    void getLaneCenterX;
  }

  private isLaneClearForChange(mover: TrafficVehicle, lane: number): boolean {
    for (const other of this.activeVehicles) {
      if (other === mover) continue;
      if (other.lane === lane || other.targetLane === lane) {
        const minClear = (mover.length + other.length) * 0.5 + 11;
        if (Math.abs(other.z - mover.z) < minClear) {
          return false;
        }
      }
    }
    return true;
  }

  getDraftingVehicle(playerX: number, playerZ: number): TrafficVehicle | null {
    for (const v of this.activeVehicles) {
      if (v.isOncoming) continue;
      const dz = playerZ - v.z; // positive when vehicle is ahead (-Z)
      const halfL = v.length * 0.5;
      if (dz > halfL + 2.5 && dz < halfL + 23 && Math.abs(v.x - playerX) < 1.35) {
        return v;
      }
    }
    return null;
  }

  getActiveVehicles(): readonly TrafficVehicle[] {
    return this.activeVehicles;
  }
}
