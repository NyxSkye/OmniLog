import { authState } from '../state/authState.js';
import { databaseService } from '../services/databaseService.js';

export const inventoryUI = {
  isOpen: false,
  selectedItem: null,
  selectedItemIndex: -1,

  toggle() {
    this.isOpen = !this.isOpen;
    const existing = document.getElementById('inventory-modal');
    if (this.isOpen) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.render();
    } else {
      if (existing) existing.remove();
    }
  },

  render() {
    let modal = document.getElementById('inventory-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inventory-modal';
      modal.className = 'modal-overlay';
      document.getElementById('ui-root').appendChild(modal);
    }

    const player = authState.player;
    if (!player) return;

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

    modal.innerHTML = `
      <div class="panel inv-panel">
        <div class="inv-header">
          <div>
            <h2 class="title" style="margin:0; text-align:left;">Grid Storage</h2>
            <span class="subtitle" style="margin:0;">CAPACITY: ${items.length} / ${capacity} | ROLE: ${player.role || 'Agent'}</span>
          </div>
          <button type="button" id="btn-close-inv" style="width:auto; padding:0.25rem 0.75rem; background:transparent; border:1px solid #e53e3e; color:#fc8181;">✕ Close [M]</button>
        </div>

        <div class="inv-layout">
          <!-- Equipment Bar -->
          <div>
            <label>EQUIPPED GEAR</label>
            <div style="background:#0d1522; padding:0.6rem; border:1px solid #1a365d; margin-bottom:0.5rem; border-radius:3px;">
              <span style="font-size:0.65rem; color:#718096; display:block;">BACKPACK</span>
              <strong style="color:#00f0ff;">${player.equipped.backpack ? player.equipped.backpack.name : '[None - 6 Slots]'}</strong>
            </div>
            <div style="background:#0d1522; padding:0.6rem; border:1px solid #1a365d; margin-bottom:0.5rem; border-radius:3px;">
              <span style="font-size:0.65rem; color:#718096; display:block;">ATTIRE</span>
              <strong>${player.equipped.clothes ? player.equipped.clothes.name : 'Standard Uniform'}</strong>
            </div>
          </div>

          <!-- Main Grid -->
          <div>
            <label>INVENTORY SLOTS</label>
            <div class="inventory-grid">
              ${gridHtml}
            </div>
          </div>

          <!-- Description & Inspection -->
          <div>
            <label>SYSTEM DESCRIPTION</label>
            <div style="background:#0d1522; border:1px solid #1a365d; padding:0.75rem; border-radius:3px; min-height:180px;">
              ${this.selectedItem ? this.renderDetails(this.selectedItem, player.role) : '<p style="color:#718096; font-size:0.75rem;">Click an item from storage to inspect system data or use it.</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(modal, player);
  },

  renderDetails(item, role) {
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
          ${isFood ? `<button type="button" id="btn-use-item">Consume (+Nutrition)</button>` : ''}
          ${isBackpack ? `<button type="button" id="btn-equip-item">Equip (+Extra Slots)</button>` : ''}
          <button type="button" id="btn-drop-item" class="secondary">Discard</button>
        </div>
      </div>
    `;
  },

  bindEvents(modal, player) {
    modal.querySelector('#btn-close-inv').addEventListener('click', () => this.toggle());

    modal.querySelectorAll('.has-item').forEach(slot => {
      slot.addEventListener('click', () => {
        const idx = parseInt(slot.dataset.index, 10);
        this.selectedItemIndex = idx;
        this.selectedItem = player.items[idx];
        this.render();
      });
    });

    const useBtn = modal.querySelector('#btn-use-item');
    if (useBtn && this.selectedItem) {
      useBtn.addEventListener('click', async () => {
        player.stats.currentHunger = Math.min(player.stats.maxHunger, player.stats.currentHunger + (this.selectedItem.nutrition || 30));
        player.removeItem(this.selectedItemIndex);
        this.selectedItem = null;
        this.selectedItemIndex = -1;
        await databaseService.savePlayerProgress(player);
        this.render();
        window.dispatchEvent(new CustomEvent('update-vitals'));
      });
    }

    const equipBtn = modal.querySelector('#btn-equip-item');
    if (equipBtn && this.selectedItem) {
      equipBtn.addEventListener('click', async () => {
        const item = player.removeItem(this.selectedItemIndex);
        if (item.type === 'BACKPACK') {
          player.equipped.backpack = item;
        }
        this.selectedItem = null;
        this.selectedItemIndex = -1;
        await databaseService.savePlayerProgress(player);
        this.render();
        window.dispatchEvent(new CustomEvent('update-vitals'));
      });
    }

    const dropBtn = modal.querySelector('#btn-drop-item');
    if (dropBtn && this.selectedItem) {
      dropBtn.addEventListener('click', async () => {
        player.removeItem(this.selectedItemIndex);
        this.selectedItem = null;
        this.selectedItemIndex = -1;
        await databaseService.savePlayerProgress(player);
        this.render();
        window.dispatchEvent(new CustomEvent('update-vitals'));
      });
    }
  }
};