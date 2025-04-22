'use client';

import { useAuth } from './hooks/useAuth';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  
  // ログインページの場合は認証チェックをスキップ
  if (pathname === '/admin/login') {
    return children;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
          <div className="flex items-center justify-center">
            <div className="text-lg font-semibold text-gray-700">読み込み中...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
          <div className="flex items-center justify-center">
            <div className="text-lg font-semibold text-gray-700">認証が必要です...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-theme min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}
