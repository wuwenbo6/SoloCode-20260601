'use client';

import { useDiffWorker } from '@/hooks/useDiffWorker';
import { useMemo } from 'react';

interface Version {
  id: string;
  title: string;
  content: string;
  tags: string[];
  version: number;
  createdAt: string;
}

interface VersionDiffProps {
  oldVersion: Version;
  newVersion: Version;
}

export default function VersionDiff({ oldVersion, newVersion }: VersionDiffProps) {
  const { isLoading, diffResult, error, computeDiff, clearDiff } = useDiffWorker();

  useMemo(() => {
    computeDiff(
      oldVersion.content,
      newVersion.content,
      oldVersion.title,
      newVersion.title,
      oldVersion.tags,
      newVersion.tags
    );
  }, [oldVersion, newVersion, computeDiff]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</div>
        <p style={{ marginTop: '1rem' }}>正在计算差异...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px' }}>
        错误: {error}
      </div>
    );
  }

  if (!diffResult) return null;

  const renderTitleDiff = () => {
    return diffResult.titleDiff.map((part: any, index: number) => {
      let bgColor = 'transparent';
      if (part.added) bgColor = '#dcfce7';
      if (part.removed) bgColor = '#fee2e2';
      return (
        <span key={index} style={{ backgroundColor: bgColor }}>
          {part.value}
        </span>
      );
    });
  };

  const renderTagsDiff = () => {
    const { added, removed, unchanged } = diffResult.tagsDiff;
    return (
      <div>
        {unchanged.map((tag: string) => (
          <span key={tag} className="tag">{tag}</span>
        ))}
        {added.map((tag: string) => (
          <span key={`+${tag}`} className="tag" style={{ background: '#dcfce7', color: '#166534' }}>+{tag}</span>
        ))}
        {removed.map((tag: string) => (
          <span key={`-${tag}`} className="tag" style={{ background: '#fee2e2', color: '#991b1b', textDecoration: 'line-through' }}>-{tag}</span>
        ))}
      </div>
    );
  };

  const renderLineDiff = () => {
    return diffResult.lineByLineDiff.map((line: any, index: number) => {
      const bgColor = line.type === 'added' ? '#f0fdf4' : line.type === 'removed' ? '#fef2f2' : 'transparent';
      const borderLeft = line.type === 'added' ? '4px solid #22c55e' : line.type === 'removed' ? '4px solid #ef4444' : '4px solid transparent';
      const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      const textColor = line.type === 'unchanged' ? '#666' : 'inherit';

      return (
        <div
          key={index}
          style={{
            display: 'flex',
            background: bgColor,
            borderLeft,
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
        >
          <span
            style={{
              width: '50px',
              padding: '0 8px',
              textAlign: 'right',
              color: '#999',
              borderRight: '1px solid #e5e7eb',
              userSelect: 'none',
            }}
          >
            {line.oldLineNum || ''}
          </span>
          <span
            style={{
              width: '50px',
              padding: '0 8px',
              textAlign: 'right',
              color: '#999',
              borderRight: '1px solid #e5e7eb',
              userSelect: 'none',
            }}
          >
            {line.newLineNum || ''}
          </span>
          <span style={{ padding: '0 8px', color: textColor, flex: 1 }}>
            <span style={{ userSelect: 'none', opacity: 0.5 }}>{prefix}</span>
            {line.content || ' '}
          </span>
        </div>
      );
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div>
            <strong style={{ color: '#991b1b' }}>版本 {oldVersion.version}</strong>
            <span style={{ margin: '0 0.5rem', color: '#999' }}>→</span>
            <strong style={{ color: '#166534' }}>版本 {newVersion.version}</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>
              +{diffResult.stats.addedLines}
            </span>
            <span style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>
              -{diffResult.stats.removedLines}
            </span>
            <span style={{ color: '#999' }}>
              耗时: {diffResult.stats.timeMs.toFixed(2)}ms
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.25rem' }}>标题变更:</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px' }}>
          {renderTitleDiff()}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>标签变更:</div>
        {renderTagsDiff()}
      </div>

      <div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>内容变更:</div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'auto', maxHeight: '500px' }}>
          {renderLineDiff()}
        </div>
      </div>

      <button
        className="secondary"
        onClick={clearDiff}
        style={{ marginTop: '1rem' }}
      >
        关闭对比
      </button>
    </div>
  );
}
