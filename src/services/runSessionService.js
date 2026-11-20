import { ref, set } from 'firebase/database';
import { rtdb } from '../config/firebase.js';

export const RUN_EXPIRY_MS = 4 * 60 * 60 * 1000;
export const ROOM_SNAPSHOT_INTERVAL_MS = 10 * 1000;

const activeRunKey = uid => `omnilog:active-run:${uid}`;

export const runSessionService = {
  getActiveRun(uid) {
    if (!uid) return null;

    const raw = localStorage.getItem(activeRunKey(uid));
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error('Could not read the saved run session:', error);
      localStorage.removeItem(activeRunKey(uid));
      return null;
    }
  },

  setActiveRun(uid, activeRun) {
    if (!uid) return;
    localStorage.setItem(activeRunKey(uid), JSON.stringify(activeRun));
  },

  clearActiveRun(uid) {
    if (!uid) return;
    localStorage.removeItem(activeRunKey(uid));
  },

  isExpired(lastActivityAt) {
    return !Number.isFinite(lastActivityAt) || Date.now() - lastActivityAt >= RUN_EXPIRY_MS;
  },

  saveSoloRun(uid, snapshot) {
    this.setActiveRun(uid, { mode: 'solo', snapshot });
  },

  saveRoomResume(uid, roomCode, snapshot) {
    this.setActiveRun(uid, { mode: 'multiplayer', roomCode, snapshot });
  },

  async saveRoomRun(roomCode, uid, snapshot) {
    await set(ref(rtdb, `rooms/${roomCode}/runState/players/${uid}`), snapshot);
  },

  async saveCollectedAnomaly(roomCode, anomalyId) {
    await set(ref(rtdb, `rooms/${roomCode}/runState/collectedAnomalies/${anomalyId}`), true);
  },

};
