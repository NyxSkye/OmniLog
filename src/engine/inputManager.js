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
      jump: false,
      // Arrow keys dedicated to camera rotation
      arrowUp: false,
      arrowDown: false,
      arrowLeft: false,
      arrowRight: false
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
      // WASD: Movement only
      case 'KeyW':
        this.keys.forward = isPressed;
        break;
      case 'KeyS':
        this.keys.backward = isPressed;
        break;
      case 'KeyA':
        this.keys.left = isPressed;
        break;
      case 'KeyD':
        this.keys.right = isPressed;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = isPressed;
        break;
      case 'Space':
        this.keys.jump = isPressed;
        break;

      // Arrow Keys: Look & Direction turning
      case 'ArrowUp':
        this.keys.arrowUp = isPressed;
        break;
      case 'ArrowDown':
        this.keys.arrowDown = isPressed;
        break;
      case 'ArrowLeft':
        this.keys.arrowLeft = isPressed;
        break;
      case 'ArrowRight':
        this.keys.arrowRight = isPressed;
        break;
    }
  }
}