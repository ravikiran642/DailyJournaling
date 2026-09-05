'use client';

import React from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LandingView } from '@/components/LandingView';
import { JournalDashboard } from '@/components/JournalDashboard';
import { Sparkles } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        id="app-loading-screen"
        className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-100 space-y-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-pulse shadow-lg shadow-amber-950/40">
          <Sparkles className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-neutral-200">Connecting to Firestore & Auth...</p>
          <p className="text-xs text-neutral-500 font-mono">Initializing user vault</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingView />;
  }

  return <JournalDashboard />;
}

export default function HomePage() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
