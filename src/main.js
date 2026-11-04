import { authService } from './services/authService.js';
import { databaseService } from './services/databaseService.js';
import { authState } from './state/authState.js';
import { gameState } from './state/gameState.js';
import { authUI } from './ui/authUI.js';
import { lobbyUI } from './ui/lobbyUI.js';
import { roomService, getAgentColor } from './services/roomService.js';

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
  const currentUid = authState.currentUser?.uid;

  let players = [];
  if (isMultiplayer) {
    const rawList = Object.values(room.players || {});
    // Always pin current player to index 0
    players = rawList.sort((a, b) => {
      if (a.uid === currentUid) return -1;
      if (b.uid === currentUid) return 1;
      return 0;
    });
  } else {
    players = [{
      uid: currentUid,
      displayName: authState.currentUser?.displayName || 'Agent Solo',
      hp: 100,
      maxHp: 100
    }];
  }

  uiRoot.innerHTML = `
    <!-- Top-Right Docked Squad HUD -->
    <div class="game-hud">
      <div class="game-hud-header">
        <span class="game-hud-title">${isMultiplayer ? 'Squad Chamber' : 'Solo Sector'}</span>
        ${isMultiplayer ? `<span class="game-hud-code">${gameState.roomCode}</span>` : '<span style="color:#718096">OFFLINE</span>'}
      </div>
      <div class="hud-player-list">
        ${players.map(p => {
          const isSelf = p.uid === currentUid;
          const hp = p.hp || 100;
          const maxHp = p.maxHp || 100;
          const hpPercent = (hp / maxHp) * 100;
          const dotColor = (p.color || 0x00d9ff).toString(16).padStart(6, '0');

          return `
            <div style="padding: 0.35rem 0.5rem; background: ${isSelf ? 'rgba(0,217,255,0.08)' : 'transparent'}; border-left: 2px solid #${dotColor}; margin-bottom: 0.3rem;">
              <div class="hud-player-item">
                <span style="display: flex; align-items: center; gap: 0.4rem;">
                  <strong>${p.displayName}</strong>
                  ${isSelf ? '<span class="you-badge">YOU</span>' : ''}
                </span>
                <span style="color: #48bb78; font-size: 0.7rem; font-weight: bold;">${hp}/${maxHp}</span>
              </div>
              <div class="hp-bar-track">
                <div class="hp-bar-fill" style="width: ${hpPercent}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Controls Overlay -->
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

  const myColor = getAgentColor(authState.currentUser.uid);

  sceneManager = new SceneManager(canvas);
  cameraManager = new CameraManager();
  localPlayer = new PlayerCharacter(
    sceneManager.scene,
    true,
    authState.currentUser?.displayName,
    myColor,
    100,
    100
  );

  inputManager = new InputManager(canvas, (deltaX, deltaY) => {
    cameraManager.handleMouseLook(deltaX, deltaY);
  });

  if (!isSolo && gameState.roomCode && authState.currentUser) {
    networkSync = new NetworkSync(
      gameState.roomCode,
      authState.currentUser.uid,
      localPlayer,
      sceneManager.scene,
      myColor
    );
  }

  let lastTime = performance.now();
  function gameLoop(currentTime) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    localPlayer.update(deltaTime, inputManager.keys, cameraManager.yaw);

    if (networkSync) {
      networkSync.update(currentTime, deltaTime);
    }

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

uiRoot.addEventListener('nav-lobby', () => switchView('lobby'));
uiRoot.addEventListener('nav-profile', () => switchView('auth'));

uiRoot.addEventListener('start-solo-game', () => {
  isSolo = true;
  gameState.setInGame(true);
  init3DWorld();
});

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