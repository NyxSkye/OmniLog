export class Player {
  constructor(uid, displayName = 'Amnesiac Agent') {
    this.uid = uid;
    this.displayName = displayName;
    this.level = 1;
    this.sp = 0;

    // Assigned specialization (Researcher, Weapon Master, Elementalist, Appraiser, Tamer)
    this.role = 'Researcher';

    // Vitals
    this.stats = {
      maxHealth: 100,
      currentHealth: 100,
      maxStamina: 100,
      currentStamina: 100,
      maxHunger: 100,
      currentHunger: 100,
      maxMana: 0,
      currentMana: 0
    };

    // Equipment slots
    this.equipped = {
      clothes: null,
      backpack: null, // Equipping upgrades grid capacity
      accessory: null,
      weapon: null
    };

    // Base inventory: 6 slots without backpack
    this.baseGridCapacity = 6;
    this.items = []; // Array of Item objects

    this.cluesFound = [];
    this.createdAt = Date.now();
    this.lastSaved = Date.now();
  }

  get totalInventoryCapacity() {
    const bonus = this.equipped.backpack ? (this.equipped.backpack.extraSlots || 6) : 0;
    return this.baseGridCapacity + bonus;
  }

  addItem(item) {
    if (this.items.length >= this.totalInventoryCapacity) {
      return false; // Grid full
    }
    this.items.push(item);
    return true;
  }

  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      return this.items.splice(index, 1)[0];
    }
    return null;
  }

  toFirestore() {
    return {
      uid: this.uid,
      displayName: this.displayName,
      level: this.level,
      sp: this.sp,
      role: this.role,
      stats: this.stats,
      equipped: this.equipped,
      items: this.items,
      cluesFound: this.cluesFound,
      lastSaved: Date.now()
    };
  }

  static fromFirestore(data) {
    const p = new Player(data.uid, data.displayName);
    Object.assign(p, data);
    return p;
  }
}