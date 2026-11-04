export class GameSession {
  constructor(roomCode, hostUid, hostName) {
    this.roomCode = roomCode;
    this.hostUid = hostUid;
    this.status = 'LOBBY'; // LOBBY | IN_PROGRESS | CASE_CLOSED
    this.createdAt = Date.now();
    this.maxPlayers = 8;
    this.minPlayers = 2;
    this.players = {
      [hostUid]: {
        uid: hostUid,
        displayName: hostName,
        isHost: true,
        isReady: true,
        joinedAt: Date.now()
      }
    };
  }

  static fromJSON(data) {
    const session = new GameSession(data.roomCode, data.hostUid, '');
    Object.assign(session, data);
    return session;
  }

  toJSON() {
    return {
      roomCode: this.roomCode,
      hostUid: this.hostUid,
      status: this.status,
      createdAt: this.createdAt,
      maxPlayers: this.maxPlayers,
      minPlayers: this.minPlayers,
      players: this.players
    };
  }
}