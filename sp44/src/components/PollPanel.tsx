import { useState } from 'react';
import { X, Vote, Settings, Check } from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';

interface PollPanelProps {
  onStartPoll: (question: string, options: string[], isAnonymous: boolean, allowMultiple: boolean) => void;
  onVote: (pollId: string, optionIndices: number[]) => void;
  onEndPoll: (pollId: string) => void;
}

export default function PollPanel({ onStartPoll, onVote, onEndPoll }: PollPanelProps) {
  const { polls, setPanelOpen, userName } = useMeetingStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', ''],
    isAnonymous: true,
    allowMultiple: false,
  });
  const [selectedOptions, setSelectedOptions] = useState<Map<string, Set<number>>>(new Map());

  const handleCreatePoll = () => {
    if (!newPoll.question.trim()) return;
    const validOptions = newPoll.options.filter((o) => o.trim());
    if (validOptions.length < 2) return;

    onStartPoll(newPoll.question, validOptions, newPoll.isAnonymous, newPoll.allowMultiple);
    setIsCreating(false);
    setNewPoll({ question: '', options: ['', ''], isAnonymous: true, allowMultiple: false });
  };

  const handleVote = (pollId: string, optionIndex: number, allowMultiple: boolean) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll || !poll.isActive) return;

    let current = selectedOptions.get(pollId) || new Set();
    if (allowMultiple) {
      const next = new Set(current);
      if (next.has(optionIndex)) {
        next.delete(optionIndex);
      } else {
        next.add(optionIndex);
      }
      setSelectedOptions(new Map(selectedOptions).set(pollId, next));
      onVote(pollId, Array.from(next));
    } else {
      if (current.has(optionIndex)) {
        current = new Set();
      } else {
        current = new Set([optionIndex]);
      }
      setSelectedOptions(new Map(selectedOptions).set(pollId, current));
      onVote(pollId, current.size > 0 ? [optionIndex] : []);
    }
  };

  const activePolls = polls.filter((p) => p.isActive);
  const closedPolls = polls.filter((p) => !p.isActive);

  return (
    <div className="w-80 h-full bg-[#0d1230]/95 backdrop-blur-xl border-l border-white/10 flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <h3 className="text-white font-heading font-semibold text-lg flex items-center gap-2">
          <Vote className="w-5 h-5 text-[#00e5a0]" />
          Polls
        </h3>
        <button
          onClick={() => setPanelOpen('none')}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-2.5 mb-4 bg-[#00e5a0]/20 hover:bg-[#00e5a0]/30 text-[#00e5a0] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Create New Poll
          </button>
        )}

        {isCreating && (
          <div className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
            <h4 className="text-white font-medium text-sm mb-3">Create Poll</h4>
            <input
              type="text"
              value={newPoll.question}
              onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })}
              placeholder="Enter question..."
              className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 outline-none focus:border-[#00e5a0]/50 mb-3"
            />
            {newPoll.options.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                value={opt}
                onChange={(e) => {
                  const opts = [...newPoll.options];
                  opts[idx] = e.target.value;
                  setNewPoll({ ...newPoll, options: opts });
                }}
                placeholder={`Option ${idx + 1}`}
                className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 outline-none focus:border-[#00e5a0]/50 mb-2"
              />
            ))}
            {newPoll.options.length < 6 && (
              <button
                onClick={() => setNewPoll({ ...newPoll, options: [...newPoll.options, ''] })}
                className="text-[#00e5a0] text-xs hover:underline mb-3"
              >
                + Add option
              </button>
            )}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="anonymous"
                checked={newPoll.isAnonymous}
                onChange={(e) => setNewPoll({ ...newPoll, isAnonymous: e.target.checked })}
                className="rounded bg-white/10 border-white/20"
              />
              <label htmlFor="anonymous" className="text-white/70 text-xs">
                Anonymous voting
              </label>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="allowMultiple"
                checked={newPoll.allowMultiple}
                onChange={(e) => setNewPoll({ ...newPoll, allowMultiple: e.target.checked })}
                className="rounded bg-white/10 border-white/20"
              />
              <label htmlFor="allowMultiple" className="text-white/70 text-xs">
                Allow multiple selections
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePoll}
                className="flex-1 py-2 bg-[#00e5a0] text-[#0a0e27] rounded-lg text-sm font-medium hover:bg-[#00e5a0]/90 transition-colors"
              >
                Start Poll
              </button>
            </div>
          </div>
        )}

        {activePolls.map((poll) => {
          const totalVotes = poll.totalVotes || poll.results.reduce((a, b) => a + b, 0);
          const maxVotes = Math.max(...poll.results, 1);
          const selected = selectedOptions.get(poll.id) || new Set();

          return (
            <div key={poll.id} className="mb-4 p-4 bg-[#00e5a0]/10 rounded-xl border border-[#00e5a0]/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#00e5a0] text-xs font-semibold uppercase tracking-wider">
                  Active Poll
                </span>
                <button
                  onClick={() => onEndPoll(poll.id)}
                  className="text-red-400 text-xs hover:text-red-300"
                >
                  End Poll
                </button>
              </div>
              <h4 className="text-white font-medium mb-3">{poll.question}</h4>
              <div className="space-y-2">
                {poll.options.map((option, idx) => {
                  const voteCount = poll.results[idx] || 0;
                  const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                  const isSelected = selected.has(idx);

                  return (
                    <button
                      key={idx}
                      onClick={() => handleVote(poll.id, idx, poll.allowMultiple)}
                      className={`w-full text-left p-3 rounded-lg transition-all relative overflow-hidden ${
                        isSelected
                          ? 'bg-[#00e5a0]/30 border border-[#00e5a0]/50'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div
                        className="absolute inset-0 bg-[#00e5a0]/20 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center ${
                              isSelected ? 'bg-[#00e5a0]' : 'bg-white/20'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-[#0a0e27]" />}
                          </div>
                          <span className="text-white text-sm">{option}</span>
                        </div>
                        <span className="text-white/50 text-xs">{voteCount} ({percentage.toFixed(0)}%)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-white/40 text-xs text-right">
                {totalVotes} votes
              </div>
            </div>
          );
        })}

        {closedPolls.length > 0 && (
          <div>
            <h4 className="text-white/50 text-xs uppercase tracking-wider mb-2">Closed Polls</h4>
            <div className="space-y-2">
              {closedPolls.map((poll) => {
                const totalVotes = poll.totalVotes || poll.results.reduce((a, b) => a + b, 0);

                return (
                  <div key={poll.id} className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <h5 className="text-white/70 text-sm mb-2">{poll.question}</h5>
                    <div className="space-y-1">
                      {poll.options.map((option, idx) => {
                        const voteCount = poll.results[idx] || 0;
                        const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

                        return (
                          <div key={idx} className="text-xs">
                            <div className="flex justify-between text-white/60 mb-0.5">
                              <span>{option}</span>
                              <span>{voteCount} ({percentage.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-white/40 transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-white/40 text-xs text-right">
                      {totalVotes} votes
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {polls.length === 0 && !isCreating && (
          <div className="text-center py-8">
            <Vote className="w-12 h-12 text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No polls yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
