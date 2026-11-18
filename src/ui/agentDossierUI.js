import { authState } from '../state/authState.js';
import { databaseService } from '../services/databaseService.js';

/**
 * Agent Dossier — single combined panel for Grid Storage + Memory Log.
 * Opened/closed with [P]. ESC closes it via the global ESC stack.
 *
 * Tabs: 'inventory' | 'clues' | 'directives' | 'daily'
 */
export const agentDossierUI = {
  isOpen: false,
  activeTab: 'inventory',

  // Inventory state
  selectedItem: null,
  selectedItemIndex: -1,

  // Memory log reference — set via open() or toggle()
  _logInstance: null,

  // ─── Public API ────────────────────────────────────────────────────────────

  toggle(logInstance) {
    if (logInstance) this._logInstance = logInstance;
    this.isOpen ? this.close() : this.open(logInstance);
  },

  open(logInstance, tab = null) {
    if (logInstance) this._logInstance = logInstance;
    if (tab) this.activeTab = tab;
    this.isOpen = true;

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this._render();
  },

  close() {
    this.isOpen = false;
    // Reset inventory selection so it's fresh next open
    this.selectedItem = null;
    this.selectedItemIndex = -1;
    const el = document.getElementById('agent-dossier-modal');
    if (el) el.remove();
  },

  // ─── Rendering ─────────────────────────────────────────────────────────────

  _render() {
    let modal = document.getElementById('agent-dossier-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'agent-dossier-modal';
      modal.className = 'modal-overlay';
      document.getElementById('ui-root').appendChild(modal);
    }

    const player = authState.player;
    const log = this._logInstance;

    modal.innerHTML = `
      <div class="dossier-panel">

        <!-- ── Header ── -->
        <div class="dossier-header">
          <div>
            <h2 class="title" style="margin:0; text-align:left;">Agent Dossier</h2>
            <span class="subtitle" style="margin:0;">FIELD RECORD — STORAGE &amp; INTELLIGENCE</span>
          </div>
          <button type="button" id="dossier-close-btn"
            style="width:auto; padding:0.25rem 0.75rem; background:transparent; border:1px solid #e53e3e; color:#fc8181;">
            ✕ Close [ESC]
          </button>
        </div>

        <!-- ── Top-level tab bar ── -->
        <div class="dossier-tab-bar">
          <button type="button" class="dossier-tab ${this.activeTab === 'inventory' ? 'active' : ''}" data-tab="inventory">
            ◫ Grid Storage
          </button>
          <button type="button" class="dossier-tab ${this.activeTab === 'clues' ? 'active' : ''}" data-tab="clues">
            ✦ Verified Clues ${log ? `(${log.verifiedClues.length})` : ''}
          </button>
          <button type="button" class="dossier-tab ${this.activeTab === 'directives' ? 'active' : ''}" data-tab="directives">
            ⚡ System Guidance ${log ? `(${log.systemDirectives.length})` : ''}
          </button>
          <button type="button" class="dossier-tab ${this.activeTab === 'daily' ? 'active' : ''}" data-tab="daily">
            📓 Daily Journal ${log ? `(${log.dailyLogs.length})` : ''}
          </button>
        </div>

        <!-- ── Tab body ── -->
        <div class="dossier-body">
          ${this.activeTab === 'inventory' ? this._renderInventory(player) : this._renderLogTab(log)}
        </div>

      </div>
    `;

    this._bindEvents(modal, player, log);
  },

  // ─── Inventory tab ─────────────────────────────────────────────────────────

  _renderInventory(player) {
    if (!player) return `<p style="color:#718096;">No agent data loaded.</p>`;

    const capacity = player.totalInventoryCapacity;
    const items = player.items || [];

    let gridHtml = '';
    for (let i = 0; i < capacity; i++) {
      const item = items[i];
      if (item) {
        const isSelected = this.selectedItemIndex === i;
        gridHtml += `
          <div class="inv-slot has-item ${isSelected ? 'player-item-self' : ''}" data-index="${i}">
            <div style="font-size:0.6rem; color:#00d9ff; font-weight:bold;">${item.type}</div>
            <div style="font-size:0.75rem; color:#e0f0ff; margin-top:0.25rem;">${item.name}</div>
          </div>
        `;
      } else {
        gridHtml += `<div class="inv-slot empty-slot" style="opacity:0.3;">[Empty]</div>`;
      }
    }

    return `
      <div class="inv-layout">
        <!-- Equipment Bar -->
        <div>
          <label>EQUIPPED GEAR</label>
          <div style="background:#0d1522; padding:0.6rem; border:1px solid #1a365d; margin-bottom:0.5rem; border-radius:3px;">
            <span style="font-size:0.65rem; color:#718096; display:block;">BACKPACK</span>
            <strong style="color:#00f0ff;">${player.equipped.backpack ? player.equipped.backpack.name : '[None — 6 Slots]'}</strong>
          </div>
          <div style="background:#0d1522; padding:0.6rem; border:1px solid #1a365d; margin-bottom:0.5rem; border-radius:3px;">
            <span style="font-size:0.65rem; color:#718096; display:block;">ATTIRE</span>
            <strong>${player.equipped.clothes ? player.equipped.clothes.name : 'Standard Uniform'}</strong>
          </div>
          <div style="font-size:0.7rem; color:#718096; margin-top:0.25rem;">
            CAPACITY: ${items.length} / ${capacity} &nbsp;|&nbsp; ROLE: ${player.role || 'Agent'}
          </div>
        </div>

        <!-- Main Grid -->
        <div>
          <label>INVENTORY SLOTS</label>
          <div class="inventory-grid">
            ${gridHtml}
          </div>
        </div>

        <!-- Description & Actions -->
        <div>
          <label>SYSTEM DESCRIPTION</label>
          <div style="background:#0d1522; border:1px solid #1a365d; padding:0.75rem; border-radius:3px; min-height:180px;">
            ${this.selectedItem
              ? this._renderItemDetails(this.selectedItem, player.role)
              : '<p style="color:#718096; font-size:0.75rem;">Select an item from the grid to inspect or use it.</p>'}
          </div>
        </div>
      </div>
    `;
  },

  _renderItemDetails(item, role) {
    const isFood = item.type === 'FOOD';
    const isBackpack = item.type === 'BACKPACK';
    return `
      <div>
        <h3 style="color:#00f0ff; font-size:0.95rem;">${item.name}</h3>
        <span style="color:#a0aec0; font-size:0.7rem;">TYPE: ${item.type}</span>
        <p style="color:#e0f0ff; font-size:0.75rem; margin:0.5rem 0; line-height:1.4;">${item.systemDescription}</p>

        ${role === 'Researcher' && item.researchData ? `
          <div style="background:rgba(0,217,255,0.1); border-left:2px solid #00d9ff; padding:0.4rem; font-size:0.7rem; margin:0.5rem 0;">
            <strong>[RESEARCH REPORT]:</strong> ${item.researchData}
          </div>
        ` : ''}

        <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.75rem;">
          ${isFood     ? `<button type="button" id="btn-use-item">Consume (+Nutrition)</button>` : ''}
          ${isBackpack ? `<button type="button" id="btn-equip-item">Equip (+Extra Slots)</button>` : ''}
          <button type="button" id="btn-drop-item" class="secondary">Discard</button>
        </div>
      </div>
    `;
  },

  // ─── Memory log tabs ────────────────────────────────────────────────────────

  _renderLogTab(log) {
    if (!log) return `<p style="color:#718096;">Memory log not available.</p>`;

    if (this.activeTab === 'clues') {
      if (log.verifiedClues.length === 0) {
        return `<p style="color:#718096;">No physical clues recorded yet. Rummage anomalies [E] to discover facts.</p>`;
      }
      return `<div class="log-body">${log.verifiedClues.map(c => `
        <div class="clue-entry">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
            <strong style="color:#00f0ff;">${c.title}</strong>
            <span style="font-size:0.65rem; color:#48bb78; border:1px solid #48bb78; padding:0.1rem 0.3rem;">VERIFIED</span>
          </div>
          <p style="color:#edf2f7; font-size:0.8rem; margin:0;">${c.description}</p>
        </div>
      `).join('')}</div>`;
    }

    if (this.activeTab === 'directives') {
      if (log.systemDirectives.length === 0) {
        return `<p style="color:#718096;">No system directives received yet.</p>`;
      }
      return `<div class="log-body">${log.systemDirectives.map(d => {
        const isFlagged = log.flaggedDirectives.includes(d.id);
        return `
          <div class="directive-entry" style="${isFlagged ? 'border-color:#fc8181; background:rgba(252,129,129,0.08);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <strong style="color:${isFlagged ? '#fc8181' : '#00d9ff'};">[DIRECTIVE #${d.code || d.id}]</strong>
              <button type="button" class="flag-btn" data-id="${d.id}"
                style="width:auto; padding:0.2rem 0.5rem; font-size:0.7rem; background:transparent;
                       border:1px solid ${isFlagged ? '#fc8181' : '#718096'};
                       color:${isFlagged ? '#fc8181' : '#a0aec0'};">
                ${isFlagged ? '⚠️ DECEPTIVE' : 'Mark Suspicious'}
              </button>
            </div>
            <p style="color:#edf2f7; font-size:0.8rem; margin:0.3rem 0;">"${d.message}"</p>
            <div style="font-size:0.65rem; color:#718096;">ORIGIN: ${d.source || 'Breach Node'}</div>
          </div>
        `;
      }).join('')}</div>`;
    }

    if (this.activeTab === 'daily') {
      return `
        <div class="log-body">
          <div style="font-family:monospace; font-size:0.75rem; color:#a0aec0; display:flex; flex-direction:column; gap:0.3rem;">
            ${log.dailyLogs.length
              ? log.dailyLogs.map(line => `<div>${line}</div>`).join('')
              : '<p style="color:#718096;">No journal entries yet.</p>'}
          </div>
        </div>
      `;
    }

    return '';
  },

  // ─── Event binding ──────────────────────────────────────────────────────────

  _bindEvents(modal, player, log) {
    // Close button
    modal.querySelector('#dossier-close-btn').addEventListener('click', () => this.close());

    // Top-level tab switching
    modal.querySelectorAll('.dossier-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this._render();
      });
    });

    // ── Inventory interactions ──
    if (this.activeTab === 'inventory' && player) {
      modal.querySelectorAll('.has-item').forEach(slot => {
        slot.addEventListener('click', () => {
          const idx = parseInt(slot.dataset.index, 10);
          this.selectedItemIndex = idx;
          this.selectedItem = player.items[idx];
          this._render();
        });
      });

      const useBtn = modal.querySelector('#btn-use-item');
      if (useBtn && this.selectedItem) {
        useBtn.addEventListener('click', async () => {
          player.stats.currentHunger = Math.min(
            player.stats.maxHunger,
            player.stats.currentHunger + (this.selectedItem.nutrition || 30)
          );
          player.removeItem(this.selectedItemIndex);
          this.selectedItem = null;
          this.selectedItemIndex = -1;
          if (this._logInstance) player.memoryLog = this._logInstance.toJSON();
          await databaseService.savePlayerProgress(player);
          this._render();
          window.dispatchEvent(new CustomEvent('update-vitals'));
        });
      }

      const equipBtn = modal.querySelector('#btn-equip-item');
      if (equipBtn && this.selectedItem) {
        equipBtn.addEventListener('click', async () => {
          const item = player.removeItem(this.selectedItemIndex);
          if (item.type === 'BACKPACK') player.equipped.backpack = item;
          this.selectedItem = null;
          this.selectedItemIndex = -1;
          if (this._logInstance) player.memoryLog = this._logInstance.toJSON();
          await databaseService.savePlayerProgress(player);
          this._render();
          window.dispatchEvent(new CustomEvent('update-vitals'));
        });
      }

      const dropBtn = modal.querySelector('#btn-drop-item');
      if (dropBtn && this.selectedItem) {
        dropBtn.addEventListener('click', async () => {
          player.removeItem(this.selectedItemIndex);
          this.selectedItem = null;
          this.selectedItemIndex = -1;
          if (this._logInstance) player.memoryLog = this._logInstance.toJSON();
          await databaseService.savePlayerProgress(player);
          this._render();
          window.dispatchEvent(new CustomEvent('update-vitals'));
        });
      }
    }

    // ── Memory log flag buttons ──
    if (log && this.activeTab === 'directives') {
      modal.querySelectorAll('.flag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          log.toggleFlagDirective(btn.dataset.id);
          this._render();
        });
      });
    }
  }
};
