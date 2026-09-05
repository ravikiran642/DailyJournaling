'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { ReflectionMode } from '@/lib/types';
import {
  Sparkles,
  LogOut,
  Check,
  Loader2,
  Database,
  Feather,
  Lightbulb,
  Heart,
  Scale,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  Calendar,
} from 'lucide-react';
import { formatJournalDate, getLocalCalendarDate } from '@/lib/utils';

interface NavbarProps {
  currentMode: ReflectionMode;
  onSelectMode: (mode: ReflectionMode) => void;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  onNewReflection: () => void;
  onSelectToday?: () => void;
  isTodayActive?: boolean;
  viewMode?: 'daily' | 'chat';
  onSelectViewMode?: (view: 'daily' | 'chat') => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function Navbar({
  currentMode,
  onSelectMode,
  syncStatus,
  onNewReflection,
  onSelectToday,
  isTodayActive = false,
  viewMode = 'daily',
  onSelectViewMode,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: NavbarProps) {
  const { user, signOutUser } = useAuth();
  const todayStr = getLocalCalendarDate();

  return (
    <header
      id="app-navbar"
      className="h-16 border-b border-[#E5E7E2] bg-[#FAFAF7]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between z-20 shrink-0 text-[#252723]"
    >
      {/* Left: Sidebar Toggle, Brand & Today Button */}
      <div id="nav-brand-section" className="flex items-center gap-3 sm:gap-4">
        {onToggleSidebar && (
          <button
            id="nav-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Expand library' : 'Collapse library for distraction-free writing'}
            className="hidden lg:flex p-2 rounded-lg text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9] transition-colors cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center font-serif text-sm">
            <Feather className="w-3.5 h-3.5" />
          </div>
          <span className="font-serif italic text-lg sm:text-xl tracking-tight text-[#252723]">
            The Open Page
          </span>
        </div>

        {/* View Mode Switcher: Daily Journal vs Guided Dialogue */}
        {onSelectViewMode && (
          <div
            id="nav-view-mode-toggle"
            className="hidden md:flex items-center p-0.5 rounded-full bg-[#F3F4EF] border border-[#E5E7E2] text-xs ml-2"
          >
            <button
              onClick={() => onSelectViewMode('daily')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white text-[#252723] shadow-xs'
                  : 'text-[#737872] hover:text-[#252723]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-[#6F8273]" />
              <span>Daily Journal</span>
            </button>
            <button
              onClick={() => onSelectViewMode('chat')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'chat'
                  ? 'bg-white text-[#252723] shadow-xs'
                  : 'text-[#737872] hover:text-[#252723]'
              }`}
            >
              <Feather className="w-3.5 h-3.5 text-[#6F8273]" />
              <span>Guided Reflection</span>
            </button>
          </div>
        )}
      </div>

      {/* Center: Calm Date Indicator */}
      <div
        id="nav-center-date-badge"
        className="hidden lg:flex items-center gap-2 text-xs font-serif italic text-[#737872]"
      >
        <Calendar className="w-3.5 h-3.5 text-[#6F8273]" />
        <span>{formatJournalDate(todayStr)}</span>
      </div>

      {/* Right: Unobtrusive Status & User Avatar */}
      <div id="nav-user-section" className="flex items-center gap-3">
        {/* Subtle Cloud Sync Indicator */}
        <div
          id="firestore-sync-badge"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-[#F3F4EF] border border-[#E5E7E2] text-[#737872]"
          title="Cloud Firestore Isolated Persistence"
        >
          <Database className="w-3 h-3 text-[#6F8273]" />
          {syncStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[#252723]">
              <Loader2 className="w-3 h-3 animate-spin text-[#6F8273]" />
              <span>Saving...</span>
            </span>
          )}
          {syncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[#252723]">
              <Check className="w-3 h-3 text-[#6F8273]" />
              <span>Synced</span>
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="text-red-700">Sync Warning</span>
          )}
          {syncStatus === 'idle' && (
            <span>Saved</span>
          )}
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E5E7E2]">
          {user?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              id="user-avatar"
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-7 h-7 rounded-full border border-[#E5E7E2] object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              id="user-avatar-fallback"
              className="w-7 h-7 rounded-full bg-[#DCE8DE] text-[#252723] font-serif italic text-xs flex items-center justify-center border border-[#E5E7E2]"
            >
              {user?.displayName?.[0] || user?.email?.[0] || 'U'}
            </div>
          )}

          <div className="hidden lg:flex flex-col text-left text-xs">
            <span className="font-medium text-[#252723] truncate max-w-[110px]">
              {user?.displayName || 'Elena'}
            </span>
            <span className="text-[#737872] text-[10px] truncate max-w-[110px]">
              {user?.email}
            </span>
          </div>

          <button
            id="nav-logout-btn"
            onClick={signOutUser}
            title="Sign Out"
            className="p-1.5 rounded-lg text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

