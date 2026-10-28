export const authState = {
  currentUser: null,
  player: null,
  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  },

  setUser(user) {
    this.currentUser = user;
    this.notify();
  },

  setPlayer(player) {
    this.player = player;
    this.notify();
  },

  clear() {
    this.currentUser = null;
    this.player = null;
    this.notify();
  }
};