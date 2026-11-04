import { ref, get, set, update, remove, onValue, onDisconnect } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { GameSession } from '../models/GameSession.js';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ROOM_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function getAgentColor(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const c = 0.8;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return (Math.round((r + 0.2) * 255) << 16) +
         (Math.round((g + 0.2) * 255) << 8) +
         Math.round((b + 0.2) * 255);
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
    const color = getAgentColor(hostUser.uid);
    const session = new GameSession(roomCode, hostUser.uid, hostUser.displayName || 'Agent');
    
    session.players[hostUser.uid].color = color;
    session.players[hostUser.uid].online = true;
    session.players[hostUser.uid].hp = 100;
    session.players[hostUser.uid].maxHp = 100;

    await set(roomRef, session.toJSON());

    // Flag offline on network disconnect
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

    // 5-minute empty room expiration check
    if (roomData.emptySince && (now - roomData.emptySince > ROOM_EXPIRY_MS)) {
      await remove(roomRef);
      await remove(ref(rtdb, `rooms/${roomCode}/transforms`));
      throw new Error(`Room [${roomCode}] has expired due to 5 minutes of inactivity.`);
    }

    const existingPlayer = roomData.players && roomData.players[user.uid];

    // Rejoining an existing slot
    if (existingPlayer) {
      await update(ref(rtdb, `rooms/${roomCode}/players/${user.uid}`), {
        online: true,
        displayName: user.displayName || existingPlayer.displayName
      });
      // Clear empty timer if active
      await update(ref(rtdb, `rooms/${roomCode}`), { emptySince: null });

      const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}/online`);
      onDisconnect(onlineRef).set(false);
      return roomData;
    }

    // Joining new slot
    if (roomData.status !== 'LOBBY') {
      throw new Error('Mission already in progress. Only existing squad members can rejoin.');
    }

    const currentCount = Object.keys(roomData.players || {}).length;
    if (currentCount >= (roomData.maxPlayers || 8)) {
      throw new Error('Chamber is at maximum capacity (8 players).');
    }

    const color = getAgentColor(user.uid);
    const playerRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}`);
    await set(playerRef, {
      uid: user.uid,
      displayName: user.displayName || 'Agent Guest',
      isReady: false,
      color: color,
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
      // Mark empty timestamp to start the 5-minute expiry window
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