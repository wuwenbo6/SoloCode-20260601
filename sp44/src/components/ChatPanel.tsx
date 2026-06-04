import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useMeetingStore } from '@/store/meetingStore';

interface ChatPanelProps {
  onSendMessage: (text: string) => void;
}

export default function ChatPanel({ onSendMessage }: ChatPanelProps) {
  const { chatMessages, userName, setPanelOpen } = useMeetingStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="w-80 h-full bg-[#0d1230]/95 backdrop-blur-xl border-l border-white/10 flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <h3 className="text-white font-heading font-semibold text-lg">Chat</h3>
        <button
          onClick={() => setPanelOpen('none')}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center text-white/30 text-sm py-8">No messages yet</div>
        )}
        {chatMessages.map((msg) => {
          const isSelf = msg.senderId === 'local';
          return (
            <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  isSelf
                    ? 'bg-[#00e5a0]/20 text-white rounded-br-md'
                    : 'bg-white/10 text-white/90 rounded-bl-md'
                }`}
              >
                {!isSelf && (
                  <div className="text-[10px] text-[#00e5a0] font-medium mb-0.5">{msg.senderName}</div>
                )}
                <div>{msg.text}</div>
                <div className="text-[9px] text-white/30 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#00e5a0]/20 hover:bg-[#00e5a0]/30 disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4 text-[#00e5a0]" />
          </button>
        </div>
      </div>
    </div>
  );
}
