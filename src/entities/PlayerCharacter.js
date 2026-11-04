import * as THREE from 'three';

export class PlayerCharacter {
  constructor(scene, isLocal = true, displayName = 'Agent', color = 0x00d9ff, initialHp = 100, maxHp = 100) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.displayName = displayName;
    this.color = color;
    this.hp = initialHp;
    this.maxHp = maxHp;

    this.group = new THREE.Group();
    this.speed = 7;
    this.sprintMultiplier = 1.6;

    // Jump & Physics
    this.velocityY = 0;
    this.gravity = -24;
    this.jumpForce = 9.5;
    this.isGrounded = true;

    // Remote network targets
    this.targetPosition = new THREE.Vector3();
    this.targetRotationY = 0;

    this.buildMesh();
    this.buildNameplate();
    this.scene.add(this.group);
  }

  buildMesh() {
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

    const visorGeo = new THREE.BoxGeometry(0.4, 0.15, 0.3);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.4, 0.4);
    this.group.add(visor);
  }

  // Dynamic 2D Canvas Billboard above player head
  buildNameplate() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false
    });

    this.nameplateSprite = new THREE.Sprite(spriteMat);
    this.nameplateSprite.position.set(0, 2.35, 0); // Position above the helmet
    this.nameplateSprite.scale.set(1.8, 0.68, 1);
    this.group.add(this.nameplateSprite);

    this.redrawNameplate();
  }

  redrawNameplate() {
    if (!this.ctx) return;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Semi-transparent dark backing
    ctx.fillStyle = 'rgba(5, 7, 10, 0.75)';
    ctx.roundRect(10, 6, 236, 84, 8);
    ctx.fill();

    // Callout border
    ctx.strokeStyle = this.isLocal ? '#00d9ff' : 'rgba(26, 54, 93, 0.8)';
    ctx.lineWidth = 2;
    ctx.roundRect(10, 6, 236, 84, 8);
    ctx.stroke();

    // Player Name
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.isLocal ? '#00ffff' : '#e0f0ff';
    const label = this.isLocal ? `${this.displayName} (YOU)` : this.displayName;
    ctx.fillText(label, 128, 34);

    // HP Bar Track
    const barX = 24;
    const barY = 46;
    const barW = 208;
    const barH = 12;

    ctx.fillStyle = '#1a202c';
    ctx.fillRect(barX, barY, barW, barH);

    // HP Fill
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    ctx.fillStyle = pct > 0.5 ? '#48bb78' : pct > 0.25 ? '#ecc94b' : '#f56565';
    ctx.fillRect(barX, barY, barW * pct, barH);

    // HP Text
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this.hp}/${this.maxHp} HP`, 128, 74);

    this.texture.needsUpdate = true;
  }

  setHp(newHp) {
    this.hp = Math.max(0, newHp);
    this.redrawNameplate();
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
    if (this.texture) this.texture.dispose();
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}