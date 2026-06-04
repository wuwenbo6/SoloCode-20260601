import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessagePayload } from './types';

interface ChatPanelProps {
  messages: ChatMessagePayload[];
  onSendMessage: (message: string) => void;
  clientId: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, clientId }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span className="text-xl">💬</span>
          聊天室
          <span className="text-xs text-gray-400 ml-auto">{messages.length} 条消息</span>
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">📭</div>
            <p>暂无聊天消息</p>
            <p className="text-sm mt-1">发送第一条消息开始聊天吧！</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.client_id === clientId;
            return (
              <div
                key={index}
                className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${isSelf ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`text-xs mb-1 ${isSelf ? 'text-right text-cyan-400' : 'text-left text-green-400'}`}
                  >
                    {msg.client_name} · {formatTime(msg.timestamp)}
                  </div>
                  <div
                    className={`px-4 py-2 rounded-2xl break-words ${
                      isSelf
                        ? 'bg-cyan-600 text-white rounded-br-md'
                        : 'bg-gray-700 text-white rounded-bl-md'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-full border border-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="px-5 py-2 bg-cyan-600 text-white rounded-full hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
};
