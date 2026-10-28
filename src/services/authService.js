import { 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../config/firebase.js';

export const authService = {
  // Listen to auth state transitions
  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Anonymous instant guest play
  async loginAsGuest(customName = 'Agent Unknown') {
    const credential = await signInAnonymously(auth);
    await updateProfile(credential.user, { displayName: customName });
    return credential.user;
  },

  // Permanent account registration
  async registerWithEmail(email, password, displayName) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    return credential.user;
  },

  // Login existing agent
  async loginWithEmail(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  // Sign out
  async logout() {
    return await signOut(auth);
  },

  getCurrentUser() {
    return auth.currentUser;
  }
};