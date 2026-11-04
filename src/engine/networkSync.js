import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { PlayerCharacter } from '../entities/PlayerCharacter.js';

export class NetworkSync {
  constructor(roomCode, localUid, localPlayer, scene, playerColor) {
    this.roomCode = roomCode;
    this.localUid = localUid;
    this.localPlayer = localPlayer;
    this.scene = scene;
    this.playerColor = playerColor;

    this.remotePlayers = new Map(); // uid -> PlayerCharacter
    this.lastBroadcastTime = 0;
    this.broadcastRate = 50; // 20 Hz
    this.unsubscribe = null;

    this.initSync();
  }

  initSync() {
    const myTransformRef = ref(rtdb, `rooms/${this.roomCode}/transforms/${this.localUid}`);
    onDisconnect(myTransformRef).remove();

    // Broadcast spawn position instantly so players are visible immediately without moving
    this.broadcastTransform();

    const transformsRef = ref(rtdb, `rooms/${this.roomCode}/transforms`);
    this.unsubscribe = onValue(transformsRef, (snapshot) => {
      const data = snapshot.val() || {};
      this.handleRemoteTransforms(data);
    });
  }

  broadcastTransform() {
    const pos = this.localPlayer.getPosition();
    const rotY = this.localPlayer.getRotation();

    const myTransformRef = ref(rtdb, `rooms/${this.roomCode}/transforms/${this.localUid}`);
    set(myTransformRef, {
      x: Number(pos.x.toFixed(2)),
      y: Number(pos.y.toFixed(2)),
      z: Number(pos.z.toFixed(2)),
      rotY: Number(rotY.toFixed(3)),
      color: this.playerColor,
      displayName: this.localPlayer.displayName,
      t: Date.now()
    });
  }

  handleRemoteTransforms(transformsData) {
    const activeUids = new Set(Object.keys(transformsData));

    for (const [uid, data] of Object.entries(transformsData)) {
      if (uid === this.localUid) continue;

      if (!this.remotePlayers.has(uid)) {
        // Instantiate remote player using their exact transmitted color
        const remoteAgent = new PlayerCharacter(
          this.scene,
          false,
          data.displayName || 'Ally',
          data.color || 0xff9900
        );
        remoteAgent.group.position.set(data.x, data.y, data.z);
        remoteAgent.group.rotation.y = data.rotY;
        remoteAgent.setNetworkTransform(data.x, data.y, data.z, data.rotY);
        this.remotePlayers.set(uid, remoteAgent);
      } else {
        const remoteAgent = this.remotePlayers.get(uid);
        remoteAgent.setNetworkTransform(data.x, data.y, data.z, data.rotY);
      }
    }

    for (const [uid, remoteAgent] of this.remotePlayers.entries()) {
      if (!activeUids.has(uid)) {
        remoteAgent.destroy();
        this.remotePlayers.delete(uid);
      }
    }
  }

  update(currentTime, deltaTime) {
    if (currentTime - this.lastBroadcastTime >= this.broadcastRate) {
      this.lastBroadcastTime = currentTime;
      this.broadcastTransform();
    }

    for (const remoteAgent of this.remotePlayers.values()) {
      remoteAgent.update(deltaTime);
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    const myTransformRef = ref(rtdb, `rooms/${this.roomCode}/transforms/${this.localUid}`);
    set(myTransformRef, null);

    for (const remoteAgent of this.remotePlayers.values()) {
      remoteAgent.destroy();
    }
    this.remotePlayers.clear();
  }
}