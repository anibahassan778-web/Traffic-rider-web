import RAPIER from '@dimforge/rapier3d-compat';
import { TrafficVehicle } from '../traffic/TrafficVehicle';

export interface CollisionCheckResult {
  crashed: boolean;
  hitVehicle: TrafficVehicle | null;
  nearMisses: TrafficVehicle[];
  overtakes: TrafficVehicle[];
}

export class CollisionSystem {
  private world: RAPIER.World | null = null;
  private playerBody: RAPIER.RigidBody | null = null;
  private playerCollider: RAPIER.Collider | null = null;
  private npcBodies = new Map<TrafficVehicle, { body: RAPIER.RigidBody; collider: RAPIER.Collider }>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    const playerDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.7, 0);
    this.playerBody = this.world.createRigidBody(playerDesc);

    const playerColDesc = RAPIER.ColliderDesc.cuboid(0.32, 0.55, 0.96)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.playerCollider = this.world.createCollider(playerColDesc, this.playerBody);
    this.initialized = true;
  }

  private ensureNpcBody(vehicle: TrafficVehicle): RAPIER.Collider | null {
    if (!this.world) return null;
    const existing = this.npcBodies.get(vehicle);
    if (existing) {
      existing.body.setNextKinematicTranslation({
        x: vehicle.x,
        y: vehicle.height * 0.5,
        z: vehicle.z,
      });
      return existing.collider;
    }

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      vehicle.x,
      vehicle.height * 0.5,
      vehicle.z
    );
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.65, vehicle.width * 0.44),
      Math.max(0.5, vehicle.height * 0.45),
      Math.max(1.5, vehicle.length * 0.46)
    );
    const collider = this.world.createCollider(colDesc, body);
    this.npcBodies.set(vehicle, { body, collider });
    return collider;
  }

  stepAndEvaluate(
    playerX: number,
    playerZ: number,
    prevPlayerZ: number,
    playerSpeedMs: number,
    vehicles: readonly TrafficVehicle[]
  ): CollisionCheckResult {
    const result: CollisionCheckResult = {
      crashed: false,
      hitVehicle: null,
      nearMisses: [],
      overtakes: [],
    };

    if (this.initialized && this.world && this.playerBody) {
      this.playerBody.setNextKinematicTranslation({ x: playerX, y: 0.7, z: playerZ });
      for (const v of vehicles) {
        if (v.active) {
          this.ensureNpcBody(v);
        } else {
          const entry = this.npcBodies.get(v);
          if (entry) {
            entry.body.setNextKinematicTranslation({ x: 0, y: -50, z: 99999 });
          }
        }
      }
      this.world.step();
    }

    const bikeHalfW = 0.34;
    const bikeHalfL = 0.96;

    for (const v of vehicles) {
      if (!v.active) continue;

      const vHalfW = v.width * 0.44;
      const vHalfL = v.length * 0.46;

      // Swept Z overlap test along [playerZ, prevPlayerZ] combined with Rapier intersection check
      const minSweepZ = Math.min(playerZ, prevPlayerZ) - bikeHalfL;
      const maxSweepZ = Math.max(playerZ, prevPlayerZ) + bikeHalfL;
      const zOverlap = maxSweepZ >= v.z - vHalfL && minSweepZ <= v.z + vHalfL;
      const xDist = Math.abs(playerX - v.x);
      const xOverlap = xDist <= bikeHalfW + vHalfW;

      let rapierOverlap = false;
      if (this.initialized && this.world && this.playerCollider) {
        const entry = this.npcBodies.get(v);
        if (entry) {
          rapierOverlap = this.world.intersectionPair(this.playerCollider, entry.collider);
        }
      }

      if ((zOverlap && xOverlap) || rapierOverlap) {
        result.crashed = true;
        result.hitVehicle = v;
        return result;
      }

      // Near-miss corridor check (passing within ~1.3m of vehicle edge at >= 80 km/h)
      const speedKmh = playerSpeedMs * 3.6;
      if (!v.nearMissed && speedKmh >= 80) {
        const zBand = Math.abs(playerZ - v.z) <= vHalfL + bikeHalfL + 0.6;
        const lateralClearance = xDist - (bikeHalfW + vHalfW);
        if (zBand && lateralClearance > 0 && lateralClearance <= 1.3) {
          v.nearMissed = true;
          result.nearMisses.push(v);
        }
      }

      // Overtake / oncoming dodge detection: player passed completely past NPC (-Z is forward)
      if (!v.overtaken && playerZ < v.z - (vHalfL + 1.1)) {
        v.overtaken = true;
        result.overtakes.push(v);
      }
    }

    return result;
  }

  dispose(): void {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.npcBodies.clear();
    this.initialized = false;
  }
}
