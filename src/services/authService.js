import { 
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser
} from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { auth, rtdb } from '../config/firebase.js';

const CALLSIGN_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCallsign() {
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += CALLSIGN_CHARACTERS.charAt(
      Math.floor(Math.random() * CALLSIGN_CHARACTERS.length)
    );
  }
  return `Agent-${suffix}`;
}

export function normalizeCallsign(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .slice(0, 24);
}

export const authService = {
  // Holds a callsign until Firebase's auth-state callback sees the guest user.
  _pendingCallsign: null,
  _pendingCharacterType: null,

  getCharacterType(uid) {
    return localStorage.getItem(`omnilog:character-type:${uid}`) === 'female'
      ? 'female'
      : 'male';
  },

  setCharacterType(uid, characterType) {
    localStorage.setItem(
      `omnilog:character-type:${uid}`,
      characterType === 'female' ? 'female' : 'male'
    );
  },

  // Listen to auth state transitions
  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Anonymous instant guest play
  async loginAsGuest(customName = generateCallsign(), characterType = 'male') {
    const callsign = normalizeCallsign(customName) || generateCallsign();
    const selectedCharacter = characterType === 'female' ? 'female' : 'male';
    this._pendingCallsign = callsign;
    this._pendingCharacterType = selectedCharacter;
    const credential = await signInAnonymously(auth);
    this.setCharacterType(credential.user.uid, selectedCharacter);
    await this.setGuestCallsign(credential.user, callsign);
    return credential.user;
  },

  async setGuestCallsign(user, requestedCallsign) {
    const callsign = normalizeCallsign(requestedCallsign) || generateCallsign();
    await updateProfile(user, { displayName: callsign });
    return callsign;
  },

  // Sign out and discard the temporary guest identity.
  async logout() {
    const user = auth.currentUser;
    if (user) {
      if (user.isAnonymous) {
        await remove(ref(rtdb, `players/${user.uid}`));
        await deleteUser(user);
      } else {
        await signOut(auth);
      }
    }
  },

  getCurrentUser() {
    return auth.currentUser;
  }
};