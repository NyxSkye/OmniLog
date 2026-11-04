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
        this.errorMessage = 'Room was disbanded or expired.';
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
    const playersMap = room.players || {};

    // Sort players: Current user pinned to index 0 (top)
    const sortedPlayers = Object.values(playersMap).sort((a, b) => {
      if (a.uid === currentUid) return -1;
      if (b.uid === currentUid) return 1;
      return 0;
    });

    const isCreator = room.hostUid === currentUid;
    const me = playersMap[currentUid];
    // Creator is always ready; others must click Confirm Ready
    const allGuestsReady = sortedPlayers.filter(p => p.uid !== room.hostUid).every(p => p.isReady);
    const canLaunch = isCreator && sortedPlayers.length >= 2 && allGuestsReady;

    const playerListHtml = sortedPlayers.map(p => {
      const isSelf = p.uid === currentUid;
      const dotColor = (p.color || 0x00d9ff).toString(16).padStart(6, '0');
      const isPlayerReady = p.uid === room.hostUid || p.isReady;

      return `
        <div class="status-item ${isSelf ? 'player-item-self' : ''}" style="margin-bottom: 0.5rem; padding: 0.65rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#${dotColor};"></span>
              <strong>${p.displayName}</strong>
              ${isSelf ? '<span class="you-badge">YOU</span>' : ''}
            </div>
            <div style="font-size: 0.75rem; color: ${isPlayerReady ? '#48bb78' : '#e53e3e'}; font-weight: bold;">
              ${isPlayerReady ? 'READY' : 'STANDBY'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="panel">
        <h1 class="title">Breach Chamber</h1>
        <p class="subtitle" style="margin-bottom: 0.5rem;">Secure Relay Code:</p>
        <div style="background: #0d1522; padding: 0.75rem; text-align: center; border: 1px dashed #00d9ff; margin-bottom: 1rem;">
          <span style="font-size: 1.75rem; letter-spacing: 0.25em; color: #00f0ff; font-weight: bold;">${code}</span>
          <div style="font-size: 0.7rem; color: #718096; margin-top: 0.25rem;">Share with allies (Expires after 5 min empty)</div>
        </div>

        <div style="margin-bottom: 1rem;">
          <label>Squad Manifest (${sortedPlayers.length} / 8)</label>
          <div style="max-height: 220px; overflow-y: auto; margin-top: 0.5rem;">
            ${playerListHtml}
          </div>
        </div>

        <div class="button-stack">
          ${!isCreator ? `
            <button type="button" id="btn-toggle-ready">
              ${me && me.isReady ? 'Cancel Ready' : 'Confirm Ready'}
            </button>
          ` : `
            <button type="button" id="btn-start-game" ${!canLaunch ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
              ${sortedPlayers.length < 2 ? 'Awaiting Squad (Min 2 Players)' : canLaunch ? 'Launch Incursion' : 'Awaiting Squad Readiness'}
            </button>
          `}
          <button type="button" id="btn-leave-room" class="secondary">Leave Chamber</button>
        </div>
      </div>
    `;

    if (!isCreator) {
      document.getElementById('btn-toggle-ready').addEventListener('click', async () => {
        if (me) {
          await roomService.toggleReady(code, currentUid, me.isReady);
        }
      });
    } else {
      const startBtn = document.getElementById('btn-start-game');
      if (canLaunch && startBtn) {
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