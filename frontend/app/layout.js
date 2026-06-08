import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { CurrencyProvider } from '@/lib/currency-context';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'Binance — Crypto Exchange',
  description: 'Trade Bitcoin, Ethereum and 500+ cryptocurrencies with real-time price data.',
  keywords: 'crypto, bitcoin, ethereum, trading, exchange, binance',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <CurrencyProvider>
          <AuthProvider>
            {children}
            <BottomNav />
          </AuthProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}

