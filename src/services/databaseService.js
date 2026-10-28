import { ref, get, set, update } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { Player } from '../models/Player.js';

export const databaseService = {
  // Fetch existing save or initialize a new blank slate via Realtime Database
  async getOrCreatePlayer(user) {
    const playerRef = ref(rtdb, `players/${user.uid}`);
    const snap = await get(playerRef);

    if (snap.exists()) {
      return Player.fromFirestore(snap.val());
    }

    const newPlayer = new Player(user.uid, user.displayName || 'Amnesiac Agent');
    await set(playerRef, newPlayer.toFirestore());
    return newPlayer;
  },

  // Save current player state
  async savePlayerProgress(player) {
    const playerRef = ref(rtdb, `players/${player.uid}`);
    await update(playerRef, player.toFirestore());
  },

  // Add discovered anomaly to player's persistent log
  async recordClue(uid, clueId) {
    const playerRef = ref(rtdb, `players/${uid}`);
    const snap = await get(playerRef);
    if (snap.exists()) {
      const data = snap.val();
      const clues = data.cluesFound || [];
      if (!clues.includes(clueId)) {
        clues.push(clueId);
        await update(playerRef, { cluesFound: clues, lastSaved: Date.now() });
      }
    }
  }
};