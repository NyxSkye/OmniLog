import { authService } from '../services/authService.js';
import { databaseService } from '../services/databaseService.js';
import { authState } from '../state/authState.js';

export const authUI = {
  container: null,
  isRegistering: false,

  init(containerElement) {
    this.container = containerElement;
    authState.subscribe(() => this.render());
    this.render();
  },

  render() {
    if (!this.container) return;

    if (authState.currentUser && authState.player) {
      this.renderProfile();
    } else {
      this.renderAuthForm();
    }
  },

  renderAuthForm(errorMessage = '') {
    this.container.innerHTML = `
      <div class="panel">
        <h1 class="title">OmniLog // Terminal</h1>
        <p class="subtitle">Dimensional Breach Reconnaissance Unit</p>

        <form id="auth-form">
          <div class="form-group">
            <label for="agent-callsign">Agent Callsign</label>
            <input type="text" id="agent-callsign" placeholder="e.g. Cipher-07" value="Amnesiac-${Math.floor(Math.random() * 900 + 100)}" required />
          </div>

          <div class="form-group" id="email-group" style="${this.isRegistering ? 'display:block' : 'display:none'}">
            <label for="agent-email">Secure Comm Relay (Email)</label>
            <input type="email" id="agent-email" placeholder="agent@breach.net" />
          </div>

          <div class="form-group" id="pass-group" style="${this.isRegistering ? 'display:block' : 'display:none'}">
            <label for="agent-pass">Encryption Key (Password)</label>
            <input type="password" id="agent-pass" placeholder="••••••••" />
          </div>

          <div class="button-stack">
            <button type="button" id="btn-guest">Enter as Guest (Instant Access)</button>
            <button type="submit" id="btn-submit" class="secondary" style="${this.isRegistering ? 'display:block' : 'display:none'}">
              Register Credentials
            </button>
            <button type="button" id="btn-toggle-mode" class="secondary">
              ${this.isRegistering ? 'Back to Quick Access' : 'Create Persistent Cloud Account'}
            </button>
          </div>
          ${errorMessage ? `<p class="error-text">${errorMessage}</p>` : ''}
        </form>
      </div>
    `;

    this.bindAuthEvents();
  },

  bindAuthEvents() {
    const form = document.getElementById('auth-form');
    const guestBtn = document.getElementById('btn-guest');
    const toggleBtn = document.getElementById('btn-toggle-mode');

    guestBtn.addEventListener('click', async () => {
      const callsign = document.getElementById('agent-callsign').value.trim() || 'Agent Unknown';
      try {
        await authService.loginAsGuest(callsign);
      } catch (err) {
        this.renderAuthForm(err.message);
      }
    });

    toggleBtn.addEventListener('click', () => {
      this.isRegistering = !this.isRegistering;
      this.render();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('agent-email').value.trim();
      const pass = document.getElementById('agent-pass').value;
      const callsign = document.getElementById('agent-callsign').value.trim();

      try {
        await authService.registerWithEmail(email, pass, callsign);
      } catch (err) {
        this.renderAuthForm(err.message);
      }
    });
  },

  renderProfile() {
    const { player } = authState;

    this.container.innerHTML = `
      <div class="panel">
        <h1 class="title">Agent Identity Verified</h1>
        <p class="subtitle">Status: Synchronized with Multiverse Anchor</p>

        <div class="status-grid">
          <div class="status-item">
            <span>CALLSIGN</span>
            <strong>${player.displayName}</strong>
          </div>
          <div class="status-item">
            <span>LEVEL / SP</span>
            <strong>Lv. ${player.level} (${player.sp} SP)</strong>
          </div>
          <div class="status-item">
            <span>HEALTH / STAMINA</span>
            <strong>${player.stats.currentHealth} HP / ${player.stats.currentStamina} STA</strong>
          </div>
          <div class="status-item">
            <span>ARCANA POOL</span>
            <strong>${player.stats.currentMana} MANA (Locked)</strong>
          </div>
        </div>

        <div class="button-stack">
          <button type="button" id="btn-simulate-sp">Test Progress: Grant +1 SP</button>
          <button type="button" id="btn-logout" class="secondary">Sever Uplink (Log Out)</button>
        </div>
      </div>
    `;

    document.getElementById('btn-simulate-sp').addEventListener('click', async () => {
      player.sp += 1;
      await databaseService.savePlayerProgress(player);
      authState.setPlayer(player);
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
      await authService.logout();
    });
  }
};