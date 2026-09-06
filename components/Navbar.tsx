'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  LogOut,
  Check,
  Loader2,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  Minus,
  Square,
  X,
} from 'lucide-react';

interface NavbarProps {
  activeJournalDate: string;
  onSelectDate: (date: string) => void;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  activeViewTab?: 'journal' | 'patterns';
  onSelectViewTab?: (tab: 'journal' | 'patterns') => void;
}

export function Navbar({
  syncStatus,
  isSidebarCollapsed,
  onToggleSidebar,
  activeViewTab = 'journal',
  onSelectViewTab,
}: NavbarProps) {
  const { user, signOutUser } = useAuth();

  return (
    <header
      id="app-navbar"
      className="h-14 border-b border-[#E5E7E2] bg-[#F7F5F0] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0 text-[#252723] select-none"
    >
      {/* Left: Brand & Sidebar Toggle */}
      <div id="nav-brand-section" className="flex items-center gap-3">
        <button
          id="nav-sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Show date list' : 'Hide date list'}
          className="p-1.5 rounded-md text-[#737872] hover:text-[#252723] hover:bg-[#EBE8E2] transition-colors cursor-pointer"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <span className="text-lg sm:text-xl font-serif italic text-[#1A1C18] tracking-tight font-medium">
          The Open Page
        </span>
      </div>

      {/* Center: Segmented Navigation matching wireframe */}
      <div
        id="nav-tab-switcher"
        className="flex items-center gap-1 bg-[#EBE8E2]/60 p-1 rounded-lg border border-[#E0DCD4]"
      >
        <button
          id="tab-journal-btn"
          onClick={() => onSelectViewTab && onSelectViewTab('journal')}
          className="px-4 py-1 rounded-md text-xs sm:text-sm font-medium transition-all cursor-pointer bg-[#FBF9F5] text-[#1A1C18] shadow-xs"
        >
          Journal
        </button>

        <div
          id="tab-patterns-btn"
          aria-disabled="true"
          className="px-3 py-1 rounded-md text-xs sm:text-sm font-medium text-[#737872] opacity-30 pointer-events-none select-none inline-flex items-center gap-1.5 cursor-default"
        >
          <span>Personal Patterns</span>
          <span className="text-[10px] font-normal tracking-wide text-[#737872]">
            (Coming Soon)
          </span>
        </div>
      </div>

      {/* Right: Sync Status, User & Window Controls */}
      <div id="nav-user-section" className="flex items-center gap-2 sm:gap-3">
        {/* Subtle Sync Indicator */}
        <div
          id="firestore-sync-badge"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-[#EBE8E2]/70 text-[#737872]"
          title="Cloud Firestore Isolated Storage"
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
              <span>Saved</span>
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="text-red-700">Sync Warning</span>
          )}
          {syncStatus === 'idle' && <span>Saved</span>}
        </div>

        {/* User Avatar & Logout */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-[#E5E7E2]">
          {user?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              id="user-avatar"
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-6 h-6 rounded-full border border-[#E5E7E2] object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              id="user-avatar-fallback"
              className="w-6 h-6 rounded-full bg-[#E8EFE9] text-[#252723] font-serif text-[11px] flex items-center justify-center border border-[#E5E7E2]"
            >
              {user?.displayName?.[0] || user?.email?.[0] || 'U'}
            </div>
          )}

          <button
            id="nav-logout-btn"
            onClick={signOutUser}
            title="Sign Out"
            className="p-1 rounded text-[#737872] hover:text-[#252723] hover:bg-[#EBE8E2] transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>

        {/* Minimal Desktop Window Frame Controls (echoing wireframe) */}
        <div className="hidden md:flex items-center gap-1 pl-1 text-[#8F948C]">
          <span className="p-1 hover:text-[#252723] cursor-default" title="Minimize">
            <Minus className="w-3 h-3" />
          </span>
          <span className="p-1 hover:text-[#252723] cursor-default" title="Window View">
            <Square className="w-2.5 h-2.5" />
          </span>
          <span className="p-1 hover:text-[#252723] cursor-default" title="Controls">
            <X className="w-3 h-3" />
          </span>
        </div>
      </div>
    </header>
  );
}
