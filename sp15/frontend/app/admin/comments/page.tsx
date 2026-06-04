'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { PENDING_COMMENTS, NEW_COMMENT_SUBSCRIPTION } from '@/graphql/queries';
import { REVIEW_COMMENT } from '@/graphql/mutations';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useSingletonSubscription } from '@/hooks/useSingletonSubscription';

export default function CommentReview() {
  const { state } = useAuth();
  const router = useRouter();
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (!state.loading && (!state.user || state.user.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [state.user, state.loading, router]);

  const { data, loading, refetch } = useQuery(PENDING_COMMENTS, {
    skip: !state.user || state.user.role !== 'ADMIN',
  });

  useSingletonSubscription({
    document: NEW_COMMENT_SUBSCRIPTION,
    onData: (data: any) => {
      if (data?.data?.newComment) {
        setNotification(`新评论待审核: ${data.data.newComment.content.substring(0, 30)}...`);
        refetch();
        setTimeout(() => setNotification(null), 5000);
      }
    },
    skip: !state.user || state.user.role !== 'ADMIN',
    channelId: 'blog-comment-subscription',
  });

  const [reviewComment] = useMutation(REVIEW_COMMENT, {
    onCompleted: () => refetch(),
  });

  if (state.loading || loading) return <div>加载中...</div>;
  if (!state.user || state.user.role !== 'ADMIN') return null;

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>评论审核</h1>

      {notification && (
        <div style={{
          background: '#dbeafe',
          color: '#1e40af',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          position: 'sticky',
          top: '1rem',
          zIndex: 100,
        }}>
          🔔 {notification}
        </div>
      )}

      {data?.pendingComments?.length === 0 ? (
        <div className="card">暂无待审核的评论</div>
      ) : (
        data?.pendingComments?.map((comment: any) => (
          <div key={comment.id} className="card">
            <div style={{ marginBottom: '1rem' }}>
              <strong>{comment.author?.name}</strong> 在
              <a href={`/posts/${comment.post?.id}`} style={{ color: '#2563eb', margin: '0 0.25rem' }}>
                {comment.post?.title}
              </a>
              发表评论:
            </div>
            <p style={{ padding: '1rem', background: '#f9fafb', borderRadius: '4px', marginBottom: '1rem' }}>
              {comment.content}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="success"
                onClick={() => reviewComment({ variables: { id: comment.id, status: 'APPROVED' } })}
              >
                通过
              </button>
              <button
                className="danger"
                onClick={() => reviewComment({ variables: { id: comment.id, status: 'REJECTED' } })}
              >
                拒绝
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
