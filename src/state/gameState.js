export const gameState = {
  currentRoom: null,
  roomCode: null,
  unsubscribeRoom: null,
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

  setRoom(roomCode, roomData) {
    this.roomCode = roomCode;
    this.currentRoom = roomData;
    this.notify();
  },

  clearRoom() {
    if (this.unsubscribeRoom) {
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }
    this.currentRoom = null;
    this.roomCode = null;
    this.notify();
  }
};