import * as THREE from 'three';
import { LoadedCityAsset } from '../core/AssetManager';
import { EnvironmentTheme, TrafficDirection } from '../systems/GameConfig';
import { CityEnvironment } from './CityEnvironment';
import { RoadGenerator } from './RoadGenerator';

export class World {
  public readonly group = new THREE.Group();
  public readonly road: RoadGenerator;
  public readonly city: CityEnvironment;

  // Pooled speed-streak particles (zero GC allocations per frame)
  private streakMesh: THREE.InstancedMesh;
  private streakPositions: Float32Array;
  private streakCount: number;

  // Pooled impact/scrape spark embers
  private sparkMesh: THREE.InstancedMesh;
  private sparkPos: Float32Array;
  private sparkVel: Float32Array;
  private sparkLife: Float32Array;
  private sparkCount = 24;

  private dummy = new THREE.Object3D();

  constructor(cityAsset: LoadedCityAsset, maxAnisotropy: number, lowMem = false) {
    this.road = new RoadGenerator(maxAnisotropy, lowMem);
    this.city = new CityEnvironment(cityAsset, lowMem);
    this.group.add(this.road.group);
    this.group.add(this.city.group);

    this.streakCount = lowMem ? 22 : 44;
    const streakGeo = new THREE.BoxGeometry(0.025, 0.025, 2.2);
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.streakMesh = new THREE.InstancedMesh(streakGeo, streakMat, this.streakCount);
    this.streakMesh.frustumCulled = false;
    this.streakPositions = new Float32Array(this.streakCount * 3);

    for (let i = 0; i < this.streakCount; i++) {
      this.resetStreak(i, 0, true);
    }
    this.group.add(this.streakMesh);

    // Pooled spark particles for barrier scrapes / near-misses
    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.22);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, this.sparkCount);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.visible = false;
    this.sparkPos = new Float32Array(this.sparkCount * 3);
    this.sparkVel = new Float32Array(this.sparkCount * 3);
    this.sparkLife = new Float32Array(this.sparkCount);
    this.group.add(this.sparkMesh);
  }

  setTheme(theme: EnvironmentTheme): void {
    this.road.setTheme(theme);
    this.city.setTheme(theme);
  }

  setTrafficMode(mode: TrafficDirection): void {
    this.road.setTrafficMode(mode);
  }

  emitSparks(x: number, y: number, z: number, count = 14): void {
    let spawned = 0;
    for (let i = 0; i < this.sparkCount && spawned < count; i++) {
      if (this.sparkLife[i] <= 0) {
        const idx = i * 3;
        this.sparkPos[idx] = x;
        this.sparkPos[idx + 1] = y;
        this.sparkPos[idx + 2] = z;
        this.sparkVel[idx] = (Math.random() - 0.5) * 6.5;
        this.sparkVel[idx + 1] = 1.5 + Math.random() * 4.5;
        this.sparkVel[idx + 2] = 6 + Math.random() * 10;
        this.sparkLife[i] = 0.28 + Math.random() * 0.24;
        spawned++;
      }
    }
    this.sparkMesh.visible = true;
  }

  private resetStreak(index: number, playerZ: number, randomSpread = false): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (2.5 + Math.random() * 6.5);
    const y = 0.6 + Math.random() * 2.8;
    const z = playerZ - (randomSpread ? Math.random() * 90 : 65 + Math.random() * 35);
    this.streakPositions[index * 3] = x;
    this.streakPositions[index * 3 + 1] = y;
    this.streakPositions[index * 3 + 2] = z;
  }

  update(playerZ: number, speedMs: number, dt: number): void {
    this.road.update(playerZ);
    this.city.update(playerZ);

    // Update speed streaks
    const speedAlpha = THREE.MathUtils.clamp((speedMs - 22) / 55, 0, 1);
    const mat = this.streakMesh.material as THREE.MeshBasicMaterial;
    mat.opacity = speedAlpha * 0.34;
    this.streakMesh.visible = speedAlpha > 0.04;

    if (this.streakMesh.visible) {
      const stretchZ = 0.7 + speedAlpha * 2.8;
      for (let i = 0; i < this.streakCount; i++) {
        const idx = i * 3;
        this.streakPositions[idx + 2] += speedMs * 0.12 * dt;
        if (this.streakPositions[idx + 2] > playerZ + 4) {
          this.resetStreak(i, playerZ, false);
        }
        this.dummy.position.set(
          this.streakPositions[idx],
          this.streakPositions[idx + 1],
          this.streakPositions[idx + 2]
        );
        this.dummy.scale.set(1, 1, stretchZ);
        this.dummy.updateMatrix();
        this.streakMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.streakMesh.instanceMatrix.needsUpdate = true;
    }

    // Update pooled spark particles
    if (this.sparkMesh.visible) {
      let anyAlive = false;
      for (let i = 0; i < this.sparkCount; i++) {
        if (this.sparkLife[i] > 0) {
          anyAlive = true;
          this.sparkLife[i] -= dt;
          const idx = i * 3;
          this.sparkVel[idx + 1] -= 14 * dt;
          this.sparkPos[idx] += this.sparkVel[idx] * dt;
          this.sparkPos[idx + 1] = Math.max(0.05, this.sparkPos[idx + 1] + this.sparkVel[idx + 1] * dt);
          this.sparkPos[idx + 2] += this.sparkVel[idx + 2] * dt;
          const s = Math.max(0.01, this.sparkLife[i] * 2.4);
          this.dummy.position.set(this.sparkPos[idx], this.sparkPos[idx + 1], this.sparkPos[idx + 2]);
          this.dummy.scale.set(s, s, s);
        } else {
          this.dummy.position.set(0, -50, 0);
          this.dummy.scale.set(0.001, 0.001, 0.001);
        }
        this.dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (!anyAlive) {
        this.sparkMesh.visible = false;
      }
    }
  }

  dispose(): void {
    this.road.dispose();
    this.city.dispose();
    this.streakMesh.geometry.dispose();
    (this.streakMesh.material as THREE.Material).dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
  }
}
