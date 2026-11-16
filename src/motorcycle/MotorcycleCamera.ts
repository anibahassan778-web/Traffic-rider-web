import * as THREE from 'three';
import { BikePhysicsState } from '../systems/MotorcyclePhysics';
import { Motorcycle } from './Motorcycle';

export class MotorcycleCamera {
  private camera: THREE.PerspectiveCamera;
  private trauma = 0;
  private nearMissPulse = 0;
  private currentFov = 68;
  private showcaseAngle = 0.55;
  private smoothedEye = new THREE.Vector3();
  private smoothedTarget = new THREE.Vector3();

  private _desiredPos = new THREE.Vector3();
  private _desiredLook = new THREE.Vector3();
  private _localPos = new THREE.Vector3();
  private _localLook = new THREE.Vector3();

  private currentLocalZOffset = 0;
  private currentLocalYOffset = 0;
  private currentLookOffsetX = 0;
  private currentLookOffsetY = 0;
  private currentLeanRoll = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  triggerNearMissPulse(): void {
    this.nearMissPulse = 1.0;
  }

  reset(): void {
    this.trauma = 0;
    this.nearMissPulse = 0;
    this.currentLocalZOffset = 0;
    this.currentLocalYOffset = 0;
    this.currentLookOffsetX = 0;
    this.currentLookOffsetY = 0;
    this.currentLeanRoll = 0;
  }

  updateTitleOrGarage(
    bike: Motorcycle,
    mode: 'title' | 'garage',
    dt: number,
    pointerParallaxX = 0
  ): void {
    this.showcaseAngle += dt * (mode === 'garage' ? 0.42 : 0.18);
    const baseAngle =
      mode === 'garage'
        ? this.showcaseAngle
        : 0.48 + Math.sin(this.showcaseAngle) * 0.25 + pointerParallaxX * 0.18;
    const radius = mode === 'garage' ? 3.2 : 3.55;
    const height = mode === 'garage' ? 1.35 : 1.52;

    const bx = bike.group.position.x;
    const bz = bike.group.position.z;

    this._desiredPos.set(
      bx + Math.sin(baseAngle) * radius,
      height,
      bz - Math.cos(baseAngle) * radius
    );
    this._desiredLook.set(bx, 0.78, bz - 0.1);

    this.smoothedEye.copy(this._desiredPos);
    this.smoothedTarget.copy(this._desiredLook);

    this.camera.position.copy(this.smoothedEye);
    this.camera.lookAt(this.smoothedTarget);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 48, 6, dt);
    this.camera.updateProjectionMatrix();
  }

  updateFirstPerson(
    bike: Motorcycle,
    physics: BikePhysicsState,
    dt: number,
    cameraEffectsEnabled: boolean
  ): void {
    bike.group.updateMatrixWorld(true);
    const leanPivot = bike.getLeanPivot();

    const speedRatio = THREE.MathUtils.clamp(physics.speedMs / 84, 0, 1);

    if (this.nearMissPulse > 0) {
      this.nearMissPulse = Math.max(0, this.nearMissPulse - dt * 2.6);
    }

    const targetZOffset = physics.wheelieActive
      ? 0.06
      : physics.pitchAngle > 0.005
      ? 0.045
      : physics.pitchAngle < -0.005
      ? -0.045
      : 0;
    const targetYOffset = -speedRatio * 0.04 + (physics.wheelieActive ? 0.035 : 0);
    const targetLookX = physics.steerInputSmoothed * 0.75;
    // Counteract excess wheelie pitch slightly so road traffic stays clearly visible
    const targetLookY = physics.wheelieActive ? -0.95 : 0;

    this.currentLocalZOffset = THREE.MathUtils.damp(this.currentLocalZOffset, targetZOffset, 10, dt);
    this.currentLocalYOffset = THREE.MathUtils.damp(this.currentLocalYOffset, targetYOffset, 8, dt);
    this.currentLookOffsetX = THREE.MathUtils.damp(this.currentLookOffsetX, targetLookX, 12, dt);
    this.currentLookOffsetY = THREE.MathUtils.damp(this.currentLookOffsetY, targetLookY, 7, dt);

    this._localPos.copy(bike.rig.cockpitCameraPos);
    this._localPos.y += this.currentLocalYOffset;
    this._localPos.z += this.currentLocalZOffset;

    this._localLook.copy(bike.rig.cockpitLookOffset);
    this._localLook.x += this.currentLookOffsetX;
    this._localLook.y += this.currentLookOffsetY;

    this._desiredPos.copy(this._localPos).applyMatrix4(leanPivot.matrixWorld);
    this._desiredLook.copy(this._localLook).applyMatrix4(leanPivot.matrixWorld);

    let shakeX = 0;
    let shakeY = 0;
    let shakeRoll = 0;

    if (cameraEffectsEnabled) {
      if (this.trauma > 0) {
        const shake = this.trauma * this.trauma;
        shakeX = (Math.random() * 2 - 1) * 0.11 * shake;
        shakeY = (Math.random() * 2 - 1) * 0.09 * shake;
        shakeRoll = (Math.random() * 2 - 1) * 0.08 * shake;
        this.trauma = Math.max(0, this.trauma - dt * 1.9);
      }
      if (physics.speedMs > 15) {
        const vib = speedRatio * 0.0035;
        shakeY += Math.sin(performance.now() * 0.045) * vib;
      }
    } else {
      this.trauma = 0;
    }

    this.camera.position.set(
      this._desiredPos.x + shakeX,
      this._desiredPos.y + shakeY,
      this._desiredPos.z
    );
    this.camera.lookAt(this._desiredLook);

    const targetRoll = cameraEffectsEnabled ? physics.leanAngle * 0.6 : physics.leanAngle * 0.25;
    this.currentLeanRoll = THREE.MathUtils.damp(this.currentLeanRoll, targetRoll, 14, dt);
    this.camera.rotation.z += this.currentLeanRoll + shakeRoll;

    // Speed-dependent FOV + boost/near-miss widening
    const boostFov = physics.boostTimer > 0 ? 4.5 : 0;
    const pulseFov = this.nearMissPulse * 3.5;
    const targetFov = cameraEffectsEnabled ? 66 + speedRatio * 22 + boostFov + pulseFov : 68;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 7, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
