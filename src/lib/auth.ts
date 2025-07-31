import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { cache } from 'react';

export type UserRole = 'user' | 'editor' | 'approver' | 'admin';

interface UserMetadata {
  role?: UserRole;
}

const roleHierarchy: Record<UserRole, number> = {
  user: 1,
  editor: 2,
  approver: 3,
  admin: 4,
};

// キャッシュされたセッション取得
export const getSession = cache(async () => {
  const supabase = createServerComponentClient({ cookies });
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
});

// ユーザーのロールを取得
export const getUserRole = async (): Promise<UserRole> => {
  const session = await getSession();
  if (!session?.user) return 'user';

  const metadata = session.user.user_metadata as UserMetadata;
  return metadata.role || 'user';
};

// 必要なロールレベル以上を持っているか確認
export const hasRequiredRole = async (requiredRole: UserRole): Promise<boolean> => {
  const userRole = await getUserRole();
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// テンプレートの操作権限を確認
export const canManageTemplate = async (status: string): Promise<boolean> => {
  const userRole = await getUserRole();

  switch (status) {
    case 'draft':
      return roleHierarchy[userRole] >= roleHierarchy.editor;
    case 'pending':
      return roleHierarchy[userRole] >= roleHierarchy.approver;
    case 'approved':
    case 'archived':
      return roleHierarchy[userRole] >= roleHierarchy.admin;
    default:
      return false;
  }
};

// 承認フローの権限を確認
export const canApprove = async (): Promise<boolean> => {
  return hasRequiredRole('approver');
};

// 管理者権限を確認
export const isAdmin = async (): Promise<boolean> => {
  return hasRequiredRole('admin');
}; 