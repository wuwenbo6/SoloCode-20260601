'use client';

import { useQuery, useMutation } from '@apollo/client';
import { MY_POSTS } from '@/graphql/queries';
import { DELETE_POST } from '@/graphql/mutations';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function MyPosts() {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!state.loading && !state.user) {
      router.push('/login');
    }
  }, [state.user, state.loading, router]);

  const { data, loading, refetch } = useQuery(MY_POSTS, { skip: !state.user });

  const [deletePost] = useMutation(DELETE_POST, {
    onCompleted: () => refetch(),
  });

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'status-draft';
      case 'PENDING_REVIEW':
        return 'status-pending';
      case 'PUBLISHED':
        return 'status-published';
      default:
        return '';
    }
  };

  if (state.loading || loading) return <div>加载中...</div>;
  if (!state.user) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>我的文章</h1>
        <Link href="/posts/new">
          <button className="primary">写新文章</button>
        </Link>
      </div>

      {data?.myPosts?.length === 0 ? (
        <div className="card">暂无文章，点击上方按钮创建第一篇</div>
      ) : (
        data?.myPosts?.map((post: any) => (
          <div key={post.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ marginBottom: '0.5rem' }}>{post.title}</h3>
                <span className={`status-badge ${getStatusClass(post.status)}`}>
                  {post.status === 'DRAFT' && '草稿'}
                  {post.status === 'PENDING_REVIEW' && '审核中'}
                  {post.status === 'PUBLISHED' && '已发布'}
                </span>
                <span style={{ color: '#666', fontSize: '14px', marginLeft: '1rem' }}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ gap: '0.5rem', display: 'flex' }}>
                <Link href={`/posts/${post.id}`}>
                  <button className="secondary">查看/编辑</button>
                </Link>
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm('确定删除这篇文章吗？')) {
                      deletePost({ variables: { id: post.id } });
                    }
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
