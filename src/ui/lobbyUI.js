import { roomService, AGENT_PALETTE } from '../services/roomService.js';
import { runSessionService } from '../services/runSessionService.js';
import { gameState } from '../state/gameState.js';
import { authState } from '../state/authState.js';

export const lobbyUI = {
  container: null,
  errorMessage: '',
  unsubscribeState: null,

  init(containerElement) {
    this.container = containerElement;
    if (this.unsubscribeState) this.unsubscribeState();
    this.unsubscribeState = gameState.subscribe(() => this.render());
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
        <p class="subtitle">Join or Deploy a Squad (2–8 Players)</p>

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
          <button type="button" id="btn-back-profile" class="secondary">Back</button>
        </div>

        ${this.errorMessage ? `<p class="error-text">${this.errorMessage}</p>` : ''}
      </div>
    `;

    document.getElementById('btn-create-room').addEventListener('click', async () => {
      this.errorMessage = '';
      try {
        const uid = authState.currentUser?.uid;
        const code = await roomService.createRoom(authState.currentUser);
        runSessionService.setActiveRun(uid, { mode: 'multiplayer', roomCode: code });
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
        const uid = authState.currentUser?.uid;
        await roomService.joinRoom(code, authState.currentUser);
        runSessionService.setActiveRun(uid, { mode: 'multiplayer', roomCode: code });
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
        const wasInGame = gameState.isInGame;
        runSessionService.clearActiveRun(authState.currentUser?.uid);
        gameState.clearRoom();
        this.errorMessage = wasInGame
          ? 'The multiplayer room ended or expired.'
          : 'Room ended or expired after four hours without player input.';
        if (!wasInGame) this.render();
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

    const sortedPlayers = Object.values(playersMap).sort((a, b) => {
      if (a.uid === currentUid) return -1;
      if (b.uid === currentUid) return 1;
      return 0;
    });

    const isCreator = room.hostUid === currentUid;
    const isMissionInProgress = room.status === 'IN_PROGRESS';
    const me = playersMap[currentUid];
    const storedColor = me?.color;
    const myColor = typeof storedColor === 'string' && /^#[0-9a-f]{6}$/i.test(storedColor)
      ? storedColor.toLowerCase()
      : AGENT_PALETTE[0];

    const allGuestsReady = sortedPlayers.filter(p => p.uid !== room.hostUid).every(p => p.isReady);
    const canLaunch = isCreator && sortedPlayers.length >= 2 && allGuestsReady;

    // List of colors currently taken by other players
    const takenColors = new Set(
      sortedPlayers
        .filter(p => p.uid !== currentUid)
        .map(p => typeof p.color === 'string' ? p.color.toLowerCase() : null)
        .filter(Boolean)
    );

    // Color picker HTML
    const swatchesHtml = AGENT_PALETTE.map(c => {
      const isSelected = c.toLowerCase() === myColor;
      const isTaken = takenColors.has(c.toLowerCase());

      return `
        <button 
          type="button" 
          class="color-swatch-btn ${isSelected ? 'active-swatch' : ''} ${isTaken ? 'taken-swatch' : ''}" 
          data-color="${c}"
          ${isTaken ? 'disabled' : ''}
          style="background: ${c};"
          aria-label="${isTaken ? 'Color taken by teammate' : `Choose color ${c}`}"
          title="${isTaken ? 'Taken by teammate' : 'Select color'}"
        ></button>
      `;
    }).join('');

    const playerListHtml = sortedPlayers.map(p => {
      const isSelf = p.uid === currentUid;
      const dotColor = p.color || AGENT_PALETTE[0];
      const isPlayerReady = (!isMissionInProgress && p.uid === room.hostUid) || p.isReady;

      return `
        <div class="status-item ${isSelf ? 'player-item-self' : ''}" style="margin-bottom: 0.5rem; padding: 0.65rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${dotColor}; box-shadow: 0 0 8px ${dotColor};"></span>
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
          <div style="font-size: 0.7rem; color: #718096; margin-top: 0.25rem;">Room expires after four hours without player input.</div>
        </div>
        ${isMissionInProgress ? '<p class="subtitle">Mission in progress. Confirm ready to join.</p>' : ''}

        <!-- Color Selector Swatches -->
        <div style="margin-bottom: 1rem;">
          <label style="margin-bottom: 0.4rem;">Designate Visual Signifier (Your Color)</label>
          <div style="display: flex; gap: 0.5rem; justify-content: center; background: #0d1522; padding: 0.6rem; border: 1px solid #1a365d; border-radius: 4px;">
            <button
              type="button"
              id="btn-custom-color"
              class="color-picker-button"
              aria-label="Choose a custom agent color"
              title="Choose a custom color"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14.2 5.2 4.6 4.6-2 2-1.3-1.3-8.7 8.7-3.1.6.6-3.1 8.7-8.7-1.3-1.3z" />
                <path d="m12.4 7 4.6 4.6" />
              </svg>
            </button>
            <input
              type="color"
              id="custom-color-picker"
              class="custom-color-input"
              value="${myColor}"
              aria-label="Choose a custom agent color"
            />
            ${swatchesHtml}
          </div>
        </div>

        <div style="margin-bottom: 1rem;">
          <label>Squad Manifest (${sortedPlayers.length} / 8)</label>
          <div style="max-height: 200px; overflow-y: auto; margin-top: 0.5rem;">
            ${playerListHtml}
          </div>
        </div>
        ${this.errorMessage ? `<p class="error-text">${this.errorMessage}</p>` : ''}

        <div class="button-stack">
          ${isMissionInProgress ? `
            <button type="button" id="btn-toggle-ready">
              ${me && me.isReady ? 'Cancel Ready' : 'Confirm Ready'}
            </button>
            <button type="button" id="btn-join-active" ${!me?.isReady ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
              Join Active Mission
            </button>
          ` : !isCreator ? `
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

    const updateMyColor = async color => {
      this.errorMessage = '';
      try {
        await roomService.updatePlayerColor(code, currentUid, color);
      } catch (error) {
        this.errorMessage = error.message || 'Could not update your color.';
        this.render();
      }
    };

    this.container.querySelectorAll('.color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        updateMyColor(btn.dataset.color);
      });
    });

    document.getElementById('custom-color-picker').addEventListener('change', event => {
      updateMyColor(event.target.value);
    });
    document.getElementById('btn-custom-color').addEventListener('click', () => {
      const colorPicker = document.getElementById('custom-color-picker');
      if (typeof colorPicker.showPicker === 'function') {
        colorPicker.showPicker();
      } else {
        colorPicker.click();
      }
    });

    if (isMissionInProgress || !isCreator) {
      document.getElementById('btn-toggle-ready').addEventListener('click', async () => {
        if (me) {
          await roomService.toggleReady(code, currentUid, me.isReady);
        }
      });
    }

    if (isMissionInProgress) {
      document.getElementById('btn-join-active').addEventListener('click', () => {
        if (me?.isReady) gameState.setInGame(true);
      });
    } else if (isCreator) {
      const startBtn = document.getElementById('btn-start-game');
      if (canLaunch && startBtn) {
        startBtn.addEventListener('click', async () => {
          await roomService.startGame(code);
        });
      }
    }

    document.getElementById('btn-leave-room').addEventListener('click', async () => {
      await roomService.leaveRoom(code, currentUid);
      runSessionService.clearActiveRun(currentUid);
      gameState.clearRoom();
    });
  }
};