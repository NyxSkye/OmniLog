import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { Player } from '../models/Player.js';

export const databaseService = {
  // Fetch existing save or initialize a new blank slate
  async getOrCreatePlayer(user) {
    const playerDocRef = doc(db, 'players', user.uid);
    const snap = await getDoc(playerDocRef);

    if (snap.exists()) {
      return Player.fromFirestore(snap.data());
    }

    // Initialize new blank slate profile
    const newPlayer = new Player(user.uid, user.displayName || 'Amnesiac Agent');
    await setDoc(playerDocRef, newPlayer.toFirestore());
    return newPlayer;
  },

  // Save current player state
  async savePlayerProgress(player) {
    const playerDocRef = doc(db, 'players', player.uid);
    await updateDoc(playerDocRef, player.toFirestore());
  },

  // Add discovered anomaly to player's persistent log
  async recordClue(uid, clueId) {
    const playerDocRef = doc(db, 'players', uid);
    const snap = await getDoc(playerDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (!data.cluesFound.includes(clueId)) {
        const updatedClues = [...data.cluesFound, clueId];
        await updateDoc(playerDocRef, { cluesFound: updatedClues, lastSaved: Date.now() });
      }
    }
  }
};