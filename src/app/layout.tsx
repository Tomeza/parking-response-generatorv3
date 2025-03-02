import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "駐車場問い合わせ返信メール作成",
  description: "駐車場の問い合わせに対して、構造化されたナレッジベースから最適な返信文を生成するWebアプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <header className="bg-gray-900 border-b border-gray-800 py-4">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 17V7h6" />
              </svg>
              <h1 className="text-xl font-bold">駐車場問い合わせ返信メール作成</h1>
            </div>
            <nav>
              <ul className="flex space-x-4">
                <li>
                  <a href="/" className="text-gray-300 hover:text-white">ホーム</a>
                </li>
                <li>
                  <a href="/admin" className="text-gray-300 hover:text-white">管理画面</a>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        
        <main className="flex-grow">
          {children}
        </main>
        
        <footer className="bg-gray-900 border-t border-gray-800 py-4 mt-8">
          <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
            <p>© 2024 駐車場問い合わせ返信メール作成システム</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
