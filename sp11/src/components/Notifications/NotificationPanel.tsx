import { useState, useEffect, useRef } from 'react';
import { Bell, AtSign, AlertTriangle, CheckCircle, Info, X, CheckSquare, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Notification } from '../../types';

interface NotificationPanelProps {
  position?: 'top-right' | 'bottom-right';
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'mention':
      return <AtSign className="w-4 h-4" />;
    case 'conflict':
      return <AlertTriangle className="w-4 h-4" />;
    case 'success':
      return <CheckCircle className="w-4 h-4" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'mention':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'conflict':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'success':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'warning':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default:
      return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
  }
};

const getNotificationBgColor = (type: Notification['type']) => {
  switch (type) {
    case 'mention':
      return 'bg-gradient-to-r from-cyan-500/10 to-transparent border-l-2 border-cyan-500';
    case 'conflict':
      return 'bg-gradient-to-r from-amber-500/10 to-transparent border-l-2 border-amber-500';
    case 'success':
      return 'bg-gradient-to-r from-emerald-500/10 to-transparent border-l-2 border-emerald-500';
    case 'warning':
      return 'bg-gradient-to-r from-orange-500/10 to-transparent border-l-2 border-orange-500';
    default:
      return 'bg-gradient-to-r from-violet-500/10 to-transparent border-l-2 border-violet-500';
  }
};

export const NotificationPanel = ({ position = 'top-right' }: NotificationPanelProps) => {
  const {
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unread = notifications.filter((n) => !n.read && n.timestamp > Date.now() - 5000);
    const newToasts = unread.slice(0, 3);

    newToasts.forEach((notification) => {
      if (!toastNotifications.find((t) => t.id === notification.id)) {
        setToastNotifications((prev) => [...prev, notification].slice(-3));

        setTimeout(() => {
          setToastNotifications((prev) => prev.filter((t) => t.id !== notification.id));
          markNotificationRead(notification.id);
        }, 5000);
      }
    });
  }, [notifications, toastNotifications, markNotificationRead]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toastNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`pointer-events-auto animate-fade-in rounded-lg border ${getNotificationColor(notification.type)} p-4 shadow-lg max-w-sm backdrop-blur-sm`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{notification.title}</h4>
                <p className="text-xs opacity-80 mt-0.5">{notification.message}</p>
                <p className="text-xs opacity-50 mt-1">{formatTime(notification.timestamp)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div ref={panelRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          title="通知"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 top-12 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">通知</h3>
              <div className="flex items-center gap-2">
                {unreadNotifications > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    title="全部已读"
                  >
                    <CheckSquare className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearNotifications}
                    className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    title="清空通知"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无通知</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-700/50 cursor-pointer transition-colors ${getNotificationBgColor(notification.type)} ${notification.read ? 'opacity-60' : ''}`}
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-white truncate">
                          {notification.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        {notification.fromUser && (
                          <div className="flex items-center gap-2 mt-2">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                              style={{ backgroundColor: notification.fromUser.color }}
                            >
                              {notification.fromUser.nickname.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-500">
                              {notification.fromUser.nickname}
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
