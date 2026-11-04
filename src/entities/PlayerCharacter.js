import * as THREE from 'three';

export class PlayerCharacter {
  constructor(scene, isLocal = true, displayName = 'Agent') {
    this.scene = scene;
    this.isLocal = isLocal;
    this.displayName = displayName;

    this.group = new THREE.Group();
    this.speed = 7;
    this.sprintMultiplier = 1.6;

    this.buildPlaceholderMesh();
    this.scene.add(this.group);
  }

  buildPlaceholderMesh() {
    // Body capsule
    const bodyGeo = new THREE.CapsuleGeometry(0.5, 1.0, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.isLocal ? 0x00d9ff : 0xffaa00,
      roughness: 0.3,
      metalness: 0.7
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    this.group.add(body);

    // Visor indicating look direction
    const visorGeo = new THREE.BoxGeometry(0.4, 0.15, 0.3);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.4, 0.4);
    this.group.add(visor);
  }

  update(deltaTime, keys, cameraYaw) {
    if (!this.isLocal) return;

    let moveX = 0;
    let moveZ = 0;

    if (keys.forward) moveZ -= 1;
    if (keys.backward) moveZ += 1;
    if (keys.left) moveX -= 1;
    if (keys.right) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      // Normalize diagonal speed
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      // Rotate movement vector relative to camera yaw
      const cos = Math.cos(cameraYaw);
      const sin = Math.sin(cameraYaw);
      const worldX = moveX * cos - moveZ * sin;
      const worldZ = moveX * sin + moveZ * cos;

      const currentSpeed = (keys.sprint ? this.speed * this.sprintMultiplier : this.speed) * deltaTime;
      this.group.position.x += worldX * currentSpeed;
      this.group.position.z += worldZ * currentSpeed;

      // Orient avatar toward movement direction
      const angle = Math.atan2(worldX, worldZ);
      this.group.rotation.y = angle;
    }
  }

  getPosition() {
    return this.group.position;
  }

  getRotation() {
    return this.group.rotation.y;
  }
}