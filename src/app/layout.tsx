import './globals.css';
import { Inter } from 'next/font/google';
import AuthProvider from './providers/AuthProvider';
import { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Parking Response Generator',
  description: '駐車場の問い合わせに対する返信を生成するアプリケーション',
  metadataBase: new URL('http://localhost:3000'),
  openGraph: {
    title: 'Parking Response Generator',
    description: '駐車場の問い合わせに対する返信を生成するアプリケーション',
    locale: 'ja_JP',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.className} dark-theme`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
