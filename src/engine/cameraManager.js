import * as THREE from 'three';

export class CameraManager {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    this.distance = 4.2;
    this.minDistance = 2.8;
    this.maxDistance = 9;
    this.shoulderOffset = 0.55;
    this.pitch = 0.28;
    this.yaw = 0;

    this.minPitch = -0.15;
    this.maxPitch = Math.PI / 2.15;

    this.currentPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.desiredLookAt = new THREE.Vector3();

    this.handleResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    this.handleWheel = (event) => {
      this.distance += event.deltaY * 0.004;
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    };
    this.handleWheelWithPrevent = (event) => {
      event.preventDefault();
      this.handleWheel(event);
    };
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('wheel', this.handleWheelWithPrevent, { passive: false });
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('wheel', this.handleWheelWithPrevent);
  }

  handleMouseLook(deltaX, deltaY) {
    const sensitivity = 0.0022;
    this.yaw -= deltaX * sensitivity;
    this.pitch += deltaY * sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
  }

  update(targetPosition, deltaTime = 1 / 60) {
    const horizontalDistance = this.distance * Math.cos(this.pitch);
    const offsetX = horizontalDistance * Math.sin(this.yaw);
    const offsetZ = horizontalDistance * Math.cos(this.yaw);
    const offsetY = this.distance * Math.sin(this.pitch);

    const rightX = Math.cos(this.yaw) * this.shoulderOffset;
    const rightZ = -Math.sin(this.yaw) * this.shoulderOffset;

    this.desiredPosition.set(
      targetPosition.x + offsetX + rightX,
      targetPosition.y + offsetY + 1.55,
      targetPosition.z + offsetZ + rightZ
    );
    this.desiredPosition.y = Math.max(targetPosition.y + 0.85, this.desiredPosition.y);

    const positionLerp = 1 - Math.exp(-deltaTime * 14);
    this.currentPosition.lerp(this.desiredPosition, positionLerp);
    this.camera.position.copy(this.currentPosition);

    this.desiredLookAt.set(
      targetPosition.x,
      targetPosition.y + 1.3,
      targetPosition.z
    );
    const lookLerp = 1 - Math.exp(-deltaTime * 18);
    this.targetLookAt.lerp(this.desiredLookAt, lookLerp);
    this.camera.lookAt(this.targetLookAt);
  }
}