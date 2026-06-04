import React, { useMemo } from 'react';
import { Participant } from '@/types';
import { ParticipantTile } from './ParticipantTile';

interface ConferenceGridProps {
  participants: Participant[];
  onParticipantClick?: (participant: Participant) => void;
}

export const ConferenceGrid: React.FC<ConferenceGridProps> = ({
  participants,
  onParticipantClick,
}) => {
  const layout = useMemo(() => {
    const count = participants.length;

    if (count === 0) return { cols: 1, rows: 1 };
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    if (count <= 12) return { cols: 4, rows: 3 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  }, [participants.length]);

  const speakingParticipant = useMemo(() => {
    return participants.find(p => p.isSpeaking && !p.isLocal);
  }, [participants]);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
    gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
    gap: '12px',
    width: '100%',
    height: '100%',
    padding: '16px',
  };

  return (
    <div style={gridStyle}>
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.id}
          participant={participant}
          isDominant={speakingParticipant?.id === participant.id && participants.length > 2}
          onClick={() => onParticipantClick?.(participant)}
        />
      ))}

      {participants.length === 0 && (
        <div className="col-span-full row-span-full flex flex-col items-center justify-center text-slate-400">
          <div className="w-24 h-24 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-slate-300">等待参与者加入</p>
          <p className="text-sm text-slate-500 mt-1">分享房间号邀请其他人加入会议</p>
        </div>
      )}
    </div>
  );
};
