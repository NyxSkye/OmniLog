import { ref, get, set, update, remove, onValue, onDisconnect } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { GameSession } from '../models/GameSession.js';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ROOM_EXPIRY_MS = 5 * 60 * 1000;

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
      attempts++;
    }

    if (exists) {
      throw new Error('Failed to generate unique room code. Try again.');
    }

    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const defaultColor = AGENT_PALETTE[0]; // Host gets slot 0 (Cyan) by default
    const session = new GameSession(roomCode, hostUser.uid, hostUser.displayName || 'Agent Host');

    session.players[hostUser.uid].color = defaultColor;
    session.players[hostUser.uid].online = true;
    session.players[hostUser.uid].hp = 100;
    session.players[hostUser.uid].maxHp = 100;

    await set(roomRef, session.toJSON());

    const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${hostUser.uid}/online`);
    onDisconnect(onlineRef).set(false);

    return roomCode;
  },

  async joinRoom(roomCode, user) {
    if (!roomCode || roomCode.length !== 6) {
      throw new Error('Room code must be exactly 6 characters.');
    }

    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const snap = await get(roomRef);

    if (!snap.exists()) {
      throw new Error(`Room [${roomCode}] not found. Codes are case-sensitive.`);
    }

    const roomData = snap.val();
    const now = Date.now();

    if (roomData.emptySince && (now - roomData.emptySince > ROOM_EXPIRY_MS)) {
      await remove(roomRef);
      await remove(ref(rtdb, `rooms/${roomCode}/transforms`));
      throw new Error(`Room [${roomCode}] has expired due to 5 minutes of inactivity.`);
    }

    const existingPlayer = roomData.players && roomData.players[user.uid];

    if (existingPlayer) {
      await update(ref(rtdb, `rooms/${roomCode}/players/${user.uid}`), {
        online: true,
        displayName: user.displayName || existingPlayer.displayName
      });
      await update(ref(rtdb, `rooms/${roomCode}`), { emptySince: null });

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

    const playerRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}`);
    await set(playerRef, {
      uid: user.uid,
      displayName: user.displayName || 'Agent Guest',
      isReady: false,
      color: assignedColor,
      hp: 100,
      maxHp: 100,
      online: true,
      joinedAt: Date.now()
    });

    await update(ref(rtdb, `rooms/${roomCode}`), { emptySince: null });

    const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}/online`);
    onDisconnect(onlineRef).set(false);

    return roomData;
  },

  // Update chosen color live in the lobby
  async updatePlayerColor(roomCode, uid, newColorHex) {
    const colorRef = ref(rtdb, `rooms/${roomCode}/players/${uid}/color`);
    await set(colorRef, newColorHex);
  },

  subscribeToRoom(roomCode, callback) {
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    return onValue(roomRef, (snapshot) => {
      callback(snapshot.val());
    });
  },

  async toggleReady(roomCode, uid, currentReadyState) {
    const readyRef = ref(rtdb, `rooms/${roomCode}/players/${uid}/isReady`);
    await set(readyRef, !currentReadyState);
  },

  async startGame(roomCode) {
    const statusRef = ref(rtdb, `rooms/${roomCode}/status`);
    await set(statusRef, 'IN_PROGRESS');
  },

  async leaveRoom(roomCode, uid) {
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return;

    const data = snap.val();
    const players = data.players || {};
    delete players[uid];

    const remainingUids = Object.keys(players);
    if (remainingUids.length === 0) {
      await update(ref(rtdb, `rooms/${roomCode}`), {
        emptySince: Date.now()
      });
      await remove(ref(rtdb, `rooms/${roomCode}/transforms`));
    } else {
      const updates = {};
      updates[`rooms/${roomCode}/players/${uid}`] = null;
      updates[`rooms/${roomCode}/transforms/${uid}`] = null;

      if (data.hostUid === uid) {
        updates[`rooms/${roomCode}/hostUid`] = remainingUids[0];
      }
      await update(ref(rtdb), updates);
    }
  }
};