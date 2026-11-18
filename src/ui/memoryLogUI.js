/**
 * memoryLogUI — legacy shim.
 * All functionality now lives in agentDossierUI.
 * This module re-exports a compatible surface so existing imports don't break.
 */
import { agentDossierUI } from './agentDossierUI.js';

export const memoryLogUI = {
  get isOpen() { return agentDossierUI.isOpen && agentDossierUI.activeTab !== 'inventory'; },

  toggle(logInstance) {
    if (agentDossierUI.isOpen) {
      agentDossierUI.close();
    } else {
      agentDossierUI.open(logInstance, 'clues');
    }
  }
};
