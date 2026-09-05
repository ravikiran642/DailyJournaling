'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Sparkles,
  Lock,
  Brain,
  History,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  BookOpen,
  Feather,
  Heart,
  Compass,
} from 'lucide-react';

export function LandingView() {
  const { signInWithGoogle, error, clearError } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div id="landing-view-container" className="min-h-screen bg-[#FAFAF7] text-[#252723] flex flex-col justify-between selection:bg-[#DCE8DE] selection:text-[#252723]">
      {/* Top Header */}
      <header id="landing-header" className="border-b border-[#E5E7E2] bg-[#FAFAF7]/90 backdrop-blur-md px-6 sm:px-12 py-4 flex items-center justify-between">
        <div id="brand-logo-section" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center font-serif text-sm italic shadow-xs">
            <Feather className="w-4 h-4" />
          </div>
          <div>
            <span className="font-serif italic text-xl tracking-tight text-[#252723] block leading-none">The Open Page</span>
            <span className="text-[10px] text-[#737872] tracking-wide">
              Personal sanctuary for reflection &bull; Encrypted &amp; private
            </span>
          </div>
        </div>
        <button
          id="header-sign-in-btn"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E5E7E2] bg-white hover:bg-[#E8EFE9] text-[#252723] text-xs font-medium transition-all shadow-xs disabled:opacity-60 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isSigningIn ? 'Connecting...' : 'Sign In'}</span>
        </button>
      </header>

      {/* Main Hero Container */}
      <main id="landing-hero" className="max-w-4xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center">
        {error && (
          <div id="landing-error-banner" className="mb-8 w-full max-w-lg p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between font-serif italic">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-800 hover:underline font-sans uppercase text-[10px] tracking-widest font-bold ml-2">
              Dismiss
            </button>
          </div>
        )}

        <div id="landing-badge" className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8EFE9] text-[#6F8273] text-xs font-medium mb-8">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>User-Isolated Firestore Security &bull; Gemini 3.6 Flash</span>
        </div>

        <h1 id="landing-title" className="text-4xl sm:text-5xl lg:text-6xl font-serif font-normal tracking-tight text-[#252723] max-w-3xl leading-[1.18]">
          A quiet space to think, write, and <span className="italic font-normal text-[#6F8273]">find clarity</span>
        </h1>

        <p id="landing-subtitle" className="mt-6 text-lg sm:text-xl text-[#737872] max-w-2xl font-serif italic leading-relaxed">
          Untangle complex thoughts, evaluate choices, and reflect on life with an empathetic, thoughtful companion.
        </p>

        {/* Primary CTA button */}
        <div id="landing-cta-section" className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="main-sign-in-btn"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7] font-medium text-sm tracking-wide shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isSigningIn ? 'Opening sanctuary...' : 'Sign In with Google to Enter'}</span>
            <ArrowRight className="w-4 h-4 text-[#FAFAF7] group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Feature Grid */}
        <div id="landing-features-grid" className="mt-16 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div id="feature-card-1" className="p-6 bg-white border border-[#E5E7E2] rounded-2xl transition-all shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center mb-4">
              <Lock className="w-4 h-4" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-[#737872] font-semibold mb-1">Privacy First</p>
            <h3 className="text-base font-serif font-medium text-[#252723] mb-2">Isolated Firestore Vault</h3>
            <p className="text-xs sm:text-sm font-serif italic text-[#737872] leading-relaxed">
              Every journal entry, multi-turn dialogue, and AI takeaway is bound exclusively to your user UID via strict security rules.
            </p>
          </div>

          <div id="feature-card-2" className="p-6 bg-white border border-[#E5E7E2] rounded-2xl transition-all shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center mb-4">
              <Compass className="w-4 h-4" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-[#737872] font-semibold mb-1">Companion Dialogue</p>
            <h3 className="text-base font-serif font-medium text-[#252723] mb-2">Multi-Turn Reflections</h3>
            <p className="text-xs sm:text-sm font-serif italic text-[#737872] leading-relaxed">
              Converse with Gemini across multiple turns to untangle complex thoughts, evaluate trade-offs, and challenge assumptions.
            </p>
          </div>

          <div id="feature-card-3" className="p-6 bg-white border border-[#E5E7E2] rounded-2xl transition-all shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center mb-4">
              <Brain className="w-4 h-4" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-[#737872] font-semibold mb-1">Synthesized Wisdom</p>
            <h3 className="text-base font-serif font-medium text-[#252723] mb-2">Synthesis &amp; History</h3>
            <p className="text-xs sm:text-sm font-serif italic text-[#737872] leading-relaxed">
              Extract structured digests, actionable breakthroughs, and thematic tags. Revisit past insights whenever you need clarity.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer id="landing-footer" className="border-t border-[#E5E7E2] bg-[#FAFAF7] py-6 text-center text-xs text-[#737872]">
        <p>The Open Page &bull; Google Cloud Firestore &bull; Firebase Auth &bull; Gemini 3.6 Flash</p>
      </footer>
    </div>
  );
}
