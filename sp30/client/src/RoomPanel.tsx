import React from 'react';
import type { RoomInfo } from './types';

interface RoomPanelProps {
  rooms: RoomInfo[];
  currentRoomId: string | null;
  clientId: string;
  isPublisher: boolean;
  onJoinRoom: (roomId: string, roomName: string) => void;
  onLeaveRoom: () => void;
  onStartPublish: () => void;
  onStopPublish: () => void;
  onSubscribe: (publisherId: string) => void;
  onUnsubscribe: (publisherId: string) => void;
  subscribedPublishers: string[];
}

const RoomPanel: React.FC<RoomPanelProps> = ({
  rooms,
  currentRoomId,
  clientId,
  isPublisher,
  onJoinRoom,
  onLeaveRoom,
  onStartPublish,
  onStopPublish,
  onSubscribe,
  onUnsubscribe,
  subscribedPublishers,
}) => {
  const [newRoomId, setNewRoomId] = React.useState('');
  const [newRoomName, setNewRoomName] = React.useState('');

  const handleCreateJoin = () => {
    if (newRoomId.trim()) {
      onJoinRoom(newRoomId.trim(), newRoomName.trim() || newRoomId.trim());
      setNewRoomId('');
      setNewRoomName('');
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 text-white shadow-xl border border-gray-700">
      <h3 className="text-lg font-bold mb-3 text-blue-400 border-b border-gray-700 pb-2">
        🏠 Rooms
      </h3>

      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-1">Your ID</div>
        <div className="bg-gray-800 p-2 rounded text-sm font-mono break-all">
          {clientId}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Join / Create Room</div>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Room ID"
            value={newRoomId}
            onChange={(e) => setNewRoomId(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateJoin()}
          />
          <input
            type="text"
            placeholder="Room Name (optional)"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateJoin()}
          />
          <button
            onClick={handleCreateJoin}
            disabled={!newRoomId.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            {currentRoomId ? 'Switch Room' : 'Join Room'}
          </button>
        </div>
      </div>

      {currentRoomId && (
        <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-600">
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="text-xs text-gray-400">Current Room</div>
              <div className="font-mono text-sm">{currentRoomId}</div>
            </div>
            <button
              onClick={onLeaveRoom}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs font-medium transition-colors"
            >
              Leave
            </button>
          </div>

          <div className="flex gap-2">
            {!isPublisher ? (
              <button
                onClick={onStartPublish}
                className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                📤 Start Publishing
              </button>
            ) : (
              <button
                onClick={onStopPublish}
                className="flex-1 bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                ⏹ Stop Publishing
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-gray-400 mb-2">Active Rooms</div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-4">
              No active rooms
            </div>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                className={`p-3 rounded border ${
                  room.id === currentRoomId
                    ? 'bg-blue-900/30 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500 cursor-pointer'
                }`}
                onClick={() => room.id !== currentRoomId && onJoinRoom(room.id, room.name)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{room.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{room.id}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {room.client_count} user{room.client_count !== 1 ? 's' : ''}
                  </div>
                </div>

                {room.publisher_ids.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Publishers:</div>
                    <div className="flex flex-wrap gap-1">
                      {room.publisher_ids.map((pubId) => (
                        <div
                          key={pubId}
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                            pubId === clientId
                              ? 'bg-green-900/50 text-green-300'
                              : subscribedPublishers.includes(pubId)
                              ? 'bg-blue-900/50 text-blue-300'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          <span>👤</span>
                          <span className="font-mono">{pubId.slice(-8)}</span>
                          {pubId !== clientId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (subscribedPublishers.includes(pubId)) {
                                  onUnsubscribe(pubId);
                                } else {
                                  onSubscribe(pubId);
                                }
                              }}
                              className={`ml-1 px-1.5 rounded text-xs ${
                                subscribedPublishers.includes(pubId)
                                  ? 'bg-red-600 hover:bg-red-700'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {subscribedPublishers.includes(pubId) ? '✕' : '+'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomPanel;
