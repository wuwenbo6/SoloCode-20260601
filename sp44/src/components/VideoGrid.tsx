import { useState } from 'react';
import VideoTile from './VideoTile';
import { useMeetingStore } from '@/store/meetingStore';

export default function VideoGrid() {
  const { localStream, remoteStreams, participants, userName, isMuted, isCameraOff } =
    useMeetingStore();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const totalCount = 1 + remoteStreams.size;
  const allParticipants = [
    {
      id: 'local',
      stream: localStream,
      name: userName || 'You',
      isMuted,
      isCameraOff,
      isLocal: true,
    },
    ...Array.from(remoteStreams.entries()).map(([id, stream]) => {
      const p = participants.find((p) => p.id === id);
      return {
        id,
        stream,
        name: p?.name || 'Participant',
        isMuted: p?.isMuted ?? false,
        isCameraOff: p?.isCameraOff ?? false,
        isLocal: false,
      };
    }),
  ];

  const getGridClass = () => {
    if (focusedId) return 'grid-cols-1 grid-rows-1';
    if (totalCount === 1) return 'grid-cols-1 grid-rows-1';
    if (totalCount === 2) return 'grid-cols-2 grid-rows-1';
    if (totalCount <= 4) return 'grid-cols-2 grid-rows-2';
    if (totalCount <= 6) return 'grid-cols-3 grid-rows-2';
    if (totalCount <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4 grid-rows-3';
  };

  const displayParticipants = focusedId
    ? allParticipants.filter((p) => p.id === focusedId)
    : allParticipants;

  return (
    <div className={`grid ${getGridClass()} gap-3 w-full h-full p-4`}>
      {displayParticipants.map((p) => (
        <div
          key={p.id}
          className={`cursor-pointer transition-all duration-300 ${
            focusedId === p.id ? 'col-span-1 row-span-1' : ''
          }`}
          onClick={() => setFocusedId(focusedId === p.id ? null : p.id)}
        >
          <VideoTile
            stream={p.stream}
            name={p.name}
            isMuted={p.isMuted}
            isCameraOff={p.isCameraOff}
            isLocal={p.isLocal}
          />
        </div>
      ))}
    </div>
  );
}
