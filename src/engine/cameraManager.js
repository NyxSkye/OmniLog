import * as THREE from 'three';

export class CameraManager {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    this.distance = 6;
    this.pitch = 0.25;
    this.yaw = 0;

    this.minPitch = -0.2;
    this.maxPitch = Math.PI / 2.5;

    this.currentPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  handleMouseLook(deltaX, deltaY) {
    const sensitivity = 0.0025;
    this.yaw -= deltaX * sensitivity;
    this.pitch += deltaY * sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
  }

  update(targetPosition) {
    const offsetX = this.distance * Math.sin(this.yaw) * Math.cos(this.pitch);
    const offsetZ = this.distance * Math.cos(this.yaw) * Math.cos(this.pitch);
    const offsetY = this.distance * Math.sin(this.pitch);

    const desiredPosition = new THREE.Vector3(
      targetPosition.x + offsetX,
      targetPosition.y + offsetY + 1.6,
      targetPosition.z + offsetZ
    );

    this.currentPosition.lerp(desiredPosition, 0.15);
    this.camera.position.copy(this.currentPosition);

    const desiredLookAt = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + 1.3,
      targetPosition.z
    );
    this.targetLookAt.lerp(desiredLookAt, 0.15);
    this.camera.lookAt(this.targetLookAt);
  }
}