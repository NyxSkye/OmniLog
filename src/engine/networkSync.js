import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { rtdb } from '../config/firebase.js';
import { PlayerCharacter } from '../entities/PlayerCharacter.js';

export class NetworkSync {
  constructor(roomCode, localUid, localPlayer, scene, colorHex) {
    this.roomCode = roomCode;
    this.localUid = localUid;
    this.localPlayer = localPlayer;
    this.scene = scene;
    this.colorHex = colorHex;

    this.remotePlayers = new Map();
    this.lastBroadcastTime = 0;
    this.broadcastRate = 50;
    this.unsubscribe = null;

    this.initSync();
  }

  initSync() {
    const myTransformRef = ref(rtdb, `rooms/${this.roomCode}/transforms/${this.localUid}`);
    onDisconnect(myTransformRef).remove();

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
      color: this.colorHex,
      displayName: this.localPlayer.displayName,
      hp: this.localPlayer.hp,
      maxHp: this.localPlayer.maxHp,
      t: Date.now()
    });
  }

  handleRemoteTransforms(transformsData) {
    const activeUids = new Set(Object.keys(transformsData));

    for (const [uid, data] of Object.entries(transformsData)) {
      if (uid === this.localUid) continue;

      if (!this.remotePlayers.has(uid)) {
        const remoteAgent = new PlayerCharacter(
          this.scene,
          false,
          data.displayName || 'Ally',
          data.color || '#ff9900',
          data.hp || 100,
          data.maxHp || 100
        );
        remoteAgent.group.position.set(data.x, data.y, data.z);
        remoteAgent.group.rotation.y = data.rotY;
        remoteAgent.setNetworkTransform(data.x, data.y, data.z, data.rotY);
        this.remotePlayers.set(uid, remoteAgent);
      } else {
        const remoteAgent = this.remotePlayers.get(uid);
        remoteAgent.setNetworkTransform(data.x, data.y, data.z, data.rotY);
        if (data.hp !== undefined && remoteAgent.hp !== data.hp) {
          remoteAgent.setHp(data.hp);
        }
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