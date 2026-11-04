import * as THREE from 'three';

export class PlayerCharacter {
  constructor(scene, isLocal = true, displayName = 'Agent') {
    this.scene = scene;
    this.isLocal = isLocal;
    this.displayName = displayName;

    this.group = new THREE.Group();
    this.speed = 7;
    this.sprintMultiplier = 1.6;

    // Jump & Physics
    this.velocityY = 0;
    this.gravity = -24;
    this.jumpForce = 9.5;
    this.isGrounded = true;

    this.buildPlaceholderMesh();
    this.scene.add(this.group);
  }

  buildPlaceholderMesh() {
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

    const visorGeo = new THREE.BoxGeometry(0.4, 0.15, 0.3);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.4, 0.4);
    this.group.add(visor);
  }

  update(deltaTime, keys, cameraYaw) {
    if (!this.isLocal) return;

    // --- 1. Horizontal Movement (WASD) ---
    let moveX = 0;
    let moveZ = 0;

    if (keys.forward) moveZ -= 1;
    if (keys.backward) moveZ += 1;
    if (keys.left) moveX -= 1;
    if (keys.right) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      const cos = Math.cos(cameraYaw);
      const sin = Math.sin(cameraYaw);
      const worldX = moveX * cos - moveZ * sin;
      const worldZ = moveX * sin + moveZ * cos;

      const currentSpeed = (keys.sprint ? this.speed * this.sprintMultiplier : this.speed) * deltaTime;
      this.group.position.x += worldX * currentSpeed;
      this.group.position.z += worldZ * currentSpeed;

      const targetAngle = Math.atan2(worldX, worldZ);
      this.group.rotation.y = targetAngle;
    }

    // --- 2. Vertical Jump & Gravity ---
    if (keys.jump && this.isGrounded) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }

    this.velocityY += this.gravity * deltaTime;
    this.group.position.y += this.velocityY * deltaTime;

    // Floor collision baseline at y = 0
    if (this.group.position.y <= 0) {
      this.group.position.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }

  getPosition() {
    return this.group.position;
  }

  getRotation() {
    return this.group.rotation.y;
  }
}