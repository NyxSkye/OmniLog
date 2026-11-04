export const gameState = {
  currentRoom: null,
  roomCode: null,
  unsubscribeRoom: null,
  isInGame: false,
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
    if (roomData && roomData.status === 'IN_PROGRESS') {
      this.isInGame = true;
    }
    this.notify();
  },

  setInGame(val) {
    this.isInGame = val;
    this.notify();
  },

  clearRoom() {
    if (this.unsubscribeRoom) {
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }
    this.currentRoom = null;
    this.roomCode = null;
    this.isInGame = false;
    this.notify();
  }
};