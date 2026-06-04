'use client';

import { useQuery } from '@apollo/client';
import { POSTS } from '@/graphql/queries';
import Link from 'next/link';

export default function Home() {
  const { data, loading, error } = useQuery(POSTS);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

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

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>文章列表</h1>
      {data?.posts?.length === 0 ? (
        <div className="card">暂无文章</div>
      ) : (
        data?.posts?.map((post: any) => (
          <div key={post.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{post.title}</h2>
              <span className={`status-badge ${getStatusClass(post.status)}`}>
                {post.status === 'DRAFT' && '草稿'}
                {post.status === 'PENDING_REVIEW' && '审核中'}
                {post.status === 'PUBLISHED' && '已发布'}
              </span>
            </div>
            <div style={{ margin: '0.5rem 0' }}>
              {post.tags?.map((tag: string) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            <p style={{ color: '#666', fontSize: '14px' }}>
              作者: {post.author?.name} | {new Date(post.createdAt).toLocaleDateString()}
            </p>
            <Link href={`/posts/${post.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
              阅读全文 →
            </Link>
          </div>
        ))
      )}
    </div>
  );
}
