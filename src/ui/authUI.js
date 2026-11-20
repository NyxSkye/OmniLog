import { authState } from '../state/authState.js';
import {
  authService,
  generateCallsign,
  normalizeCallsign
} from '../services/authService.js';

export const authUI = {
  container: null,
  noticeMessage: '',
  unsubscribe: null,
  generatedCallsign: '',
  selectedCharacter: 'male',

  init(containerElement) {
    this.container = containerElement;
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = authState.subscribe(() => this.render());
    this.render();
  },

  setNotice(message) {
    this.noticeMessage = message;
    this.render();
  },

  render() {
    if (!this.container) return;

    if (authState.currentUser && authState.player) {
      this.renderHome();
    } else {
      this.renderAuthForm();
    }
  },

  renderAuthForm(errorMessage = '') {
    if (!this.generatedCallsign) this.generatedCallsign = generateCallsign();
    this.container.innerHTML = `
      <div class="panel">
        <h1 class="title">OmniLog // Terminal</h1>
        <p class="subtitle">A short breach. A story that stays with you.</p>
        <div class="form-group">
          <label>Choose Your Character</label>
          <div class="character-choices" role="group" aria-label="Choose your character">
            <button type="button" class="character-choice ${this.selectedCharacter === 'male' ? 'selected' : ''}" data-character="male" aria-pressed="${this.selectedCharacter === 'male'}">Male</button>
            <button type="button" class="character-choice ${this.selectedCharacter === 'female' ? 'selected' : ''}" data-character="female" aria-pressed="${this.selectedCharacter === 'female'}">Female</button>
          </div>
        </div>
        <div class="form-group">
          <label for="agent-callsign">Your Callsign (editable)</label>
          <input type="text" id="agent-callsign" maxlength="24" />
          <small>Letters, numbers, spaces, hyphens, and underscores.</small>
        </div>
        <div class="button-stack">
          <button type="button" id="btn-guest">Begin as Guest</button>
        </div>
        ${this.noticeMessage ? `<p class="error-text">${this.noticeMessage}</p>` : ''}
        ${errorMessage ? `<p class="error-text">${errorMessage}</p>` : ''}
      </div>
    `;
    document.getElementById('agent-callsign').value = this.generatedCallsign;
    this.container.querySelectorAll('.character-choice').forEach(button => {
      button.addEventListener('click', () => {
        this.selectedCharacter = button.dataset.character;
        this.container.querySelectorAll('.character-choice').forEach(choice => {
          const isSelected = choice.dataset.character === this.selectedCharacter;
          choice.classList.toggle('selected', isSelected);
          choice.setAttribute('aria-pressed', String(isSelected));
        });
      });
    });

    document.getElementById('btn-guest').addEventListener('click', async () => {
      const callsign = normalizeCallsign(document.getElementById('agent-callsign').value)
        || this.generatedCallsign;
      const characterType = this.container.querySelector('.character-choice.selected')?.dataset.character
        || this.selectedCharacter;
      try {
        this.noticeMessage = '';
        this.generatedCallsign = callsign;
        await authService.loginAsGuest(callsign, characterType);
        this.selectedCharacter = 'male';
        this.generatedCallsign = generateCallsign();
      } catch (err) {
        this.renderAuthForm(err.message);
      }
    });
  },

  renderHome() {
    const { player } = authState;
    this.container.innerHTML = `
      <div class="panel">
        <h1 class="title" id="agent-welcome"></h1>
        <p class="subtitle">Choose how to enter the breach.</p>
        <p class="subtitle">Refresh to resume. Four hours without player input ends the run.</p>
        <div class="button-stack">
          <button type="button" id="btn-deploy-solo">Start Solo Run</button>
          <button type="button" id="btn-to-lobby" class="secondary">Play Multiplayer</button>
          <button type="button" id="btn-logout" class="secondary">End Run &amp; Log Out</button>
        </div>
        ${this.noticeMessage ? `<p class="error-text">${this.noticeMessage}</p>` : ''}
      </div>
    `;
    document.getElementById('agent-welcome').textContent = `Welcome, ${player.displayName}`;

    document.getElementById('btn-deploy-solo').addEventListener('click', () => {
      this.container.dispatchEvent(new CustomEvent('start-solo-game'));
    });

    document.getElementById('btn-to-lobby').addEventListener('click', () => {
      this.container.dispatchEvent(new CustomEvent('nav-lobby'));
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      this.container.dispatchEvent(new CustomEvent('logout-request'));
    });
  }
};
