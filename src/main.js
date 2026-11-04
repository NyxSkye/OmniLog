import { authService } from './services/authService.js';
import { databaseService } from './services/databaseService.js';
import { authState } from './state/authState.js';
import { gameState } from './state/gameState.js';
import { authUI } from './ui/authUI.js';
import { lobbyUI } from './ui/lobbyUI.js';

import { SceneManager } from './engine/sceneManager.js';
import { CameraManager } from './engine/cameraManager.js';
import { InputManager } from './engine/inputManager.js';
import { NetworkSync } from './engine/networkSync.js';
import { PlayerCharacter } from './entities/PlayerCharacter.js';

const uiRoot = document.getElementById('ui-root');
const canvas = document.getElementById('game-canvas');

let sceneManager = null;
let cameraManager = null;
let inputManager = null;
let localPlayer = null;
let networkSync = null;
let isGameRunning = false;
let isSolo = false;

function renderInGameHUD() {
  const room = gameState.currentRoom;
  const isMultiplayer = !isSolo && room;
  const players = isMultiplayer 
    ? Object.values(room.players || {}) 
    : [{ displayName: authState.currentUser?.displayName || 'Agent Solo', isHost: true }];

  uiRoot.innerHTML = `
    <div class="game-hud">
      <div class="game-hud-header">
        <span class="game-hud-title">${isMultiplayer ? 'Squad Chamber' : 'Solo Sector'}</span>
        ${isMultiplayer ? `<span class="game-hud-code">${gameState.roomCode}</span>` : '<span style="color:#718096">OFFLINE</span>'}
      </div>
      <div class="hud-player-list">
        ${players.map(p => `
          <div class="hud-player-item">
            <span>${p.displayName}</span>
            <span style="color: #00d9ff; font-size: 0.7rem;">${p.isHost ? 'LEAD' : 'ACTIVE'}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="hud-controls-hint">
      <strong>CONTROLS:</strong><br>
      • WASD or ARROWS: Move / Strafe<br>
      • MOUSE: Free Orbit Camera<br>
      • SPACE: Jump<br>
      • SHIFT: Sprint
    </div>
  `;
}

function init3DWorld() {
  renderInGameHUD();

  if (isGameRunning) return;
  isGameRunning = true;

  sceneManager = new SceneManager(canvas);
  cameraManager = new CameraManager();
  localPlayer = new PlayerCharacter(sceneManager.scene, true, authState.currentUser?.displayName);

  inputManager = new InputManager(canvas, (deltaX, deltaY) => {
    cameraManager.handleMouseLook(deltaX, deltaY);
  });

  // Enable Real-Time Network Sync if in multiplayer room
  if (!isSolo && gameState.roomCode && authState.currentUser) {
    networkSync = new NetworkSync(
      gameState.roomCode,
      authState.currentUser.uid,
      localPlayer,
      sceneManager.scene
    );
  }

  let lastTime = performance.now();
  function gameLoop(currentTime) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    // Local physics update
    localPlayer.update(deltaTime, inputManager.keys, cameraManager.yaw);

    // Network broadcast & remote peer interpolation
    if (networkSync) {
      networkSync.update(currentTime, deltaTime);
    }

    // Camera follow & render
    cameraManager.update(localPlayer.getPosition());
    sceneManager.render(cameraManager.camera);

    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

function switchView(view) {
  if (gameState.isInGame) return;
  if (view === 'auth') {
    authUI.init(uiRoot);
  } else if (view === 'lobby') {
    lobbyUI.init(uiRoot);
  }
}

// Navigation event routing
uiRoot.addEventListener('nav-lobby', () => switchView('lobby'));
uiRoot.addEventListener('nav-profile', () => switchView('auth'));

uiRoot.addEventListener('start-solo-game', () => {
  isSolo = true;
  gameState.setInGame(true);
  init3DWorld();
});

// React to multiplayer match launch
gameState.subscribe((state) => {
  if (state.currentRoom && state.currentRoom.status === 'IN_PROGRESS') {
    isSolo = false;
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
    if (networkSync) {
      networkSync.destroy();
      networkSync = null;
    }
    authState.clear();
    gameState.clearRoom();
    switchView('auth');
  }
});

switchView('auth');