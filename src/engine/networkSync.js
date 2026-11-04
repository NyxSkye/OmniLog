import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { PlayerCharacter } from '../entities/PlayerCharacter.js';

export class NetworkSync {
  constructor(roomCode, localUid, localPlayer, scene) {
    this.roomCode = roomCode;
    this.localUid = localUid;
    this.localPlayer = localPlayer;
    this.scene = scene;

    this.remotePlayers = new Map(); // uid -> PlayerCharacter instance
    this.lastBroadcastTime = 0;
    this.broadcastRate = 50; // Broadcast every 50ms (20 updates/second)
    this.unsubscribe = null;

    this.initSync();
  }

  initSync() {
    // Clean up transform on disconnect
    const myTransformRef = ref(rtdb, `rooms/${this.roomCode}/transforms/${this.localUid}`);
    onDisconnect(myTransformRef).remove();

    // Listen to all transforms in the active room
    const transformsRef = ref(rtdb, `rooms/${this.roomCode}/transforms`);
    this.unsubscribe = onValue(transformsRef, (snapshot) => {
      const data = snapshot.val() || {};
      this.handleRemoteTransforms(data);
    });
  }

  handleRemoteTransforms(transformsData) {
    const activeUids = new Set(Object.keys(transformsData));

    // 1. Update or spawn remote players
    for (const [uid, data] of Object.entries(transformsData)) {
      if (uid === this.localUid) continue; // Skip local agent

      if (!this.remotePlayers.has(uid)) {
        // Spawn newly connected remote squadmate
        const remoteAgent = new PlayerCharacter(this.scene, false, data.name || 'Ally');
        remoteAgent.group.position.set(data.x, data.y, data.z);
        remoteAgent.setNetworkTransform(data.x, data.y, data.z, data.rotY);
        this.remotePlayers.set(uid, remoteAgent);
      } else {
        // Feed target transform to remote agent for interpolation
        const remoteAgent = this.remotePlayers.get(uid);
        remoteAgent.setNetworkTransform(data.x, data.y, data.z, data.rotY);
      }
    }

    // 2. Remove players who disconnected
    for (const [uid, remoteAgent] of this.remotePlayers.entries()) {
      if (!activeUids.has(uid)) {
        remoteAgent.destroy();
        this.remotePlayers.delete(uid);
      }
    }
  }

  update(currentTime, deltaTime) {
    // 1. Outgoing broadcast (throttled)
    if (currentTime - this.lastBroadcastTime >= this.broadcastRate) {
      this.lastBroadcastTime = currentTime;
      const pos = this.localPlayer.getPosition();
      const rotY = this.localPlayer.getRotation();

      const myTransformRef = ref(rtdb, `rooms/${this.roomCode}/transforms/${this.localUid}`);
      set(myTransformRef, {
        x: Number(pos.x.toFixed(2)),
        y: Number(pos.y.toFixed(2)),
        z: Number(pos.z.toFixed(2)),
        rotY: Number(rotY.toFixed(3)),
        t: Date.now()
      });
    }

    // 2. Inbound interpolation update for all remote players
    for (const remoteAgent of this.remotePlayers.values()) {
      remoteAgent.update(deltaTime);
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Clear own transform entry
    const myTransformRef = ref(rtdb, `rooms/${this.roomCode}/transforms/${this.localUid}`);
    set(myTransformRef, null);

    // Destroy all remote instances
    for (const remoteAgent of this.remotePlayers.values()) {
      remoteAgent.destroy();
    }
    this.remotePlayers.clear();
  }
}