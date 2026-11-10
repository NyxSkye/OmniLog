import { ref, push, onChildAdded, limitToLast, query } from 'firebase/database';
import { rtdb } from '../config/firebase.js';

export const chatService = {
  sendMessage(roomCode, senderUid, senderName, text, type = 'CHAT', metadata = null) {
    const chatRef = ref(rtdb, `rooms/${roomCode}/chat`);
    return push(chatRef, {
      senderUid,
      senderName,
      text,
      type, // 'CHAT' | 'CLUE_BROADCAST' | 'DIRECTIVE_FLAG'
      metadata,
      timestamp: Date.now()
    });
  },

  subscribeToMessages(roomCode, callback) {
    const chatRef = query(ref(rtdb, `rooms/${roomCode}/chat`), limitToLast(40));
    return onChildAdded(chatRef, (snap) => {
      callback(snap.val());
    });
  }
};