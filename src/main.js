import { authService, generateCallsign } from './services/authService.js';
import { authState } from './state/authState.js';
import { gameState } from './state/gameState.js';
import { authUI } from './ui/authUI.js';
import { lobbyUI } from './ui/lobbyUI.js';
import { memoryLogUI } from './ui/memoryLogUI.js';
import { chatUI } from './ui/chatUI.js';
import { pauseMenuUI } from './ui/pauseMenuUI.js';
import { agentDossierUI } from './ui/agentDossierUI.js';
import { roomService, getAgentColorHex } from './services/roomService.js';
import {
  runSessionService,
  ROOM_SNAPSHOT_INTERVAL_MS
} from './services/runSessionService.js';

import { SceneManager } from './engine/sceneManager.js';
import { CameraManager } from './engine/cameraManager.js';
import { InputManager } from './engine/inputManager.js';
import { NetworkSync } from './engine/networkSync.js';
import { PlayerCharacter } from './entities/PlayerCharacter.js';
import { AnomalyNode } from './entities/AnomalyNode.js';
import { MemoryLog } from './models/MemoryLog.js';
import { Player } from './models/Player.js';
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
let collectedAnomalies = new Set();
let memoryLog = null;
let hungerTicker = 0;
let gameLoopFrame = null;
let snapshotTimer = null;
let expiryTimer = null;
let lastActivityAt = 0;
let lastRoomActivityWriteAt = 0;
let lastRemoteSnapshotAt = 0;
let lastRemoteSnapshotData = '';
let isEndingRun = false;
let gameKeydownHandler = null;
let pendingRunSnapshot = null;

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
      • [P]: Agent Dossier (Storage &amp; Log)<br>
      • [ENTER]: Squad Comms Chat<br>
      • [ESC]: Pause Menu
    </div>
  `;

  updateSquadHUD();

  // Chat is only available in multiplayer sessions
  if (!isSolo) {
    chatUI.init(uiRoot);
  }
}

function spawnTestAnomalies() {
  const nodes = [
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

  anomalies = nodes.filter(node => {
    if (!collectedAnomalies.has(node.id)) return true;
    node.destroy();
    return false;
  });
}

function createRunSnapshot() {
  const player = authState.player;
  const uid = authState.currentUser?.uid;
  if (!player || !uid || !localPlayer) return null;

  const position = localPlayer.getPosition();
  player.stats.currentHealth = localPlayer.hp;
  player.lastPosition = { x: position.x, y: position.y, z: position.z };
  player.memoryLog = memoryLog.toJSON();

  return {
    player: player.toJSON(),
    position: player.lastPosition,
    rotationY: localPlayer.getRotation(),
    cameraYaw: cameraManager?.yaw || 0,
    cameraPitch: cameraManager?.pitch || 0,
    velocityY: localPlayer.velocityY,
    isGrounded: localPlayer.isGrounded,
    hungerTicker,
    memoryLog: player.memoryLog,
    collectedAnomalies: Array.from(collectedAnomalies),
    lastActivityAt
  };
}

async function persistRunSnapshot(forceRemote = false) {
  if (!isGameRunning || isEndingRun) return;
  const uid = authState.currentUser?.uid;
  const snapshot = createRunSnapshot();
  if (!uid || !snapshot) return;

  if (isSolo) {
    runSessionService.saveSoloRun(uid, snapshot);
  } else if (gameState.roomCode) {
    runSessionService.saveRoomResume(uid, gameState.roomCode, snapshot);
    if (forceRemote || Date.now() - lastRemoteSnapshotAt >= ROOM_SNAPSHOT_INTERVAL_MS) {
      const snapshotData = JSON.stringify(snapshot);
      if (forceRemote || snapshotData !== lastRemoteSnapshotData) {
        await runSessionService.saveRoomRun(gameState.roomCode, uid, snapshot);
        lastRemoteSnapshotData = snapshotData;
      }
      lastRemoteSnapshotAt = Date.now();
    }
  }
}

function markGameplayActivity() {
  if (!isGameRunning || isEndingRun) return;
  lastActivityAt = Date.now();

  if (!isSolo && gameState.roomCode && lastActivityAt - lastRoomActivityWriteAt >= 5000) {
    lastRoomActivityWriteAt = lastActivityAt;
    roomService.touchRoomActivity(gameState.roomCode, lastActivityAt).catch(error => {
      console.error('Could not update room activity:', error);
    });
  }
}

function checkRunExpiry() {
  if (!isGameRunning || isEndingRun || !runSessionService.isExpired(lastActivityAt)) return;
  expireCurrentRun().catch(error => {
    console.error('Could not expire the inactive run:', error);
  });
}

async function expireCurrentRun() {
  if (isEndingRun) return;
  isEndingRun = true;
  const uid = authState.currentUser?.uid;
  const activeRun = runSessionService.getActiveRun(uid);
  const roomCode = gameState.roomCode || (
    activeRun?.mode === 'multiplayer' ? activeRun.roomCode : null
  );

  try {
    if (roomCode) {
      const expired = await roomService.expireRoom(roomCode);
      if (!expired) return;
    }
    runSessionService.clearActiveRun(uid);
    teardownGame();
    gameState.clearRoom();
    if (uid) authState.setPlayer(new Player(uid, authState.currentUser?.displayName || 'Agent'));
    switchView('auth');
    authUI.setNotice('Your run ended after four hours without player input.');
  } finally {
    isEndingRun = false;
  }
}

async function endCurrentRun() {
  if (isEndingRun) return;
  isEndingRun = true;
  const uid = authState.currentUser?.uid;
  const activeRun = runSessionService.getActiveRun(uid);
  const roomCode = gameState.roomCode || (
    activeRun?.mode === 'multiplayer' ? activeRun.roomCode : null
  );

  try {
    if (roomCode && uid) {
      await roomService.leaveRoom(roomCode, uid);
    }
    runSessionService.clearActiveRun(uid);
    teardownGame();
    gameState.clearRoom();
    if (uid) authState.setPlayer(new Player(uid, authState.currentUser?.displayName || 'Agent'));
    switchView('auth');
  } finally {
    isEndingRun = false;
  }
}

function handleMissingRoom() {
  if (!isGameRunning || isSolo || isEndingRun) return;
  isEndingRun = true;
  runSessionService.clearActiveRun(authState.currentUser?.uid);
  teardownGame();
  if (gameState.currentRoom) gameState.clearRoom();
  const uid = authState.currentUser?.uid;
  if (uid) authState.setPlayer(new Player(uid, authState.currentUser?.displayName || 'Agent'));
  isEndingRun = false;
  switchView('auth');
  authUI.setNotice('The multiplayer room ended or expired. Your run has ended.');
}

function init3DWorld(snapshot = null) {
  if (isGameRunning) return;
  isGameRunning = true;
  const uid = authState.currentUser.uid;
  const roomRunState = gameState.currentRoom?.runState;
  snapshot = snapshot || pendingRunSnapshot || roomRunState?.players?.[uid] || null;
  pendingRunSnapshot = null;
  lastRemoteSnapshotAt = 0;
  lastRemoteSnapshotData = '';

  if (snapshot?.player) {
    authState.setPlayer(Player.fromJSON(snapshot.player));
  } else if (!authState.player) {
    authState.setPlayer(new Player(uid, authState.currentUser.displayName || 'Agent'));
  }

  collectedAnomalies = new Set([
    ...(snapshot?.collectedAnomalies || []),
    ...Object.keys(roomRunState?.collectedAnomalies || {})
  ]);
  const roomLastActivityAt = gameState.currentRoom?.lastActivityAt || 0;
  lastActivityAt = Math.max(roomLastActivityAt, snapshot?.lastActivityAt || 0) || Date.now();
  lastRoomActivityWriteAt = roomLastActivityAt || lastActivityAt;

  // Show the 3D canvas
  canvas.style.display = 'block';

  mountGameShell();

  memoryLog = snapshot?.memoryLog
    ? MemoryLog.fromJSON(snapshot.memoryLog, uid)
    : new MemoryLog(uid);
  if (!memoryLog.systemDirectives.some(directive => directive.id === 'sys-001')) {
    memoryLog.addDirective({
      id: 'sys-001',
      code: 'INIT_DIR',
      source: 'Automated Breach Core',
      message: 'To seal the fracture, evacuate through the violet rift immediately without verifying spatial anchor integrity.'
    });
  }

  // Pull chosen color from the active lobby room, fallback if solo
  const roomPlayer = gameState.currentRoom?.players?.[authState.currentUser?.uid];
  const myColorHex = roomPlayer?.color || getAgentColorHex(authState.currentUser?.uid);
  const callsign = roomPlayer?.displayName || authState.currentUser?.displayName || 'Agent';
  authState.player.displayName = callsign;

  sceneManager = new SceneManager(canvas);
  cameraManager = new CameraManager();
  localPlayer = new PlayerCharacter(
    sceneManager.scene,
    true,
    callsign,
    myColorHex,
    authState.player?.stats.currentHealth ?? 100,
    100
  );

  const savedPos = snapshot?.position || authState.player?.lastPosition;
  if (savedPos) {
    localPlayer.group.position.set(savedPos.x || 0, savedPos.y || 0, savedPos.z || 0);
  }
  localPlayer.group.rotation.y = snapshot?.rotationY || 0;
  if (snapshot?.cameraYaw !== undefined) cameraManager.yaw = snapshot.cameraYaw;
  if (snapshot?.cameraPitch !== undefined) cameraManager.pitch = snapshot.cameraPitch;
  if (snapshot?.velocityY !== undefined) localPlayer.velocityY = snapshot.velocityY;
  if (snapshot?.isGrounded !== undefined) localPlayer.isGrounded = snapshot.isGrounded;
  hungerTicker = snapshot?.hungerTicker || 0;

  inputManager = new InputManager(canvas, (deltaX, deltaY) => {
    cameraManager.handleMouseLook(deltaX, deltaY);
    markGameplayActivity();
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

  // Wire up the pause menu
  pauseMenuUI.init(memoryLog, endCurrentRun);

  gameKeydownHandler = (e) => {
    markGameplayActivity();
    // Prevent actions while typing into chat
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      // ESC = one step back through the stack:
      // pause sub-panel → pause main → close pause (resume) ← dossier
      if (pauseMenuUI.isOpen) {
        pauseMenuUI.handleEsc();
        return;
      }
      if (agentDossierUI.isOpen) { agentDossierUI.close(); return; }
      pauseMenuUI.toggle();
    }
    if (e.code === 'KeyP') {
      e.preventDefault();
      agentDossierUI.toggle(memoryLog);
    }
    if (e.code === 'KeyE') {
      handleProximityInteraction();
    }
  };
  window.addEventListener('keydown', gameKeydownHandler);

  let lastTime = performance.now();
  function gameLoop(currentTime) {
    if (!isGameRunning) return;
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
    if (activeKeys.forward || activeKeys.backward || activeKeys.left || activeKeys.right || activeKeys.jump) {
      markGameplayActivity();
    }

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

    gameLoopFrame = requestAnimationFrame(gameLoop);
  }
  gameLoopFrame = requestAnimationFrame(gameLoop);
  persistRunSnapshot(true).catch(error => console.error('Could not save the run snapshot:', error));
  snapshotTimer = setInterval(() => {
    persistRunSnapshot().catch(error => console.error('Could not save the run snapshot:', error));
  }, 1000);
  expiryTimer = setInterval(checkRunExpiry, 5000);
}

function handleProximityInteraction() {
  markGameplayActivity();
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
          showToast(`+ Acquired: ${node.itemData.name} (Press [P] to inspect)`);
        } else {
          showToast(`Grid Full! Cannot acquire: ${node.itemData.name}`);
          return;
        }
      }

      if (node.clueData) {
        memoryLog.addClue(node.clueData);
        player.sp += 2;
        showToast(`+ Verified Clue Unlocked: "${node.clueData.title}" (Press [P] → Clues)`);
      }

      collectedAnomalies.add(node.id);
      player.memoryLog = memoryLog.toJSON();
      if (!isSolo && gameState.roomCode) {
        runSessionService.saveCollectedAnomaly(gameState.roomCode, node.id).catch(error => {
          console.error('Could not sync the collected anomaly:', error);
        });
      }
      persistRunSnapshot(true).catch(error => console.error('Could not save the run snapshot:', error));
      updateSquadHUD();

      node.destroy();
      anomalies.splice(i, 1);
      break;
    }
  }
}

/**
 * Tear down the 3D world and reset all runtime state so the player can
 * return to the lobby without a page reload.
 */
function teardownGame() {
  isGameRunning = false;
  isSolo = false;
  if (gameLoopFrame !== null) {
    cancelAnimationFrame(gameLoopFrame);
    gameLoopFrame = null;
  }
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }
  if (gameKeydownHandler) {
    window.removeEventListener('keydown', gameKeydownHandler);
    gameKeydownHandler = null;
  }
  if (inputManager) {
    inputManager.destroy();
  }
  pauseMenuUI.close();
  agentDossierUI.close();

  // Stop network sync
  if (networkSync) {
    networkSync.destroy();
    networkSync = null;
  }
  chatUI.destroy();

  // Release pointer lock
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  // Dispose Three.js resources
  if (sceneManager) {
    sceneManager.dispose?.();
    sceneManager = null;
  }
  cameraManager?.destroy();
  cameraManager = null;
  inputManager = null;
  localPlayer = null;
  anomalies = [];
  collectedAnomalies = new Set();
  memoryLog = null;
  pendingRunSnapshot = null;
  hungerTicker = 0;

  // Mark not in game so switchView works
  gameState.setInGame(false);

  // Hide the 3D canvas so it doesn't bleed through the lobby/auth UI
  canvas.style.display = 'none';
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

uiRoot.addEventListener('start-solo-game', () => {
  const uid = authState.currentUser?.uid;
  if (!uid) return;
  authUI.setNotice('');
  authState.setPlayer(new Player(uid, authState.currentUser.displayName || 'Agent'));
  lastActivityAt = Date.now();
  runSessionService.setActiveRun(uid, { mode: 'solo', lastActivityAt });
  isSolo = true;
  gameState.setInGame(true);
  init3DWorld();
});

async function restoreActiveRun(user, displayName) {
  const activeRun = runSessionService.getActiveRun(user.uid);
  if (!activeRun) return false;

  if (activeRun.mode === 'solo' && activeRun.snapshot?.player) {
    if (runSessionService.isExpired(activeRun.snapshot.lastActivityAt)) {
      runSessionService.clearActiveRun(user.uid);
      authState.setPlayer(new Player(user.uid, displayName));
      authUI.setNotice('Your run ended after four hours without player input.');
      return true;
    }

    authState.setPlayer(Player.fromJSON(activeRun.snapshot.player));
    isSolo = true;
    gameState.setInGame(true);
    init3DWorld(activeRun.snapshot);
    return true;
  }

  if (activeRun.mode === 'solo') {
    runSessionService.clearActiveRun(user.uid);
    authState.setPlayer(new Player(user.uid, displayName));
    authUI.setNotice('The saved run could not be restored. A new run is ready.');
    return true;
  }

  if (activeRun.mode === 'multiplayer' && activeRun.roomCode) {
    try {
      await roomService.joinRoom(activeRun.roomCode, user);
      if (activeRun.snapshot?.player) {
        pendingRunSnapshot = activeRun.snapshot;
        authState.setPlayer(Player.fromJSON(activeRun.snapshot.player));
      } else {
        authState.setPlayer(new Player(user.uid, displayName));
      }
      switchView('lobby');
      lobbyUI.listenToRoom(activeRun.roomCode);
      return true;
    } catch (error) {
      console.error('Could not resume multiplayer run:', error);
      if (error.code === 'room/not-found' || error.code === 'room/expired') {
        runSessionService.clearActiveRun(user.uid);
      }
      authState.setPlayer(new Player(user.uid, displayName));
      authUI.setNotice(
        error.code === 'room/not-found' || error.code === 'room/expired'
          ? error.message
          : 'Could not reconnect to your multiplayer run. Refresh to try again.'
      );
      return true;
    }
  }

  runSessionService.clearActiveRun(user.uid);
  return false;
}

gameState.subscribe((state) => {
  const room = state.currentRoom;
  if (!room) {
    handleMissingRoom();
    return;
  }

  if (room.lastActivityAt && room.lastActivityAt > lastActivityAt) {
    lastActivityAt = room.lastActivityAt;
  }

  const sharedCollected = Object.keys(room.runState?.collectedAnomalies || {});
  sharedCollected.forEach(id => {
    if (collectedAnomalies.has(id)) return;
    collectedAnomalies.add(id);
    const nodeIndex = anomalies.findIndex(node => node.id === id);
    if (nodeIndex !== -1) {
      anomalies[nodeIndex].destroy();
      anomalies.splice(nodeIndex, 1);
    }
  });

  if (!isEndingRun && !isGameRunning && room.status === 'IN_PROGRESS') {
    isSolo = false;
    init3DWorld();
    updateSquadHUD();
  }
});

authService.onAuthChange(async (user) => {
  if (user) {
    if (!user.isAnonymous) {
      await authService.logout();
      return;
    }
    authState.setUser(user);
    let displayName = user.displayName || authService._pendingCallsign || '';
    authService._pendingCallsign = null;
    if (!displayName || /^Agent (Unknown|Guest|Host)$/i.test(displayName)) {
      try {
        displayName = await authService.setGuestCallsign(user, generateCallsign());
      } catch (error) {
        console.error('Could not assign a guest callsign:', error);
        displayName = generateCallsign();
      }
    }
    if (!await restoreActiveRun(user, displayName)) {
      authState.setPlayer(new Player(user.uid, displayName));
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

uiRoot.addEventListener('logout-request', async () => {
  try {
    await endCurrentRun();
    await authService.logout();
  } catch (error) {
    console.error('Could not log out:', error);
    authUI.setNotice(error.message || 'Could not log out. Please try again.');
  }
});

window.addEventListener('update-vitals', updateSquadHUD);
window.addEventListener('run-state-changed', () => {
  markGameplayActivity();
  persistRunSnapshot(true).catch(error => {
    console.error('Could not save the changed run state:', error);
  });
});
window.addEventListener('pointerdown', markGameplayActivity);
window.addEventListener('mousemove', () => {
  if (document.pointerLockElement === canvas) markGameplayActivity();
});
window.addEventListener('pagehide', () => {
  persistRunSnapshot(true).catch(error => {
    console.error('Could not save the run before closing:', error);
  });
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    persistRunSnapshot(true).catch(error => {
      console.error('Could not save the run before it was hidden:', error);
    });
  }
});

switchView('auth');