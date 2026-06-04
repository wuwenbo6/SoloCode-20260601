import './globals.css';
import type { Metadata } from 'next';
import { ApolloWrapper } from '@/lib/apollo';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Blog System',
  description: 'A full-stack blog with GraphQL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ApolloWrapper>
          <AuthProvider>
            <Navbar />
            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
              {children}
            </main>
          </AuthProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
