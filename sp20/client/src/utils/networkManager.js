import { io } from 'socket.io-client';

class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.playerId = null;
    this.players = new Map();
    this.listeners = new Map();
    this.peerConnections = new Map();
    this.localStream = null;
    this.audioEnabled = true;
  }

  async connect(url = 'http://localhost:5001') {
    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.connected = true;
      });

      this.socket.on('init', (data) => {
        this.playerId = data.yourId;
        data.players.forEach(player => {
          if (player.id !== this.playerId) {
            this.players.set(player.id, player);
          }
        });
        this._emit('init', { playerId: this.playerId, players: data.players });
        resolve();
      });

      this.socket.on('playerJoined', (player) => {
        this.players.set(player.id, player);
        this._emit('playerJoined', player);
      });

      this.socket.on('playerLeft', ({ id }) => {
        this.players.delete(id);
        this._closePeerConnection(id);
        this._emit('playerLeft', { id });
      });

      this.socket.on('playerMoved', ({ id, position, rotation }) => {
        const player = this.players.get(id);
        if (player) {
          player.position = position;
          player.rotation = rotation;
          this._emit('playerMoved', { id, position, rotation });
        }
      });

      this.socket.on('playerVoiceState', ({ id, muted }) => {
        const player = this.players.get(id);
        if (player) {
          player.muted = muted;
          this._emit('playerVoiceState', { id, muted });
        }
      });

      this.socket.on('chatMessage', (data) => {
        this._emit('chatMessage', data);
      });

      this.socket.on('offer', async ({ callerId, offer }) => {
        await this._handleOffer(callerId, offer);
      });

      this.socket.on('answer', async ({ answererId, answer }) => {
        await this._handleAnswer(answererId, answer);
      });

      this.socket.on('iceCandidate', async ({ senderId, candidate }) => {
        await this._handleIceCandidate(senderId, candidate);
      });

      this.socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        reject(err);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.connected = false;
        this._emit('disconnected');
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }

  updatePosition(position, rotation) {
    if (this.socket && this.connected) {
      this.socket.emit('updatePosition', { position, rotation });
    }
  }

  sendChatMessage(message) {
    if (this.socket && this.connected) {
      this.socket.emit('chatMessage', message);
    }
  }

  async enableAudio() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioEnabled = true;
      this._emit('audioEnabled');
      
      this.players.forEach((_, playerId) => {
        this._createPeerConnection(playerId);
      });
      
      return true;
    } catch (err) {
      console.error('Failed to enable audio:', err);
      return false;
    }
  }

  disableAudio() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.audioEnabled = false;
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this._emit('audioDisabled');
  }

  toggleMute() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      const muted = !audioTracks[0]?.enabled;
      if (this.socket) {
        this.socket.emit('voiceState', { muted });
      }
      return muted;
    }
    return false;
  }

  async _createPeerConnection(targetId) {
    if (this.peerConnections.has(targetId)) {
      return this.peerConnections.get(targetId);
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('iceCandidate', {
          targetId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      this._emit('remoteStream', { playerId: targetId, stream: remoteStream });
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${targetId}: ${pc.connectionState}`);
    };

    this.peerConnections.set(targetId, pc);
    return pc;
  }

  async _handleOffer(callerId, offer) {
    const pc = await this._createPeerConnection(callerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    if (this.socket) {
      this.socket.emit('answer', {
        targetId: callerId,
        answer
      });
    }
  }

  async _handleAnswer(answererId, answer) {
    const pc = this.peerConnections.get(answererId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async _handleIceCandidate(senderId, candidate) {
    const pc = this.peerConnections.get(senderId);
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  }

  async initiateCall(targetId) {
    const pc = await this._createPeerConnection(targetId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    if (this.socket) {
      this.socket.emit('offer', {
        targetId,
        offer
      });
    }
  }

  _closePeerConnection(playerId) {
    const pc = this.peerConnections.get(playerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(playerId);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  _emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  getPlayers() {
    return Array.from(this.players.values());
  }
}

const networkManager = new NetworkManager();
export default networkManager;
