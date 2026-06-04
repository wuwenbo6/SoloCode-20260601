import React, { useState, useEffect, useRef } from 'react';
import networkManager from '../utils/networkManager';

const VoiceChatPanel = ({ onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef();
  const audioElementsRef = useRef({});

  useEffect(() => {
    const handleInit = () => {
      setIsConnected(true);
      setPlayers(networkManager.getPlayers());
    };

    const handlePlayerJoined = () => {
      setPlayers(networkManager.getPlayers());
    };

    const handlePlayerLeft = () => {
      setPlayers(networkManager.getPlayers());
    };

    const handleChatMessage = (data) => {
      setMessages(prev => [...prev, data]);
    };

    const handleRemoteStream = ({ playerId, stream }) => {
      if (audioElementsRef.current[playerId]) {
        audioElementsRef.current[playerId].srcObject = stream;
      }
    };

    networkManager.on('init', handleInit);
    networkManager.on('playerJoined', handlePlayerJoined);
    networkManager.on('playerLeft', handlePlayerLeft);
    networkManager.on('chatMessage', handleChatMessage);
    networkManager.on('remoteStream', handleRemoteStream);

    return () => {
      networkManager.off('init', handleInit);
      networkManager.off('playerJoined', handlePlayerJoined);
      networkManager.off('playerLeft', handlePlayerLeft);
      networkManager.off('chatMessage', handleChatMessage);
      networkManager.off('remoteStream', handleRemoteStream);
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleEnableAudio = async () => {
    const success = await networkManager.enableAudio();
    if (success) {
      setAudioEnabled(true);
      players.forEach(player => {
        networkManager.initiateCall(player.id);
      });
    }
  };

  const handleDisableAudio = () => {
    networkManager.disableAudio();
    setAudioEnabled(false);
    setIsMuted(false);
  };

  const handleToggleMute = () => {
    const muted = networkManager.toggleMute();
    setIsMuted(muted);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      networkManager.sendChatMessage(chatInput.trim());
      setChatInput('');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.9)',
      borderRadius: '12px',
      padding: '24px',
      minWidth: '400px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      overflow: 'auto',
      zIndex: 1000,
      color: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>多人语音聊天</h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0 10px'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {!audioEnabled ? (
            <button
              onClick={handleEnableAudio}
              disabled={!isConnected}
              style={{
                flex: 1,
                padding: '12px',
                background: isConnected ? '#4CAF50' : '#666',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '1rem',
                cursor: isConnected ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              🎤 开启语音
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleMute}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isMuted ? '#f44336' : '#2196F3',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {isMuted ? '🔇 已静音' : '🔊 语音中'}
              </button>
              <button
                onClick={handleDisableAudio}
                style={{
                  padding: '12px 20px',
                  background: '#666',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                关闭
              </button>
            </>
          )}
        </div>

        <div style={{ fontSize: '0.875rem', color: isConnected ? '#4CAF50' : '#f44336' }}>
          {isConnected ? '✓ 已连接到服务器' : '✗ 未连接'}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>在线玩家 ({players.length})</h3>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '150px',
          overflow: 'auto'
        }}>
          {players.map(player => (
            <div
              key={player.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '6px'
              }}
            >
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: player.color
              }} />
              <span style={{ flex: 1 }}>{player.name}</span>
              {player.muted && <span>🔇</span>}
              {audioEnabled && (
                <audio
                  ref={el => audioElementsRef.current[player.id] = el}
                  autoPlay
                  style={{ display: 'none' }}
                />
              )}
            </div>
          ))}
          {players.length === 0 && (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
              暂无其他玩家在线
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>文字聊天</h3>
        <div
          ref={chatContainerRef}
          style={{
            height: '150px',
            overflow: 'auto',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '10px'
          }}
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                marginBottom: '8px',
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '4px'
              }}
            >
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <span style={{
                  color: msg.id === networkManager.playerId ? '#4CAF50' : '#2196F3',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {msg.name}
                </span>
                <span style={{ color: '#666', fontSize: '0.7rem' }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem' }}>{msg.message}</div>
            </div>
          ))}
          {messages.length === 0 && (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
              暂无消息
            </div>
          )}
        </div>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="输入消息..."
            disabled={!isConnected}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #444',
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: '0.9rem'
            }}
          />
          <button
            type="submit"
            disabled={!isConnected || !chatInput.trim()}
            style={{
              padding: '10px 20px',
              background: isConnected && chatInput.trim() ? '#2196F3' : '#444',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: isConnected && chatInput.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            发送
          </button>
        </form>
      </div>
    </div>
  );
};

export default VoiceChatPanel;
