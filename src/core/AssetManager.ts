import * as THREE from 'three';
import { GLTFLoader, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { GraphicsQuality } from '../systems/GameConfig';

export interface LoadedBikeRig {
  root: THREE.Group;
  model: THREE.Group;
  handlebarsNode: THREE.Object3D | null;
  forksNode: THREE.Object3D | null;
  frontWheelNode: THREE.Object3D | null;
  rearWheelNode: THREE.Object3D | null;
  dialsMaterial: THREE.MeshStandardMaterial | null;
  cockpitCameraPos: THREE.Vector3;
  cockpitLookOffset: THREE.Vector3;
  paintMaterials: THREE.MeshStandardMaterial[];
  length: number;
  width: number;
  height: number;
}

export interface VehicleTemplate {
  id: string;
  category: 'car' | 'suv' | 'van' | 'truck';
  prototype: THREE.Group;
  width: number;
  height: number;
  length: number;
}

export interface LoadedCityAsset {
  prototype: THREE.Group;
  size: THREE.Vector3;
  center: THREE.Vector3;
}

export interface LoadedGameAssets {
  bike: LoadedBikeRig;
  npcVehicles: VehicleTemplate[];
  city: LoadedCityAsset;
}

function registerSpecularGlossinessPlugin(loader: GLTFLoader): void {
  loader.register((parser: GLTFParser) => ({
    name: 'KHR_materials_pbrSpecularGlossiness',
    getMaterialType(materialIndex: number) {
      const matDef = parser.json.materials?.[materialIndex];
      if (!matDef?.extensions?.KHR_materials_pbrSpecularGlossiness) {
        return null;
      }
      return THREE.MeshStandardMaterial;
    },
    extendMaterialParams(materialIndex: number, materialParams: Record<string, unknown>) {
      const matDef = parser.json.materials?.[materialIndex];
      const ext = matDef?.extensions?.KHR_materials_pbrSpecularGlossiness;
      if (!ext) return Promise.resolve();

      const pending: Promise<unknown>[] = [];
      const color = new THREE.Color(1, 1, 1);
      let opacity = 1;

      if (Array.isArray(ext.diffuseFactor)) {
        const [r, g, b, a] = ext.diffuseFactor;
        color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
        opacity = a ?? 1;
      }

      materialParams.color = color;
      materialParams.opacity = opacity;
      if (opacity < 1) {
        materialParams.transparent = true;
      }

      if (ext.diffuseTexture !== undefined) {
        pending.push(
          parser.assignTexture(materialParams, 'map', ext.diffuseTexture, THREE.SRGBColorSpace)
        );
      }

      const glossiness = typeof ext.glossinessFactor === 'number' ? ext.glossinessFactor : 0.7;
      materialParams.roughness = THREE.MathUtils.clamp(1.0 - glossiness * 0.65, 0.15, 0.92);

      if (Array.isArray(ext.specularFactor)) {
        const avgSpec = (ext.specularFactor[0] + ext.specularFactor[1] + ext.specularFactor[2]) / 3;
        materialParams.metalness = THREE.MathUtils.clamp(avgSpec * 0.45, 0.05, 0.6);
      } else {
        materialParams.metalness = 0.25;
      }

      return Promise.all(pending);
    },
  }));
}

function classifyVehicle(name: string): 'car' | 'suv' | 'van' | 'truck' {
  const lower = name.toLowerCase();
  if (
    lower.includes('tir') ||
    lower.includes('truck') ||
    lower.includes('scania') ||
    lower.includes('atleon') ||
    lower.includes('atlas') ||
    lower.includes('maxity') ||
    lower.includes('unimog')
  ) {
    return 'truck';
  }
  if (lower.includes('sprinter') || lower.includes('transit') || lower.includes('e150')) {
    return 'van';
  }
  if (
    lower.includes('excursion') ||
    lower.includes('freelander') ||
    lower.includes('f150') ||
    lower.includes('chevy') ||
    lower.includes('amorak')
  ) {
    return 'suv';
  }
  return 'car';
}

function yieldForGc(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 16));
}

