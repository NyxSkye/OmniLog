import { gameState } from '../state/gameState.js';
import { agentDossierUI } from './agentDossierUI.js';

/**
 * Pause Menu — triggered by [ESC] while in-game.
 *
 * Options:
 *  1. Resume Game
 *  2. Memory Log
 *  3. Controls
 *  4. Settings
 *  5. End the solo run or leave the multiplayer run
 */
export const pauseMenuUI = {
  isOpen: false,
  _memoryLogRef: null,  // Set from main.js so we can open the log from here
  _onQuit: null,
  _activePanel: 'main', // 'main' | 'controls' | 'settings'

  /**
   * Call once from main.js to wire up dependencies.
   * @param {MemoryLog} memoryLogInstance
   * @param {Function} onQuitCallback — called when the player ends or leaves the run
   */
  init(memoryLogInstance, onQuitCallback) {
    this._memoryLogRef = memoryLogInstance;
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

          <button type="button" class="pause-btn pause-btn-danger" id="pause-end-run">
            <span class="pause-btn-icon">⇠</span> ${isSolo ? 'End Run' : 'Leave Multiplayer Run'}
          </button>
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
          <div class="ctrl-row"><kbd>P</kbd><span>Status Window and Inventory</span></div>
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

    const endRunBtn = document.getElementById('pause-end-run');
    if (endRunBtn) {
      endRunBtn.addEventListener('click', async () => {
        this._setButtonsDisabled(true);
        try {
          if (this._onQuit) await this._onQuit('end');
          this.close();
        } catch (err) {
          console.error('Could not end the run:', err);
          this._setButtonsDisabled(false);
        }
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

  _setButtonsDisabled(disabled) {
    const overlay = document.getElementById('pause-menu-overlay');
    if (!overlay) return;
    overlay.querySelectorAll('button').forEach(btn => {
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.5' : '';
    });
  }
};
