import { 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser
} from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { auth, rtdb } from '../config/firebase.js';

export const authService = {
  // Holds a callsign set before onAuthStateChanged fires, so getOrCreatePlayer
  // can use the correct name even if updateProfile hasn't resolved yet.
  _pendingCallsign: null,

  // Listen to auth state transitions
  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Anonymous instant guest play
  async loginAsGuest(customName = 'Agent Unknown') {
    this._pendingCallsign = customName;
    const credential = await signInAnonymously(auth);
    await updateProfile(credential.user, { displayName: customName });
    return credential.user;
  },

  // Permanent account registration
  async registerWithEmail(email, password, displayName) {
    this._pendingCallsign = displayName;
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    return credential.user;
  },

  // Login existing agent
  async loginWithEmail(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  // Sign out — if anonymous, wipe the player record and delete the auth account entirely
  async logout() {
    const user = auth.currentUser;
    if (user) {
      // Always remove the player profile from the database
      await remove(ref(rtdb, `players/${user.uid}`));

      if (user.isAnonymous) {
        // Delete the throwaway Firebase Auth account so it doesn't pile up
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