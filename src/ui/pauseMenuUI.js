import { authState } from '../state/authState.js';
import { gameState } from '../state/gameState.js';
import { databaseService } from '../services/databaseService.js';
import { roomService } from '../services/roomService.js';
import { agentDossierUI } from './agentDossierUI.js';

/**
 * Pause Menu — triggered by [ESC] while in-game.
 *
 * Options:
 *  1. Resume Game
 *  2. Memory Log
 *  3. Controls
 *  4. Settings
 *  5. Save & Quit  (saves progress + checkpoint, returns to lobby/auth)
 *  6. Evict        (removes player from the active room slot; record stays in the room's player registry)
 */
export const pauseMenuUI = {
  isOpen: false,
  _memoryLogRef: null,  // Set from main.js so we can open the log from here
  _localPlayerRef: null, // Set from main.js for position snapshot on save
  _onQuit: null,        // Callback — called when player saves & quits or evicts
  _activePanel: 'main', // 'main' | 'controls' | 'settings'

  /**
   * Call once from main.js to wire up dependencies.
   * @param {MemoryLog} memoryLogInstance
   * @param {PlayerCharacter} localPlayerInstance
   * @param {Function} onQuitCallback  — called with ('quit' | 'evict') when the session ends
   */
  init(memoryLogInstance, localPlayerInstance, onQuitCallback) {
    this._memoryLogRef = memoryLogInstance;
    this._localPlayerRef = localPlayerInstance;
    this._onQuit = onQuitCallback;
  },

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._activePanel = 'main';

    // Release pointer lock so the cursor is visible
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    this._render();
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._activePanel = 'main';
    const el = document.getElementById('pause-menu-overlay');
    if (el) el.remove();
  },

  toggle() {
    this.isOpen ? this.close() : this.open();
  },

  /**
   * Called by the global ESC handler in main.js.
   * - On a sub-panel → go back to main panel
   * - On main panel → close the menu (resume game)
   */
  handleEsc() {
    if (!this.isOpen) return;
    if (this._activePanel !== 'main') {
      this._activePanel = 'main';
      this._render();
    } else {
      this.close();
    }
  },

  _render() {
    let overlay = document.getElementById('pause-menu-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pause-menu-overlay';
      overlay.className = 'modal-overlay pause-overlay';
      document.getElementById('ui-root').appendChild(overlay);
    }

    if (this._activePanel === 'controls') {
      overlay.innerHTML = this._buildControlsPanel();
    } else if (this._activePanel === 'settings') {
      overlay.innerHTML = this._buildSettingsPanel();
    } else {
      overlay.innerHTML = this._buildMainPanel();
    }

    this._bindEvents(overlay);
  },

  _buildMainPanel() {
    const isSolo = !gameState.roomCode;
    return `
      <div class="pause-panel">
        <div class="pause-header">
          <div class="pause-glitch-title">// SYSTEM PAUSE</div>
          <div class="pause-subtitle">BREACH SEQUENCE SUSPENDED</div>
        </div>

        <div class="pause-menu-list">
          <button type="button" class="pause-btn" id="pause-resume">
            <span class="pause-btn-icon">▶</span> Resume Game
          </button>

          <button type="button" class="pause-btn" id="pause-memory-log">
            <span class="pause-btn-icon">📋</span> Memory Log
          </button>

          <button type="button" class="pause-btn" id="pause-controls">
            <span class="pause-btn-icon">⌨</span> Controls
          </button>

          <button type="button" class="pause-btn" id="pause-settings">
            <span class="pause-btn-icon">⚙</span> Settings
          </button>

          <button type="button" class="pause-btn pause-btn-warn" id="pause-save-quit">
            <span class="pause-btn-icon">💾</span> Save &amp; Quit
          </button>

          ${!isSolo ? `
          <button type="button" class="pause-btn pause-btn-danger" id="pause-evict">
            <span class="pause-btn-icon">⇠</span> Evict from Room
          </button>
          ` : ''}
        </div>

        <div class="pause-footer">
          Press <kbd>ESC</kbd> to resume
        </div>
      </div>
    `;
  },

  _buildControlsPanel() {
    return `
      <div class="pause-panel">
        <div class="pause-header">
          <div class="pause-glitch-title">// CONTROLS</div>
          <div class="pause-subtitle">KEYBINDING REFERENCE · Press <kbd style="font-size:0.65rem; background:#1a202c; border:1px solid #2d3748; padding:0.1rem 0.4rem; border-radius:3px; color:#a0aec0;">ESC</kbd> to go back</div>
        </div>

        <div class="pause-controls-grid">
          <div class="ctrl-row"><kbd>W A S D</kbd><span>Move</span></div>
          <div class="ctrl-row"><kbd>MOUSE</kbd><span>Orbit Camera</span></div>
          <div class="ctrl-row"><kbd>SPACE</kbd><span>Jump</span></div>
          <div class="ctrl-row"><kbd>E</kbd><span>Inspect / Scavenge Anomaly</span></div>
          <div class="ctrl-row"><kbd>M</kbd><span>Grid Storage &amp; Equip</span></div>
          <div class="ctrl-row"><kbd>TAB</kbd><span>Memory Log</span></div>
          <div class="ctrl-row"><kbd>ENTER</kbd><span>Squad Comms Chat</span></div>
          <div class="ctrl-row"><kbd>ESC</kbd><span>Pause / Navigate Back</span></div>
        </div>
      </div>
    `;
  },

  _buildSettingsPanel() {
    return `
      <div class="pause-panel">
        <div class="pause-header">
          <div class="pause-glitch-title">// SETTINGS</div>
          <div class="pause-subtitle">SYSTEM CONFIGURATION · Press <kbd style="font-size:0.65rem; background:#1a202c; border:1px solid #2d3748; padding:0.1rem 0.4rem; border-radius:3px; color:#a0aec0;">ESC</kbd> to go back</div>
        </div>

        <div class="pause-settings-body">
          <div class="settings-row">
            <label>Mouse Sensitivity</label>
            <input type="range" id="setting-sensitivity" min="0.1" max="3" step="0.1"
              value="${parseFloat(localStorage.getItem('mouseSensitivity') || '1')}"
              style="width:140px; accent-color:#00d9ff;">
            <span id="sensitivity-val" style="color:#00f0ff; min-width:2.5rem; text-align:right;">
              ${parseFloat(localStorage.getItem('mouseSensitivity') || '1').toFixed(1)}
            </span>
          </div>

          <div class="settings-row" style="margin-top:1rem;">
            <label>Show Controls Hint</label>
            <input type="checkbox" id="setting-hint"
              ${localStorage.getItem('hideControlsHint') !== 'true' ? 'checked' : ''}
              style="width:auto; accent-color:#00d9ff;">
          </div>
        </div>
      </div>
    `;
  },

  _bindEvents(overlay) {
    // ── Main panel ─────────────────────────────────────────────
    const resumeBtn = document.getElementById('pause-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.close());
    }

    const memBtn = document.getElementById('pause-memory-log');
    if (memBtn) {
      memBtn.addEventListener('click', () => {
        this.close();
        agentDossierUI.open(this._memoryLogRef, 'clues');
      });
    }

    const ctrlBtn = document.getElementById('pause-controls');
    if (ctrlBtn) {
      ctrlBtn.addEventListener('click', () => {
        this._activePanel = 'controls';
        this._render();
      });
    }

    const settBtn = document.getElementById('pause-settings');
    if (settBtn) {
      settBtn.addEventListener('click', () => {
        this._activePanel = 'settings';
        this._render();
      });
    }

    const saveQuitBtn = document.getElementById('pause-save-quit');
    if (saveQuitBtn) {
      saveQuitBtn.addEventListener('click', async () => {
        await this._handleSaveAndQuit();
      });
    }

    const evictBtn = document.getElementById('pause-evict');
    if (evictBtn) {
      evictBtn.addEventListener('click', async () => {
        await this._handleEvict();
      });
    }

    // ── Sub-panels ─────────────────────────────────────────────
    // (Back navigation is handled by ESC via handleEsc())

    // ── Settings live-bindings ──────────────────────────────────
    const sensitivitySlider = document.getElementById('setting-sensitivity');
    if (sensitivitySlider) {
      sensitivitySlider.addEventListener('input', () => {
        const val = parseFloat(sensitivitySlider.value).toFixed(1);
        document.getElementById('sensitivity-val').textContent = val;
        localStorage.setItem('mouseSensitivity', val);
        // Notify game loop to re-read sensitivity
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: { mouseSensitivity: parseFloat(val) } }));
      });
    }

    const hintToggle = document.getElementById('setting-hint');
    if (hintToggle) {
      hintToggle.addEventListener('change', () => {
        localStorage.setItem('hideControlsHint', hintToggle.checked ? 'false' : 'true');
        const hint = document.querySelector('.hud-controls-hint');
        if (hint) hint.style.display = hintToggle.checked ? '' : 'none';
      });
    }
  },

  async _handleSaveAndQuit() {
    const player = authState.player;
    const uid = authState.currentUser?.uid;
    const roomCode = gameState.roomCode;

    // Disable buttons to prevent double-click
    this._setButtonsDisabled(true);

    try {
      // 1. Snapshot position and memory log onto player before saving
      this._snapshotSessionState();

      // 2. Save player stats
      if (player) {
        await databaseService.savePlayerProgress(player);
      }

      // 2. Save a lightweight checkpoint (last room + timestamp)
      if (uid) {
        await databaseService.saveGameCheckpoint(uid, {
          roomCode: roomCode || null,
          savedAt: Date.now()
        });
      }

      // 3. Mark player offline in room (but keep record)
      if (roomCode && uid) {
        await roomService.markOffline(roomCode, uid);
        await roomService.setActiveRoom(uid, null);
      }

      this.close();
      if (this._onQuit) this._onQuit('quit');
    } catch (err) {
      console.error('Save & Quit failed:', err);
      this._setButtonsDisabled(false);
    }
  },

  async _handleEvict() {
    const uid = authState.currentUser?.uid;
    const roomCode = gameState.roomCode;

    if (!roomCode || !uid) {
      this.close();
      if (this._onQuit) this._onQuit('evict');
      return;
    }

    this._setButtonsDisabled(true);

    try {
      // Save position and memory log, then player progress before leaving
      this._snapshotSessionState();
      if (authState.player) {
        await databaseService.savePlayerProgress(authState.player);
      }

      // Mark player as evicted (online: false, evicted: true) but keep their record
      await roomService.evictFromRoom(roomCode, uid);
      await roomService.setActiveRoom(uid, null);

      this.close();
      if (this._onQuit) this._onQuit('evict');
    } catch (err) {
      console.error('Evict failed:', err);
      this._setButtonsDisabled(false);
    }
  },

  _snapshotSessionState() {
    const player = authState.player;
    if (!player) return;

    // Persist current world position
    if (this._localPlayerRef) {
      const pos = this._localPlayerRef.getPosition();
      player.lastPosition = { x: pos.x, y: pos.y, z: pos.z };
    }

    // Persist memory log contents
    if (this._memoryLogRef) {
      player.memoryLog = this._memoryLogRef.toJSON();
    }
  },

  _setButtonsDisabled(disabled) {
    const overlay = document.getElementById('pause-menu-overlay');
    if (!overlay) return;
    overlay.querySelectorAll('button').forEach(btn => {
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.5' : '';
    });
  }
};
