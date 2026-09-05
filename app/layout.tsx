import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Gemini Reflection Journal',
  description: 'A user-authenticated reflection journal powered by Gemini and Cloud Firestore with secure, isolated entries and AI reflections.',
  openGraph: {
    title: 'Gemini Reflection Journal',
    description: 'A user-authenticated reflection journal powered by Gemini and Cloud Firestore with secure, isolated entries and AI reflections.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gemini Reflection Journal',
    description: 'A user-authenticated reflection journal powered by Gemini and Cloud Firestore with secure, isolated entries and AI reflections.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
