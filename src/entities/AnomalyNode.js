import * as THREE from 'three';

export class AnomalyNode {
  constructor(scene, id, position, itemData, clueData = null) {
    this.scene = scene;
    this.id = id;
    this.itemData = itemData;
    this.clueData = clueData;
    this.isScanned = false;
    this.interactionRadius = 3.2;

    this.group = new THREE.Group();
    this.group.position.copy(position);

    this.buildMesh();
    this.scene.add(this.group);
  }

  buildMesh() {
    // Unstable floating anomaly core
    const coreGeo = new THREE.OctahedronGeometry(0.6, 0);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x9b51e0,
      emissive: 0x5a189a,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8
    });
    this.core = new THREE.Mesh(coreGeo, this.coreMat);
    this.core.position.y = 1.2;
    this.group.add(this.core);

    // Orbital ring
    const ringGeo = new THREE.TorusGeometry(0.9, 0.04, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff, wireframe: true });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.position.y = 1.2;
    this.group.add(this.ring);

    // Beacon pillar
    const light = new THREE.PointLight(0x9b51e0, 2, 8);
    light.position.y = 1.2;
    this.group.add(light);
  }

  update(delta, time) {
    if (this.core) {
      this.core.rotation.y += 0.8 * delta;
      this.core.position.y = 1.2 + Math.sin(time * 2.5) * 0.15;
    }
    if (this.ring) {
      this.ring.rotation.x += 1.2 * delta;
      this.ring.rotation.y += 0.6 * delta;
    }
  }

  checkProximity(playerPos) {
    const dist = this.group.position.distanceTo(playerPos);
    return dist <= this.interactionRadius;
  }

  markScanned() {
    this.isScanned = true;
    this.coreMat.color.setHex(0x00f0ff);
    this.coreMat.emissive.setHex(0x005577);
  }

  destroy() {
    this.scene.remove(this.group);
  }
}