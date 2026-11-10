import { chatService } from '../services/chatService.js';
import { authState } from '../state/authState.js';
import { gameState } from '../state/gameState.js';

export const chatUI = {
  isInitialized: false,

  init(container) {
    let el = document.getElementById('chat-widget');
    if (!el) {
      el = document.createElement('div');
      el.id = 'chat-widget';
      el.className = 'chat-widget';
      container.appendChild(el);
    }

    el.innerHTML = `
      <div class="chat-feed" id="chat-feed">
        <div style="color:#718096; font-size:0.7rem;">[Uplink Online - Press ENTER to type]</div>
      </div>
      <form id="chat-form" class="chat-input-bar">
        <input type="text" id="chat-input" placeholder="Squad Comms (Enter to send)..." autocomplete="off" />
      </form>
    `;

    if (!this.isInitialized) {
      this.bindEvents();
      this.isInitialized = true;
    }

    if (gameState.roomCode) {
      chatService.subscribeToMessages(gameState.roomCode, (msg) => {
        this.appendMessage(msg);
      });
    }
  },

  appendMessage(msg) {
    const feed = document.getElementById('chat-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.style.margin = '2px 0';
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    row.innerHTML = `
      <span style="color:#718096; font-size:0.65rem;">[${time}]</span>
      <strong style="color:#00d9ff; font-size:0.75rem;">${msg.senderName}:</strong>
      <span style="color:#e0f0ff; font-size:0.75rem;">${msg.text}</span>
    `;

    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
  },

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      const input = document.getElementById('chat-input');
      if (e.code === 'Enter') {
        if (document.activeElement === input) {
          // Handled by form submit
        } else {
          e.preventDefault();
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
          if (input) {
            input.focus();
          }
        }
      }
    });

    document.addEventListener('submit', (e) => {
      if (e.target && e.target.id === 'chat-form') {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const uid = authState.currentUser ? authState.currentUser.uid : 'solo';
        const name = authState.currentUser ? authState.currentUser.displayName : 'Agent';

        if (gameState.roomCode) {
          chatService.sendMessage(gameState.roomCode, uid, name, text);
        } else {
          this.appendMessage({
            senderName: name,
            text: text,
            timestamp: Date.now()
          });
        }

        input.value = '';
        input.blur();
      }
    });
  }
};