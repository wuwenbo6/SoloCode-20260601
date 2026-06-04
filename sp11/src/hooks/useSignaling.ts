import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';
import { SignalingMessage, User, CursorPosition } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const useSignaling = () => {
  const socketRef = useRef<Socket | null>(null);
  const {
    currentUser,
    currentRoom,
    addPeer,
    removePeer,
    setRoomMembers,
    updateCursor,
    removeCursor,
    updateRemoteCursor,
    removeRemoteCursor,
    setEditorContent,
    setContentVersion,
    contentVersion,
    setConnectionStatus,
    setError,
    addNotification,
  } = useStore();

  const connect = useCallback(async (roomId: string) => {
    if (socketRef.current?.connected) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
      setConnectionStatus('connected');
      if (currentUser) {
        socketRef.current?.emit('join-room', { roomId, userId: currentUser.id, user: currentUser });
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setConnectionStatus('disconnected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
      setError('Failed to connect to server');
    });

    socketRef.current.on('joined', (data: { members: User[]; socketId: string; currentContent: string; contentVersion: number }) => {
      console.log('Joined room, members:', data.members, 'version:', data.contentVersion);
      setRoomMembers(data.members);
      if (data.currentContent) {
        setEditorContent(data.currentContent, data.contentVersion);
      }
    });

    socketRef.current.on('user-joined', (data: { user: User; members: User[] }) => {
      console.log('User joined:', data.user);
      setRoomMembers(data.members);
    });

    socketRef.current.on('user-left', (data: { userId: string; members: User[] }) => {
      console.log('User left:', data.userId);
      setRoomMembers(data.members);
      removePeer(data.userId);
      removeCursor(data.userId);
      removeRemoteCursor(data.userId);
    });

    socketRef.current.on('signal', (message: SignalingMessage) => {
      handleSignalingMessage(message);
    });

    socketRef.current.on('cursor-update', (data: { userId: string; cursor: CursorPosition }) => {
      updateRemoteCursor(data.userId, data.cursor);
    });

    socketRef.current.on('content-sync', (data: { content: string; userId: string; version: number }) => {
      if (data.userId !== currentUser?.id) {
        setEditorContent(data.content, data.version);
      }
    });

    socketRef.current.on('content-ack', (data: { version: number; accepted: boolean }) => {
      if (data.accepted) {
        setContentVersion(data.version);
      }
    });

    socketRef.current.on('content-request', (data: { roomId: string; from: string }) => {
      const content = useStore.getState().editorContent;
      socketRef.current?.emit('content-response', {
        roomId: data.roomId,
        to: data.from,
        content,
      });
    });

    socketRef.current.on('content-response', (data: { content: string; roomId: string }) => {
      setEditorContent(data.content);
    });

    socketRef.current.on('mention', (data: { fromUser: User; message: string; position: any; timestamp: number }) => {
      addNotification({
        type: 'mention',
        title: `@${data.fromUser.nickname} 提到了你`,
        message: data.message,
        fromUser: data.fromUser,
        data: { position: data.position },
      });
    });
  }, [
    currentUser,
    setConnectionStatus,
    setError,
    setRoomMembers,
    removePeer,
    removeCursor,
    removeRemoteCursor,
    updateCursor,
    updateRemoteCursor,
    setEditorContent,
    setContentVersion,
    contentVersion,
    addNotification,
  ]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const joinRoom = useCallback(
    (roomId: string, userId: string, user: User) => {
      socketRef.current?.emit('join-room', { roomId, userId, user });
    },
    []
  );

  const sendSignal = useCallback((message: SignalingMessage) => {
    socketRef.current?.emit('signal', message);
  }, []);

  const sendCursorUpdate = useCallback(
    (roomId: string, userId: string, cursor: CursorPosition) => {
      socketRef.current?.emit('cursor-update', { roomId, userId, cursor });
    },
    []
  );

  const sendContentSync = useCallback(
    (roomId: string, userId: string, content: string) => {
      const currentVersion = useStore.getState().contentVersion;
      socketRef.current?.emit('content-sync', { roomId, userId, content, version: currentVersion });
    },
    []
  );

  const requestContent = useCallback((roomId: string, from: string, to: string) => {
    socketRef.current?.emit('content-request', { roomId, from, to });
  }, []);

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      const { type, from, data, roomId } = message;
      const { peers, iceServers, currentUser: user } = useStore.getState();

      if (!user) return;

      if (type === 'offer') {
        let peerConn = peers.get(from)?.connection;

        if (!peerConn) {
          peerConn = new RTCPeerConnection({ iceServers });
          setupPeerConnection(peerConn, from, roomId);
        }

        await peerConn.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await peerConn.createAnswer();
        await peerConn.setLocalDescription(answer);

        sendSignal({
          type: 'answer',
          from: user.id,
          to: from,
          roomId,
          data: answer,
        });
      } else if (type === 'answer') {
        const peerConn = peers.get(from)?.connection;
        if (peerConn) {
          await peerConn.setRemoteDescription(new RTCSessionDescription(data));
        }
      } else if (type === 'ice-candidate') {
        const peerConn = peers.get(from)?.connection;
        if (peerConn && data) {
          try {
            await peerConn.addIceCandidate(new RTCIceCandidate(data));
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        }
      }
    },
    [sendSignal]
  );

  const setupPeerConnection = useCallback(
    (conn: RTCPeerConnection, peerId: string, roomId: string) => {
      const { addPeer, updatePeerState, currentUser: user, iceServers } = useStore.getState();

      if (!user) return;

      const dataChannel = conn.createDataChannel('editor-sync', {
        ordered: true,
      });

      setupDataChannel(dataChannel, peerId);

      conn.ondatachannel = (event) => {
        setupDataChannel(event.channel, peerId);
      };

      conn.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: 'ice-candidate',
            from: user.id,
            to: peerId,
            roomId,
            data: event.candidate,
          });
        }
      };

      conn.onconnectionstatechange = () => {
        const state = conn.connectionState;
        if (state === 'connected') {
          updatePeerState(peerId, 'connected');
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          updatePeerState(peerId, state as any);
        }
      };

      conn.oniceconnectionstatechange = () => {
        const state = conn.iceConnectionState;
        if (state === 'checking') {
          updatePeerState(peerId, 'connecting');
        }
      };

      addPeer(peerId, {
        peerId,
        connection: conn,
        dataChannel,
        state: 'connecting',
      });
    },
    [sendSignal]
  );

  const setupDataChannel = useCallback((channel: RTCDataChannel, peerId: string) => {
    channel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
      useStore.getState().updatePeerState(peerId, 'connected');

      const state = useStore.getState();
      if (state.editorContent) {
        channel.send(JSON.stringify({
          type: 'full-content',
          userId: state.currentUser?.id,
          data: state.editorContent,
          version: state.contentVersion,
          timestamp: Date.now(),
        }));
      }
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'text-change' || message.type === 'full-content') {
          const state = useStore.getState();
          const messageVersion = message.version || 0;
          if (messageVersion >= state.contentVersion) {
            state.setEditorContent(message.data, messageVersion);
          }
        } else if (message.type === 'cursor') {
          useStore.getState().updateRemoteCursor(peerId, message.data);
        }
      } catch (e) {
        console.error('Error parsing data channel message:', e);
      }
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      useStore.getState().updatePeerState(peerId, 'disconnected');
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
      useStore.getState().updatePeerState(peerId, 'failed');
    };
  }, []);

  const createOffer = useCallback(
    async (peerId: string, roomId: string) => {
      const { iceServers, currentUser: user } = useStore.getState();
      if (!user) return;

      const conn = new RTCPeerConnection({ iceServers });
      setupPeerConnection(conn, peerId, roomId);

      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);

      sendSignal({
        type: 'offer',
        from: user.id,
        to: peerId,
        roomId,
        data: offer,
      });
    },
    [sendSignal, setupPeerConnection]
  );

  const sendToDataChannel = useCallback(
    (peerId: string, data: any) => {
      const { peers } = useStore.getState();
      const peer = peers.get(peerId);
      if (peer?.dataChannel?.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(data));
        return true;
      }
      return false;
    },
    []
  );

  const broadcastToPeers = useCallback(
    (data: any) => {
      const { peers, contentVersion } = useStore.getState();
      const dataWithVersion = {
        ...data,
        version: contentVersion,
      };
      peers.forEach((peer, peerId) => {
        if (peer.dataChannel?.readyState === 'open') {
          peer.dataChannel.send(JSON.stringify(dataWithVersion));
        }
      });
    },
    []
  );

  const sendMentionNotification = useCallback(
    (roomId: string, toUserId: string, fromUser: User, message: string, position: any) => {
      socketRef.current?.emit('mention', {
        roomId,
        toUserId,
        fromUser,
        message,
        position,
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    joinRoom,
    sendSignal,
    sendCursorUpdate,
    sendContentSync,
    requestContent,
    createOffer,
    sendToDataChannel,
    broadcastToPeers,
    sendMentionNotification,
    isConnected: socketRef.current?.connected || false,
  };
};
