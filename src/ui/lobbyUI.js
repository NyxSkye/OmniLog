import { roomService } from '../services/roomService.js';
import { gameState } from '../state/gameState.js';
import { authState } from '../state/authState.js';

export const lobbyUI = {
  container: null,
  errorMessage: '',

  init(containerElement) {
    this.container = containerElement;
    gameState.subscribe(() => this.render());
    this.render();
  },

  render() {
    if (!this.container) return;

    // If the game has launched, prevent the lobby from overwriting the in-game HUD
    if (gameState.isInGame) return;

    if (gameState.currentRoom) {
      this.renderActiveLobby();
    } else {
      this.renderRoomSelector();
    }
  },

  renderRoomSelector() {
    this.container.innerHTML = `
      <div class="panel">
        <h1 class="title">Matchmaking Uplink</h1>
        <p class="subtitle">Join or Deploy a Dimensional Squad (2–8 Players)</p>

        <div class="form-group">
          <button type="button" id="btn-create-room">Create New Room</button>
        </div>

        <div style="text-align: center; margin: 1rem 0; color: #718096; font-size: 0.8rem;">— OR ENTER DISPATCH CODE —</div>

        <div class="form-group">
          <label for="room-input">6-Character Key (Case-Sensitive)</label>
          <input 
            type="text" 
            id="room-input" 
            placeholder="e.g. aB9xZ2" 
            maxlength="6" 
            style="letter-spacing: 0.25em; text-align: center; font-size: 1.25rem;"
          />
        </div>

        <div class="button-stack">
          <button type="button" id="btn-join-room" class="secondary">Join Squad</button>
          <button type="button" id="btn-back-profile" class="secondary">Back to Agent Dossier</button>
        </div>

        ${this.errorMessage ? `<p class="error-text">${this.errorMessage}</p>` : ''}
      </div>
    `;

    document.getElementById('btn-create-room').addEventListener('click', async () => {
      this.errorMessage = '';
      try {
        const code = await roomService.createRoom(authState.currentUser);
        this.listenToRoom(code);
      } catch (err) {
        this.errorMessage = err.message;
        this.render();
      }
    });

    document.getElementById('btn-join-room').addEventListener('click', async () => {
      this.errorMessage = '';
      const input = document.getElementById('room-input');
      const code = input ? input.value : '';

      if (code.length !== 6) {
        this.errorMessage = 'Room code must be exactly 6 characters.';
        this.render();
        return;
      }

      try {
        await roomService.joinRoom(code, authState.currentUser);
        this.listenToRoom(code);
      } catch (err) {
        this.errorMessage = err.message;
        this.render();
      }
    });

    document.getElementById('btn-back-profile').addEventListener('click', () => {
      this.container.dispatchEvent(new CustomEvent('nav-profile'));
    });
  },

  listenToRoom(code) {
    if (gameState.unsubscribeRoom) {
      gameState.unsubscribeRoom();
    }

    gameState.unsubscribeRoom = roomService.subscribeToRoom(code, (data) => {
      if (!data) {
        gameState.clearRoom();
        this.errorMessage = 'Room disbanded by host.';
        this.render();
        return;
      }
      gameState.setRoom(code, data);
    });
  },

  renderActiveLobby() {
    const room = gameState.currentRoom;
    const code = gameState.roomCode;
    const currentUid = authState.currentUser?.uid;
    const players = Object.values(room.players || {});
    const isHost = room.hostUid === currentUid;
    const me = room.players ? room.players[currentUid] : null;

    const allReady = players.length >= 2 && players.every(p => p.isReady || p.isHost);

    const playerListHtml = players.map(p => `
      <div class="status-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <div>
          <strong>${p.displayName}</strong> ${p.isHost ? '<span style="color:#00d9ff; font-size:0.7rem;">[HOST]</span>' : ''}
        </div>
        <div style="font-size: 0.75rem; color: ${p.isReady || p.isHost ? '#48bb78' : '#e53e3e'}; font-weight: bold;">
          ${p.isHost ? 'COMMANDER' : p.isReady ? 'READY' : 'STANDBY'}
        </div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="panel">
        <h1 class="title">Breach Chamber</h1>
        <p class="subtitle" style="margin-bottom: 0.5rem;">Secure Relay Code:</p>
        <div style="background: #0d1522; padding: 0.75rem; text-align: center; border: 1px dashed #00d9ff; margin-bottom: 1rem;">
          <span style="font-size: 1.75rem; letter-spacing: 0.25em; color: #00f0ff; font-weight: bold;">${code}</span>
          <div style="font-size: 0.7rem; color: #718096; margin-top: 0.25rem;">Share with up to 7 allies (Case-Sensitive)</div>
        </div>

        <div style="margin-bottom: 1rem;">
          <label>Active Agents (${players.length} / 8)</label>
          <div style="max-height: 180px; overflow-y: auto; margin-top: 0.5rem;">
            ${playerListHtml}
          </div>
        </div>

        <div class="button-stack">
          ${!isHost ? `
            <button type="button" id="btn-toggle-ready">
              ${me && me.isReady ? 'Cancel Ready' : 'Confirm Ready'}
            </button>
          ` : `
            <button type="button" id="btn-start-game" ${!allReady ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
              ${players.length < 2 ? 'Awaiting Squad (Min 2 Players)' : allReady ? 'Launch Incursion' : 'Awaiting Member Readiness'}
            </button>
          `}
          <button type="button" id="btn-leave-room" class="secondary">Leave Chamber</button>
        </div>
      </div>
    `;

    if (!isHost) {
      document.getElementById('btn-toggle-ready').addEventListener('click', async () => {
        if (me) {
          await roomService.toggleReady(code, currentUid, me.isReady);
        }
      });
    } else {
      const startBtn = document.getElementById('btn-start-game');
      if (allReady && startBtn) {
        startBtn.addEventListener('click', async () => {
          await roomService.startGame(code);
        });
      }
    }

    document.getElementById('btn-leave-room').addEventListener('click', async () => {
      await roomService.leaveRoom(code, currentUid);
      gameState.clearRoom();
    });
  }
};