import * as THREE from 'three';
import { VehicleTemplate } from '../core/AssetManager';
import { getLaneCenterX } from '../systems/GameConfig';

const SHARED_LIGHT_GEO = new THREE.PlaneGeometry(0.28, 0.14);

export class TrafficVehicle {
  public readonly mesh: THREE.Group;
  public readonly templateId: string;
  public readonly category: 'car' | 'suv' | 'van' | 'truck';
  public readonly width: number;
  public readonly height: number;
  public readonly length: number;

  public active = false;
  public isOncoming = false;
  public lane = 0;
  public targetLane = 0;
  public x = 0;
  public z = 0;
  public baseSpeedMs = 22;
  public speedMs = 22;
  public overtaken = false;
  public nearMissed = false;
  public laneChangeCooldown = 0;
  public braking = false;

  private wheelNodes: THREE.Object3D[] = [];
  private wheelRot = 0;
  private blinkPhase = 0;

  private tailMat: THREE.MeshBasicMaterial;
  private headMat: THREE.MeshBasicMaterial;
  private blinkerLeft: THREE.Mesh;
  private blinkerRight: THREE.Mesh;
  private headlightGroup: THREE.Group;

  constructor(template: VehicleTemplate) {
    this.templateId = template.id;
    this.category = template.category;
    this.width = template.width;
    this.height = template.height;
    this.length = template.length;

    this.mesh = template.prototype.clone(true);
    this.mesh.visible = false;

    this.mesh.traverse((child) => {
      if (child.name.startsWith('arka_teker') || child.name.startsWith('on_teker')) {
        this.wheelNodes.push(child);
      }
    });

    const tailY = Math.min(0.95, Math.max(0.58, this.height * 0.44));
    const tailX = this.width * 0.34;
    const rearZ = this.length * 0.495;
    const frontZ = -this.length * 0.495;

    // Rear taillights / brake lights (visible from +Z behind car)
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
    const tailL = new THREE.Mesh(SHARED_LIGHT_GEO, this.tailMat);
    tailL.position.set(-tailX, tailY, rearZ);
    const tailR = new THREE.Mesh(SHARED_LIGHT_GEO, this.tailMat);
    tailR.position.set(tailX, tailY, rearZ);
    this.mesh.add(tailL, tailR);

    // Amber turn signal indicators on rear corners
    const blinkMatL = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const blinkMatR = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    this.blinkerLeft = new THREE.Mesh(SHARED_LIGHT_GEO, blinkMatL);
    this.blinkerLeft.scale.set(0.65, 0.85, 1);
    this.blinkerLeft.position.set(-tailX - 0.14, tailY, rearZ + 0.01);
    this.blinkerLeft.visible = false;

    this.blinkerRight = new THREE.Mesh(SHARED_LIGHT_GEO, blinkMatR);
    this.blinkerRight.scale.set(0.65, 0.85, 1);
    this.blinkerRight.position.set(tailX + 0.14, tailY, rearZ + 0.01);
    this.blinkerRight.visible = false;
    this.mesh.add(this.blinkerLeft, this.blinkerRight);

    // Front headlights (facing -Z in local space; rotated PI when oncoming!)
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
    this.headlightGroup = new THREE.Group();
    const headL = new THREE.Mesh(SHARED_LIGHT_GEO, this.headMat);
    headL.rotation.y = Math.PI;
    headL.position.set(-tailX, tailY * 0.88, frontZ);
    const headR = new THREE.Mesh(SHARED_LIGHT_GEO, this.headMat);
    headR.rotation.y = Math.PI;
    headR.position.set(tailX, tailY * 0.88, frontZ);
    this.headlightGroup.add(headL, headR);
    this.headlightGroup.visible = false;
    this.mesh.add(this.headlightGroup);
  }

  spawn(lane: number, z: number, speedMs: number, isOncoming = false, nightMode = false): void {
    this.active = true;
    this.isOncoming = isOncoming;
    this.lane = lane;
    this.targetLane = lane;
    this.x = getLaneCenterX(lane);
    this.z = z;
    this.baseSpeedMs = speedMs;
    this.speedMs = speedMs;
    this.overtaken = false;
    this.nearMissed = false;
    this.laneChangeCooldown = 1.5 + Math.random() * 2.5;
    this.braking = false;
    this.blinkPhase = 0;

    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = isOncoming ? Math.PI : 0;
    this.tailMat.color.setHex(nightMode ? 0xdc2626 : 0x991b1b);
    this.headlightGroup.visible = isOncoming || nightMode;
    this.blinkerLeft.visible = false;
    this.blinkerRight.visible = false;
    this.mesh.visible = true;
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  update(dt: number, nightMode = false): void {
    if (!this.active) return;

    // Oncoming vehicles travel +Z toward the rider; same-way travel -Z
    if (this.isOncoming) {
      this.z += this.speedMs * dt;
    } else {
      this.z -= this.speedMs * dt;
    }

    const baseYaw = this.isOncoming ? Math.PI : 0;
    const targetX = getLaneCenterX(this.targetLane);
    const dx = targetX - this.x;

    if (Math.abs(dx) > 0.02) {
      const move = Math.sign(dx) * Math.min(Math.abs(dx), 2.9 * dt);
      this.x += move;
      const steerTilt = (this.isOncoming ? 1 : -1) * Math.sign(dx) * 0.09;
      this.mesh.rotation.y = THREE.MathUtils.damp(this.mesh.rotation.y, baseYaw + steerTilt, 8, dt);

      // Flash amber blinker on side of lane change
      this.blinkPhase += dt * 7.5;
      const blinkOn = Math.sin(this.blinkPhase) > 0;
      this.blinkerLeft.visible = blinkOn && dx < 0;
      this.blinkerRight.visible = blinkOn && dx > 0;

      if (Math.abs(targetX - this.x) < 0.05) {
        this.x = targetX;
        this.lane = this.targetLane;
        this.blinkerLeft.visible = false;
        this.blinkerRight.visible = false;
      }
    } else {
      this.mesh.rotation.y = THREE.MathUtils.damp(this.mesh.rotation.y, baseYaw, 10, dt);
      this.blinkerLeft.visible = false;
      this.blinkerRight.visible = false;
    }

    // Brighten taillights when braking
    if (this.braking) {
      this.tailMat.color.setHex(0xff1e2d);
    } else {
      this.tailMat.color.setHex(nightMode ? 0xb91c1c : 0x7f1d1d);
    }

    if (this.laneChangeCooldown > 0) {
      this.laneChangeCooldown -= dt;
    }

    this.mesh.position.set(this.x, 0, this.z);

    this.wheelRot = (this.wheelRot + (this.speedMs / 0.35) * dt) % (Math.PI * 2);
    for (const w of this.wheelNodes) {
      w.rotation.x = -this.wheelRot;
    }
  }
}
