'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { POST, POST_VERSIONS, NEW_COMMENT_SUBSCRIPTION } from '@/graphql/queries';
import { CREATE_COMMENT, UPDATE_POST, SUBMIT_FOR_REVIEW, DELETE_POST, ROLLBACK_TO_VERSION, SCHEDULE_POST } from '@/graphql/mutations';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import VersionDiff from '@/components/VersionDiff';
import CommentItem from '@/components/CommentItem';

export default function PostDetail({ params }: { params: { id: string } }) {
  const { state } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedTags, setEditedTags] = useState('');
  const [comment, setComment] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [selectedOldVersion, setSelectedOldVersion] = useState<string | null>(null);
  const [selectedNewVersion, setSelectedNewVersion] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const { data: postData, loading: postLoading } = useQuery(POST, { variables: { id: params.id } });
  const { data: versionsData } = useQuery(POST_VERSIONS, { variables: { postId: params.id }, skip: !showVersions });

  useSubscription(NEW_COMMENT_SUBSCRIPTION, {
    onData: ({ data }) => {
      console.log('New comment:', data);
    },
  });

  const [createComment] = useMutation(CREATE_COMMENT, {
    refetchQueries: [{ query: POST, variables: { id: params.id } }],
    onCompleted: () => setComment(''),
  });

  const [updatePost] = useMutation(UPDATE_POST, {
    refetchQueries: [{ query: POST, variables: { id: params.id } }],
    onCompleted: () => {
      setIsEditing(false);
      setShowSchedule(false);
    },
  });

  const [submitForReview] = useMutation(SUBMIT_FOR_REVIEW, {
    refetchQueries: [{ query: POST, variables: { id: params.id } }],
  });

  const [schedulePost] = useMutation(SCHEDULE_POST, {
    refetchQueries: [{ query: POST, variables: { id: params.id } }],
    onCompleted: () => setShowSchedule(false),
  });

  const [deletePost] = useMutation(DELETE_POST, {
    onCompleted: () => router.push('/my-posts'),
  });

  const [rollbackToVersion] = useMutation(ROLLBACK_TO_VERSION, {
    refetchQueries: [{ query: POST, variables: { id: params.id } }],
    onCompleted: () => setShowVersions(false),
  });

  useEffect(() => {
    if (postData?.post) {
      setEditedTitle(postData.post.title);
      setEditedContent(postData.post.content);
      setEditedTags(postData.post.tags?.join(', ') || '');
    }
  }, [postData]);

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

  const canEdit = state.user && (state.user.id === postData?.post?.author?.id || state.user.role === 'ADMIN');
  const isOwner = state.user && state.user.id === postData?.post?.author?.id;

  if (postLoading) return <div>加载中...</div>;
  if (!postData?.post) return <div>文章不存在</div>;

  const post = postData.post;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
          <div>
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                style={{ fontSize: '1.5rem', fontWeight: 'bold', border: 'none', borderBottom: '1px solid #ddd', width: '100%' }}
              />
            ) : (
              <h1>{post.title}</h1>
            )}
            <span className={`status-badge ${getStatusClass(post.status)}`} style={{ marginTop: '0.5rem', display: 'inline-block' }}>
              {post.status === 'DRAFT' && '草稿'}
              {post.status === 'PENDING_REVIEW' && '审核中'}
              {post.status === 'PUBLISHED' && '已发布'}
            </span>
            {post.scheduledPublishAt && (
              <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: '#666' }}>
                📅 定时发布: {new Date(post.scheduledPublishAt).toLocaleString()}
              </span>
            )}
          </div>
          {canEdit && (
            <div style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
              {isEditing ? (
                <>
                  <button className="primary" onClick={() => {
                    const tags = editedTags.split(',').map((t) => t.trim()).filter(Boolean);
                    updatePost({ variables: { id: params.id, title: editedTitle, content: editedContent, tags } });
                  }}>
                    保存
                  </button>
                  <button className="secondary" onClick={() => setIsEditing(false)}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button className="secondary" onClick={() => setIsEditing(true)}>
                    编辑
                  </button>
                  <button className="secondary" onClick={() => setShowVersions(!showVersions)}>
                    版本历史
                  </button>
                  {post.status !== 'PUBLISHED' && (
                    <button className="secondary" onClick={() => setShowSchedule(!showSchedule)}>
                      ⏰ 定时发布
                    </button>
                  )}
                  {isOwner && post.status === 'DRAFT' && (
                    <button className="primary" onClick={() => submitForReview({ variables: { id: params.id } })}>
                      提交审核
                    </button>
                  )}
                  <button className="danger" onClick={() => {
                    if (confirm('确定删除这篇文章吗？')) {
                      deletePost({ variables: { id: params.id } });
                    }
                  }}>
                    删除
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {showSchedule && canEdit && (
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '4px', marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>设置定时发布时间</h4>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              style={{ padding: '0.5rem', marginRight: '0.5rem' }}
              min={new Date().toISOString().slice(0, 16)}
            />
            <div style={{ gap: '0.5rem', display: 'flex', marginTop: '0.5rem' }}>
              <button
                className="primary"
                onClick={() => {
                  if (scheduleDate) {
                    schedulePost({ variables: { id: params.id, scheduledPublishAt: scheduleDate } });
                  }
                }}
                disabled={!scheduleDate}
              >
                确认定时
              </button>
              <button className="secondary" onClick={() => setShowSchedule(false)}>
                取消
              </button>
            </div>
          </div>
        )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          {isEditing ? (
            <input
              type="text"
              value={editedTags}
              onChange={(e) => setEditedTags(e.target.value)}
              style={{ border: 'none', borderBottom: '1px solid #ddd', width: '100%' }}
            />
          ) : (
            post.tags?.map((tag: string) => (
              <span key={tag} className="tag">{tag}</span>
            ))
          )}
        </div>

        <p style={{ color: '#666', fontSize: '14px', marginBottom: '1rem' }}>
          作者: {post.author?.name} | {new Date(post.createdAt).toLocaleDateString()}
        </p>

        {isEditing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            style={{ width: '100%', minHeight: '300px', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        ) : (
          <div style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{post.content}</div>
        )}
      </div>

      {showVersions && versionsData?.postVersions && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>版本历史</h3>
            {selectedOldVersion && selectedNewVersion && (
              <button
                className="secondary"
                onClick={() => {
                  setSelectedOldVersion(null);
                  setSelectedNewVersion(null);
                }}
              >
                取消对比
              </button>
            )}
          </div>

          {selectedOldVersion && selectedNewVersion ? (
            <VersionDiff
              oldVersion={versionsData.postVersions.find((v: any) => v.id === selectedOldVersion)}
              newVersion={versionsData.postVersions.find((v: any) => v.id === selectedNewVersion)}
            />
          ) : versionsData.postVersions.length === 0 ? (
            <p>暂无历史版本</p>
          ) : (
            <>
              <p style={{ color: '#666', marginBottom: '1rem', fontSize: '14px' }}>
                选择两个版本进行对比（先选旧版本，再选新版本）:
              </p>
              {versionsData.postVersions.map((v: any) => {
                const isOldSelected = selectedOldVersion === v.id;
                const isNewSelected = selectedNewVersion === v.id;
                const canSelect = !selectedOldVersion || !selectedNewVersion;

                return (
                  <div
                    key={v.id}
                    style={{
                      borderBottom: '1px solid #eee',
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      borderRadius: '4px',
                      background: isOldSelected
                        ? '#fef2f2'
                        : isNewSelected
                        ? '#f0fdf4'
                        : canSelect
                        ? 'transparent'
                        : '#f5f5f5',
                      cursor: canSelect ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (!canSelect) return;
                      if (!selectedOldVersion) {
                        setSelectedOldVersion(v.id);
                      } else if (!selectedNewVersion && v.id !== selectedOldVersion) {
                        const oldVer = versionsData.postVersions.find((x: any) => x.id === selectedOldVersion);
                        if (oldVer.version > v.version) {
                          setSelectedNewVersion(selectedOldVersion);
                          setSelectedOldVersion(v.id);
                        } else {
                          setSelectedNewVersion(v.id);
                        }
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {isOldSelected && (
                          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', marginRight: '0.5rem', fontSize: '12px' }}>
                            旧版本
                          </span>
                        )}
                        {isNewSelected && (
                          <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', marginRight: '0.5rem', fontSize: '12px' }}>
                            新版本
                          </span>
                        )}
                        <strong>版本 {v.version}</strong> - {v.title}
                        <br />
                        <small style={{ color: '#666' }}>{new Date(v.createdAt).toLocaleString()}</small>
                      </div>
                      {canEdit && (
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('确定回滚到此版本吗？')) {
                              rollbackToVersion({ variables: { postId: params.id, versionId: v.id } });
                            }
                          }}
                        >
                          回滚
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {post.status === 'PUBLISHED' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>评论 ({post.comments?.length || 0})</h3>

          {state.user ? (
            <div style={{ marginBottom: '2rem' }}>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="写下你的评论..."
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', marginBottom: '0.5rem' }}
              />
              <button
                className="primary"
                onClick={() => {
                  if (comment.trim()) {
                    createComment({ variables: { postId: params.id, content: comment } });
                  }
                }}
              >
                发表评论
              </button>
            </div>
          ) : (
            <p style={{ marginBottom: '1rem', color: '#666' }}>请先登录后发表评论</p>
          )}

          {post.comments?.map((c: any) => (
            <CommentItem key={c.id} comment={c} postId={params.id} />
          ))}
        </div>
      )}
    </div>
  );
}
