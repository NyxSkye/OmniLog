import { authService } from './services/authService.js';
import { databaseService } from './services/databaseService.js';
import { authState } from './state/authState.js';
import { gameState } from './state/gameState.js';
import { authUI } from './ui/authUI.js';
import { lobbyUI } from './ui/lobbyUI.js';
import { inventoryUI } from './ui/inventoryUI.js';
import { memoryLogUI } from './ui/memoryLogUI.js';
import { chatUI } from './ui/chatUI.js';
import { roomService, getAgentColorHex } from './services/roomService.js';

import { SceneManager } from './engine/sceneManager.js';
import { CameraManager } from './engine/cameraManager.js';
import { InputManager } from './engine/inputManager.js';
import { NetworkSync } from './engine/networkSync.js';
import { PlayerCharacter } from './entities/PlayerCharacter.js';
import { AnomalyNode } from './entities/AnomalyNode.js';
import { MemoryLog } from './models/MemoryLog.js';
import * as THREE from 'three';

const uiRoot = document.getElementById('ui-root');
const canvas = document.getElementById('game-canvas');

let sceneManager = null;
let cameraManager = null;
let inputManager = null;
let localPlayer = null;
let networkSync = null;
let isGameRunning = false;
let isSolo = false;

let anomalies = [];
let memoryLog = null;
let hungerTicker = 0;

function showToast(msg) {
  let toast = document.getElementById('pickup-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pickup-toast';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2500);
}

