export class Player {
  constructor(uid, displayName = 'Amnesiac Agent') {
    this.uid = uid;
    this.displayName = displayName;
    this.level = 1;
    this.sp = 0; // Skill Points

    // Base attributes
    this.stats = {
      maxHealth: 100,
      currentHealth: 100,
      maxStamina: 100,
      currentStamina: 100,
      maxMana: 0, // 0 until Arcana is unlocked
      currentMana: 0
    };

    // Progression trees
    this.trees = {
      physical: 0,
      tactical: 0,
      arcane: 0
    };

    // Unlocks & inventory
    this.unlockedArcana = [];
    this.inventory = {
      munitions: 30,
      medStims: 1,
      anomalyCures: 0,
      artifacts: []
    };

    // Investigation progress
    this.cluesFound = [];
    this.createdAt = Date.now();
    this.lastSaved = Date.now();
  }

  static fromFirestore(data) {
    const player = new Player(data.uid, data.displayName);
    Object.assign(player, data);
    return player;
  }

  toFirestore() {
    return {
      uid: this.uid,
      displayName: this.displayName,
      level: this.level,
      sp: this.sp,
      stats: this.stats,
      trees: this.trees,
      unlockedArcana: this.unlockedArcana,
      inventory: this.inventory,
      cluesFound: this.cluesFound,
      lastSaved: Date.now()
    };
  }
}