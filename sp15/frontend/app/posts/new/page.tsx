'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_POST } from '@/graphql/mutations';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

export default function NewPost() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!state.loading && !state.user) {
      router.push('/login');
    }
  }, [state.user, state.loading, router]);

  const [createPost, { loading, error }] = useMutation(CREATE_POST, {
    onCompleted: (data) => {
      router.push(`/posts/${data.createPost.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    createPost({
      variables: {
        title,
        content,
        tags,
        scheduledPublishAt: scheduledPublishAt || null,
      },
    });
  };

  if (state.loading) return <div>加载中...</div>;
  if (!state.user) return null;

  return (
    <div className="card">
      <h1 style={{ marginBottom: '1.5rem' }}>创建新文章</h1>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem' }}>
          {error.message}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>标签（用逗号分隔）</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="技术, 编程, GraphQL"
          />
        </div>
        <div className="form-group">
          <label>内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>定时发布（可选）</label>
          <input
            type="datetime-local"
            value={scheduledPublishAt}
            onChange={(e) => setScheduledPublishAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
            设置后，系统将在指定时间自动发布（需先提交审核并通过）
          </small>
        </div>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? '保存中...' : '保存草稿'}
        </button>
      </form>
    </div>
  );
}
