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
    this.handleCanvasClick = () => {
      if (!this.isPointerLocked) {
        this.canvas.requestPointerLock();
      }
    };

    this.handlePointerLockChange = () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    };

    this.handleMouseMove = (e) => {
      if (this.isPointerLocked && this.onMouseLook) {
        this.onMouseLook(e.movementX, e.movementY);
      }
    };

    this.handleKeyDown = e => this.onKeyChange(e.code, true);
    this.handleKeyUp = e => this.onKeyChange(e.code, false);

    this.canvas.addEventListener('click', this.handleCanvasClick);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  destroy() {
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
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