function updateSquadHUD() {
  const hudContainer = document.getElementById('squad-hud-container');
  if (!hudContainer) return;

  const room = gameState.currentRoom;
  const isMultiplayer = !isSolo && room;
  const currentUid = authState.currentUser?.uid;

  // Retrieve room-selected color first, fallback to join-order/hash
  const roomPlayer = room?.players?.[currentUid];
  const myColorHex = roomPlayer?.color || getAgentColorHex(currentUid);

  let players = [];
  if (isMultiplayer) {
    const rawList = Object.values(room.players || {});
    players = rawList.sort((a, b) => (a.uid === currentUid ? -1 : b.uid === currentUid ? 1 : 0));
  } else {
    players = [{
      uid: currentUid,
      displayName: authState.currentUser?.displayName || 'Agent Solo',
      color: myColorHex,
      hp: authState.player?.stats.currentHealth || 100,
      hunger: authState.player?.stats.currentHunger || 100
    }];
  }

  hudContainer.innerHTML = `
    <div class="game-hud">
      <div class="game-hud-header">
        <span class="game-hud-title">${isMultiplayer ? 'Squad Chamber' : 'Solo Sector'}</span>
        ${isMultiplayer ? `<span class="game-hud-code">${gameState.roomCode}</span>` : '<span style="color:#718096">OFFLINE</span>'}
      </div>
      <div class="hud-player-list">
        ${players.map(p => {
          const isSelf = p.uid === currentUid;
          const hp = isSelf && authState.player ? authState.player.stats.currentHealth : (p.hp || 100);
          const hunger = isSelf && authState.player ? (authState.player.stats.currentHunger ?? 100) : (p.hunger ?? 100);
          const colorHex = isSelf ? myColorHex : (p.color || getAgentColorHex(p.uid));

          return `
            <div style="padding: 0.35rem 0.5rem; background: ${isSelf ? 'rgba(0,217,255,0.08)' : 'transparent'}; border-left: 3px solid ${colorHex}; margin-bottom: 0.4rem;">
              <div class="hud-player-item">
                <span style="display: flex; align-items: center; gap: 0.4rem;">
                  <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${colorHex}; box-shadow: 0 0 6px ${colorHex};"></span>
                  <strong>${p.displayName}</strong>
                  ${isSelf ? '<span class="you-badge">YOU</span>' : ''}
                </span>
                <span style="color: #48bb78; font-size: 0.7rem; font-weight: bold;">${hp} HP</span>
              </div>
              <div class="hp-bar-track"><div class="hp-bar-fill" style="width: ${(hp / 100) * 100}%;"></div></div>

              <div style="display:flex; justify-content:space-between; font-size:0.6rem; color:#718096; margin-top:0.25rem;">
                <span>VITALITY / HUNGER</span>
                <span style="color:#e67e22;">${isNaN(hunger) ? 100 : hunger}%</span>
              </div>
              <div class="hunger-bar-track"><div class="hunger-bar-fill" style="width: ${(isNaN(hunger) ? 100 : hunger)}%;"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function mountGameShell() {
  uiRoot.innerHTML = `
    <!-- Top-Right HUD Container -->
    <div id="squad-hud-container"></div>

    <!-- Proximity Prompt -->
    <div id="interact-prompt" style="display:none; position:absolute; top:65%; left:50%; transform:translate(-50%,-50%); color:#00f0ff; background:rgba(10,16,26,0.9); border:1px solid #00d9ff; padding:0.6rem 1.2rem; font-family:monospace; font-size:0.9rem; pointer-events:none; border-radius:3px;">
      [E] RUMMAGE & INSPECT ANOMALY
    </div>

    <!-- Controls Hint -->
    <div class="hud-controls-hint">
      <strong>CONTROLS:</strong><br>
      • WASD: Move | MOUSE: Orbit Camera | SPACE: Jump<br>
      • [E]: Inspect / Scavenge Anomaly<br>
      • [M]: Grid Storage & Equip<br>
      • [TAB]: Memory Log (Clues & Directives)<br>
      • [ENTER]: Squad Comms Chat
    </div>
  `;

  updateSquadHUD();
  chatUI.init(uiRoot);
}

function spawnTestAnomalies() {
  anomalies = [
    new AnomalyNode(
      sceneManager.scene,
      'node-1',
      new THREE.Vector3(5, 0, 5),
      {
        name: 'Ration Pack (High-Calorie)',
        type: 'FOOD',
        nutrition: 35,
        systemDescription: 'Standard-issue compressed field ration. Safe to digest and relieves hunger.'
      }
    ),
    new AnomalyNode(
      sceneManager.scene,
      'node-2',
      new THREE.Vector3(-6, 0, 6),
      {
        name: 'Expedition Tactical Rig',
        type: 'BACKPACK',
        extraSlots: 6,
        systemDescription: 'Lightweight tactical harness with modular pouches. Expands inventory grid by 6 slots.'
      }
    ),
    new AnomalyNode(
      sceneManager.scene,
      'node-3',
      new THREE.Vector3(0, 0, -8),
      {
        name: 'Dimensional Prowler Membrane',
        type: 'RESEARCH',
        researchData: 'Contains latent electromagnetic frequencies from Sector 4 breach.',
        systemDescription: 'Non-consumable organic residue. Can be analyzed for research by qualified personnel.'
      },
      {
        id: 'clue-breach-origin',
        title: 'Artificial Fracture Resonance',
        description: 'The anomaly tear was not naturally opened; resonance harmonics prove an interior transmitter forced the portal.'
      }
    )
  ];
}

function init3DWorld() {
  if (isGameRunning) return;
  isGameRunning = true;

  mountGameShell();

  memoryLog = new MemoryLog(authState.currentUser.uid);
  memoryLog.addDirective({
    id: 'sys-001',
    code: 'INIT_DIR',
    source: 'Automated Breach Core',
    message: 'To seal the fracture, evacuate through the violet rift immediately without verifying spatial anchor integrity.'
  });

  // Pull chosen color from the active lobby room, fallback if solo
  const roomPlayer = gameState.currentRoom?.players?.[authState.currentUser?.uid];
  const myColorHex = roomPlayer?.color || getAgentColorHex(authState.currentUser?.uid);

  sceneManager = new SceneManager(canvas);
  cameraManager = new CameraManager();
  localPlayer = new PlayerCharacter(
    sceneManager.scene,
    true,
    authState.currentUser?.displayName,
    myColorHex,
    authState.player?.stats.currentHealth || 100,
    100
  );

  inputManager = new InputManager(canvas, (deltaX, deltaY) => {
    cameraManager.handleMouseLook(deltaX, deltaY);
  });

  spawnTestAnomalies();

  if (!isSolo && gameState.roomCode && authState.currentUser) {
    networkSync = new NetworkSync(
      gameState.roomCode,
      authState.currentUser.uid,
      localPlayer,
      sceneManager.scene,
      myColorHex
    );
  }

  // Keybindings: M [Inventory], Tab [Memory Log], E [Interact]
  window.addEventListener('keydown', (e) => {
    // Prevent actions while typing into chat
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      return;
    }

    if (e.code === 'KeyM') {
      inventoryUI.toggle();
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      memoryLogUI.toggle(memoryLog);
    }
    if (e.code === 'KeyE') {
      handleProximityInteraction();
    }
  });

  window.addEventListener('update-vitals', () => {
    updateSquadHUD();
  });

  let lastTime = performance.now();
  function gameLoop(currentTime) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    // Movement lock while typing in chat
    const isTyping = document.activeElement && document.activeElement.tagName === 'INPUT';
    const activeKeys = isTyping ? {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    } : inputManager.keys;

    localPlayer.update(deltaTime, activeKeys, cameraManager.yaw);

    const playerPos = localPlayer.getPosition();
    let promptActive = false;

    anomalies.forEach(node => {
      node.update(deltaTime, currentTime * 0.001);
      if (node.checkProximity(playerPos)) {
        promptActive = true;
      }
    });

    const promptEl = document.getElementById('interact-prompt');
    if (promptEl) {
      promptEl.style.display = promptActive ? 'block' : 'none';
    }

    // Hunger drain ticker
    hungerTicker += deltaTime;
    if (hungerTicker >= 12) {
      hungerTicker = 0;
      if (authState.player) {
        authState.player.stats.currentHunger = Math.max(0, (authState.player.stats.currentHunger ?? 100) - 1);
        if (authState.player.stats.currentHunger === 0) {
          authState.player.stats.currentHealth = Math.max(1, authState.player.stats.currentHealth - 2);
          localPlayer.setHp(authState.player.stats.currentHealth);
        }
        updateSquadHUD();
      }
    }

    if (networkSync) {
      networkSync.update(currentTime, deltaTime);
    }

    cameraManager.update(localPlayer.getPosition());
    sceneManager.render(cameraManager.camera);

    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

function handleProximityInteraction() {
  const playerPos = localPlayer.getPosition();
  const player = authState.player;

  for (let i = anomalies.length - 1; i >= 0; i--) {
    const node = anomalies[i];
    if (node.checkProximity(playerPos)) {
      node.markScanned();

      if (node.itemData) {
        const added = player.addItem(node.itemData);
        if (added) {
          memoryLog.addDailyEntry(`Scavenged: ${node.itemData.name}`);
          showToast(`+ Acquired: ${node.itemData.name} (Press [M] to inspect)`);
        } else {
          showToast(`Grid Full! Cannot acquire: ${node.itemData.name}`);
          return;
        }
      }

      if (node.clueData) {
        memoryLog.addClue(node.clueData);
        player.sp += 2;
        showToast(`+ Verified Clue Unlocked: "${node.clueData.title}" (Press [TAB])`);
      }

      databaseService.savePlayerProgress(player);
      updateSquadHUD();

      node.destroy();
      anomalies.splice(i, 1);
      break;
    }
  }
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
    updateSquadHUD();
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