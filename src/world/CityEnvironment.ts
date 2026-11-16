import * as THREE from 'three';
import { LoadedCityAsset } from '../core/AssetManager';
import { EnvironmentTheme, HIGHWAY_CONSTANTS } from '../systems/GameConfig';

export class CityEnvironment {
  public readonly group = new THREE.Group();
  private tiles: THREE.Group[] = [];
  private tileSpanZ: number;
  private groundPlane: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private groundGeo: THREE.PlaneGeometry;

  constructor(cityAsset: LoadedCityAsset, lowMem = false) {
    this.group.name = 'CityEnvironmentSystem';

    this.groundGeo = new THREE.PlaneGeometry(2000, 2000);
    this.groundGeo.rotateX(-Math.PI / 2);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x3b424c,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.groundPlane = new THREE.Mesh(this.groundGeo, this.groundMat);
    this.groundPlane.position.y = -0.38;
    this.groundPlane.receiveShadow = !lowMem;
    this.group.add(this.groundPlane);

    // 2 compact leapfrogging flanking city corridor tiles (33% fewer meshes/draw calls vs 3)
    const halfCityX = Math.max(120, cityAsset.size.x * 0.5);
    const clearanceFromCenter = HIGHWAY_CONSTANTS.ROAD_WIDTH * 0.5 + 18.0;
    this.tileSpanZ = Math.max(360, cityAsset.size.z * 0.94);

    const tileCount = 2;
    for (let i = 0; i < tileCount; i++) {
      const tile = new THREE.Group();

      const leftCity = cityAsset.prototype.clone(true);
      leftCity.position.set(-(clearanceFromCenter + halfCityX), -1.35, 0);
      tile.add(leftCity);

      const rightCity = cityAsset.prototype.clone(true);
      rightCity.rotation.y = Math.PI;
      rightCity.position.set(clearanceFromCenter + halfCityX, -1.35, 0);
      tile.add(rightCity);

      tile.position.z = -i * this.tileSpanZ;
      this.tiles.push(tile);
      this.group.add(tile);
    }
  }

  setTheme(theme: EnvironmentTheme): void {
    this.groundMat.color.setHex(theme === 'night' ? 0x111827 : theme === 'sunset' ? 0x322b38 : 0x3b424c);
  }

  update(playerZ: number): void {
    this.groundPlane.position.z = playerZ - 200;
    const totalSpan = this.tileSpanZ * this.tiles.length;

    for (const tile of this.tiles) {
      if (tile.position.z > playerZ + this.tileSpanZ * 0.85) {
        tile.position.z -= totalSpan;
      } else if (tile.position.z < playerZ - totalSpan + this.tileSpanZ * 0.85) {
        tile.position.z += totalSpan;
      }
    }
  }

  dispose(): void {
    this.groundGeo.dispose();
    this.groundMat.dispose();
  }
}
