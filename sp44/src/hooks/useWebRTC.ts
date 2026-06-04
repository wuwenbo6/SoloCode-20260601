import { useEffect, useRef, useCallback, useState } from 'react';
import { Device } from 'mediasoup-client';
import { useMeetingStore } from '@/store/meetingStore';
import {
  getDisplayMediaWithConstraints,
  getOptimalConstraints,
  constrainScreenStream,
  createBandwidthMonitor,
  applyAdaptiveBitrate,
  type BandwidthMonitor,
} from '@/utils/screen-share';

const WS_URL = `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.hostname}:3001/ws`;

function generatePeerId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function useWebRTC(roomId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<any>(null);
  const recvTransportRef = useRef<any>(null);
  const producersRef = useRef<Map<string, any>>(new Map());
  const consumersRef = useRef<Map<string, any>>(new Map());
  const pendingCallbacks = useRef<Map<string, { resolve: Function; reject: Function }>>(new Map());
  const msgIdCounter = useRef(0);
  const [connected, setConnected] = useState(false);
  const peerIdRef = useRef<string>(generatePeerId());

  const {
    setLocalStream,
    addRemoteStream,
    removeRemoteStream,
    setIsMuted,
    setIsCameraOff,
    setIsScreenSharing,
    setParticipants,
    addChatMessage,
    userName,
    setIsEncrypted,
    addSharedKey,
    encryptionKeys,
  } = useMeetingStore();

  const sendMsg = useCallback((type: string, payload: Record<string, unknown> = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== ws.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const msgId = `${++msgIdCounter.current}`;
      pendingCallbacks.current.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ type, payload, msgId }));
      setTimeout(() => {
        if (pendingCallbacks.current.has(msgId)) {
          pendingCallbacks.current.delete(msgId);
          reject(new Error(`Timeout waiting for response to ${type}`));
        }
      }, 15000);
    });
  }, []);

  const waitForMessage = useCallback((type: string, timeout = 15000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === type) {
            ws.removeEventListener('message', handler);
            resolve(msg);
          }
          if (msg.type === 'error') {
            ws.removeEventListener('message', handler);
            reject(new Error(msg.payload?.message || 'Server error'));
          }
        } catch {}
      };
      ws.addEventListener('message', handler);
      setTimeout(() => {
        ws.removeEventListener('message', handler);
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeout);
    });
  }, []);

  const consumeProducer = useCallback(async (producerId: string, peerId: string, kind: string) => {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) return;

    try {
      const response = await sendMsg('consume', {
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      const consumer = await recvTransport.consume({
        id: response.payload.consumerId,
        producerId: response.payload.producerId,
        kind: response.payload.kind,
        rtpParameters: response.payload.rtpParameters,
      });

      consumersRef.current.set(producerId, consumer);
      const stream = new MediaStream([consumer.track]);
      addRemoteStream(peerId, stream);
    } catch (err) {
      console.error('Failed to consume:', err);
    }
  }, [sendMsg, addRemoteStream]);

  const connect = useCallback(async () => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    const peerId = peerIdRef.current;

    ws.onopen = async () => {
      try {
        const rtpCapabilities = await sendMsg('get-router-rtp-capabilities', { roomId });

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities.payload.rtpCapabilities });
        deviceRef.current = device;

        const joinResponse = await sendMsg('join-room', {
          roomId,
          peerId,
          displayName: userName || 'Anonymous',
        });

        setParticipants(
          (joinResponse.payload.peers || []).map((p: any) => ({
            id: p.id,
            name: p.displayName,
            isHost: false,
            isMuted: false,
            isCameraOff: false,
            audioLevel: 0,
          }))
        );

        const sendTransportInfo = await sendMsg('create-webrtc-transport', { direction: 'send' });
        const sendTransport = device.createSendTransport({
          id: sendTransportInfo.payload.id,
          iceParameters: sendTransportInfo.payload.iceParameters,
          iceCandidates: sendTransportInfo.payload.iceCandidates,
          dtlsParameters: sendTransportInfo.payload.dtlsParameters,
        });
        sendTransportRef.current = sendTransport;

        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await sendMsg('connect-transport', {
              transportId: sendTransport.id,
              dtlsParameters,
            });
            callback();
          } catch (err) {
            errback(err as Error);
          }
        });

        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const response = await sendMsg('produce', {
              transportId: sendTransport.id,
              kind,
              rtpParameters,
              appData,
            });
            callback({ id: response.payload.producerId });
          } catch (err) {
            errback(err as Error);
          }
        });

        const recvTransportInfo = await sendMsg('create-webrtc-transport', { direction: 'recv' });
        const recvTransport = device.createRecvTransport({
          id: recvTransportInfo.payload.id,
          iceParameters: recvTransportInfo.payload.iceParameters,
          iceCandidates: recvTransportInfo.payload.iceCandidates,
          dtlsParameters: recvTransportInfo.payload.dtlsParameters,
        });
        recvTransportRef.current = recvTransport;

        recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await sendMsg('connect-transport', {
              transportId: recvTransport.id,
              dtlsParameters,
            });
            callback();
          } catch (err) {
            errback(err as Error);
          }
        });

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(stream);

          const audioTrack = stream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];

          if (audioTrack) {
            const audioProducer = await sendTransport.produce({ track: audioTrack });
            producersRef.current.set('audio', audioProducer);
          }
          if (videoTrack) {
            const videoProducer = await sendTransport.produce({ track: videoTrack });
            producersRef.current.set('video', videoProducer);
          }
        } catch (err) {
          console.error('Failed to get user media:', err);
        }

        const existingProducers = joinResponse.payload.producers || [];
        for (const prod of existingProducers) {
          await consumeProducer(prod.producerId, prod.peerId, prod.kind);
        }

        if (encryptionKeys) {
          const pubKeyB64 = await exportPublicKeyB64(encryptionKeys);
          ws.send(JSON.stringify({
            type: 'exchange-key',
            payload: { peerId, key: pubKeyB64 },
          }));
        }

        setConnected(true);
      } catch (err) {
        console.error('Failed to join room:', err);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload, msgId } = msg;

        if (msgId && pendingCallbacks.current.has(msgId)) {
          const { resolve } = pendingCallbacks.current.get(msgId)!;
          pendingCallbacks.current.delete(msgId);
          resolve(msg);
          return;
        }

        switch (type) {
          case 'peer-joined': {
            setParticipants(useMeetingStore.getState().participants.concat({
              id: payload.peerId as string,
              name: payload.displayName as string,
              isHost: false,
              isMuted: false,
              isCameraOff: false,
              audioLevel: 0,
            }));
            break;
          }

          case 'peer-left': {
            const leftPeerId = payload.peerId as string;
            removeRemoteStream(leftPeerId);
            setParticipants(useMeetingStore.getState().participants.filter((p) => p.id !== leftPeerId));
            break;
          }

          case 'new-producer': {
            consumeProducer(payload.producerId as string, payload.peerId as string, payload.kind as string);
            break;
          }

          case 'key-exchanged': {
            const exchangedPeerId = payload.peerId as string;
            const keyB64 = payload.key as string;
            if (encryptionKeys) {
              importPublicKeyB64(keyB64).then(async (pubKey) => {
                const sharedKey = await window.crypto.subtle.deriveKey(
                  { name: 'ECDH', public: pubKey },
                  encryptionKeys.privateKey,
                  { name: 'AES-GCM', length: 256 },
                  false,
                  ['encrypt', 'decrypt'],
                );
                addSharedKey(exchangedPeerId, sharedKey);
                setIsEncrypted(true);
              });
            }
            break;
          }

          case 'chat-message': {
            addChatMessage({
              id: crypto.randomUUID(),
              senderId: payload.peerId as string,
              senderName: payload.displayName as string,
              text: payload.message as string,
              timestamp: payload.timestamp as number,
            });
            break;
          }

          case 'recording-started': {
            useMeetingStore.getState().setIsRecording(true);
            break;
          }

          case 'recording-stopped': {
            useMeetingStore.getState().setIsRecording(false);
            break;
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };
  }, [roomId, userName, sendMsg, consumeProducer, setLocalStream, addRemoteStream, removeRemoteStream, setParticipants, addChatMessage, setIsEncrypted, addSharedKey, encryptionKeys]);

  const toggleMic = useCallback(() => {
    const stream = useMeetingStore.getState().localStream;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, [setIsMuted]);

  const toggleCamera = useCallback(() => {
    const stream = useMeetingStore.getState().localStream;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, [setIsCameraOff]);

  const bandwidthMonitorRef = useRef<BandwidthMonitor | null>(null);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await getDisplayMediaWithConstraints();
      const screenTrack = screenStream.getVideoTracks()[0];

      const settings = screenTrack.getSettings();
      const screenResolution = {
        width: settings.width || 1920,
        height: settings.height || 1080,
      };
      const constraints = getOptimalConstraints(screenResolution);
      constrainScreenStream(screenStream, constraints);

      if (sendTransportRef.current) {
        const screenProducer = await sendTransportRef.current.produce({
          track: screenTrack,
          appData: { screenShare: true },
        });
        producersRef.current.set('screen', screenProducer);

        applyAdaptiveBitrate(screenTrack, screenProducer);
      }

      const monitor = createBandwidthMonitor();
      bandwidthMonitorRef.current = monitor;
      monitor.start(screenTrack);
      monitor.onLowBandwidth((bitrateKbps) => {
        const newConstraints = getOptimalConstraints(screenResolution, bitrateKbps);
        const track = screenStream.getVideoTracks()[0];
        if (track) {
          track.applyConstraints({
            width: { ideal: newConstraints.maxWidth },
            height: { ideal: newConstraints.maxHeight },
            frameRate: { ideal: 15 },
          }).catch(() => {});
        }
      });

      setIsScreenSharing(true);
      screenTrack.onended = () => {
        const sp = producersRef.current.get('screen');
        if (sp) {
          sp.close();
          producersRef.current.delete('screen');
        }
        monitor.stop();
        bandwidthMonitorRef.current = null;
        setIsScreenSharing(false);
      };
    } catch (err) {
      console.error('Screen share failed:', err);
    }
  }, [setIsScreenSharing]);

  const stopScreenShare = useCallback(() => {
    const sp = producersRef.current.get('screen');
    if (sp) {
      sp.close();
      producersRef.current.delete('screen');
    }
    if (bandwidthMonitorRef.current) {
      bandwidthMonitorRef.current.stop();
      bandwidthMonitorRef.current = null;
    }
    setIsScreenSharing(false);
  }, [setIsScreenSharing]);

  const startRecording = useCallback(async () => {
    try {
      await sendMsg('start-recording', {});
    } catch (err) {
      console.error('Start recording failed:', err);
    }
  }, [sendMsg]);

  const stopRecording = useCallback(async () => {
    try {
      await sendMsg('stop-recording', {});
    } catch (err) {
      console.error('Stop recording failed:', err);
    }
  }, [sendMsg]);

  const sendChatMessage = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({
      type: 'chat-message',
      payload: { message: text },
    }));
    addChatMessage({
      id: crypto.randomUUID(),
      senderId: 'local',
      senderName: userName || 'You',
      text,
      timestamp: Date.now(),
    });
  }, [userName, addChatMessage]);

  const exchangeEncryptionKey = useCallback(async () => {
    if (!encryptionKeys) return;
    const pubKeyB64 = await exportPublicKeyB64(encryptionKeys);
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({
      type: 'exchange-key',
      payload: { peerId: peerIdRef.current, key: pubKeyB64 },
    }));
  }, [encryptionKeys]);

  const leaveMeeting = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.close();
    }
    producersRef.current.forEach((p) => p.close());
    producersRef.current.clear();
    consumersRef.current.forEach((c) => c.close());
    consumersRef.current.clear();
    const stream = useMeetingStore.getState().localStream;
    stream?.getTracks().forEach((t) => t.stop());
    useMeetingStore.getState().reset();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      leaveMeeting();
    };
  }, [connect, leaveMeeting]);

  return {
    connected,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    startRecording,
    stopRecording,
    sendChatMessage,
    exchangeEncryptionKey,
    leaveMeeting,
  };
}

async function exportPublicKeyB64(keyPair: CryptoKeyPair): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function importPublicKeyB64(b64: string): Promise<CryptoKey> {
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    'spki',
    binary.buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}
