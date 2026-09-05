import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Gemini Reflection Journal | User-Isolated Cloud Firestore & AI',
  description: 'A private sanctuary for multi-turn journal reflections, strategic decision making, and automated synthesis with Gemini 3.6 Flash and Cloud Firestore.',
  openGraph: {
    title: 'Gemini Reflection Journal',
    description: 'A private sanctuary for multi-turn journal reflections, strategic decision making, and automated synthesis with Gemini 3.6 Flash and Cloud Firestore.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gemini Reflection Journal',
    description: 'A private sanctuary for multi-turn journal reflections, strategic decision making, and automated synthesis with Gemini 3.6 Flash and Cloud Firestore.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
