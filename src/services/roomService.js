import { ref, get, set, update, remove, onValue, onDisconnect, runTransaction } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { GameSession } from '../models/GameSession.js';
import { normalizeCallsign } from './authService.js';
import { RUN_EXPIRY_MS } from './runSessionService.js';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const AGENT_PALETTE = [
  '#00f0ff', // 0: Cyan
  '#ff0055', // 1: Neon Crimson / Pink
  '#00ff66', // 2: Matrix Green
  '#ffaa00', // 3: Amber / Orange
  '#b026ff', // 4: Neon Purple
  '#ffea00', // 5: Electric Yellow
  '#00a8ff', // 6: Azure Blue
  '#ff7675'  // 7: Coral
];

export function getAgentColorHex(uid) {
  if (!uid) return AGENT_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AGENT_PALETTE.length;
  return AGENT_PALETTE[index];
}

function getUniqueCallsign(requestedName, players) {
  const baseName = normalizeCallsign(requestedName) || 'Agent';
  const takenNames = new Set(
    Object.values(players || {}).map(player => (player.displayName || '').toLowerCase())
  );
  if (!takenNames.has(baseName.toLowerCase())) return baseName;

  for (let suffix = 2; ; suffix++) {
    const suffixText = `-${suffix}`;
    const uniqueName = `${baseName.slice(0, 24 - suffixText.length)}${suffixText}`;
    if (!takenNames.has(uniqueName.toLowerCase())) return uniqueName;
  }
}

