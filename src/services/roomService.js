import { ref, get, set, update, remove, onValue, onDisconnect } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { GameSession } from '../models/GameSession.js';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const roomService = {
  // Generate a random 6-character case-sensitive alphanumeric code
  generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
    }
    return code;
  },

  // Create a new room with collision check
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
    const session = new GameSession(roomCode, hostUser.uid, hostUser.displayName || 'Agent Host');

    await set(roomRef, session.toJSON());

    // Auto-remove player if connection drops
    const playerRef = ref(rtdb, `rooms/${roomCode}/players/${hostUser.uid}`);
    onDisconnect(playerRef).remove();

    return roomCode;
  },

  // Join an existing room (strictly preserves 6-character case)
  async joinRoom(roomCode, user) {
    if (!roomCode || roomCode.length !== 6) {
      throw new Error('Room code must be exactly 6 characters.');
    }

    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const snap = await get(roomRef);

    if (!snap.exists()) {
      throw new Error(`Room [${roomCode}] not found. Notice that codes are case-sensitive.`);
    }

    const roomData = snap.val();
    const currentCount = Object.keys(roomData.players || {}).length;

    if (currentCount >= (roomData.maxPlayers || 8)) {
      throw new Error('Room is at maximum capacity (8 players).');
    }

    if (roomData.status !== 'LOBBY') {
      throw new Error('Mission already in progress in this room.');
    }

    // Add player to room
    const playerRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}`);
    await set(playerRef, {
      uid: user.uid,
      displayName: user.displayName || 'Agent Guest',
      isHost: false,
      isReady: false,
      joinedAt: Date.now()
    });

    onDisconnect(playerRef).remove();

    return roomData;
  },

  // Real-time listener for lobby state
  subscribeToRoom(roomCode, callback) {
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    return onValue(roomRef, (snapshot) => {
      callback(snapshot.val());
    });
  },

  // Toggle ready status
  async toggleReady(roomCode, uid, currentReadyState) {
    const readyRef = ref(rtdb, `rooms/${roomCode}/players/${uid}/isReady`);
    await set(readyRef, !currentReadyState);
  },

  // Host triggers mission launch
  async startGame(roomCode) {
    const statusRef = ref(rtdb, `rooms/${roomCode}/status`);
    await set(statusRef, 'IN_PROGRESS');
  },

  // Leave room gracefully with host reassignment if needed
  async leaveRoom(roomCode, uid) {
    const roomRef = ref(rtdb, `rooms/${roomCode}`);
    const snap = await get(roomRef);

    if (!snap.exists()) return;

    const data = snap.val();
    const players = data.players || {};
    delete players[uid];

    const remainingUids = Object.keys(players);

    if (remainingUids.length === 0) {
      // Clean up empty room
      await remove(roomRef);
    } else {
      const updates = {};
      updates[`rooms/${roomCode}/players/${uid}`] = null;

      // Reassign host if the host departed
      if (data.hostUid === uid) {
        const nextHostUid = remainingUids[0];
        updates[`rooms/${roomCode}/hostUid`] = nextHostUid;
        updates[`rooms/${roomCode}/players/${nextHostUid}/isHost`] = true;
        updates[`rooms/${roomCode}/players/${nextHostUid}/isReady`] = true;
      }

      await update(ref(rtdb), updates);
    }
  }
};