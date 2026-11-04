import * as THREE from 'three';

export class PlayerCharacter {
  constructor(scene, isLocal = true, displayName = 'Agent', color = 0x00d9ff) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.displayName = displayName;
    this.color = color;

    this.group = new THREE.Group();
    this.speed = 7;
    this.sprintMultiplier = 1.6;

    // Jump & Physics
    this.velocityY = 0;
    this.gravity = -24;
    this.jumpForce = 9.5;
    this.isGrounded = true;

    // Remote network interpolation targets
    this.targetPosition = new THREE.Vector3();
    this.targetRotationY = 0;

    this.buildMesh();
    this.scene.add(this.group);
  }

  buildMesh() {
    // Body capsule tinted with the character's unique designated color
    const bodyGeo = new THREE.CapsuleGeometry(0.5, 1.0, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.35,
      metalness: 0.6
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    this.group.add(body);

    // Visor indicating orientation
    const visorGeo = new THREE.BoxGeometry(0.4, 0.15, 0.3);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.4, 0.4);
    this.group.add(visor);
  }

  update(deltaTime, keys, cameraYaw) {
    if (this.isLocal) {
      this.updateLocal(deltaTime, keys, cameraYaw);
    } else {
      this.updateRemote(deltaTime);
    }
  }

  updateLocal(deltaTime, keys, cameraYaw) {
    let inputX = 0;
    let inputZ = 0;

    if (keys.forward) inputZ += 1;
    if (keys.backward) inputZ -= 1;
    if (keys.left) inputX -= 1;
    if (keys.right) inputX += 1;

    const isMoving = inputX !== 0 || inputZ !== 0;

    if (isMoving) {
      const length = Math.hypot(inputX, inputZ);
      const normX = inputX / length;
      const normZ = inputZ / length;

      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);

      const moveDirectionX = (forwardX * normZ) + (rightX * normX);
      const moveDirectionZ = (forwardZ * normZ) + (rightZ * normX);

      const currentSpeed = (keys.sprint ? this.speed * this.sprintMultiplier : this.speed) * deltaTime;
      this.group.position.x += moveDirectionX * currentSpeed;
      this.group.position.z += moveDirectionZ * currentSpeed;

      this.group.rotation.y = Math.atan2(moveDirectionX, moveDirectionZ);
    }

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

  updateRemote(deltaTime) {
    const lerpFactor = Math.min(deltaTime * 18, 1);
    this.group.position.lerp(this.targetPosition, lerpFactor);

    let diff = this.targetRotationY - this.group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.group.rotation.y += diff * lerpFactor;
  }

  setNetworkTransform(x, y, z, rotY) {
    this.targetPosition.set(x, y, z);
    this.targetRotationY = rotY;
  }

  getPosition() {
    return this.group.position;
  }

  getRotation() {
    return this.group.rotation.y;
  }

  destroy() {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}