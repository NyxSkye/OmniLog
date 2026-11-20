import { ref, get, set, update, remove, onValue, onDisconnect, runTransaction } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { GameSession } from '../models/GameSession.js';
import { authService, normalizeCallsign } from './authService.js';
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

function normalizeColorHex(color) {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
    ? color.toLowerCase()
    : null;
}

function ensureUniquePlayerColors(players) {
  const updatedPlayers = { ...(players || {}) };
  const usedColors = new Set();
  const orderedPlayers = Object.entries(updatedPlayers).sort(([, a], [, b]) =>
    (a.joinedAt || 0) - (b.joinedAt || 0)
  );

  for (const [uid, player] of orderedPlayers) {
    let color = normalizeColorHex(player.color);
    if (!color || usedColors.has(color)) {
      color = AGENT_PALETTE.find(candidate => !usedColors.has(candidate.toLowerCase()))?.toLowerCase();
      if (!color) {
        throw new Error('Could not assign a unique color to every squad member.');
      }
    }

    usedColors.add(color);
    if (player.color !== color) {
      updatedPlayers[uid] = { ...player, color };
    }
  }

  return updatedPlayers;
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
    session.players[hostUser.uid].characterType = authService.getCharacterType(hostUser.uid);
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

    const playersRef = ref(rtdb, `rooms/${roomCode}/players`);
    const existingPlayer = roomData.players && roomData.players[user.uid];

    if (existingPlayer) {
      const result = await runTransaction(playersRef, players => {
        if (!players || !players[user.uid]) return;

        const uniquePlayers = ensureUniquePlayerColors(players);
        const currentPlayer = uniquePlayers[user.uid];
        const otherPlayers = Object.fromEntries(
          Object.entries(uniquePlayers).filter(([uid]) => uid !== user.uid)
        );
        const currentCallsign = currentPlayer.displayName || '';
        const requestedCallsign = /^Agent (Unknown|Guest|Host)$/i.test(currentCallsign)
          ? user.displayName
          : currentCallsign;

        return {
          ...uniquePlayers,
          [user.uid]: {
            ...currentPlayer,
            online: true,
            isReady: roomData.status === 'IN_PROGRESS' ? false : currentPlayer.isReady,
            characterType: authService.getCharacterType(user.uid),
            displayName: getUniqueCallsign(
              requestedCallsign || user.displayName,
              otherPlayers
            )
          }
        };
      }, { applyLocally: false });
      if (!result.committed) {
        throw new Error('Could not rejoin the room. Please try again.');
      }
      await this.touchRoomActivity(roomCode);

      const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}/online`);
      onDisconnect(onlineRef).set(false);
      return { isNewPlayer: false };
    }

    let alreadyJoined = false;
    let capacityReached = false;
    let noColorAvailable = false;
    const result = await runTransaction(playersRef, players => {
      alreadyJoined = false;
      capacityReached = false;
      noColorAvailable = false;

      const uniquePlayers = ensureUniquePlayerColors(players || {});
      if (uniquePlayers[user.uid]) {
        alreadyJoined = true;
        return uniquePlayers;
      }

      if (Object.keys(uniquePlayers).length >= (roomData.maxPlayers || 8)) {
        capacityReached = true;
        return;
      }

      const usedColors = new Set(
        Object.values(uniquePlayers).map(player => normalizeColorHex(player.color))
      );
      const assignedColor = AGENT_PALETTE.find(color => !usedColors.has(color.toLowerCase()));
      if (!assignedColor) {
        noColorAvailable = true;
        return;
      }

      return {
        ...uniquePlayers,
        [user.uid]: {
          uid: user.uid,
          displayName: getUniqueCallsign(user.displayName, uniquePlayers),
          characterType: authService.getCharacterType(user.uid),
          isReady: false,
          color: assignedColor,
          hp: 100,
          maxHp: 100,
          online: true,
          joinedAt: Date.now()
        }
      };
    }, { applyLocally: false });

    if (!result.committed) {
      if (capacityReached) {
        throw new Error('Chamber is at maximum capacity (8 players).');
      }
      if (noColorAvailable) {
        throw new Error('No unused agent colors are available.');
      }
      throw new Error('Could not join the room. Please try again.');
    }

    await this.touchRoomActivity(roomCode);

    const onlineRef = ref(rtdb, `rooms/${roomCode}/players/${user.uid}/online`);
    onDisconnect(onlineRef).set(false);

    return { isNewPlayer: !alreadyJoined };
  },

  // Update chosen color live in the lobby
  async updatePlayerColor(roomCode, uid, newColorHex) {
    const color = normalizeColorHex(newColorHex);
    if (!color) {
      throw new Error('Choose a valid six-digit hex color.');
    }

    let colorIsTaken = false;
    const playersRef = ref(rtdb, `rooms/${roomCode}/players`);
    const result = await runTransaction(playersRef, players => {
      colorIsTaken = false;
      if (!players || !players[uid]) return;

      const uniquePlayers = ensureUniquePlayerColors(players);
      colorIsTaken = Object.entries(uniquePlayers).some(
        ([playerUid, player]) => playerUid !== uid
          && normalizeColorHex(player.color) === color
      );
      if (colorIsTaken) return uniquePlayers;

      return {
        ...uniquePlayers,
        [uid]: { ...uniquePlayers[uid], color }
      };
    }, { applyLocally: false });

    if (!result.committed) {
      if (!result.snapshot.val()?.[uid]) {
        throw new Error('You are no longer in this room.');
      }
      throw new Error('Could not update your color. Please try again.');
    }
    if (colorIsTaken) {
      throw new Error('That color is already taken. Choose another color.');
    }

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