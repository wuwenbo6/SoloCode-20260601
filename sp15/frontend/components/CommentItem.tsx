'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { REACT_TO_COMMENT, CREATE_COMMENT } from '@/graphql/mutations';
import { POST } from '@/graphql/queries';
import { useAuth } from '@/context/AuthContext';

interface Comment {
  id: string;
  content: string;
  status: string;
  likesCount: number;
  dislikesCount: number;
  userReaction: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
  replies?: Comment[];
}

interface CommentItemProps {
  comment: Comment;
  postId: string;
  depth?: number;
}

export default function CommentItem({ comment, postId, depth = 0 }: CommentItemProps) {
  const { state } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const [reactToComment] = useMutation(REACT_TO_COMMENT, {
    refetchQueries: [{ query: POST, variables: { id: postId } }],
  });

  const [createReply] = useMutation(CREATE_COMMENT, {
    refetchQueries: [{ query: POST, variables: { id: postId } }],
    onCompleted: () => {
      setReplyContent('');
      setShowReply(false);
    },
  });

  const handleReaction = (type: 'LIKE' | 'DISLIKE') => {
    if (!state.user) return;
    reactToComment({ variables: { commentId: comment.id, type } });
  };

  const handleSubmitReply = () => {
    if (!replyContent.trim() || !state.user) return;
    createReply({ variables: { postId, content: replyContent, parentId: comment.id } });
  };

  return (
    <div style={{ marginLeft: depth > 0 ? '2rem' : 0, marginTop: '1rem' }}>
      <div className="comment" style={{ borderLeft: depth > 0 ? '3px solid #93c5fd' : '3px solid #2563eb' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <span className="comment-author">{comment.author?.name}</span>
          <span className="comment-date" style={{ marginLeft: '0.5rem' }}>
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>
        <p style={{ marginBottom: '0.5rem' }}>{comment.content}</p>
        
        {state.user && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '14px' }}>
            <button
              onClick={() => handleReaction('LIKE')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                color: comment.userReaction === 'LIKE' ? '#2563eb' : '#666',
                fontWeight: comment.userReaction === 'LIKE' ? 'bold' : 'normal',
              }}
            >
              👍 {comment.likesCount}
            </button>
            <button
              onClick={() => handleReaction('DISLIKE')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                color: comment.userReaction === 'DISLIKE' ? '#dc2626' : '#666',
                fontWeight: comment.userReaction === 'DISLIKE' ? 'bold' : 'normal',
              }}
            >
              👎 {comment.dislikesCount}
            </button>
            {depth < 3 && (
              <button
                onClick={() => setShowReply(!showReply)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2563eb',
                  padding: '4px 8px',
                }}
              >
                回复
              </button>
            )}
          </div>
        )}

        {showReply && state.user && (
          <div style={{ marginTop: '1rem' }}>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="写下你的回复..."
              style={{ width: '100%', minHeight: '60px', padding: '0.5rem', marginBottom: '0.5rem' }}
            />
            <div style={{ gap: '0.5rem', display: 'flex' }}>
              <button className="primary" onClick={handleSubmitReply} disabled={!replyContent.trim()}>
                发表回复
              </button>
              <button className="secondary" onClick={() => setShowReply(false)}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} postId={postId} depth={depth + 1} />
      ))}
    </div>
  );
}
