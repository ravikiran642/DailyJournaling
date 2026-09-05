'use client';

import React, { useState, useMemo } from 'react';
import { JournalEntry } from '@/lib/types';
import {
  Search,
  Trash2,
  Calendar,
  X,
  Plus,
  ChevronRight,
  PanelLeftClose,
} from 'lucide-react';
import { formatJournalDate, getLocalCalendarDate, formatSidebarDate } from '@/lib/utils';

interface SidebarProps {
  entries: JournalEntry[];
  activeJournalDate: string;
  onSelectDate: (dateStr: string) => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  entries,
  activeJournalDate,
  onSelectDate,
  onDeleteEntry,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [jumpDate, setJumpDate] = useState('');

  const todayStr = getLocalCalendarDate();

  // Distinct dates sorted descending
  const dateList = useMemo(() => {
    const datesMap = new Map<string, JournalEntry>();

    // Always include today's date so user can journal today
    if (!datesMap.has(todayStr)) {
      datesMap.set(todayStr, {
        id: 'placeholder-today',
        journalDate: todayStr,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: '',
        content: '',
      } as JournalEntry);
    }

    // Include all entries
    entries.forEach((entry) => {
      const dateKey = entry.journalDate || entry.createdAt.split('T')[0];
      if (dateKey) {
        datesMap.set(dateKey, entry);
      }
    });

    // Make sure active date is in the map
    if (activeJournalDate && !datesMap.has(activeJournalDate)) {
      datesMap.set(activeJournalDate, {
        id: `placeholder-${activeJournalDate}`,
        journalDate: activeJournalDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: '',
        content: '',
      } as JournalEntry);
    }

    const sortedDates = Array.from(datesMap.keys()).sort((a, b) => b.localeCompare(a));

    if (!searchTerm) {
      return sortedDates.map((d) => ({
        dateStr: d,
        entry: datesMap.get(d),
      }));
    }

    const term = searchTerm.toLowerCase().trim();
    return sortedDates
      .map((d) => ({ dateStr: d, entry: datesMap.get(d) }))
      .filter(({ dateStr, entry }) => {
        const fullDate = formatJournalDate(dateStr).toLowerCase();
        const sidebarDate = formatSidebarDate(dateStr, todayStr).toLowerCase();
        const title = entry?.title?.toLowerCase() || '';
        const plain = entry?.content?.replace(/<[^>]+>/g, ' ').toLowerCase() || '';
        const tags = entry?.tags?.join(' ').toLowerCase() || '';
        return (
          fullDate.includes(term) ||
          sidebarDate.includes(term) ||
          title.includes(term) ||
          plain.includes(term) ||
          tags.includes(term)
        );
      });
  }, [entries, todayStr, activeJournalDate, searchTerm]);

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteEntry(entryToDelete);
      setEntryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (jumpDate) {
      onSelectDate(jumpDate);
      setJumpDate('');
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/20 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="journal-sidebar"
        className={`fixed lg:static top-14 bottom-0 left-0 z-40 w-64 sm:w-72 bg-[#F7F5F0] border-r border-[#E5E7E2] flex flex-col text-[#252723] transition-all duration-200 select-none ${
          isCollapsed ? 'hidden' : 'flex'
        } ${
          isOpenMobile
            ? 'translate-x-0 shadow-xl'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Control Bar (contextually minimal) */}
        <div className="px-4 py-2.5 border-b border-[#E5E7E2]/60 flex items-center justify-between gap-2 text-xs text-[#737872]">
          <div className="flex items-center gap-1.5 font-medium text-[11px] tracking-wide uppercase text-[#888D85]">
            <span>Dates</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              title="Search entries"
              className="p-1 rounded hover:bg-[#EBE8E2] text-[#737872] hover:text-[#252723] cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <form onSubmit={handleJumpSubmit} className="inline-flex items-center">
              <label
                htmlFor="sidebar-jump-input"
                title="Jump to date"
                className="p-1 rounded hover:bg-[#EBE8E2] text-[#737872] hover:text-[#252723] cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
              </label>
              <input
                id="sidebar-jump-input"
                type="date"
                value={jumpDate}
                onChange={(e) => {
                  setJumpDate(e.target.value);
                  if (e.target.value) {
                    onSelectDate(e.target.value);
                    setJumpDate('');
                    onCloseMobile();
                  }
                }}
                className="sr-only"
              />
            </form>

            <button
              onClick={() => {
                onSelectDate(todayStr);
                onCloseMobile();
              }}
              title="Write Today"
              className="p-1 rounded hover:bg-[#EBE8E2] text-[#737872] hover:text-[#252723] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                className="hidden lg:flex p-1 rounded hover:bg-[#EBE8E2] text-[#737872] hover:text-[#252723] cursor-pointer"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded hover:bg-[#EBE8E2] text-[#737872]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible Search Input */}
        {isSearchOpen && (
          <div className="px-3 py-2 border-b border-[#E5E7E2]/80 bg-[#EFECE5]">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737872]" />
              <input
                type="text"
                placeholder="Search thoughts or dates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full pl-7 pr-6 py-1 bg-white border border-[#DDD8CE] rounded-md text-xs placeholder:text-[#A3A8A0] focus:outline-none focus:border-[#6F8273] text-[#252723]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737872] hover:text-[#252723]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Vertical Date List Matching Wireframe */}
        <div className="flex-1 overflow-y-auto py-2 px-2.5 space-y-0.5">
          {dateList.length === 0 ? (
            <div className="text-center py-8 px-4 text-[#737872]">
              <p className="text-xs font-serif italic">No entries match</p>
            </div>
          ) : (
            dateList.map(({ dateStr, entry }) => {
              const isSelected = activeJournalDate === dateStr;
              const hasRealContent = Boolean(
                entry && entry.id !== `placeholder-${dateStr}` && entry.content
              );

              // Consistent date format: "Today" for current day, "25-Oct-2026" for other dates
              const formattedDate = formatSidebarDate(dateStr, todayStr);

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    onSelectDate(dateStr);
                    onCloseMobile();
                  }}
                  className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    isSelected
                      ? 'bg-[#EAE7DF] text-[#1A1C18] font-medium'
                      : 'text-[#4A4E46] hover:bg-[#EFECE5] hover:text-[#1A1C18]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate tracking-tight font-serif text-[15px]">
                      {formattedDate}
                    </span>
                    {hasRealContent && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8E9F91] shrink-0" />
                    )}
                  </div>

                  {/* Subtle delete trigger on hover */}
                  {entry && hasRealContent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEntryToDelete(entry.id);
                      }}
                      title="Delete entry"
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#8F948C] hover:text-red-700 transition-opacity rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-[#E5E7E2] shadow-xl space-y-4">
            <h3 className="text-base font-serif font-semibold text-[#1A1C18]">
              Delete Journal Entry?
            </h3>
            <p className="text-xs text-[#737872] leading-relaxed">
              This action permanently deletes this daily reflection from your private Firestore database.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEntryToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-[#737872] hover:text-[#252723] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
