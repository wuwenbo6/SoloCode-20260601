import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSignaling } from '../hooks/useSignaling';
import { useEditorSync } from '../hooks/useEditorSync';
import { useAutoSave } from '../hooks/useAutoSave';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useMentions } from '../hooks/useMentions';
import { CodeEditor, CodeEditorHandle } from '../components/Editor/CodeEditor';
import { CursorLayer } from '../components/Editor/CursorLayer';
import { NotificationPanel } from '../components/Notifications/NotificationPanel';
import Header from '../components/Room/Header';
import MembersPanel from '../components/Sidebar/MembersPanel';
import VersionPanel from '../components/Sidebar/VersionPanel';
import { ChevronLeft, ChevronRight, Users, History, Loader2, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { CursorPosition, User } from '../types';

interface CursorLayerWithViewProps {
  remoteCursors: Map<string, CursorPosition>;
  editorContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  currentUserId: string;
  members: User[];
  editorRef: React.RefObject<CodeEditorHandle | null>;
}

const CursorLayerWithView = ({
  remoteCursors,
  editorContainerRef,
  currentUserId,
  members,
  editorRef,
}: CursorLayerWithViewProps) => {
  const [editorView, setEditorView] = useState(editorRef.current?.getView() || null);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 50;
    const interval = setInterval(() => {
      attempts++;
      const view = editorRef.current?.getView();
      if (view) {
        setEditorView(view);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [editorRef]);

  useEffect(() => {
    const view = editorRef.current?.getView();
    if (view) {
      setEditorView(view);
    }
  }, [remoteCursors, editorRef]);

  return (
    <CursorLayer
      remoteCursors={remoteCursors}
      editorContainerRef={editorContainerRef}
      currentUserId={currentUserId}
      members={members}
      editorView={editorView}
    />
  );
};

const EditorRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    currentUser,
    currentRoom,
    editorContent,
    remoteCursors,
    roomMembers,
    connectionStatus,
    isOnline,
    error,
    setError,
    setCurrentRoom,
    setEditorContent,
  } = useStore();

  const [sidebarTab, setSidebarTab] = useState<'members' | 'versions'>('members');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CodeEditorHandle>(null);

  const { connect, disconnect } = useSignaling();
  const { handleEditorUpdate: syncEditorUpdate, handleCursorChange } = useEditorSync();
  const { saveVersion, loadVersions, restoreVersion } = useAutoSave(roomId || '');
  const { recordOfflineEdit } = useOfflineSync();
  const { onContentChange: checkMentions } = useMentions();

  const handleEditorUpdate = (content: string) => {
    syncEditorUpdate(content);
    recordOfflineEdit(content);
    checkMentions(content);
  };

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    if (!currentUser) {
      navigate('/');
      return;
    }

    const initRoom = async () => {
      try {
        await connect(roomId);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        }
      }
    };

    initRoom();

    return () => {
      disconnect();
    };
  }, [roomId, currentUser, connect, disconnect, loadVersions, setError, navigate]);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-emerald-400';
      case 'connecting':
        return 'text-amber-400';
      case 'disconnected':
        return 'text-red-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'disconnected':
        return '已断开';
      case 'error':
        return '连接错误';
      default:
        return '未知';
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">正在加载...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      <Header
        roomId={roomId || ''}
        roomName={currentRoom?.name}
        connectionStatus={connectionStatus}
        connectionStatusText={getConnectionStatusText()}
        connectionStatusColor={getConnectionStatusColor()}
        isOnline={isOnline}
        onSaveNow={() => saveVersion(false, 'Manual save')}
        onLeaveRoom={() => {
          disconnect();
          navigate('/');
        }}
      />

      {error && (
        <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300 text-sm"
          >
            关闭
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div
          ref={editorContainerRef}
          className="flex-1 relative overflow-hidden"
        >
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700/50">
            <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()} animate-pulse`}></div>
            <span className="text-xs text-slate-300">{getConnectionStatusText()}</span>
          </div>

          <CodeEditor
            ref={editorRef}
            value={editorContent}
            onChange={handleEditorUpdate}
            onCursorChange={handleCursorChange}
            language="typescript"
          />

          <CursorLayerWithView
            remoteCursors={remoteCursors}
            editorContainerRef={editorContainerRef}
            currentUserId={currentUser.id}
            members={roomMembers}
            editorRef={editorRef}
          />
        </div>

        <div
          className={`relative flex flex-col bg-slate-800/50 border-l border-slate-700/50 transition-all duration-300 ${
            sidebarOpen ? 'w-80' : 'w-0'
          }`}
        >
          {sidebarOpen && (
            <>
              <div className="flex border-b border-slate-700/50">
                <button
                  onClick={() => setSidebarTab('members')}
                  className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                    sidebarTab === 'members'
                      ? 'text-violet-400 bg-violet-500/10 border-b-2 border-violet-500'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>成员</span>
                </button>
                <button
                  onClick={() => setSidebarTab('versions')}
                  className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                    sidebarTab === 'versions'
                      ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-500'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>版本</span>
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                {sidebarTab === 'members' ? (
                  <MembersPanel />
                ) : (
                  <VersionPanel />
                )}
              </div>
            </>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-1/2 -translate-y-1/2 -left-5 w-5 h-10 bg-slate-800 border border-slate-700 rounded-l-lg flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-slate-700 transition-all z-10"
          >
            {sidebarOpen ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorRoom;