export const roomService = {
  generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
    }
    return code;
  },

  async createRoom(hostUser) {
    let roomCode = '';
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
      roomCode = this.generateRoomCode();
      const checkRef = ref(rtdb, `rooms/${roomCode}`);
      const snap = await get(checkRef);
      exists = snap.exists();
      if (exists) {
        const existingRoom = snap.val();
        const lastActivityAt = existingRoom.lastActivityAt || existingRoom.createdAt || 0;
        if (Date.now() - lastActivityAt >= RUN_EXPIRY_MS) {
          await this.expireRoom(roomCode);
          exists = (await get(checkRef)).exists();
        }
      }
      attempts++;
    }

    if (exists) {
      throw new Error('Failed to generate unique room code. Try again.');
    }

    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const defaultColor = AGENT_PALETTE[0]; // Host gets slot 0 (Cyan) by default
    const session = new GameSession(
      roomCode,
      hostUser.uid,
      normalizeCallsign(hostUser.displayName) || 'Agent'
    );

    session.players[hostUser.uid].color = defaultColor;
    session.players[hostUser.uid].online = true;
    session.players[hostUser.uid].hp = 100;
    session.players[hostUser.uid].maxHp = 100;
    session.lastActivityAt = Date.now();

    await set(roomRef, session.toJSON());

    const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${hostUser.uid}/online`);
    onDisconnect(onlineRef).set(false);

    return roomCode;
  },

  async joinRoom(roomCode, user) {
    if (!roomCode || roomCode.length !== 6) {
      const error = new Error('Room code must be exactly 6 characters.');
      error.code = 'room/invalid-code';
      throw error;
    }

    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const snap = await get(roomRef);

    if (!snap.exists()) {
      const error = new Error(`Room [${roomCode}] not found. Codes are case-sensitive.`);
      error.code = 'room/not-found';
      throw error;
    }

    const now = Date.now();

    let roomData = snap.val();
    const lastActivityAt = roomData.lastActivityAt || roomData.createdAt || 0;
    if (now - lastActivityAt >= RUN_EXPIRY_MS) {
      const expired = await this.expireRoom(roomCode);
      if (expired) {
        const error = new Error(`Room [${roomCode}] expired after four hours without player input.`);
        error.code = 'room/expired';
        throw error;
      }

      const refreshedRoom = await get(roomRef);
      if (!refreshedRoom.exists()) {
        const error = new Error(`Room [${roomCode}] expired after four hours without player input.`);
        error.code = 'room/expired';
        throw error;
      }
      roomData = refreshedRoom.val();
    }

    const existingPlayer = roomData.players && roomData.players[user.uid];

    if (existingPlayer) {
      const otherPlayers = Object.fromEntries(
        Object.entries(roomData.players).filter(([uid]) => uid !== user.uid)
      );
      const currentCallsign = existingPlayer.displayName || '';
      const requestedCallsign = /^Agent (Unknown|Guest|Host)$/i.test(currentCallsign)
        ? user.displayName
        : currentCallsign;
      await update(ref(rtdb, `rooms/${roomCode}/players/${user.uid}`), {
        online: true,
        displayName: getUniqueCallsign(
          requestedCallsign || user.displayName,
          otherPlayers
        )
      });
      await this.touchRoomActivity(roomCode);

      const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}/online`);
      onDisconnect(onlineRef).set(false);
      return roomData;
    }

    if (roomData.status !== 'LOBBY') {
      throw new Error('Mission already in progress. Only existing squad members can rejoin.');
    }

    const currentPlayers = Object.values(roomData.players || {});
    if (currentPlayers.length >= (roomData.maxPlayers || 8)) {
      throw new Error('Chamber is at maximum capacity (8 players).');
    }

    // Default color assigned strictly by join order
    const nextSlotIndex = currentPlayers.length % AGENT_PALETTE.length;
    const assignedColor = AGENT_PALETTE[nextSlotIndex];
    const callsign = getUniqueCallsign(user.displayName, roomData.players);

    const playerRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}`);
    await set(playerRef, {
      uid: user.uid,
      displayName: callsign,
      isReady: false,
      color: assignedColor,
      hp: 100,
      maxHp: 100,
      online: true,
      joinedAt: Date.now()
    });
    await this.touchRoomActivity(roomCode);

    const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}/online`);
    onDisconnect(onlineRef).set(false);

    return roomData;
  },

  // Update chosen color live in the lobby
  async updatePlayerColor(roomCode, uid, newColorHex) {
    const colorRef = ref(rtdb, `rooms/${roomCode}/players/${uid}/color`);
    await set(colorRef, newColorHex);
    await this.touchRoomActivity(roomCode);
  },

  subscribeToRoom(roomCode, callback) {
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    let expiryTimer = null;
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      const room = snapshot.val();
      if (!room) {
        callback(null);
        return;
      }

      const lastActivityAt = room.lastActivityAt || room.createdAt || 0;
      const expiresIn = RUN_EXPIRY_MS - (Date.now() - lastActivityAt);
      if (expiresIn <= 0) {
        this.expireRoom(roomCode).catch(error => {
          console.error(`Could not expire room [${roomCode}]:`, error);
        });
      } else {
        expiryTimer = setTimeout(() => {
          this.expireRoom(roomCode).catch(error => {
            console.error(`Could not expire room [${roomCode}]:`, error);
          });
        }, expiresIn);
      }

      callback(room);
    });
    return () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      unsubscribe();
    };
  },

  async toggleReady(roomCode, uid, currentReadyState) {
    const readyRef = ref(rtdb, `rooms/${roomCode}/players/${uid}/isReady`);
    await set(readyRef, !currentReadyState);
    await this.touchRoomActivity(roomCode);
  },

  async startGame(roomCode) {
    const now = Date.now();
    await update(ref(rtdb, `rooms/${roomCode}`), {
      status: 'IN_PROGRESS',
      lastActivityAt: now,
      runState: {
        collectedAnomalies: {},
        players: {}
      }
    });
  },

  async leaveRoom(roomCode, uid) {
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return;

    const data = snap.val();
    const players = data.players || {};
    if (!players[uid]) return;
    delete players[uid];

    const remainingUids = Object.keys(players);
    if (remainingUids.length === 0) {
      await remove(roomRef);
    } else {
      const updates = {};
      updates[`rooms/${roomCode}/players/${uid}`] = null;
      updates[`rooms/${roomCode}/transforms/${uid}`] = null;
      updates[`rooms/${roomCode}/runState/players/${uid}`] = null;
      updates[`rooms/${roomCode}/lastActivityAt`] = Date.now();

      if (data.hostUid === uid) {
        updates[`rooms/${roomCode}/hostUid`] = remainingUids[0];
      }
      await update(ref(rtdb), updates);
    }
  },

  async touchRoomActivity(roomCode, timestamp = Date.now()) {
    await update(ref(rtdb, `rooms/${roomCode}`), { lastActivityAt: timestamp });
  },

  async expireRoom(roomCode) {
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const result = await runTransaction(roomRef, room => {
      if (!room) return;
      const lastActivityAt = room.lastActivityAt || room.createdAt || 0;
      if (Date.now() - lastActivityAt < RUN_EXPIRY_MS) return;
      return null;
    }, { applyLocally: false });
    return result.committed && !result.snapshot.exists();
  },

};