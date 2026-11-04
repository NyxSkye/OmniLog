import { authService } from './services/authService.js';
import { databaseService } from './services/databaseService.js';
import { authState } from './state/authState.js';
import { gameState } from './state/gameState.js';
import { authUI } from './ui/authUI.js';
import { lobbyUI } from './ui/lobbyUI.js';

const uiRoot = document.getElementById('ui-root');

let currentView = 'auth'; // 'auth' | 'lobby' | 'game'

function switchView(view) {
  currentView = view;
  if (view === 'auth') {
    authUI.init(uiRoot);
  } else if (view === 'lobby') {
    lobbyUI.init(uiRoot);
  }
}

// Navigation event listeners
uiRoot.addEventListener('nav-lobby', () => switchView('lobby'));
uiRoot.addEventListener('nav-profile', () => switchView('auth'));

// React to game in-progress status from RTDB
gameState.subscribe((state) => {
  if (state.currentRoom && state.currentRoom.status === 'IN_PROGRESS') {
    uiRoot.innerHTML = `
      <div class="panel" style="text-align: center;">
        <h1 class="title">Incursion Commenced</h1>
        <p class="subtitle">Breaching dimensional boundary...</p>
        <p style="color:#00d9ff; font-size:0.9rem; margin-top:1rem;">Ready for 3D world & controller integration.</p>
      </div>
    `;
  }
});

// Boot auth listener
authService.onAuthChange(async (user) => {
  if (user) {
    authState.setUser(user);
    try {
      const player = await databaseService.getOrCreatePlayer(user);
      authState.setPlayer(player);
    } catch (error) {
      console.error('Failed to sync player document:', error);
    }
  } else {
    authState.clear();
    gameState.clearRoom();
    switchView('auth');
  }
});

// Initial boot
switchView('auth');