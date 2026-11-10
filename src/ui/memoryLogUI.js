export const memoryLogUI = {
  isOpen: false,
  activeTab: 'clues',
  logInstance: null,

  toggle(logInstance) {
    this.logInstance = logInstance;
    this.isOpen = !this.isOpen;
    const existing = document.getElementById('memory-log-modal');
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
    let modal = document.getElementById('memory-log-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'memory-log-modal';
      modal.className = 'modal-overlay';
      document.getElementById('ui-root').appendChild(modal);
    }

    const log = this.logInstance;
    if (!log) return;

    modal.innerHTML = `
      <div class="panel log-panel">
        <div class="inv-header">
          <div>
            <h2 class="title" style="margin:0; text-align:left;">Case Dossier // Memory Log</h2>
            <span class="subtitle" style="margin:0;">VERIFIED PHYSICAL CLUES VS. SYSTEM DIRECTIVES</span>
          </div>
          <button type="button" id="btn-close-log" style="width:auto; padding:0.25rem 0.75rem; background:transparent; border:1px solid #e53e3e; color:#fc8181;">✕ Close [TAB]</button>
        </div>

        <div class="log-tab-bar">
          <button type="button" class="log-tab-btn ${this.activeTab === 'clues' ? 'active' : ''}" data-tab="clues">
            Verified Clues (${log.verifiedClues.length})
          </button>
          <button type="button" class="log-tab-btn ${this.activeTab === 'directives' ? 'active' : ''}" data-tab="directives">
            System Guidance (${log.systemDirectives.length})
          </button>
          <button type="button" class="log-tab-btn ${this.activeTab === 'daily' ? 'active' : ''}" data-tab="daily">
            Daily Journal (${log.dailyLogs.length})
          </button>
        </div>

        <div class="log-body">
          ${this.renderActiveTab(log)}
        </div>
      </div>
    `;

    this.bindEvents(modal, log);
  },

  renderActiveTab(log) {
    if (this.activeTab === 'clues') {
      if (log.verifiedClues.length === 0) {
        return `<p style="color:#718096;">No physical clues recorded. Rummage through anomalies [E] to discover facts.</p>`;
      }
      return log.verifiedClues.map(c => `
        <div class="clue-entry">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
            <strong style="color:#00f0ff;">${c.title}</strong>
            <span style="font-size:0.65rem; color:#48bb78; border:1px solid #48bb78; padding:0.1rem 0.3rem;">VERIFIED</span>
          </div>
          <p style="color:#edf2f7; font-size:0.8rem; margin:0;">${c.description}</p>
        </div>
      `).join('');
    }

    if (this.activeTab === 'directives') {
      return log.systemDirectives.map(d => {
        const isFlagged = log.flaggedDirectives.includes(d.id);
        return `
          <div class="directive-entry" style="${isFlagged ? 'border-color:#fc8181; background:rgba(252,129,129,0.08);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <strong style="color:${isFlagged ? '#fc8181' : '#00d9ff'};">[DIRECTIVE #${d.code || d.id}]</strong>
              <button type="button" class="flag-btn" data-id="${d.id}" style="width:auto; padding:0.2rem 0.5rem; font-size:0.7rem; background:transparent; border:1px solid ${isFlagged ? '#fc8181' : '#718096'}; color:${isFlagged ? '#fc8181' : '#a0aec0'};">
                ${isFlagged ? '⚠️ DECEPTIVE' : 'Mark Suspicious'}
              </button>
            </div>
            <p style="color:#edf2f7; font-size:0.8rem; margin:0.3rem 0;">"${d.message}"</p>
            <div style="font-size:0.65rem; color:#718096;">ORIGIN: ${d.source || 'Breach Node'}</div>
          </div>
        `;
      }).join('');
    }

    if (this.activeTab === 'daily') {
      return `
        <div style="font-family:monospace; font-size:0.75rem; color:#a0aec0; display:flex; flex-direction:column; gap:0.3rem;">
          ${log.dailyLogs.map(line => `<div>${line}</div>`).join('')}
        </div>
      `;
    }
  },

  bindEvents(modal, log) {
    modal.querySelector('#btn-close-log').addEventListener('click', () => this.toggle(log));

    modal.querySelectorAll('.log-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    modal.querySelectorAll('.flag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        log.toggleFlagDirective(btn.dataset.id);
        this.render();
      });
    });
  }
};