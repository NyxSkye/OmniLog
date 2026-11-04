export class InputManager {
  constructor(canvas, onMouseLook) {
    this.canvas = canvas;
    this.onMouseLook = onMouseLook;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false
    };

    this.isPointerLocked = false;
    this.initEvents();
  }

  initEvents() {
    // Request pointer lock on canvas click
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.onMouseLook) {
        this.onMouseLook(e.movementX, e.movementY);
      }
    });

    // Keydown
    window.addEventListener('keydown', (e) => this.onKeyChange(e.code, true));
    window.addEventListener('keyup', (e) => this.onKeyChange(e.code, false));
  }

  onKeyChange(code, isPressed) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isPressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isPressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isPressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isPressed;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = isPressed;
        break;
    }
  }
}