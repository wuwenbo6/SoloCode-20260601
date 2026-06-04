import { useState, useRef, useCallback, useEffect } from 'react';
import { JanusConfig, Participant, JanusClientState } from '@/types';

interface JanusMessage {
  janus: string;
  transaction?: string;
  session_id?: number;
  handle_id?: number;
  [key: string]: any;
}

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface UseJanusClientOptions {
  serverUrl: string;
  roomId: number;
  displayName: string;
  iceServers?: IceServer[];
}

interface UseJanusClientReturn extends JanusClientState {
  connect: (localStream: MediaStream) => Promise<boolean>;
  disconnect: () => void;
  toggleVideo: (enabled: boolean) => void;
  toggleAudio: (enabled: boolean) => void;
  updateConfig: (config: Partial<JanusConfig>) => void;
  publishStream: (stream: MediaStream) => Promise<boolean>;
  unpublishStream: () => void;
}

const JANUS_PLUGIN_VIDEO_ROOM = 'janus.plugin.videoroom';

export function useJanusClient(
  options: UseJanusClientOptions
): UseJanusClientReturn {
  const [state, setState] = useState<JanusClientState>({
    isConnected: false,
    isInRoom: false,
    participants: [],
    error: null,
    roomId: options.roomId,
    displayName: options.displayName,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const handleIdRef = useRef<number | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, { pc: RTCPeerConnection; handleId: number }>>(new Map());
  const transactionsRef = useRef<Map<string, (msg: JanusMessage) => void>>(new Map());
  const trickleQueueRef = useRef<Map<number, RTCIceCandidate[]>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const generateTransaction = useCallback(() => {
    return Math.random().toString(36).substring(2, 12);
  }, []);

  const sendMessage = useCallback((msg: JanusMessage): Promise<JanusMessage> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const transaction = msg.transaction || generateTransaction();
      const msgWithTransaction = { ...msg, transaction };

      transactionsRef.current.set(transaction, resolve);

      setTimeout(() => {
        if (transactionsRef.current.has(transaction)) {
          transactionsRef.current.delete(transaction);
          reject(new Error('Request timeout'));
        }
      }, 10000);

      ws.send(JSON.stringify(msgWithTransaction));
    });
  }, [generateTransaction]);

  const keepAlive = useCallback(() => {
    if (!sessionIdRef.current || !wsRef.current) return;

    try {
      sendMessage({
        janus: 'keepalive',
        session_id: sessionIdRef.current,
      }).catch(() => {});
    } catch (e) {
      console.warn('Keepalive failed');
    }
  }, [sendMessage]);

  const handleMessage = useCallback(async (msg: JanusMessage) => {
    const { janus, transaction } = msg;

    if (transaction && transactionsRef.current.has(transaction)) {
      const resolver = transactionsRef.current.get(transaction)!;
      transactionsRef.current.delete(transaction);
      resolver(msg);
    }

    switch (janus) {
      case 'event': {
        const plugindata = msg.plugindata?.data;
        if (!plugindata) break;

        if (plugindata.publishers) {
          const publishers = plugindata.publishers as Array<{ id: number; display: string; talking?: boolean }>;
          
          setState(prev => {
            const existingIds = new Set(prev.participants.map(p => p.id));
            
            for (const pub of publishers) {
              if (!existingIds.has(String(pub.id)) && String(pub.id) !== String(handleIdRef.current)) {
                subscribeToPublisher(pub.id, pub.display);
              }
            }

            const updatedParticipants = prev.participants.map(p => {
              const publisher = publishers.find(pub => String(pub.id) === p.id);
              return publisher ? { ...p, isSpeaking: publisher.talking || false } : p;
            });

            return { ...prev, participants: updatedParticipants };
          });
        }

        if (plugindata.unpublished) {
          const publisherId = String(plugindata.unpublished);
          unsubscribeFromPublisher(publisherId);
        }

        if (plugindata.leaving) {
          const publisherId = String(plugindata.leaving);
          unsubscribeFromPublisher(publisherId);
        }
        break;
      }

      case 'trickle': {
        const { candidate, sender } = msg;
        if (!candidate || candidate.completed) break;

        const pc = sender === handleIdRef.current
          ? pcRef.current
          : remoteStreamsRef.current.get(String(sender))?.pc;

        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Failed to add ICE candidate:', e);
          }
        } else if (sender) {
          if (!trickleQueueRef.current.has(sender)) {
            trickleQueueRef.current.set(sender, []);
          }
          trickleQueueRef.current.get(sender)!.push(candidate);
        }
        break;
      }

      case 'media': {
        console.log('Media event:', msg.type);
        break;
      }

      case 'webrtcup': {
        setState(prev => ({ ...prev, isInRoom: true }));
        break;
      }

      case 'hangup': {
        console.log('WebRTC hangup');
        break;
      }
    }
  }, []);

  const subscribeToPublisher = useCallback(async (publisherId: number, displayName: string) => {
    const ws = wsRef.current;
    if (!ws || !sessionIdRef.current) return;

    try {
      const iceServers = optionsRef.current.iceServers || [];
      const pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });

      const participantId = String(publisherId);
      remoteStreamsRef.current.set(participantId, { pc, handleId: 0 });

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          setState(prev => {
            const existing = prev.participants.find(p => p.id === participantId);
            if (existing) {
              return {
                ...prev,
                participants: prev.participants.map(p =>
                  p.id === participantId ? { ...p, stream } : p
                ),
              };
            }

            return {
              ...prev,
              participants: [
                ...prev.participants,
                {
                  id: participantId,
                  displayName,
                  stream,
                  videoEnabled: true,
                  audioEnabled: true,
                  isLocal: false,
                  isSpeaking: false,
                },
              ],
            };
          });
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const remoteInfo = remoteStreamsRef.current.get(participantId);
        if (remoteInfo?.handleId) {
          sendMessage({
            janus: 'trickle',
            session_id: sessionIdRef.current!,
            handle_id: remoteInfo.handleId,
            candidate: event.candidate,
          }).catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          console.warn(`ICE connection failed for ${participantId}`);
          pc.restartIce();
        }
      };

      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const joinResponse = await sendMessage({
        janus: 'attach',
        session_id: sessionIdRef.current,
        plugin: JANUS_PLUGIN_VIDEO_ROOM,
      });

      const subscriberHandleId = joinResponse.data?.id;
      if (!subscriberHandleId) throw new Error('Failed to get subscriber handle');

      const remoteInfo = remoteStreamsRef.current.get(participantId);
      if (remoteInfo) {
        remoteInfo.handleId = subscriberHandleId;
        remoteStreamsRef.current.set(participantId, remoteInfo);
      }

      const queuedCandidates = trickleQueueRef.current.get(subscriberHandleId) || [];
      for (const candidate of queuedCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      trickleQueueRef.current.delete(subscriberHandleId);

      const startResponse = await sendMessage({
        janus: 'message',
        session_id: sessionIdRef.current,
        handle_id: subscriberHandleId,
        body: {
          request: 'join',
          room: optionsRef.current.roomId,
          ptype: 'subscriber',
          streams: [{ feed: publisherId }],
        },
        jsep: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });

      const jsep = startResponse.jsep;
      if (jsep) {
        await pc.setRemoteDescription(new RTCSessionDescription(jsep));
      }

      setState(prev => {
        const existing = prev.participants.find(p => p.id === participantId);
        if (existing) return prev;

        return {
          ...prev,
          participants: [
            ...prev.participants,
            {
              id: participantId,
              displayName,
              stream: null,
              videoEnabled: true,
              audioEnabled: true,
              isLocal: false,
              isSpeaking: false,
            },
          ],
        };
      });

    } catch (error) {
      console.error('Failed to subscribe to publisher:', error);
      unsubscribeFromPublisher(String(publisherId));
    }
  }, [sendMessage]);

  const unsubscribeFromPublisher = useCallback((publisherId: string) => {
    const remoteInfo = remoteStreamsRef.current.get(publisherId);
    if (remoteInfo) {
      try {
        if (remoteInfo.pc.signalingState !== 'closed') {
          remoteInfo.pc.close();
        }
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
      remoteStreamsRef.current.delete(publisherId);
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== publisherId),
    }));
  }, []);

  const connect = useCallback(async (localStream: MediaStream): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));

      localStreamRef.current = localStream;

      const ws = new WebSocket(optionsRef.current.serverUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = (e) => reject(new Error('WebSocket connection failed'));
        ws.onclose = () => {
          if (reconnectTimeoutRef.current) return;
        };
      });

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      ws.onerror = () => {
        setState(prev => ({ ...prev, error: 'WebSocket error' }));
      };

      ws.onclose = () => {
        if (keepaliveIntervalRef.current) {
          clearInterval(keepaliveIntervalRef.current);
          keepaliveIntervalRef.current = null;
        }

        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            reconnectTimeoutRef.current = null;
            if (localStreamRef.current) {
              connect(localStreamRef.current);
            }
          }, 3000);
        }
      };

      const createResponse = await sendMessage({
        janus: 'create',
      });

      sessionIdRef.current = createResponse.data?.id;
      if (!sessionIdRef.current) {
        throw new Error('Failed to create Janus session');
      }

      keepaliveIntervalRef.current = setInterval(keepAlive, 30000);

      const attachResponse = await sendMessage({
        janus: 'attach',
        session_id: sessionIdRef.current,
        plugin: JANUS_PLUGIN_VIDEO_ROOM,
      });

      handleIdRef.current = attachResponse.data?.id;
      if (!handleIdRef.current) {
        throw new Error('Failed to attach plugin');
      }

      setState(prev => ({
        ...prev,
        isConnected: true,
        participants: [{
          id: String(handleIdRef.current),
          displayName: optionsRef.current.displayName,
          stream: localStream,
          videoEnabled: true,
          audioEnabled: true,
          isLocal: true,
          isSpeaking: false,
        }],
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setState(prev => ({ ...prev, error: errorMessage }));
      cleanup();
      return false;
    }
  }, [sendMessage, handleMessage, keepAlive]);

  const publishStream = useCallback(async (stream: MediaStream): Promise<boolean> => {
    try {
      if (!handleIdRef.current || !sessionIdRef.current) {
        throw new Error('Not connected to Janus');
      }

      localStreamRef.current = stream;

      const iceServers = optionsRef.current.iceServers || [];
      const pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });

      pcRef.current = pc;

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendMessage({
          janus: 'trickle',
          session_id: sessionIdRef.current!,
          handle_id: handleIdRef.current!,
          candidate: event.candidate,
        }).catch(() => {});
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          pc.restartIce();
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await sendMessage({
            janus: 'message',
            session_id: sessionIdRef.current!,
            handle_id: handleIdRef.current!,
            body: {
              request: 'configure',
              audio: true,
              video: true,
            },
            jsep: {
              type: offer.type,
              sdp: offer.sdp,
            },
          });
        } catch (e) {
          console.error('Negotiation error:', e);
        }
      };

      const joinResponse = await sendMessage({
        janus: 'message',
        session_id: sessionIdRef.current,
        handle_id: handleIdRef.current,
        body: {
          request: 'join',
          room: optionsRef.current.roomId,
          ptype: 'publisher',
          display: optionsRef.current.displayName,
        },
      });

      if (joinResponse.plugindata?.data?.videoroom !== 'joined') {
        throw new Error('Failed to join room');
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const publishResponse = await sendMessage({
        janus: 'message',
        session_id: sessionIdRef.current,
        handle_id: handleIdRef.current,
        body: {
          request: 'publish',
          audio: true,
          video: true,
          display: optionsRef.current.displayName,
        },
        jsep: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });

      const jsep = publishResponse.jsep;
      if (jsep) {
        await pc.setRemoteDescription(new RTCSessionDescription(jsep));
      }

      setState(prev => ({
        ...prev,
        isInRoom: true,
        participants: prev.participants.map(p =>
          p.isLocal ? { ...p, stream } : p
        ),
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to publish stream';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [sendMessage]);

  const unpublishStream = useCallback(() => {
    if (pcRef.current) {
      try {
        if (pcRef.current.signalingState !== 'closed') {
          pcRef.current.close();
        }
      } catch (e) {
        console.warn('Error closing publisher PC:', e);
      }
      pcRef.current = null;
    }

    if (handleIdRef.current && sessionIdRef.current) {
      sendMessage({
        janus: 'message',
        session_id: sessionIdRef.current,
        handle_id: handleIdRef.current,
        body: { request: 'unpublish' },
      }).catch(() => {});
    }

    setState(prev => ({
      ...prev,
      isInRoom: false,
      participants: prev.participants.filter(p => p.isLocal),
    }));
  }, [sendMessage]);

  const cleanup = useCallback(() => {
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    unpublishStream();

    for (const [publisherId, info] of remoteStreamsRef.current) {
      try {
        if (info.pc.signalingState !== 'closed') {
          info.pc.close();
        }
        if (sessionIdRef.current && info.handleId) {
          sendMessage({
            janus: 'detach',
            session_id: sessionIdRef.current,
            handle_id: info.handleId,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Error cleaning up remote stream:', e);
      }
    }
    remoteStreamsRef.current.clear();

    if (handleIdRef.current && sessionIdRef.current) {
      sendMessage({
        janus: 'detach',
        session_id: sessionIdRef.current,
        handle_id: handleIdRef.current,
      }).catch(() => {});
    }

    if (sessionIdRef.current) {
      sendMessage({
        janus: 'destroy',
        session_id: sessionIdRef.current,
      }).catch(() => {});
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    handleIdRef.current = null;
    sessionIdRef.current = null;
    transactionsRef.current.clear();
    trickleQueueRef.current.clear();

    setState({
      isConnected: false,
      isInRoom: false,
      participants: [],
      error: null,
      roomId: optionsRef.current.roomId,
      displayName: optionsRef.current.displayName,
    });
  }, [sendMessage, unpublishStream]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.isLocal ? { ...p, videoEnabled: enabled } : p
      ),
    }));
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.isLocal ? { ...p, audioEnabled: enabled } : p
      ),
    }));
  }, []);

  const updateConfig = useCallback((config: Partial<JanusConfig>) => {
    setState(prev => ({
      ...prev,
      roomId: config.roomId ?? prev.roomId,
      displayName: config.displayName ?? prev.displayName,
    }));

    if (config.serverUrl) {
      optionsRef.current.serverUrl = config.serverUrl;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio,
    updateConfig,
    publishStream,
    unpublishStream,
  };
}
