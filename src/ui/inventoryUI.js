/**
 * inventoryUI — legacy shim.
 * All functionality now lives in agentDossierUI.
 * This module re-exports a compatible surface so existing imports don't break.
 */
import { agentDossierUI } from './agentDossierUI.js';

export const inventoryUI = {
  get isOpen() { return agentDossierUI.isOpen && agentDossierUI.activeTab === 'inventory'; },

  toggle() {
    if (agentDossierUI.isOpen) {
      agentDossierUI.close();
    } else {
      agentDossierUI.open(null, 'inventory');
    }
  }
};
