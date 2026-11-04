import { authService } from './services/authService.js';
import { databaseService } from './services/databaseService.js';
import { authState } from './state/authState.js';
import { gameState } from './state/gameState.js';
import { authUI } from './ui/authUI.js';
import { lobbyUI } from './ui/lobbyUI.js';

// 3D Engine imports
import { SceneManager } from './engine/sceneManager.js';
import { CameraManager } from './engine/cameraManager.js';
import { InputManager } from './engine/inputManager.js';
import { PlayerCharacter } from './entities/PlayerCharacter.js';

const uiRoot = document.getElementById('ui-root');
const canvas = document.getElementById('game-canvas');

let sceneManager = null;
let cameraManager = null;
let inputManager = null;
let localPlayer = null;
let isGameRunning = false;

function init3DWorld() {
  if (isGameRunning) return;
  isGameRunning = true;

  sceneManager = new SceneManager(canvas);
  cameraManager = new CameraManager();
  localPlayer = new PlayerCharacter(sceneManager.scene, true, authState.currentUser.displayName);

  inputManager = new InputManager(canvas, (deltaX, deltaY) => {
    cameraManager.handleMouseLook(deltaX, deltaY);
  });

  // Hide the UI panel so the 3D viewport takes over
  uiRoot.innerHTML = `
    <div style="position: absolute; top: 1rem; left: 1rem; color: #00d9ff; font-family: monospace; font-size: 0.85rem; pointer-events: none; background: rgba(5,7,10,0.7); padding: 0.5rem 1rem; border: 1px solid #1a365d;">
      CLICK TO LOCK MOUSE // WASD TO MOVE // SHIFT TO SPRINT
    </div>
  `;

  let lastTime = performance.now();
  function gameLoop(currentTime) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    localPlayer.update(deltaTime, inputManager.keys, cameraManager.yaw);
    cameraManager.update(localPlayer.getPosition());
    sceneManager.render(cameraManager.camera);

    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

function switchView(view) {
  if (view === 'auth') {
    authUI.init(uiRoot);
  } else if (view === 'lobby') {
    lobbyUI.init(uiRoot);
  }
}

uiRoot.addEventListener('nav-lobby', () => switchView('lobby'));
uiRoot.addEventListener('nav-profile', () => switchView('auth'));

gameState.subscribe((state) => {
  if (state.currentRoom && state.currentRoom.status === 'IN_PROGRESS') {
    init3DWorld();
  }
});

authService.onAuthChange(async (user) => {
  if (user) {
    authState.setUser(user);
    try {
      const player = await databaseService.getOrCreatePlayer(user);
      authState.setPlayer(player);
    } catch (error) {
      console.error('Failed to sync player:', error);
    }
  } else {
    authState.clear();
    gameState.clearRoom();
    switchView('auth');
  }
});

switchView('auth');