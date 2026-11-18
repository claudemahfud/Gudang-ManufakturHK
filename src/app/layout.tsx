import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Gudang Manufaktur',
  description: 'Sistem Inventory & Manajemen Gudang Manufaktur',
};

export const viewport: Viewport = {
  themeColor: '#00C853',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={poppins.variable}>
      <body className="bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
