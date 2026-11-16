import * as THREE from 'three';
import { LoadedBikeRig } from '../core/AssetManager';
import { BIKE_PAINTS, EnvironmentTheme } from '../systems/GameConfig';
import { BikePhysicsState } from '../systems/MotorcyclePhysics';

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHeadlightBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(225, 242, 255, 0.65)');
  grad.addColorStop(0.45, 'rgba(210, 232, 255, 0.25)');
  grad.addColorStop(1, 'rgba(200, 225, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(56, 256);
  ctx.lineTo(72, 256);
  ctx.lineTo(124, 0);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Motorcycle {
  public readonly group: THREE.Group;
  public readonly rig: LoadedBikeRig;
  private leanPivot: THREE.Group;
  private contactShadow: THREE.Mesh;
  private headlightBeam: THREE.Mesh;
  private headlightMat: THREE.MeshBasicMaterial;
  private baseBeamOpacity = 0.08;
  private highBeamTimer = 0;

  // Live 3D BMW TFT instrument cluster texture
  private tftCanvas: HTMLCanvasElement | null = null;
  private tftCtx: CanvasRenderingContext2D | null = null;
  private tftTexture: THREE.CanvasTexture | null = null;
  private tftUpdateAccum = 0;

  private baseHandlebarRotY = 0;
  private baseForkRotY = 0;
  private baseFrontWheelRotX = 0;
  private baseRearWheelRotX = 0;

  constructor(rig: LoadedBikeRig) {
    this.rig = rig;
    this.group = new THREE.Group();
    this.group.name = 'PlayerBikeWrapper';

    this.leanPivot = new THREE.Group();
    this.leanPivot.add(rig.root);
    this.group.add(this.leanPivot);

    if (rig.handlebarsNode) this.baseHandlebarRotY = rig.handlebarsNode.rotation.y;
    if (rig.forksNode) this.baseForkRotY = rig.forksNode.rotation.y;
    if (rig.frontWheelNode) this.baseFrontWheelRotX = rig.frontWheelNode.rotation.x;
    if (rig.rearWheelNode) this.baseRearWheelRotX = rig.rearWheelNode.rotation.x;

    // Grounded contact shadow disc beneath the motorcycle
    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.15, 2.35);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.y = 0.03;
    this.group.add(this.contactShadow);

    // BMW LED headlight forward projection on road
    const beamTex = createHeadlightBeamTexture();
    const beamGeo = new THREE.PlaneGeometry(4.4, 15.0);
    beamGeo.rotateX(-Math.PI / 2);
    this.headlightMat = new THREE.MeshBasicMaterial({
      map: beamTex,
      transparent: true,
      opacity: this.baseBeamOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.headlightBeam = new THREE.Mesh(beamGeo, this.headlightMat);
    this.headlightBeam.position.set(0, 0.045, -8.3);
    this.group.add(this.headlightBeam);

    // Attach live 3D TFT dashboard texture onto script_rt_dials_race material
    if (rig.dialsMaterial) {
      this.tftCanvas = document.createElement('canvas');
      this.tftCanvas.width = 256;
      this.tftCanvas.height = 128;
      this.tftCtx = this.tftCanvas.getContext('2d');
      this.tftTexture = new THREE.CanvasTexture(this.tftCanvas);
      this.tftTexture.colorSpace = THREE.SRGBColorSpace;
      this.tftTexture.flipY = false;

      rig.dialsMaterial.color = new THREE.Color(0x141820);
      rig.dialsMaterial.map = this.tftTexture;
      rig.dialsMaterial.emissiveMap = this.tftTexture;
      rig.dialsMaterial.emissive = new THREE.Color(0xffffff);
      rig.dialsMaterial.emissiveIntensity = 1.05;
      rig.dialsMaterial.roughness = 0.92;
      rig.dialsMaterial.metalness = 0.0;
      rig.dialsMaterial.envMapIntensity = 0.04;
      rig.dialsMaterial.needsUpdate = true;
      this.renderTftScreen(0, 1, 0.2);
    }
  }

  private renderTftScreen(speedKmh: number, gear: number, rpmRatio: number): void {
    const ctx = this.tftCtx;
    const tex = this.tftTexture;
    if (!ctx || !tex) return;

    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, 256, 128);

    // BMW M top accent stripes
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(10, 8, 52, 5);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(64, 8, 52, 5);
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(118, 8, 52, 5);

    // Segmented RPM shift bar
    const segs = 14;
    const lit = Math.round(rpmRatio * segs);
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle =
        i < lit
          ? i >= 11
            ? '#f43f5e'
            : i >= 8
            ? '#fbbf24'
            : '#38bdf8'
          : '#1e293b';
      ctx.fillRect(14 + i * 16, 22, 13, 14);
    }

    // Digital Speed readout
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 48px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(Math.round(speedKmh)), 18, 92);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 14px sans-serif';
    ctx.fillText('KM/H', 20, 112);

    // Gear badge box
    ctx.fillStyle = '#111827';
    ctx.fillRect(182, 46, 56, 66);
    ctx.strokeStyle = rpmRatio > 0.85 ? '#f43f5e' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(182, 46, 56, 66);

    ctx.fillStyle = rpmRatio > 0.85 ? '#f43f5e' : '#38bdf8';
    ctx.font = '800 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(gear), 210, 94);

    tex.needsUpdate = true;
  }

  setTheme(theme: EnvironmentTheme): void {
    this.baseBeamOpacity = theme === 'night' ? 0.56 : theme === 'sunset' ? 0.24 : 0.06;
    if (this.rig.dialsMaterial) {
      this.rig.dialsMaterial.emissiveIntensity = theme === 'night' ? 1.25 : 1.05;
    }
  }

  triggerHighBeam(): void {
    this.highBeamTimer = 0.28;
  }

  applyPaint(paintId: string): void {
    const paint = BIKE_PAINTS.find((p) => p.id === paintId) ?? BIKE_PAINTS[0];
    for (const mat of this.rig.paintMaterials) {
      mat.color.set(paint.hex);
      mat.needsUpdate = true;
    }
  }

  updateFromPhysics(state: BikePhysicsState, dt = 0.016): void {
    this.group.position.set(state.x, 0, state.z);
    this.leanPivot.rotation.z = state.leanAngle;
    this.leanPivot.rotation.x = state.pitchAngle;
    this.leanPivot.rotation.y = -state.steerInputSmoothed * 0.06;

    const steerAngle = -state.steerInputSmoothed * 0.14;
    if (this.rig.handlebarsNode) {
      this.rig.handlebarsNode.rotation.y = this.baseHandlebarRotY + steerAngle;
    }
    if (this.rig.forksNode) {
      this.rig.forksNode.rotation.y = this.baseForkRotY + steerAngle * 0.5;
    }
    if (this.rig.frontWheelNode) {
      this.rig.frontWheelNode.rotation.x = this.baseFrontWheelRotX - state.wheelRotationRad;
    }
    if (this.rig.rearWheelNode) {
      this.rig.rearWheelNode.rotation.x = this.baseRearWheelRotX - state.wheelRotationRad;
    }

    if (this.highBeamTimer > 0) {
      this.highBeamTimer = Math.max(0, this.highBeamTimer - dt);
      this.headlightMat.opacity = Math.min(0.85, this.baseBeamOpacity + 0.52);
    } else {
      this.headlightMat.opacity = this.baseBeamOpacity;
    }

    this.tftUpdateAccum += dt;
    if (this.tftUpdateAccum >= 0.07) {
      this.tftUpdateAccum = 0;
      this.renderTftScreen(state.speedMs * 3.6, state.gear, state.rpmRatio);
    }
  }

  getWorldCenter(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.group.position.x, 0.72, this.group.position.z);
  }

  getLeanPivot(): THREE.Group {
    return this.leanPivot;
  }
}