export class AssetManager {
  private loader: GLTFLoader;
  private manager: THREE.LoadingManager;
  private resizeCanvas: HTMLCanvasElement | null = null;
  private resizeCtx: CanvasRenderingContext2D | null = null;

  constructor(onProgress?: (progress01: number, statusText: string) => void) {
    this.manager = new THREE.LoadingManager();
    this.manager.onProgress = (_url, loaded, total) => {
      if (onProgress && total > 0) {
        onProgress(Math.min(0.92, loaded / total), `Loading 3D assets (${loaded}/${total})...`);
      }
    };
    this.loader = new GLTFLoader(this.manager);
    registerSpecularGlossinessPlugin(this.loader);
  }

  private loadGLB(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => {
          reject(
            new Error(
              `Failed to load GLB model at "${path}": ${err instanceof Error ? err.message : String(err)}`
            )
          );
        }
      );
    });
  }

  async loadAll(
    maxAnisotropy: number,
    quality: GraphicsQuality,
    onProgress?: (p: number, label: string) => void
  ): Promise<LoadedGameAssets> {
    // Sequential GLB loading avoids simultaneous 3x memory spikes on 500MB RAM devices
    onProgress?.(0.08, 'Loading BMW S1000RR (1/3)...');
    const bikeScene = await this.loadGLB('assets/bmw_s1000rr_2019.glb');
    const bikeMaxTex = quality === 'low' ? 512 : 1024;
    const bike = this.prepareBike(bikeScene, maxAnisotropy, bikeMaxTex, quality);
    await yieldForGc();

    onProgress?.(0.38, 'Loading NPC Highway Traffic (2/3)...');
    const trafficScene = await this.loadGLB('assets/traffic_rider_npc_vehicles.glb');
    const npcMaxTex = quality === 'low' ? 256 : quality === 'medium' ? 512 : 1024;
    const npcVehicles = this.prepareTrafficVehicles(trafficScene, maxAnisotropy, npcMaxTex, quality);
    await yieldForGc();

    onProgress?.(0.72, 'Loading City Skyline (3/3)...');
    const cityScene = await this.loadGLB('assets/city_mapnot_a_scan.glb');
    const cityMaxTex = quality === 'low' ? 256 : quality === 'medium' ? 512 : 1024;
    const city = this.prepareCity(cityScene, maxAnisotropy, cityMaxTex, quality);
    await yieldForGc();

    // Free temporary resize canvas after asset normalization
    if (this.resizeCanvas) {
      this.resizeCanvas.width = 1;
      this.resizeCanvas.height = 1;
      this.resizeCanvas = null;
      this.resizeCtx = null;
    }

    onProgress?.(1.0, 'Ready to ride');
    return { bike, npcVehicles, city };
  }

  private downscaleTexture(tex: THREE.Texture, maxDim: number): void {
    const img = tex.image as
      | (CanvasImageSource & { width?: number; height?: number; close?: () => void })
      | undefined;
    if (!img || typeof img.width !== 'number' || typeof img.height !== 'number') return;
    if (img.width <= maxDim && img.height <= maxDim) return;

    const scale = maxDim / Math.max(img.width, img.height);
    const targetW = Math.max(32, Math.round(img.width * scale));
    const targetH = Math.max(32, Math.round(img.height * scale));

    if (!this.resizeCanvas) {
      this.resizeCanvas = document.createElement('canvas');
      this.resizeCtx = this.resizeCanvas.getContext('2d');
    }
    if (!this.resizeCanvas || !this.resizeCtx) return;

    // Copy texture into an independent right-sized canvas so full-size ImageBitmap RAM can be freed
    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetW;
    outCanvas.height = targetH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    outCtx.drawImage(img, 0, 0, targetW, targetH);
    if (typeof img.close === 'function') {
      try {
        img.close();
      } catch {
        // ignore if already detached
      }
    }
    tex.image = outCanvas;
    tex.needsUpdate = true;
  }

  private optimizeTextures(
    root: THREE.Object3D,
    maxAnisotropy: number,
    maxTextureDim: number,
    stripSecondaryMaps: boolean
  ): void {
    const processedTex = new Set<THREE.Texture>();
    const desiredAniso = stripSecondaryMaps ? 1 : Math.min(4, maxAnisotropy);

    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.frustumCulled = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          const std = mat as THREE.MeshStandardMaterial;

          if (stripSecondaryMaps) {
            if (std.normalMap) {
              std.normalMap.dispose();
              std.normalMap = null;
            }
            if (std.roughnessMap) {
              std.roughnessMap.dispose();
              std.roughnessMap = null;
            }
            if (std.aoMap) {
              std.aoMap.dispose();
              std.aoMap = null;
            }
            if (std.metalnessMap) {
              std.metalnessMap.dispose();
              std.metalnessMap = null;
            }
          }

          if (std.map) {
            if (!processedTex.has(std.map)) {
              processedTex.add(std.map);
              this.downscaleTexture(std.map, maxTextureDim);
            }
            std.map.anisotropy = desiredAniso;
            std.map.needsUpdate = true;
          }
          if (std.envMapIntensity !== undefined) {
            std.envMapIntensity = 0.9;
          }
        }
      }
    });
  }

  private prepareBike(
    bikeScene: THREE.Group,
    maxAnisotropy: number,
    maxTexDim: number,
    quality: GraphicsQuality
  ): LoadedBikeRig {
    this.optimizeTextures(bikeScene, maxAnisotropy, maxTexDim, quality === 'low');
    bikeScene.updateMatrixWorld(true);

    // Find key skeletal/mesh nodes from bmw_s1000rr_2019.glb
    const headlightNode =
      bikeScene.getObjectByName('headlight_l_44') ?? bikeScene.getObjectByName('headlight_l_63');
    const taillightNode =
      bikeScene.getObjectByName('taillight_l_38') ?? bikeScene.getObjectByName('taillight_l_85');
    const handlebarsNode = bikeScene.getObjectByName('handlebars_34');
    const forksNode = bikeScene.getObjectByName('forks_u_17');
    const frontWheelNode = bikeScene.getObjectByName('wheel_lf_14');
    const rearWheelNode = bikeScene.getObjectByName('wheel_lr_19');
    const dialsNode = bikeScene.getObjectByName('dials_35');

    const root = new THREE.Group();
    root.name = 'PlayerMotorcycleRoot';
    root.add(bikeScene);
    root.updateMatrixWorld(true);

    // Orient bike so headlight -> taillight faces -Z (forward)
    if (headlightNode && taillightNode) {
      const headPos = new THREE.Vector3();
      const tailPos = new THREE.Vector3();
      headlightNode.getWorldPosition(headPos);
      taillightNode.getWorldPosition(tailPos);
      const forward = headPos.clone().sub(tailPos);
      forward.y = 0;
      if (forward.lengthSq() > 0.001) {
        forward.normalize();
        const targetForward = new THREE.Vector3(0, 0, -1);
        const angle = Math.atan2(forward.x, forward.z) - Math.atan2(targetForward.x, targetForward.z);
        bikeScene.rotation.y -= angle;
        root.updateMatrixWorld(true);
      }
    }

    // Measure size using bone landmarks or bounding box and normalize to ~2.08m length
    const box = new THREE.Box3().setFromObject(bikeScene);
    const size = box.getSize(new THREE.Vector3());
    const maxHoriz = Math.max(size.x, size.z, 0.5);
    const scaleFactor = 2.08 / maxHoriz;
    bikeScene.scale.multiplyScalar(scaleFactor);
    root.updateMatrixWorld(true);

    // Center X/Z and place bottom wheel flush at Y = 0
    const scaledBox = new THREE.Box3().setFromObject(bikeScene);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    bikeScene.position.x -= scaledCenter.x;
    bikeScene.position.z -= scaledCenter.z;
    bikeScene.position.y -= scaledBox.min.y;
    root.updateMatrixWorld(true);

    // Compute calibrated first-person rider eye position centered over the front tank,
    // looking cleanly above the windscreen down the highway while keeping handlebars,
    // mirrors, and live TFT dash visible in the lower frame.
    let cockpitCameraPos = new THREE.Vector3(0, 1.21, 0.06);
    let cockpitLookOffset = new THREE.Vector3(0, 1.07, -14.0);

    if (dialsNode) {
      const dialsWorld = new THREE.Vector3();
      dialsNode.getWorldPosition(dialsWorld);
      const eyeY = Math.max(dialsWorld.y + 0.34, 1.21);
      const eyeZ = dialsWorld.z + 0.36;
      cockpitCameraPos = new THREE.Vector3(0, eyeY, eyeZ);
      cockpitLookOffset = new THREE.Vector3(0, eyeY - 0.14, dialsWorld.z - 14.0);
    }

    // Collect paintable primary body/fairing materials + live TFT dial screen material
    const paintMaterials: THREE.MeshStandardMaterial[] = [];
    let dialsMaterial: THREE.MeshStandardMaterial | null = null;
    const seenMat = new Set<THREE.Material>();

    bikeScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.frustumCulled = false;
        mesh.castShadow = quality !== 'low';
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m || seenMat.has(m)) continue;
          seenMat.add(m);
          const nameLower = (m.name || '').toLowerCase();
          if (nameLower.includes('dials')) {
            dialsMaterial = m as THREE.MeshStandardMaterial;
          } else if (nameLower.includes('dashb')) {
            const bezel = m as THREE.MeshStandardMaterial;
            bezel.color.setHex(0x161922);
            bezel.emissive.setHex(0x000000);
            bezel.emissiveIntensity = 0;
            bezel.roughness = 0.78;
            bezel.metalness = 0.14;
            bezel.envMapIntensity = 0.18;
            bezel.needsUpdate = true;
          } else if (
            nameLower.includes('primary') ||
            nameLower.includes('body') ||
            nameLower.includes('paint') ||
            nameLower.includes('shell') ||
            nameLower.includes('fairing')
          ) {
            paintMaterials.push(m as THREE.MeshStandardMaterial);
          } else if (nameLower.includes('glasswindows')) {
            const glass = m as THREE.MeshStandardMaterial;
            glass.transparent = true;
            glass.opacity = Math.min(glass.opacity ?? 1, 0.45);
            glass.roughness = 0.08;
            glass.needsUpdate = true;
          }
        }
      }
    });

    if (paintMaterials.length === 0) {
      seenMat.forEach((m) => {
        if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const nameLower = (m.name || '').toLowerCase();
          if (
            !nameLower.includes('tire') &&
            !nameLower.includes('wheel') &&
            !nameLower.includes('glass') &&
            !nameLower.includes('chrome') &&
            !nameLower.includes('hand') &&
            !nameLower.includes('dash') &&
            !nameLower.includes('dial')
          ) {
            paintMaterials.push(m as THREE.MeshStandardMaterial);
          }
        }
      });
    }

    const finalBox = new THREE.Box3().setFromObject(root);
    const finalSize = finalBox.getSize(new THREE.Vector3());

    return {
      root,
      model: bikeScene,
      handlebarsNode: handlebarsNode ?? null,
      forksNode: forksNode ?? null,
      frontWheelNode: frontWheelNode ?? null,
      rearWheelNode: rearWheelNode ?? null,
      dialsMaterial,
      cockpitCameraPos,
      cockpitLookOffset,
      paintMaterials,
      width: Math.min(finalSize.x, 0.85),
      height: finalSize.y,
      length: Math.max(finalSize.z, 2.0),
    };
  }

  private prepareTrafficVehicles(
    trafficScene: THREE.Group,
    maxAnisotropy: number,
    maxTexDim: number,
    quality: GraphicsQuality
  ): VehicleTemplate[] {
    this.optimizeTextures(trafficScene, maxAnisotropy, maxTexDim, quality === 'low');
    trafficScene.updateMatrixWorld(true);

    const rootNode = trafficScene.getObjectByName('RootNode') ?? trafficScene;
    const rawVehicles = [...rootNode.children].filter((c) => c.name.startsWith('AI_'));
    const templates: VehicleTemplate[] = [];

    for (const vehicleNode of rawVehicles) {
      const wrapper = new THREE.Group();
      wrapper.name = `NPC_${vehicleNode.name}`;

      const inner = vehicleNode;
      inner.position.set(0, 0, 0);

      const fbxScaleContainer = new THREE.Group();
      fbxScaleContainer.scale.setScalar(0.01);
      fbxScaleContainer.add(inner);
      wrapper.add(fbxScaleContainer);
      wrapper.updateMatrixWorld(true);

      let rearWheel: THREE.Object3D | null = null;
      let frontWheel: THREE.Object3D | null = null;
      inner.traverse((child) => {
        if (!rearWheel && child.name.startsWith('arka_teker')) rearWheel = child;
        if (!frontWheel && child.name.startsWith('on_teker')) frontWheel = child;
      });

      if (rearWheel && frontWheel) {
        const rwPos = new THREE.Vector3();
        const fwPos = new THREE.Vector3();
        (rearWheel as THREE.Object3D).getWorldPosition(rwPos);
        (frontWheel as THREE.Object3D).getWorldPosition(fwPos);
        const dir = fwPos.sub(rwPos);
        dir.y = 0;
        if (dir.lengthSq() > 0.001) {
          dir.normalize();
          const target = new THREE.Vector3(0, 0, -1);
          const angle = Math.atan2(dir.x, dir.z) - Math.atan2(target.x, target.z);
          fbxScaleContainer.rotation.y -= angle;
          wrapper.updateMatrixWorld(true);
        }
      }

      const rawBox = new THREE.Box3().setFromObject(wrapper);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const category = classifyVehicle(vehicleNode.name);
      const targetWidth =
        category === 'truck' ? 2.45 : category === 'van' ? 2.08 : category === 'suv' ? 2.02 : 1.86;
      const currentWidth = Math.max(0.2, rawSize.x);
      const normScale = targetWidth / currentWidth;
      fbxScaleContainer.scale.multiplyScalar(normScale);
      wrapper.updateMatrixWorld(true);

      const alignedBox = new THREE.Box3().setFromObject(wrapper);
      const center = alignedBox.getCenter(new THREE.Vector3());
      fbxScaleContainer.position.x -= center.x;
      fbxScaleContainer.position.z -= center.z;
      fbxScaleContainer.position.y -= alignedBox.min.y;
      wrapper.updateMatrixWorld(true);

      const finalBox = new THREE.Box3().setFromObject(wrapper);
      const finalSize = finalBox.getSize(new THREE.Vector3());

      wrapper.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.castShadow = quality !== 'low';
          m.receiveShadow = true;
        }
      });

      templates.push({
        id: vehicleNode.name,
        category,
        prototype: wrapper,
        width: finalSize.x,
        height: finalSize.y,
        length: finalSize.z,
      });
    }

    return templates;
  }

  private prepareCity(
    cityScene: THREE.Group,
    maxAnisotropy: number,
    maxTexDim: number,
    quality: GraphicsQuality
  ): LoadedCityAsset {
    this.optimizeTextures(cityScene, maxAnisotropy, maxTexDim, quality === 'low');
    cityScene.updateMatrixWorld(true);

    const rawBox = new THREE.Box3().setFromObject(cityScene);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const rawMaxHoriz = Math.max(rawSize.x, rawSize.z, 1);

    const scale = 640 / rawMaxHoriz;
    const wrapper = new THREE.Group();
    wrapper.name = 'CityMapNormalized';
    cityScene.scale.multiplyScalar(scale);
    wrapper.add(cityScene);
    wrapper.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(wrapper);
    const center = box.getCenter(new THREE.Vector3());
    cityScene.position.x -= center.x;
    cityScene.position.z -= center.z;
    cityScene.position.y -= box.min.y;
    wrapper.updateMatrixWorld(true);

    wrapper.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = quality !== 'low';
      }
    });

    const finalBox = new THREE.Box3().setFromObject(wrapper);
    return {
      prototype: wrapper,
      size: finalBox.getSize(new THREE.Vector3()),
      center: finalBox.getCenter(new THREE.Vector3()),
    };
  }
}
