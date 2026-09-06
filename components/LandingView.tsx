'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

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
    <div
      id="landing-view-container"
      className="min-h-screen bg-[#FBF9F5] text-[#252723] flex flex-col justify-between selection:bg-[#DCE8DE] selection:text-[#252723]"
    >
      {/* Top Header: Two-point minimalist navigation bar */}
      <header
        id="landing-header"
        className="w-full px-8 sm:px-16 py-8 flex items-center justify-between"
      >
        <span
          id="brand-title"
          className="font-serif text-xl sm:text-2xl tracking-tight text-[#252723] font-normal"
        >
          The Open Page
        </span>

        <button
          id="header-sign-in-btn"
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          style={{
            border: '1px solid rgba(0, 0, 0, 0.15)',
            padding: '6px 16px',
            borderRadius: '9999px',
            background: 'transparent',
            fontSize: '14px',
            letterSpacing: '0.02em',
            transition: 'all 0.2s ease-in-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
            e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
          }}
          className="font-sans font-medium text-[#252723] cursor-pointer disabled:opacity-50"
        >
          {isSigningIn ? 'Connecting...' : 'Sign In'}
        </button>
      </header>

      {/* Main Hero Container */}
      <main
        id="landing-hero"
        className="max-w-4xl mx-auto px-6 py-12 sm:py-20 flex flex-col items-center text-center my-auto"
      >
        {error && (
          <div
            id="landing-error-banner"
            className="mb-8 w-full max-w-lg p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between font-serif italic"
          >
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-red-800 hover:underline font-sans uppercase text-[10px] tracking-widest font-bold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <h1
          id="landing-title"
          className="text-5xl sm:text-6xl md:text-7xl font-serif font-normal tracking-tight text-[#252723] max-w-3xl leading-[1.12]"
        >
          A quiet space to think,<br />write, and find clarity.
        </h1>

        <p
          id="landing-subtitle"
          className="mt-6 text-base sm:text-lg text-[#555953] max-w-xl font-serif leading-relaxed"
        >
          Untangle complex thoughts, evaluate choices, and reflect on life with an ambient, thoughtful echo companion.
        </p>

        {/* Primary CTA button */}
        <div id="landing-cta-section" className="mt-8">
          <button
            id="main-sign-in-btn"
            type="button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-white hover:bg-[#F6F4EE] text-[#252723] font-sans font-medium text-sm tracking-normal border border-[#E5E7E2]/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-sm transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span className="text-[#252723] font-sans font-normal ml-0.5">→</span>
          </button>
        </div>
      </main>

      {/* Feature Pillars: Boundaryless 3-column text row floating directly on canvas background */}
      <div
        id="landing-features-grid"
        className="w-full max-w-5xl mx-auto px-6 pt-8 pb-16 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 text-center"
      >
        <div id="feature-pillar-1" className="flex flex-col items-center">
          <h2 className="text-xs font-sans font-semibold tracking-widest text-[#252723] uppercase mb-2">
            Privacy First
          </h2>
          <p className="text-xs sm:text-sm font-serif text-[#555953] leading-relaxed max-w-[280px]">
            Your words belong strictly to you. Every raw entry, realization, and AI dialogue is sandboxed securely to your unique UID—ensuring your digital mind remains completely private.
          </p>
        </div>

        <div id="feature-pillar-2" className="flex flex-col items-center">
          <h2 className="text-xs font-sans font-semibold tracking-widest text-[#252723] uppercase mb-2">
            The Silent Writing Guide
          </h2>
          <p className="text-xs sm:text-sm font-serif text-[#555953] leading-relaxed max-w-[280px]">
            Write without the pressure of a blank page. An ambient companion gently attunes to your natural flow, surfacing context-aware prompts only when your thoughts pause.
          </p>
        </div>

        <div id="feature-pillar-3" className="flex flex-col items-center">
          <h2 className="text-xs font-sans font-semibold tracking-widest text-[#252723] uppercase mb-2">
            Deep Reflection & Evolving Echoes
          </h2>
          <p className="text-xs sm:text-sm font-serif text-[#555953] leading-relaxed max-w-[280px]">
           Unpack daily friction through conversational deep dives and crystallize raw text into structured insights—laying the foundation for upcoming memory links to past breakthroughs.
          </p>
        </div>
      </div>
    </div>
  );
}
