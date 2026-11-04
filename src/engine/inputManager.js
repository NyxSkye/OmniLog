export class InputManager {
  constructor(canvas, onMouseLook) {
    this.canvas = canvas;
    this.onMouseLook = onMouseLook;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    };

    this.isPointerLocked = false;
    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.onMouseLook) {
        this.onMouseLook(e.movementX, e.movementY);
      }
    });

    window.addEventListener('keydown', (e) => this.onKeyChange(e.code, true));
    window.addEventListener('keyup', (e) => this.onKeyChange(e.code, false));
  }

  onKeyChange(code, isPressed) {
    switch (code) {
      // Forward
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isPressed;
        break;

      // Backward
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isPressed;
        break;

      // Left (Strafe)
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isPressed;
        break;

      // Right (Strafe)
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isPressed;
        break;

      // Actions
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = isPressed;
        break;

      case 'Space':
        this.keys.jump = isPressed;
        break;
    }
  }
}