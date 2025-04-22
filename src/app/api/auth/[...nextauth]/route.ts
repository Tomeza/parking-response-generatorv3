import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          // 環境変数から管理者アカウント情報を取得
          const adminUsername = process.env.ADMIN_USERNAME || 'admin';
          const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

          // ユーザー名が一致するか確認
          if (credentials.username !== adminUsername) {
            return null;
          }

          // パスワードが一致するか確認
          if (credentials.password !== adminPassword) {
            return null;
          }

          // 認証成功
          return {
            id: '1',
            name: adminUsername,
            email: 'admin@example.com',
            role: 'admin'
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role as string;
      }
      return session;
    }
  }
});

export { handler as GET, handler as POST }; 