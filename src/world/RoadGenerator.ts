import * as THREE from 'three';
import { EnvironmentTheme, HIGHWAY_CONSTANTS, TrafficDirection } from '../systems/GameConfig';

function createAsphaltTexture(maxAnisotropy: number, lowMem: boolean): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture | null;
} {
  const w = lowMem ? 256 : 512;
  const h = lowMem ? 256 : 512;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#26282d';
  ctx.fillRect(0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 14 - 7;
    data[i] = Math.max(14, Math.min(80, data[i] + noise));
    data[i + 1] = Math.max(14, Math.min(80, data[i + 1] + noise));
    data[i + 2] = Math.max(17, Math.min(85, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Subtle tire track lanes
  ctx.fillStyle = 'rgba(10, 11, 14, 0.30)';
  const lanePx = w / 4;
  for (let l = 0; l < 4; l++) {
    const cx = l * lanePx + lanePx * 0.5;
    ctx.fillRect(cx - lanePx * 0.24, 0, lanePx * 0.14, h);
    ctx.fillRect(cx + lanePx * 0.1, 0, lanePx * 0.14, h);
  }

  // Solid edge shoulder lines
  ctx.fillStyle = '#e4e4e7';
  const edgeW = Math.max(3, Math.round(w * 0.014));
  ctx.fillRect(Math.round(w * 0.027), 0, edgeW, h);
  ctx.fillRect(w - Math.round(w * 0.027) - edgeW, 0, edgeW, h);

  // Dashed lane dividers
  ctx.fillStyle = '#f4f4f5';
  const dashW = Math.max(3, Math.round(w * 0.012));
  for (let d = 1; d < 4; d++) {
    const x = Math.round(d * (w / 4) - dashW * 0.5);
    const step = h / 4;
    for (let y = Math.round(step * 0.12); y < h; y += step) {
      ctx.fillRect(x, y, dashW, Math.round(step * 0.48));
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 3);
  map.anisotropy = lowMem ? 1 : Math.min(8, maxAnisotropy);

  if (lowMem) {
    return { map, roughnessMap: null };
  }

  const rCanvas = document.createElement('canvas');
  rCanvas.width = 256;
  rCanvas.height = 256;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, 256, 256);
  rCtx.fillStyle = '#909090';
  for (let l = 0; l < 4; l++) {
    const cx = l * 64 + 32;
    rCtx.fillRect(cx - 16, 0, 10, 256);
    rCtx.fillRect(cx + 6, 0, 10, 256);
  }
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1, 3);

  return { map, roughnessMap };
}

function createGantrySignTexture(title: string, sub: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#065f46';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#ecfdf5';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 128, 30);

  ctx.fillStyle = '#fde68a';
  ctx.font = '700 14px sans-serif';
  ctx.fillText(sub, 128, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RoadGenerator {
  public readonly group = new THREE.Group();
  private segments: THREE.Group[] = [];
  private twoWayStrips: THREE.Mesh[] = [];
  private segmentLength = HIGHWAY_CONSTANTS.SEGMENT_LENGTH;
  private segmentCount = HIGHWAY_CONSTANTS.SEGMENT_COUNT;
  private lampMat: THREE.MeshStandardMaterial;
  private studMat: THREE.MeshBasicMaterial;
  private gantries: THREE.Group[] = [];
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(maxAnisotropy: number, lowMem = false) {
    this.group.name = 'HighwayRoadSystem';

    const { map, roughnessMap } = createAsphaltTexture(maxAnisotropy, lowMem);
    this.disposables.push(map);
    if (roughnessMap) this.disposables.push(roughnessMap);

    const roadGeo = new THREE.PlaneGeometry(HIGHWAY_CONSTANTS.ROAD_WIDTH, this.segmentLength, 1, 1);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      ...(roughnessMap ? { roughnessMap } : {}),
      roughness: 0.85,
      metalness: 0.05,
    });

    const apronGeo = new THREE.BoxGeometry(HIGHWAY_CONSTANTS.ROAD_WIDTH + 4.4, 0.4, this.segmentLength);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.9,
      metalness: 0.05,
    });

    const barrierGeo = new THREE.BoxGeometry(0.55, 0.92, this.segmentLength);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      roughness: 0.78,
      metalness: 0.12,
    });

    const railGeo = new THREE.BoxGeometry(0.14, 0.2, this.segmentLength);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.35,
      metalness: 0.75,
    });

    // Double-amber centerline strip used in Two-Way highway mode
    const centerLineGeo = new THREE.PlaneGeometry(0.24, this.segmentLength);
    centerLineGeo.rotateX(-Math.PI / 2);
    const centerLineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    // Instanced streetlight geometries & reflective road studs (cuts 140+ draw calls down to 4!)
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7.2, 6);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.45,
      metalness: 0.7,
    });
    const armGeo = new THREE.BoxGeometry(2.6, 0.12, 0.12);
    this.lampMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfde68a,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const lampGeo = new THREE.BoxGeometry(0.7, 0.1, 0.35);

    const studGeo = new THREE.BoxGeometry(0.12, 0.04, 0.28);
    this.studMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    // Roadside coastal pine foliage (batched two-tier InstancedMesh for realistic silhouette & speed parallax)
    const treeTrunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.6, 5);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.96 });
    const treeLowerGeo = new THREE.ConeGeometry(1.35, 3.6, 7);
    const treeLowerMat = new THREE.MeshStandardMaterial({ color: 0x1d3827, roughness: 0.94 });
    const treeUpperGeo = new THREE.ConeGeometry(0.95, 3.5, 7);
    const treeUpperMat = new THREE.MeshStandardMaterial({ color: 0x244530, roughness: 0.92 });

    this.disposables.push(
      roadGeo,
      roadMat,
      apronGeo,
      apronMat,
      barrierGeo,
      barrierMat,
      railGeo,
      railMat,
      centerLineGeo,
      centerLineMat,
      poleGeo,
      poleMat,
      armGeo,
      this.lampMat,
      lampGeo,
      studGeo,
      this.studMat,
      treeTrunkGeo,
      treeTrunkMat,
      treeLowerGeo,
      treeLowerMat,
      treeUpperGeo,
      treeUpperMat
    );

    const barrierOffsetX = HIGHWAY_CONSTANTS.ROAD_WIDTH / 2 + 0.35;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.segmentCount; i++) {
      const seg = new THREE.Group();

      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.y = 0.02;
      roadMesh.receiveShadow = !lowMem;
      seg.add(roadMesh);

      const apronMesh = new THREE.Mesh(apronGeo, apronMat);
      apronMesh.position.y = -0.2;
      apronMesh.receiveShadow = !lowMem;
      seg.add(apronMesh);

      const leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
      leftBarrier.position.set(-barrierOffsetX, 0.46, 0);
      leftBarrier.receiveShadow = !lowMem;
      seg.add(leftBarrier);

      const rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
      rightBarrier.position.set(barrierOffsetX, 0.46, 0);
      rightBarrier.receiveShadow = !lowMem;
      seg.add(rightBarrier);

      const leftRail = new THREE.Mesh(railGeo, railMat);
      leftRail.position.set(-barrierOffsetX + 0.3, 0.78, 0);
      seg.add(leftRail);

      const rightRail = new THREE.Mesh(railGeo, railMat);
      rightRail.position.set(barrierOffsetX - 0.3, 0.78, 0);
      seg.add(rightRail);

      const twoWayStrip = new THREE.Mesh(centerLineGeo, centerLineMat);
      twoWayStrip.position.set(0, 0.026, 0);
      twoWayStrip.visible = false;
      this.twoWayStrips.push(twoWayStrip);
      seg.add(twoWayStrip);

      // Batched streetlight poles/arms/lamps per segment
      const poles = new THREE.InstancedMesh(poleGeo, poleMat, 4);
      const arms = new THREE.InstancedMesh(armGeo, poleMat, 4);
      const lamps = new THREE.InstancedMesh(lampGeo, this.lampMat, 4);
      let idx = 0;
      for (const zOff of [-20, 20]) {
        for (const side of [-1, 1]) {
          dummy.position.set(side * (barrierOffsetX + 0.45), 3.6, zOff);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          poles.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(side * (barrierOffsetX - 0.7), 7.1, zOff);
          dummy.updateMatrix();
          arms.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(side * (barrierOffsetX - 1.7), 7.0, zOff);
          dummy.updateMatrix();
          lamps.setMatrixAt(idx, dummy.matrix);
          idx++;
        }
      }
      seg.add(poles, arms, lamps);

      // Batched roadside cypress/pines outside barriers for peripheral speed cues
      const trunks = new THREE.InstancedMesh(treeTrunkGeo, treeTrunkMat, 6);
      const lowers = new THREE.InstancedMesh(treeLowerGeo, treeLowerMat, 6);
      const uppers = new THREE.InstancedMesh(treeUpperGeo, treeUpperMat, 6);
      let tIdx = 0;
      for (const zOff of [-28, 0, 28]) {
        for (const side of [-1, 1]) {
          const xOff = side * (barrierOffsetX + 6.4 + ((i + tIdx) % 3) * 1.9);
          const scaleVar = 0.85 + ((i + tIdx) % 4) * 0.16;
          dummy.rotation.y = (i + tIdx) * 0.7;
          dummy.position.set(xOff, 1.0 * scaleVar, zOff);
          dummy.scale.set(scaleVar, scaleVar, scaleVar);
          dummy.updateMatrix();
          trunks.setMatrixAt(tIdx, dummy.matrix);

          dummy.position.set(xOff, 3.1 * scaleVar, zOff);
          dummy.updateMatrix();
          lowers.setMatrixAt(tIdx, dummy.matrix);

          dummy.position.set(xOff, 4.9 * scaleVar, zOff);
          dummy.updateMatrix();
          uppers.setMatrixAt(tIdx, dummy.matrix);
          tIdx++;
        }
      }
      dummy.rotation.y = 0;
      seg.add(trunks, lowers, uppers);

      // Reflective cat's-eye road studs
      const studs = new THREE.InstancedMesh(studGeo, this.studMat, 12);
      let sIdx = 0;
      dummy.scale.set(1, 1, 1);
      for (const zOff of [-30, -10, 10, 30]) {
        for (const xOff of [-3.7, 0, 3.7]) {
          dummy.position.set(xOff, 0.03, zOff);
          dummy.updateMatrix();
          studs.setMatrixAt(sIdx++, dummy.matrix);
        }
      }
      seg.add(studs);

      seg.position.z = 40 - i * this.segmentLength;
      this.segments.push(seg);
      this.group.add(seg);
    }

    // 3 lightweight overhead highway destination gantries cycling ahead of rider
    const gantrySpecs = [
      { title: 'DOWNTOWN  2 KM', sub: 'EXPRESSWAY NORTH  ▲', z: -150 },
      { title: 'BAY BRIDGE  1 KM', sub: 'KEEP RIGHT FOR EXIT', z: -390 },
      { title: 'AIRPORT  EXPRESS', sub: 'ALL LANES OPEN  ▲', z: -630 },
    ];
    const gantryPostGeo = new THREE.BoxGeometry(0.28, 7.6, 0.28);
    const gantryCrossGeo = new THREE.BoxGeometry(HIGHWAY_CONSTANTS.ROAD_WIDTH + 2.2, 0.3, 0.3);
    const gantrySignGeo = new THREE.PlaneGeometry(6.4, 1.6);
    this.disposables.push(gantryPostGeo, gantryCrossGeo, gantrySignGeo);

    for (const spec of gantrySpecs) {
      const g = new THREE.Group();
      const leftP = new THREE.Mesh(gantryPostGeo, poleMat);
      leftP.position.set(-(barrierOffsetX + 0.5), 3.8, 0);
      const rightP = new THREE.Mesh(gantryPostGeo, poleMat);
      rightP.position.set(barrierOffsetX + 0.5, 3.8, 0);
      const cross = new THREE.Mesh(gantryCrossGeo, poleMat);
      cross.position.set(0, 7.4, 0);

      const tex = createGantrySignTexture(spec.title, spec.sub);
      const signMat = new THREE.MeshBasicMaterial({ map: tex });
      this.disposables.push(tex, signMat);

      const sign = new THREE.Mesh(gantrySignGeo, signMat);
      sign.position.set(0, 6.75, 0.2);

      g.add(leftP, rightP, cross, sign);
      g.position.z = spec.z;
      this.gantries.push(g);
      this.group.add(g);
    }
  }

  setTrafficMode(mode: TrafficDirection): void {
    const showTwoWay = mode === 'twoway';
    for (const strip of this.twoWayStrips) {
      strip.visible = showTwoWay;
    }
    this.studMat.color.setHex(showTwoWay ? 0xf97316 : 0xfbbf24);
  }

  setTheme(theme: EnvironmentTheme): void {
    this.lampMat.emissiveIntensity = theme === 'night' ? 3.5 : theme === 'sunset' ? 2.4 : 1.0;
  }

  update(playerZ: number): void {
    const totalLength = this.segmentLength * this.segmentCount;
    for (const seg of this.segments) {
      if (seg.position.z > playerZ + this.segmentLength * 1.5) {
        seg.position.z -= totalLength;
      } else if (seg.position.z < playerZ - totalLength + this.segmentLength * 1.5) {
        seg.position.z += totalLength;
      }
    }

    const gantrySpan = 720;
    for (const g of this.gantries) {
      if (g.position.z > playerZ + 25) {
        g.position.z -= gantrySpan;
      } else if (g.position.z < playerZ - gantrySpan + 25) {
        g.position.z += gantrySpan;
      }
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
