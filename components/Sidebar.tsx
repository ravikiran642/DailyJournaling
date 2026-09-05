'use client';

import React, { useState } from 'react';
import { JournalEntry, ReflectionMode } from '@/lib/types';
import {
  Search,
  Plus,
  Trash2,
  Calendar,
  Tag,
  Feather,
  Lightbulb,
  Heart,
  Scale,
  Sparkles,
  BookOpen,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from 'lucide-react';
import { formatJournalDate, getLocalCalendarDate } from '@/lib/utils';

interface SidebarProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewReflection: () => void;
  onSelectToday: () => void;
  todayEntry: JournalEntry | null;
  onDeleteEntry: (entryId: string) => Promise<void>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  entries,
  selectedEntryId,
  onSelectEntry,
  onNewReflection,
  onSelectToday,
  todayEntry,
  onDeleteEntry,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const todayStr = getLocalCalendarDate();
  const isTodaySelected = selectedEntryId === todayEntry?.id && todayEntry !== null;

  const getModeIcon = (mode: ReflectionMode) => {
    switch (mode) {
      case 'brainstorm':
        return <Lightbulb className="w-3.5 h-3.5 text-[#6F8273]" />;
      case 'gratitude':
        return <Heart className="w-3.5 h-3.5 text-[#6F8273]" />;
      case 'decision':
        return <Scale className="w-3.5 h-3.5 text-[#6F8273]" />;
      case 'reflection':
      default:
        return <Feather className="w-3.5 h-3.5 text-[#6F8273]" />;
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesCategory =
      activeCategory === 'all' || entry.reflectionType === activeCategory;

    const term = searchTerm.toLowerCase().trim();
    if (!term) return matchesCategory;

    const inTitle = entry.title?.toLowerCase().includes(term);
    const inInitial = entry.initialPrompt?.toLowerCase().includes(term);
    const inSummary = entry.summary?.toLowerCase().includes(term);
    const inTags = entry.tags?.some((t) => t.toLowerCase().includes(term));
    const inInsights = entry.keyInsights?.some((i) =>
      i.toLowerCase().includes(term)
    );
    const inMessages = entry.messages?.some((m) =>
      m.content.toLowerCase().includes(term)
    );

    return (
      matchesCategory &&
      (inTitle || inInitial || inSummary || inTags || inInsights || inMessages)
    );
  });

  const handleDeleteConfirm = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDeleteEntry(id);
      setEntryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalInsightsCount = entries.reduce(
    (acc, curr) => acc + (curr.keyInsights?.length || 0),
    0
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Desktop Collapsed Slim Rail */}
      {isCollapsed && (
        <aside
          id="journal-sidebar-collapsed"
          className="hidden lg:flex flex-col items-center py-5 border-r border-[#E5E7E2] bg-[#FAFAF7] w-14 shrink-0 justify-between z-10"
        >
          <div className="flex flex-col items-center gap-4">
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title="Expand library"
                className="p-2 text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9] rounded-lg transition-colors cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onSelectToday}
              title="Today's Journal"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isTodaySelected
                  ? 'bg-[#E8EFE9] text-[#2F4133] ring-1 ring-[#6F8273]'
                  : 'bg-[#F3F4EF] hover:bg-[#E8EFE9] text-[#252723]'
              }`}
            >
              <Sun className="w-4 h-4 text-[#6F8273]" />
            </button>

            <button
              onClick={onNewReflection}
              title="New Reflection"
              className="w-9 h-9 rounded-full bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7] flex items-center justify-center transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 text-[#737872]">
            <BookOpen className="w-4 h-4 text-[#6F8273]" />
            <span className="text-[10px] font-serif italic">{entries.length}</span>
          </div>
        </aside>
      )}

      {/* Full Sidebar (Desktop Expanded & Mobile Drawer) */}
      <aside
        id="journal-sidebar"
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-80 sm:w-84 bg-[#FAFAF7] border-r border-[#E5E7E2] flex flex-col text-[#252723] transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:hidden' : 'lg:flex'
        } ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header & New Button */}
        <div className="p-5 sm:p-6 border-b border-[#E5E7E2] flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center font-serif text-xs">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif italic text-lg tracking-tight text-[#252723]">Library &amp; Archives</h2>
            </div>
            
            <div className="flex items-center gap-1">
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  title="Collapse library"
                  className="hidden lg:flex p-1.5 text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9] rounded-md transition-colors cursor-pointer"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 text-[#737872] hover:text-[#252723] rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            id="sidebar-new-reflection-btn"
            onClick={() => {
              onNewReflection();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7] text-xs font-medium transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Begin New Reflection</span>
          </button>

          {/* Pinned Today's Journal Card */}
          <button
            id="sidebar-today-journal-btn"
            onClick={() => {
              onSelectToday();
              onCloseMobile();
            }}
            className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              isTodaySelected
                ? 'bg-[#E8EFE9] border-[#C3D6C6] shadow-xs ring-1 ring-[#6F8273]'
                : 'bg-white border-[#E5E7E2] hover:border-[#DCE8DE] hover:bg-[#FAFAF7]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#DCE8DE] text-[#2F4133] flex items-center justify-center shrink-0">
                <Sun className="w-3.5 h-3.5 text-[#6F8273]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#252723]">Today&apos;s Journal</span>
                  {todayEntry && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" title="Today's journal exists" />
                  )}
                </div>
                <span className="text-[11px] text-[#737872]">
                  {formatJournalDate(todayStr)}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-medium text-[#6F8273] px-2 py-0.5 rounded-full bg-[#F3F4EF]">
              {todayEntry ? 'Continue' : 'Write'}
            </span>
          </button>
        </div>

        {/* Search & Mode Filters */}
        <div className="px-5 py-3 border-b border-[#E5E7E2] flex flex-col gap-2.5 bg-[#FAFAF7]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737872]" />
            <input
              id="sidebar-search-input"
              type="text"
              placeholder="Search past thoughts &amp; insights..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#F3F4EF] border border-[#E5E7E2] rounded-lg pl-8 pr-7 py-1.5 text-xs text-[#252723] placeholder-[#737872] focus:outline-none focus:border-[#6F8273] transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737872] hover:text-[#252723]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            {[
              { id: 'all', label: 'All' },
              { id: 'reflection', label: 'Reflect' },
              { id: 'brainstorm', label: 'Brainstorm' },
              { id: 'gratitude', label: 'Gratitude' },
              { id: 'decision', label: 'Decide' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-[#DCE8DE] text-[#252723]'
                    : 'text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9]/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section title & count */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between text-xs text-[#737872]">
          <span className="font-serif italic">Entries ({filteredEntries.length})</span>
          {totalInsightsCount > 0 && (
            <span className="text-[11px] text-[#6F8273] font-medium">
              {totalInsightsCount} takeaway{totalInsightsCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Entries List */}
        <div id="sidebar-entries-list" className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5">
          {filteredEntries.length === 0 ? (
            <div className="py-14 text-center text-[#737872] flex flex-col items-center">
              <Feather className="w-5 h-5 text-[#6F8273] mb-2 opacity-60" />
              <p className="text-xs font-serif italic text-[#737872]">
                {searchTerm
                  ? 'No matching reflections found.'
                  : 'Your journal is peaceful and empty.'}
              </p>
              <p className="text-[11px] text-[#737872] mt-1 max-w-[190px]">
                {searchTerm
                  ? 'Try different keywords.'
                  : 'Start writing to build your personal sanctuary.'}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = selectedEntryId === entry.id;
              const dateFormatted = entry.journalDate
                ? formatJournalDate(entry.journalDate)
                : new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

              // Clean text preview for snippet
              let snippet = entry.summary || '';
              if (!snippet && entry.content) {
                snippet = entry.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              }
              if (!snippet) {
                snippet = entry.initialPrompt || entry.messages?.[0]?.content || 'No text recorded.';
              }

              return (
                <div
                  key={entry.id}
                  id={`entry-card-${entry.id}`}
                  onClick={() => {
                    onSelectEntry(entry);
                    onCloseMobile();
                  }}
                  className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#E8EFE9] border-[#DCE8DE] text-[#252723] shadow-xs'
                      : 'bg-white border-[#E5E7E2] hover:border-[#DCE8DE] hover:bg-[#FAFAF7]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[10px] text-[#737872] font-sans truncate">
                      {dateFormatted}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.isDailyPrimary && (
                        <span className="text-[9px] text-[#2F4133] font-medium px-1.5 py-0.5 rounded-full bg-[#DCE8DE]">
                          Daily
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#6F8273] font-medium px-2 py-0.5 rounded-full bg-[#F3F4EF] capitalize">
                        {entry.reflectionType}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-serif font-medium leading-snug text-[#252723] group-hover:text-[#6F8273] transition-colors mb-1">
                    {entry.title || 'Untitled Reflection'}
                  </h3>

                  <p className="text-xs text-[#737872] line-clamp-2 leading-relaxed font-serif italic mb-2">
                    {snippet}
                  </p>

                  <div className="flex items-center justify-between pt-1.5 border-t border-[#E5E7E2]/60 text-[11px]">
                    {entry.synthesis || (entry.keyInsights && entry.keyInsights.length > 0) ? (
                      <span className="text-[#6F8273] font-medium text-[10px] flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Synthesized</span>
                      </span>
                    ) : (
                      <span className="text-[#737872] text-[10px]">
                        {entry.content ? 'Document' : `${entry.messages?.length || 0} interactions`}
                      </span>
                    )}

                    {/* Delete entry button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEntryToDelete(entry.id);
                      }}
                      title="Delete Entry"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#737872] hover:text-red-700 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Inline Delete Confirmation Popover */}
                  {entryToDelete === entry.id && (
                    <div
                      className="absolute inset-0 bg-[#FAFAF7]/98 border border-[#E5E7E2] rounded-xl p-3 flex flex-col justify-center items-center z-10 shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs font-serif italic text-[#252723] mb-2 text-center">
                        Delete this reflection permanently?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={isDeleting}
                          onClick={(e) => handleDeleteConfirm(e, entry.id)}
                          className="px-3 py-1 rounded-lg bg-red-700 text-white text-xs font-medium cursor-pointer"
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntryToDelete(null);
                          }}
                          className="px-3 py-1 rounded-lg border border-[#E5E7E2] bg-white text-[#252723] text-xs font-medium cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-[#E5E7E2] bg-[#FAFAF7] text-[11px] text-[#737872] flex items-center justify-between px-5">
          <span>Personal Sanctuary</span>
          <span className="font-serif italic text-xs text-[#6F8273]">Firestore Encrypted</span>
        </div>
      </aside>
    </>
  );
}
