import './globals.css';
import { Inter } from 'next/font/google';
import AuthProvider from './providers/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Parking Response Generator',
  description: '駐車場の問い合わせに対する返信を生成するアプリケーション',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} dark-theme`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
