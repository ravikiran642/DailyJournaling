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
} from 'lucide-react';

interface DailyJournalEditorProps {
  entry: JournalEntry | null;
  journalDate: string; // YYYY-MM-DD
  onSave: (data: { title: string; content: string; tags?: string[] }) => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isSynthesizing: boolean;
  synthesisError: string | null;
  onRetrySynthesis?: () => void;
  lastSavedAt: Date | null;
  onOpenSynthesisDrawer?: () => void;
  isSynthesisDrawerOpen?: boolean;
  onSelectDate?: (dateStr: string) => void;
}

export function DailyJournalEditor({
  entry,
  journalDate,
  onSave,
  saveStatus,
  isSynthesizing,
  lastSavedAt,
  onOpenSynthesisDrawer,
  isSynthesisDrawerOpen = false,
  onSelectDate,
}: DailyJournalEditorProps) {
  const formattedDate = formatJournalDate(journalDate);
  const [prevEntryKey, setPrevEntryKey] = useState(`${entry?.id || ''}_${journalDate}`);
  const [isDirty, setIsDirty] = useState(false);

  // Contextual Popovers (Contextual Utility Directive)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Typography Settings
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl'>('lg');

  // Tags
  const [currentTags, setCurrentTags] = useState<string[]>(entry?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // Auto-save debounce timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentEntryKey = `${entry?.id || ''}_${journalDate}`;
  if (currentEntryKey !== prevEntryKey) {
    setPrevEntryKey(currentEntryKey);
    setCurrentTags(entry?.tags || []);
    setIsDirty(false);
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

  // Handle Save
  const handleSave = useCallback(async () => {
    if (!editor || saveStatus === 'saving') return;
    const contentHtml = editor.getHTML();
    await onSave({
      title: formattedDate,
      content: contentHtml,
      tags: currentTags,
    });
    setIsDirty(false);
  }, [editor, saveStatus, formattedDate, onSave, currentTags]);

  // Debounced auto-save when dirty
  useEffect(() => {
    if (!isDirty || saveStatus === 'saving') return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 2500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, handleSave, saveStatus]);

  // Keyboard shortcut: Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Tag Management
  const handleAddTag = () => {
    const clean = newTagInput.trim().replace(/^#/, '');
    if (clean && !currentTags.includes(clean)) {
      const updated = [...currentTags, clean];
      setCurrentTags(updated);
      setNewTagInput('');
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = currentTags.filter((t) => t !== tagToRemove);
    setCurrentTags(updated);
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
        {/* Entry Header: Date on left, discrete action icons on right (matching wireframe) */}
        <div className="flex items-center justify-between pb-8 select-none">
          <h1
            id="journal-date-title"
            className="text-2xl sm:text-3xl lg:text-4xl font-serif font-normal text-[#1A1C18] tracking-tight"
          >
            {formattedDate}
          </h1>

          {/* Action Icons Cluster */}
          <div className="flex items-center gap-1 sm:gap-2 relative text-[#5A6057]">
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
                      if (e.target.value && onSelectDate) {
                        onSelectDate(e.target.value);
                        setIsCalendarOpen(false);
                      }
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-[#E5E7E2] bg-[#FAF8F5] text-[#252723] focus:border-[#6F8273] outline-none"
                  />

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => {
                        if (onSelectDate) onSelectDate(getLocalCalendarDate());
                        setIsCalendarOpen(false);
                      }}
                      className="text-[#6F8273] hover:underline font-medium cursor-pointer"
                    >
                      Go to Today
                    </button>
                    <button
                      onClick={() => {
                        if (onSelectDate) onSelectDate(addDaysToDate(journalDate, -1));
                        setIsCalendarOpen(false);
                      }}
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
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {currentTags.length === 0 ? (
                      <span className="text-[11px] text-[#8F948C] italic">
                        No tags assigned to this entry yet.
                      </span>
                    ) : (
                      currentTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#E8EFE9] text-[#2F4133]"
                        >
                          <span>#{tag}</span>
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="text-[#6F8273] hover:text-red-600 cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))
                    )}
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
                      onClick={handleAddTag}
                      className="p-1.5 rounded-lg bg-[#252723] text-white hover:bg-[#3D413A] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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
    </div>
  );
}
