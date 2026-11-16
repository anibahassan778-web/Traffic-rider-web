import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EnvironmentTheme, GraphicsQuality } from '../systems/GameConfig';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

interface ThemePreset {
  zenith: THREE.Color;
  horizon: THREE.Color;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunOffset: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  exposure: number;
}

const THEME_PRESETS: Record<EnvironmentTheme, ThemePreset> = {
  day: {
    zenith: new THREE.Color('#3b82c4'),
    horizon: new THREE.Color('#c7daea'),
    fogDensity: 0.004,
    sunColor: 0xfff5e0,
    sunIntensity: 2.25,
    sunOffset: [28, 52, 20],
    hemiSky: 0xdbeafe,
    hemiGround: 0x3f3f46,
    hemiIntensity: 1.05,
    exposure: 1.1,
  },
  sunset: {
    zenith: new THREE.Color('#1f2247'),
    horizon: new THREE.Color('#e2845c'),
    fogDensity: 0.0044,
    sunColor: 0xffa65c,
    sunIntensity: 2.45,
    sunOffset: [-42, 19, -24],
    hemiSky: 0xfdba74,
    hemiGround: 0x27272a,
    hemiIntensity: 0.95,
    exposure: 1.08,
  },
  night: {
    zenith: new THREE.Color('#020617'),
    horizon: new THREE.Color('#0f1f3a'),
    fogDensity: 0.0054,
    sunColor: 0x93c5fd,
    sunIntensity: 1.05,
    sunOffset: [20, 42, 16],
    hemiSky: 0x334155,
    hemiGround: 0x09090b,
    hemiIntensity: 0.82,
    exposure: 1.15,
  },
};

export class SceneManager {
  public readonly isSoftwareGl: boolean;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  private pmremEnv: THREE.WebGLRenderTarget | null = null;
  private skyMesh: THREE.Mesh;
  private skyUniforms: {
    uZenith: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
  };
  private quality: GraphicsQuality = 'medium';
  private theme: EnvironmentTheme = 'sunset';
  private sunOffset: [number, number, number] = [28, 48, 22];

  constructor(container: HTMLElement, initialQuality: GraphicsQuality, initialTheme: EnvironmentTheme = 'sunset') {
    this.isSoftwareGl = detectSoftwareWebGL();
    this.quality = initialQuality;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && initialQuality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && initialQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height);

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e2845c');
    this.scene.fog = new THREE.FogExp2('#e2845c', 0.0044);

    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.08, 650);

    // Lightweight procedural Sky Dome (unit sphere scaled dynamically to stay inside camera.far)
    this.skyUniforms = {
      uZenith: { value: new THREE.Color('#1f2247') },
      uHorizon: { value: new THREE.Color('#e2845c') },
    };
    const skyGeo = new THREE.SphereGeometry(1, 16, 12);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying float vY;
        void main() {
          vY = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying float vY;
        void main() {
          float h = clamp(pow(max(vY, 0.0), 0.42), 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, h);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);

    // Studio environment map for metallic bike paint, chrome forks, and NPC clearcoat
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmremEnv = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.pmremEnv.texture;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3f3f46, 1.05);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sunLight.position.set(28, 48, 22);
    this.sunLight.castShadow = !this.isSoftwareGl && initialQuality !== 'low';
    this.sunLight.shadow.mapSize.set(initialQuality === 'high' ? 1024 : 512, initialQuality === 'high' ? 1024 : 512);
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    const d = 32;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 140;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.applyQuality(initialQuality);
    this.applyTheme(initialTheme);
  }

  applyTheme(theme: EnvironmentTheme): void {
    this.theme = theme;
    const preset = THEME_PRESETS[theme];

    this.skyUniforms.uZenith.value.copy(preset.zenith);
    this.skyUniforms.uHorizon.value.copy(preset.horizon);
    (this.scene.background as THREE.Color).copy(preset.horizon);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(preset.horizon);
      this.scene.fog.density = preset.fogDensity;
    }

    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunOffset = preset.sunOffset;

    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;
    this.renderer.toneMappingExposure = preset.exposure;
  }

  getTheme(): EnvironmentTheme {
    return this.theme;
  }

  applyQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.camera.far = quality === 'low' ? 320 : 520;
      this.camera.updateProjectionMatrix();
      this.skyMesh.scale.setScalar(this.camera.far * 0.88);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    if (quality === 'low') {
      // 500MB Safe profile: native 1x DPR, shadows off, compact far plane
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      if (this.sunLight) this.sunLight.castShadow = false;
      this.camera.far = 320;
      this.camera.updateProjectionMatrix();
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      this.renderer.shadowMap.enabled = true;
      if (this.sunLight) this.sunLight.castShadow = true;
      this.camera.far = 520;
      this.camera.updateProjectionMatrix();
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2));
      this.renderer.shadowMap.enabled = true;
      if (this.sunLight) this.sunLight.castShadow = true;
      this.camera.far = 650;
      this.camera.updateProjectionMatrix();
    }
    this.skyMesh.scale.setScalar(this.camera.far * 0.88);
  }

  getQuality(): GraphicsQuality {
    return this.quality;
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  updateSunFollow(playerZ: number): void {
    this.skyMesh.position.set(0, 0, playerZ);
    this.sunLight.position.set(this.sunOffset[0], this.sunOffset[1], playerZ + this.sunOffset[2]);
    this.sunLight.target.position.set(0, 0, playerZ - 18);
    this.sunLight.target.updateMatrixWorld();
  }

  precompile(): void {
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.skyMesh.geometry.dispose();
    (this.skyMesh.material as THREE.Material).dispose();
    this.pmremEnv?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
