'use client';

import { useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { SEARCH_POSTS } from '@/graphql/queries';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [search, { data, loading, error }] = useLazyQuery(SEARCH_POSTS);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      search({ variables: { query: query.trim() } });
    }
  };

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
      <h1 style={{ marginBottom: '2rem' }}>全文搜索</h1>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入关键词搜索文章标题、内容或标签..."
            style={{ flex: 1, padding: '0.75rem', fontSize: '16px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <button type="submit" className="primary" disabled={loading || !query.trim()}>
            {loading ? '搜索中...' : '搜索'}
          </button>
        </form>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem' }}>
          搜索错误: {error.message}
        </div>
      )}

      {data?.searchPosts && (
        <>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            找到 {data.searchPosts.total} 篇相关文章
          </p>
          
          {data.searchPosts.posts.length === 0 ? (
            <div className="card">
              <p>未找到相关文章，请尝试其他关键词</p>
            </div>
          ) : (
            data.searchPosts.posts.map((post: any) => (
              <div key={post.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ marginBottom: '0.5rem' }}>{post.title}</h3>
                  <span className={`status-badge ${getStatusClass(post.status)}`}>
                    {post.status === 'DRAFT' && '草稿'}
                    {post.status === 'PENDING_REVIEW' && '审核中'}
                    {post.status === 'PUBLISHED' && '已发布'}
                  </span>
                </div>
                <div style={{ margin: '0.5rem 0' }}>
                  {post.tags?.map((tag: string) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  {post.content.substring(0, 200)}...
                </p>
                <p style={{ color: '#999', fontSize: '14px', marginBottom: '0.5rem' }}>
                  作者: {post.author?.name} | {new Date(post.createdAt).toLocaleDateString()}
                </p>
                <Link href={`/posts/${post.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                  阅读全文 →
                </Link>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
