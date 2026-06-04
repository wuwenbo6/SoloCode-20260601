'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { state, logout } = useAuth();

  return (
    <nav>
      <div>
        <Link href="/">首页</Link>
        <Link href="/search">搜索</Link>
        {state.user && (
          <>
            <Link href="/posts/new">写文章</Link>
            <Link href="/my-posts">我的文章</Link>
            {state.user.role === 'ADMIN' && (
              <Link href="/admin/comments">审核评论</Link>
            )}
          </>
        )}
      </div>
      <div>
        {state.user ? (
          <>
            <span style={{ marginRight: '1rem' }}>
              {state.user.name} ({state.user.role === 'ADMIN' ? '管理员' : '作者'})
            </span>
            <button className="secondary" onClick={logout}>
              退出
            </button>
          </>
        ) : (
          <>
            <Link href="/login">登录</Link>
            <Link href="/register">注册</Link>
          </>
        )}
      </div>
    </nav>
  );
}
