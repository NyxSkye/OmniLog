import * as THREE from 'three';

export class PlayerCharacter {
  constructor(scene, isLocal = true, displayName = 'Agent') {
    this.scene = scene;
    this.isLocal = isLocal;
    this.displayName = displayName;

    this.group = new THREE.Group();
    this.speed = 7;
    this.sprintMultiplier = 1.6;

    // Jump & Vertical Physics
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

    // --- 1. Movement Vector Relative to Camera Yaw ---
    let inputX = 0; // -1 = Left, +1 = Right
    let inputZ = 0; // -1 = Backward, +1 = Forward

    if (keys.forward) inputZ += 1;
    if (keys.backward) inputZ -= 1;
    if (keys.left) inputX -= 1;
    if (keys.right) inputX += 1;

    const isMoving = inputX !== 0 || inputZ !== 0;

    if (isMoving) {
      // Normalize diagonal movement speed
      const length = Math.hypot(inputX, inputZ);
      const normX = inputX / length;
      const normZ = inputZ / length;

      // The camera looks along (-sin(yaw), -cos(yaw)).
      // Camera forward vector:
      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);

      // Camera right vector (perpendicular):
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);

      // Combine forward/backward with left/right strafe
      const moveDirectionX = (forwardX * normZ) + (rightX * normX);
      const moveDirectionZ = (forwardZ * normZ) + (rightZ * normX);

      const currentSpeed = (keys.sprint ? this.speed * this.sprintMultiplier : this.speed) * deltaTime;
      this.group.position.x += moveDirectionX * currentSpeed;
      this.group.position.z += moveDirectionZ * currentSpeed;

      // Rotate avatar mesh to face movement direction
      this.group.rotation.y = Math.atan2(moveDirectionX, moveDirectionZ);
    }

    // --- 2. Vertical Jump & Gravity ---
    if (keys.jump && this.isGrounded) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }

    this.velocityY += this.gravity * deltaTime;
    this.group.position.y += this.velocityY * deltaTime;

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