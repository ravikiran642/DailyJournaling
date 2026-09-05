'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { JournalEntry } from '@/lib/types';
import { formatJournalDate, getLocalCalendarDate, addDaysToDate } from '@/lib/utils';
import {
  Settings,
  Calendar as CalendarIcon,
  Tag,
  Sparkles,
  Check,
  Loader2,
  X,
  Plus,
  Maximize2,
  Minimize2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  List,
  Quote,
  Clock,
  Type,
  Save,
  AlertTriangle,
  Pencil,
} from 'lucide-react';

interface DailyJournalEditorProps {
  entry: JournalEntry | null;
  journalDate: string; // YYYY-MM-DD
  onSave?: (data: { title: string; content: string; tags?: string[]; manualTags?: string[] }) => Promise<void>;
  onSaveOnly: (data: { title: string; content: string; tags?: string[]; manualTags?: string[] }) => Promise<void>;
  onSaveAndSynthesize: (data: { title: string; content: string; tags?: string[]; manualTags?: string[] }) => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isSynthesizing: boolean;
  synthesisError: string | null;
  onRetrySynthesis?: () => void;
  lastSavedAt: Date | null;
  onOpenSynthesisDrawer?: () => void;
  isSynthesisDrawerOpen?: boolean;
  onSelectDate?: (dateStr: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  externalPendingDate?: string | null;
  onClearExternalPendingDate?: () => void;
}

export function DailyJournalEditor({
  entry,
  journalDate,
  onSave,
  onSaveOnly,
  onSaveAndSynthesize,
  saveStatus,
  isSynthesizing,
  lastSavedAt,
  onOpenSynthesisDrawer,
  isSynthesisDrawerOpen = false,
  onSelectDate,
  onDirtyChange,
  externalPendingDate,
  onClearExternalPendingDate,
}: DailyJournalEditorProps) {
  const formattedDate = formatJournalDate(journalDate);
  const [prevEntryNavKey, setPrevEntryNavKey] = useState(`${entry?.id || ''}_${journalDate}`);
  const [prevTagsServerKey, setPrevTagsServerKey] = useState(
    `${(entry?.tags || []).join(',')}_${(entry?.manualTags || []).join(',')}`
  );
  const [isDirty, setIsDirty] = useState(false);

  // Title state with fallback to expressed date format: e.g. "Saturday, September 5, 2026"
  const [currentTitle, setCurrentTitle] = useState<string>(entry?.title || formattedDate);

  // Contextual Popovers (Contextual Utility Directive)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Typography Settings
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl'>('lg');

  // Tags (currentTags: all active tags, manualTags: flagged tags manually added by user)
  const [currentTags, setCurrentTags] = useState<string[]>(entry?.tags || []);
  const [manualTags, setManualTags] = useState<string[]>(entry?.manualTags || entry?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // Unsaved changes date navigation confirmation state
  const [pendingDateChange, setPendingDateChange] = useState<string | null>(null);

  // Sync dirty status with parent dashboard
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const currentEntryNavKey = `${entry?.id || ''}_${journalDate}`;
  const currentTagsServerKey = `${(entry?.tags || []).join(',')}_${(entry?.manualTags || []).join(',')}`;

  if (currentEntryNavKey !== prevEntryNavKey) {
    setPrevEntryNavKey(currentEntryNavKey);
    setPrevTagsServerKey(currentTagsServerKey);
    setCurrentTags(entry?.tags || []);
    setManualTags(entry?.manualTags || entry?.tags || []);
    setCurrentTitle(entry?.title || formattedDate);
    setIsDirty(false);
  } else if (currentTagsServerKey !== prevTagsServerKey) {
    setPrevTagsServerKey(currentTagsServerKey);
    setCurrentTags(entry?.tags || []);
    setManualTags(entry?.manualTags || []);
  }

  // TipTap Editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
          class: 'text-[#4E6852] underline underline-offset-3 hover:text-[#2F4133]',
        },
      }),
    ],
    content: entry?.content || (entry?.initialPrompt ? `<p>${entry.initialPrompt}</p>` : ''),
    editorProps: {
      attributes: {
        class: `tiptap focus:outline-none min-h-[560px] leading-relaxed text-[#252723] ${
          fontFamily === 'serif' ? 'font-serif' : 'font-sans'
        } ${
          fontSize === 'base'
            ? 'text-base'
            : fontSize === 'lg'
            ? 'text-[1.125rem]'
            : 'text-xl'
        }`,
        'data-placeholder': 'Start writing your thoughts...',
      },
    },
    immediatelyRender: false,
    onUpdate: () => {
      setIsDirty(true);
    },
  });

  // Calculate live word count
  const editorText = editor?.getText() || '';
  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;

  // Keep editor content in sync when loaded entry changes
  useEffect(() => {
    if (editor && entry) {
      const incoming = entry.content || (entry.initialPrompt ? `<p>${entry.initialPrompt}</p>` : '');
      const current = editor.getHTML();
      if (incoming && incoming !== current) {
        editor.commands.setContent(incoming, { emitUpdate: false });
      }
    } else if (editor && !entry) {
      editor.commands.setContent('', { emitUpdate: false });
    }
  }, [entry, editor]);

  // Handle Save Journal (content + tags only, no synthesis or summary)
  const handleSaveOnly = useCallback(async () => {
    if (!editor || saveStatus === 'saving') return;
    const contentHtml = editor.getHTML();
    const saveFn = onSaveOnly || onSave;
    const titleToSave = currentTitle.trim() || formattedDate;
    if (saveFn) {
      await saveFn({
        title: titleToSave,
        content: contentHtml,
        tags: currentTags,
        manualTags: manualTags,
      });
    }
    setIsDirty(false);
  }, [editor, saveStatus, currentTitle, formattedDate, onSaveOnly, onSave, currentTags, manualTags]);

  // Handle Save and Synthesis (content + tags, then trigger synthesis)
  const handleSaveAndSynthesize = useCallback(async () => {
    if (!editor || saveStatus === 'saving' || isSynthesizing) return;
    const contentHtml = editor.getHTML();
    const titleToSave = currentTitle.trim() || formattedDate;
    if (onSaveAndSynthesize) {
      await onSaveAndSynthesize({
        title: titleToSave,
        content: contentHtml,
        tags: currentTags,
        manualTags: manualTags,
      });
    }
    setIsDirty(false);
  }, [editor, saveStatus, isSynthesizing, currentTitle, formattedDate, onSaveAndSynthesize, currentTags, manualTags]);

  // Target date requiring unsaved changes confirmation
  const targetDateToConfirm = pendingDateChange || externalPendingDate;

  // Date navigation initiator with unsaved check
  const handleInitiateDateChange = (targetDate: string) => {
    if (!targetDate || targetDate === journalDate) return;
    setIsCalendarOpen(false);
    if (isDirty) {
      setPendingDateChange(targetDate);
    } else if (onSelectDate) {
      onSelectDate(targetDate);
    }
  };

  // Confirm: Save & Reflect, then move to target date
  const handleConfirmSaveAndReflect = async () => {
    const target = targetDateToConfirm;
    if (!target) return;
    await handleSaveAndSynthesize();
    setIsDirty(false);
    setPendingDateChange(null);
    onClearExternalPendingDate?.();
    onSelectDate?.(target);
  };

  // Confirm: Discard unsaved changes and move to target date
  const handleConfirmDiscardAndMove = () => {
    const target = targetDateToConfirm;
    if (!target) return;
    setIsDirty(false);
    setPendingDateChange(null);
    onClearExternalPendingDate?.();
    onSelectDate?.(target);
  };

  // Cancel date navigation, stay on current journal entry
  const handleCancelDateChange = () => {
    setPendingDateChange(null);
    onClearExternalPendingDate?.();
  };

  // Keyboard shortcut: Cmd+S / Ctrl+S explicitly triggers save journal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveOnly();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveOnly]);

  // Tag Management (Manually added tags are flagged into manualTags)
  const handleAddTag = () => {
    const clean = newTagInput.trim().replace(/^#/, '');
    if (clean && !currentTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      const updatedTags = [...currentTags, clean];
      const updatedManual = manualTags.some((t) => t.toLowerCase() === clean.toLowerCase())
        ? manualTags
        : [...manualTags, clean];
      setCurrentTags(updatedTags);
      setManualTags(updatedManual);
      setNewTagInput('');
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = currentTags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    const updatedManual = manualTags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    setCurrentTags(updatedTags);
    setManualTags(updatedManual);
    setIsDirty(true);
  };

  // Toggle whether a tag is flagged as manual or AI
  const handleToggleTagManualFlag = (tagToToggle: string) => {
    const isManual = manualTags.some((t) => t.toLowerCase() === tagToToggle.toLowerCase());
    if (isManual) {
      setManualTags(manualTags.filter((t) => t.toLowerCase() !== tagToToggle.toLowerCase()));
    } else {
      setManualTags([...manualTags, tagToToggle]);
    }
    setIsDirty(true);
  };

  return (
    <div
      id="daily-journal-canvas"
      className={`flex-1 flex flex-col h-full bg-[#FBF9F5] overflow-y-auto relative select-text ${
        isFocusMode ? 'fixed inset-0 z-50 bg-[#FBF9F5]' : ''
      }`}
    >
      {/* Sacred Canvas Wrapper with Generous Negative Space */}
      <div className="max-w-3xl w-full mx-auto px-6 sm:px-12 py-10 sm:py-16 flex-1 flex flex-col relative">
        {/* Entry Header: Date on left, Save Journal & Save and Synthesis buttons + utility icons on right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 select-none border-b border-[#F0ECE1]">
          <div className="flex-1 min-w-0 mr-2">
            <div className="group relative flex items-center">
              <input
                id="journal-title-input"
                type="text"
                value={currentTitle}
                onChange={(e) => {
                  setCurrentTitle(e.target.value);
                  setIsDirty(true);
                }}
                onBlur={() => {
                  if (!currentTitle.trim()) {
                    setCurrentTitle(formattedDate);
                  }
                }}
                placeholder={formattedDate}
                className="w-full text-2xl sm:text-3xl lg:text-4xl font-serif font-normal text-[#1A1C18] tracking-tight bg-transparent border-b border-transparent hover:border-[#D5D0C5] focus:border-[#6F8273] focus:outline-none transition-colors py-0.5 rounded-xs"
                title="Click to edit journal title"
              />
              <Pencil className="w-3.5 h-3.5 text-[#989E95] opacity-0 group-hover:opacity-60 transition-opacity ml-1 shrink-0 pointer-events-none hidden sm:inline-block" />
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-[#82887E]">
              {currentTitle !== formattedDate && (
                <span className="font-medium text-[#656A61]">{formattedDate} •</span>
              )}
              {saveStatus === 'saving' ? (
                <span className="flex items-center gap-1 text-[#6F8273]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </span>
              ) : saveStatus === 'saved' ? (
                <span className="flex items-center gap-1 text-emerald-700">
                  <Check className="w-3 h-3" /> Saved to cloud
                </span>
              ) : lastSavedAt ? (
                <span>Last saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              ) : (
                <span>Daily reflection entry</span>
              )}
              {isDirty && (
                <span className="inline-flex items-center gap-1 text-amber-700 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unsaved changes
                </span>
              )}
            </div>
          </div>

          {/* Action Icons Cluster */}
          <div className="flex items-center flex-wrap gap-2 text-[#5A6057]">
            {/* 1. Save Journal Button (Saves content + tags only, no synthesis/summary) */}
            <button
              id="btn-save-journal"
              onClick={handleSaveOnly}
              disabled={saveStatus === 'saving'}
              title="Save journal entry content with tags without creating any synthesis or summary"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D5D2C8] bg-white text-[#2B3028] hover:bg-[#F3EFE6] hover:border-[#C4BFB2] transition-colors cursor-pointer shadow-xs disabled:opacity-60"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6F8273]" />
              ) : saveStatus === 'saved' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Save className="w-3.5 h-3.5 text-[#5A6057]" />
              )}
              <span>Save Journal</span>
            </button>

            {/* 2. Save and Synthesis Button (Saves journal and synthesizes data using existing API) */}
            <button
              id="btn-save-and-synthesis"
              onClick={handleSaveAndSynthesize}
              disabled={saveStatus === 'saving' || isSynthesizing}
              title="Save journal and synthesize reflection insights with Gemini AI"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#2F4133] text-white hover:bg-[#202E24] transition-colors cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isSynthesizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{isSynthesizing ? 'Synthesizing...' : 'Save & Synthesize'}</span>
            </button>

            <div className="h-4 w-px bg-[#E2DED5] mx-0.5 hidden sm:block" />
            {/* 1. Settings Gear Icon */}
            <div className="relative">
              <button
                id="btn-journal-settings"
                onClick={() => {
                  setIsSettingsOpen((prev) => !prev);
                  setIsCalendarOpen(false);
                  setIsTagsOpen(false);
                }}
                title="Writing preferences & settings"
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isSettingsOpen
                    ? 'bg-[#EAE7DF] text-[#1A1C18]'
                    : 'hover:bg-[#EAE7DF]/70 hover:text-[#1A1C18]'
                }`}
              >
                <Settings className="w-5 h-5 stroke-[1.75]" />
              </button>

              {/* Settings Popover */}
              {isSettingsOpen && (
                <div
                  id="popover-journal-settings"
                  className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#E5E7E2] rounded-2xl shadow-xl p-4 z-40 space-y-3.5 animate-in fade-in duration-100"
                >
                  <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2">
                    <span className="text-xs font-semibold text-[#1A1C18]">Preferences</span>
                    <button
                      onClick={() => setIsSettingsOpen(false)}
                      className="text-[#8F948C] hover:text-[#1A1C18] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Typography Font Selection */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-[#737872] uppercase tracking-wider block">
                      Typography
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 bg-[#F3F4EF] p-1 rounded-lg">
                      <button
                        onClick={() => setFontFamily('serif')}
                        className={`py-1 text-xs rounded font-serif transition-colors cursor-pointer ${
                          fontFamily === 'serif'
                            ? 'bg-white text-[#1A1C18] font-medium shadow-xs'
                            : 'text-[#737872]'
                        }`}
                      >
                        Serif (Newsreader)
                      </button>
                      <button
                        onClick={() => setFontFamily('sans')}
                        className={`py-1 text-xs rounded font-sans transition-colors cursor-pointer ${
                          fontFamily === 'sans'
                            ? 'bg-white text-[#1A1C18] font-medium shadow-xs'
                            : 'text-[#737872]'
                        }`}
                      >
                        Sans (Clean)
                      </button>
                    </div>
                  </div>

                  {/* Font Sizing */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-[#737872] uppercase tracking-wider block">
                      Font Scale
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-[#F3F4EF] p-1 rounded-lg text-center text-xs">
                      {(['base', 'lg', 'xl'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setFontSize(s)}
                          className={`py-1 rounded cursor-pointer transition-colors ${
                            fontSize === s
                              ? 'bg-white text-[#1A1C18] font-medium shadow-xs'
                              : 'text-[#737872]'
                          }`}
                        >
                          {s === 'base' ? 'Standard' : s === 'lg' ? 'Large' : 'Spacious'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Focus Mode & Auto-Save */}
                  <div className="pt-2 border-t border-[#F0EFEA] space-y-2 text-xs">
                    <button
                      onClick={() => {
                        setIsFocusMode((prev) => !prev);
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-[#F7F5F0] cursor-pointer text-[#4A4E46]"
                    >
                      <span>Focus Mode</span>
                      {isFocusMode ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-[#737872] px-1.5">
                      <span>Sync</span>
                      <span>
                        {saveStatus === 'saving'
                          ? 'Saving...'
                          : saveStatus === 'saved'
                          ? 'Saved to Cloud'
                          : 'Idle'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Calendar Icon */}
            <div className="relative">
              <button
                id="btn-journal-calendar"
                onClick={() => {
                  setIsCalendarOpen((prev) => !prev);
                  setIsSettingsOpen(false);
                  setIsTagsOpen(false);
                }}
                title="Jump to date"
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isCalendarOpen
                    ? 'bg-[#EAE7DF] text-[#1A1C18]'
                    : 'hover:bg-[#EAE7DF]/70 hover:text-[#1A1C18]'
                }`}
              >
                <CalendarIcon className="w-5 h-5 stroke-[1.75]" />
              </button>

              {/* Calendar Popover */}
              {isCalendarOpen && (
                <div
                  id="popover-journal-calendar"
                  className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5E7E2] rounded-2xl shadow-xl p-4 z-40 space-y-3 animate-in fade-in duration-100"
                >
                  <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2">
                    <span className="text-xs font-semibold text-[#1A1C18]">Select Date</span>
                    <button
                      onClick={() => setIsCalendarOpen(false)}
                      className="text-[#8F948C] hover:text-[#1A1C18] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="date"
                    value={journalDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleInitiateDateChange(e.target.value);
                      }
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-[#E5E7E2] bg-[#FAF8F5] text-[#252723] focus:border-[#6F8273] outline-none"
                  />

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => handleInitiateDateChange(getLocalCalendarDate())}
                      className="text-[#6F8273] hover:underline font-medium cursor-pointer"
                    >
                      Go to Today
                    </button>
                    <button
                      onClick={() => handleInitiateDateChange(addDaysToDate(journalDate, -1))}
                      className="text-[#737872] hover:text-[#1A1C18] cursor-pointer"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Tag Icon */}
            <div className="relative">
              <button
                id="btn-journal-tags"
                onClick={() => {
                  setIsTagsOpen((prev) => !prev);
                  setIsSettingsOpen(false);
                  setIsCalendarOpen(false);
                }}
                title="Add or manage tags"
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isTagsOpen
                    ? 'bg-[#EAE7DF] text-[#1A1C18]'
                    : 'hover:bg-[#EAE7DF]/70 hover:text-[#1A1C18]'
                }`}
              >
                <Tag className="w-5 h-5 stroke-[1.75]" />
              </button>

              {/* Tag Management Popover */}
              {isTagsOpen && (
                <div
                  id="popover-journal-tags"
                  className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5E7E2] rounded-2xl shadow-xl p-4 z-40 space-y-3 animate-in fade-in duration-100"
                >
                  <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2">
                    <span className="text-xs font-semibold text-[#1A1C18]">Thematic Tags</span>
                    <button
                      onClick={() => setIsTagsOpen(false)}
                      className="text-[#8F948C] hover:text-[#1A1C18] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Existing Tags */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {currentTags.length === 0 ? (
                      <span className="text-[11px] text-[#8F948C] italic">
                        No tags assigned to this entry yet.
                      </span>
                    ) : (
                      currentTags.map((tag) => {
                        const isManual = manualTags.some(
                          (m) => m.toLowerCase() === tag.toLowerCase()
                        );
                        return (
                          <span
                            key={tag}
                            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                              isManual
                                ? 'bg-[#EBF3EC] text-[#243B29] border-[#C8DACB]'
                                : 'bg-[#F5F3ED] text-[#4E544B] border-[#E2DDD5]'
                            }`}
                          >
                            <span className="font-medium">#{tag}</span>
                            {/* Flag indicator: Manual (user) or AI */}
                            <button
                              type="button"
                              onClick={() => handleToggleTagManualFlag(tag)}
                              title={
                                isManual
                                  ? 'Manual tag (protected from AI synthesis overwrite). Click to toggle.'
                                  : 'AI generated tag. Click to flag as Manual to protect from overwrite.'
                              }
                              className={`text-[8.5px] font-sans font-medium px-1 py-0.2 rounded cursor-pointer transition-colors ${
                                isManual
                                  ? 'bg-[#2F4133] text-white hover:bg-[#1E2D22]'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200 inline-flex items-center gap-0.5'
                              }`}
                            >
                              {isManual ? (
                                'Manual'
                              ) : (
                                <>
                                  <Sparkles className="w-2 h-2" /> AI
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-[#6F8273] hover:text-red-600 cursor-pointer"
                              title={`Remove #${tag}`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  <div className="text-[10px] text-[#7E847A] pt-0.5 leading-snug">
                    <span>💡 Manual tags are flagged & protected from AI overwrite.</span>
                  </div>

                  {/* Add Tag Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Add tag (e.g. Clarity)..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E7E2] bg-[#FAF8F5] text-[#252723] focus:border-[#6F8273] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="p-1.5 rounded-lg bg-[#252723] text-white hover:bg-[#3D413A] cursor-pointer"
                      title="Add manual tag"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Tags on Canvas (Displays current tags with manual vs AI flags and remove controls) */}
        {currentTags.length > 0 && (
          <div id="journal-canvas-tags" className="flex flex-wrap items-center gap-1.5 pt-3 pb-4 select-none">
            <span className="text-[11px] text-[#8F948C] font-serif italic mr-1">Tags:</span>
            {currentTags.map((tag) => {
              const isManual = manualTags.some(
                (m) => m.toLowerCase() === tag.toLowerCase()
              );
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                    isManual
                      ? 'bg-[#EBF3EC] text-[#243B29] border-[#C8DACB]'
                      : 'bg-[#F5F3ED] text-[#4E544B] border-[#E2DDD5]'
                  }`}
                >
                  <span className="font-medium">#{tag}</span>
                  {/* Flag indicator badge */}
                  <span
                    className={`text-[8.5px] font-sans font-medium px-1 py-0.2 rounded ${
                      isManual
                        ? 'bg-[#2F4133] text-white'
                        : 'bg-amber-100/90 text-amber-800 inline-flex items-center gap-0.5'
                    }`}
                    title={
                      isManual
                        ? 'Manually added by you (protected from AI overwrite)'
                        : 'Generated by AI synthesis'
                    }
                  >
                    {isManual ? (
                      'Manual'
                    ) : (
                      <>
                        <Sparkles className="w-2 h-2" /> AI
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-[#6F8273] hover:text-red-600 cursor-pointer ml-0.5"
                    title={`Remove #${tag}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Floating / Contextual Text Formatting Toolbar (Contextual Utility) */}
        {editor && (
          <div
            id="editor-contextual-toolbar"
            className="mb-6 flex items-center gap-1 bg-white/90 backdrop-blur-xs border border-[#E0DCD4] px-2 py-1 rounded-xl shadow-xs self-start text-[#5A6057] transition-all select-none"
          >
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded hover:bg-[#EAE7DF] cursor-pointer ${
                editor.isActive('bold') ? 'bg-[#EAE7DF] text-[#1A1C18]' : ''
              }`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-[#EAE7DF] cursor-pointer ${
                editor.isActive('italic') ? 'bg-[#EAE7DF] text-[#1A1C18]' : ''
              }`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded hover:bg-[#EAE7DF] cursor-pointer ${
                editor.isActive('underline') ? 'bg-[#EAE7DF] text-[#1A1C18]' : ''
              }`}
              title="Underline"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-[#E5E7E2] mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded hover:bg-[#EAE7DF] cursor-pointer ${
                editor.isActive('heading', { level: 2 }) ? 'bg-[#EAE7DF] text-[#1A1C18]' : ''
              }`}
              title="Heading"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded hover:bg-[#EAE7DF] cursor-pointer ${
                editor.isActive('bulletList') ? 'bg-[#EAE7DF] text-[#1A1C18]' : ''
              }`}
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded hover:bg-[#EAE7DF] cursor-pointer ${
                editor.isActive('blockquote') ? 'bg-[#EAE7DF] text-[#1A1C18]' : ''
              }`}
              title="Quote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sacred Core Writing Canvas */}
        <div className="flex-1 min-h-[500px]">
          <EditorContent editor={editor} />
        </div>

        {/* Faint Word Count Footnote (Non-intrusive) */}
        {wordCount > 0 && (
          <div className="pt-6 text-right select-none">
            <span className="text-[11px] text-[#A3A8A0] font-serif italic">
              {wordCount} words
            </span>
          </div>
        )}
      </div>

      {/* Bottom Right Sparkle Icon (Directly matching wireframe) */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30">
        <button
          id="btn-sparkle-reflection"
          onClick={onOpenSynthesisDrawer}
          title="Open AI Reflections & Synthesis"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
            isSynthesisDrawerOpen
              ? 'bg-[#252723] text-white rotate-12 scale-105'
              : 'bg-[#F7F5F0] hover:bg-[#EAE7DF] text-[#6F8273] hover:text-[#1A1C18] border border-[#E0DCD4]'
          }`}
        >
          <Sparkles
            className={`w-4 h-4 transition-transform ${
              isSynthesizing ? 'animate-spin text-amber-600' : ''
            }`}
          />
        </button>
      </div>
      {/* Unsaved Changes Date Navigation Warning Modal */}
      {targetDateToConfirm && (
        <div
          id="unsaved-changes-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="unsaved-changes-modal"
            className="bg-white rounded-2xl border border-[#E5E7E2] max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[#1A1C18]">Unsaved Changes</h3>
                <p className="text-xs text-[#6F746C] mt-1 leading-relaxed">
                  Your changes are not saved. Moving to <span className="font-semibold text-[#1A1C18]">{formatJournalDate(targetDateToConfirm)}</span> will discard your unsaved reflections.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F5] border border-[#EAE7DF] rounded-xl p-3 text-xs text-[#5A6057] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#8F948C]">Current Entry:</span>
                <span className="font-medium text-[#252723]">{currentTitle || formattedDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8F948C]">Destination Date:</span>
                <span className="font-medium text-[#2F4133]">{formatJournalDate(targetDateToConfirm)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-[#F0EFEA]">
              <button
                id="btn-unsaved-keep-editing"
                type="button"
                onClick={handleCancelDateChange}
                className="px-3 py-2 text-xs font-medium text-[#5A6057] hover:text-[#1A1C18] hover:bg-[#F3F4EF] rounded-lg transition-colors cursor-pointer text-center"
              >
                Keep Editing
              </button>
              <button
                id="btn-unsaved-discard"
                type="button"
                onClick={handleConfirmDiscardAndMove}
                className="px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-center"
              >
                Discard Changes
              </button>
              <button
                id="btn-unsaved-save-and-reflect"
                type="button"
                disabled={saveStatus === 'saving' || isSynthesizing}
                onClick={handleConfirmSaveAndReflect}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#2F4133] text-white hover:bg-[#202E24] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-60 text-center"
              >
                {isSynthesizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>Save and Reflect</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
