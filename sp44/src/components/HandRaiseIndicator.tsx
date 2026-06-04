import { Hand } from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';

export default function HandRaiseIndicator() {
  const { participants } = useMeetingStore();
  const raisedHands = participants.filter((p) => p.isHandRaised);

  if (raisedHands.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 rounded-full border border-yellow-500/30">
      <Hand className="w-4 h-4 text-yellow-400" />
      <span className="text-yellow-400 text-sm font-medium">{raisedHands.length}</span>
    </div>
  );
}
