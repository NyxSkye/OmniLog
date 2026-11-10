export class MemoryLog {
  constructor(ownerUid) {
    this.ownerUid = ownerUid;
    this.verifiedClues = [];        // Confirmed physical facts
    this.systemDirectives = [];     // Autonomous hints (authentic or corrupted)
    this.dailyLogs = [];            // Chronological diary of movements and scavenged items
    this.flaggedDirectives = [];    // IDs of directives marked 'SUSPICIOUS' by player
  }

  addClue(clue) {
    if (!this.verifiedClues.some(c => c.id === clue.id)) {
      this.verifiedClues.push({
        ...clue,
        discoveredAt: Date.now()
      });
      this.addDailyEntry(`Discovered verified clue: "${clue.title}"`);
    }
  }

  addDirective(directive) {
    if (!this.systemDirectives.some(d => d.id === directive.id)) {
      this.systemDirectives.push({
        ...directive,
        receivedAt: Date.now()
      });
      this.addDailyEntry(`Received System Directive [${directive.code || 'SYS'}]`);
    }
  }

  addDailyEntry(text) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.dailyLogs.unshift(`[${timeStr}] ${text}`);
    if (this.dailyLogs.length > 50) this.dailyLogs.pop();
  }

  toggleFlagDirective(directiveId) {
    const idx = this.flaggedDirectives.indexOf(directiveId);
    if (idx === -1) {
      this.flaggedDirectives.push(directiveId);
      this.addDailyEntry(`Flagged System Directive #${directiveId} as DECEPTIVE`);
    } else {
      this.flaggedDirectives.splice(idx, 1);
      this.addDailyEntry(`Removed deceptive flag from Directive #${directiveId}`);
    }
  }

  toJSON() {
    return {
      verifiedClues: this.verifiedClues,
      systemDirectives: this.systemDirectives,
      dailyLogs: this.dailyLogs,
      flaggedDirectives: this.flaggedDirectives
    };
  }

  static fromJSON(data, ownerUid) {
    const log = new MemoryLog(ownerUid);
    if (data) {
      log.verifiedClues = data.verifiedClues || [];
      log.systemDirectives = data.systemDirectives || [];
      log.dailyLogs = data.dailyLogs || [];
      log.flaggedDirectives = data.flaggedDirectives || [];
    }
    return log;
  }
}