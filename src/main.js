import { authService } from './services/authService.js';
import { databaseService } from './services/databaseService.js';
import { authState } from './state/authState.js';
import { authUI } from './ui/authUI.js';

const uiRoot = document.getElementById('ui-root');

// Initialize the Auth interface
authUI.init(uiRoot);

// Listen for authentication changes across sessions
authService.onAuthChange(async (user) => {
  if (user) {
    authState.setUser(user);
    try {
      // Restore save or initialize blank-slate agent profile
      const player = await databaseService.getOrCreatePlayer(user);
      authState.setPlayer(player);
    } catch (error) {
      console.error('Failed to sync player document:', error);
    }
  } else {
    authState.clear();
  }
});