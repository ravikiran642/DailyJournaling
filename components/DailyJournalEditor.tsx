'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { JournalEntry } from '@/lib/types';
import { formatJournalDate } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo,
  Redo,
  Save,
  Check,
  Loader2,
  Calendar,
  Sparkles,
  BookOpen,
  Minus,
  Brain,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';

interface DailyJournalEditorProps {
  entry: JournalEntry | null;
  journalDate: string; // YYYY-MM-DD
  onSave: (data: { title: string; content: string }) => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isSynthesizing: boolean;
  synthesisError: string | null;
  onRetrySynthesis?: () => void;
  lastSavedAt: Date | null;
  onOpenSynthesisDrawer?: () => void;
  isSynthesisDrawerOpen?: boolean;
}

export function DailyJournalEditor({
  entry,
  journalDate,
  onSave,
  saveStatus,
  isSynthesizing,
  synthesisError,
  onRetrySynthesis,
  lastSavedAt,
  onOpenSynthesisDrawer,
  isSynthesisDrawerOpen = false,
}: DailyJournalEditorProps) {
  // Title state with key-tracking to reinitialize cleanly when entry or date changes
  const formattedDateTitle = formatJournalDate(journalDate);
  const [prevEntryKey, setPrevEntryKey] = useState(`${entry?.id || ''}_${journalDate}`);
  const [title, setTitle] = useState(entry?.title || formattedDateTitle || 'Daily Reflection');
  const [isDirty, setIsDirty] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const currentEntryKey = `${entry?.id || ''}_${journalDate}`;
  if (currentEntryKey !== prevEntryKey) {
    setPrevEntryKey(currentEntryKey);
    setTitle(entry?.title || formattedDateTitle || 'Daily Reflection');
    setIsDirty(false);
  }

  // TipTap Editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
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
        class: 'tiptap focus:outline-none min-h-[480px] p-2 leading-relaxed text-[#252723]',
        'data-placeholder': 'Write freely about your day, realizations, tensions, and thoughts...',
      },
    },
    immediatelyRender: false,
    onUpdate: () => {
      setIsDirty(true);
    },
  });

  // Calculate live counts directly from editor
  const editorText = editor?.getText() || '';
  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;
  const charCount = editorText.length;

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
    const resolvedTitle = title.trim() || formatJournalDate(journalDate) || 'Daily Reflection';
    await onSave({
      title: resolvedTitle,
      content: contentHtml,
    });
    setIsDirty(false);
  }, [editor, saveStatus, title, journalDate, onSave]);

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

  // Link Insertion Helper
  const setLink = () => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setLinkModalOpen(false);
    } else {
      editor.chain().focus().unsetLink().run();
      setLinkModalOpen(false);
    }
  };

  const formattedDisplayDate = formatJournalDate(journalDate);

  return (
    <div id="daily-journal-canvas" className="flex-1 flex flex-col h-full bg-[#FAFAF7] overflow-y-auto">
      {/* Top Banner / Document Meta Bar */}
      <div className="border-b border-[#E5E7E2] bg-white/75 backdrop-blur-xs px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 sticky top-0 z-10">
        {/* Date & Mode Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F3F4EF] border border-[#E5E7E2] text-xs text-[#252723] font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#6F8273]" />
            <span>{formattedDisplayDate || 'Today'}</span>
          </div>

          {entry?.isDailyPrimary && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E8EFE9] text-[#2F4133]">
              Primary Daily Reflection
            </span>
          )}

          {isDirty && (
            <span className="text-[11px] text-[#737872] italic hidden md:inline">
              (Unsaved edits)
            </span>
          )}
        </div>

        {/* Action Controls & Save Status */}
        <div className="flex items-center gap-3">
          {/* Subtle Background Synthesis Status Indicator */}
          {isSynthesizing && (
            <div
              id="synthesis-background-spinner"
              className="flex items-center gap-1.5 text-xs text-[#6F8273] animate-pulse"
              title="AI is quietly generating reflective synthesis and tags in the background"
            >
              <Sparkles className="w-3.5 h-3.5 animate-spin text-[#6F8273]" />
              <span className="hidden lg:inline text-[11px]">Reflecting in background...</span>
            </div>
          )}

          {!isSynthesizing && synthesisError && onRetrySynthesis && (
            <button
              onClick={onRetrySynthesis}
              className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-200 transition-colors cursor-pointer"
              title="Background AI synthesis had an issue. Click to retry."
            >
              <AlertCircle className="w-3 h-3" />
              <span>Retry Reflection</span>
            </button>
          )}

          {/* Last Saved Timestamp */}
          {lastSavedAt && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#737872]">
              <Clock className="w-3 h-3" />
              <span>
                Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {/* Optional Quiet Synthesis Drawer Toggle */}
          {onOpenSynthesisDrawer && (entry?.synthesis || entry?.summary) && (
            <button
              onClick={onOpenSynthesisDrawer}
              id="toggle-synthesis-drawer-btn"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                isSynthesisDrawerOpen
                  ? 'bg-[#DCE8DE] border-[#C3D6C6] text-[#252723]'
                  : 'bg-white border-[#E5E7E2] text-[#737872] hover:text-[#252723] hover:border-[#D0D4CC]'
              }`}
              title="View reflective synthesis derived from this journal"
            >
              <Brain className="w-3.5 h-3.5 text-[#6F8273]" />
              <span className="hidden sm:inline">Reflective Layer</span>
            </button>
          )}

          {/* Save Action Button */}
          <button
            id="save-journal-btn"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-all cursor-pointer ${
              saveStatus === 'saved'
                ? 'bg-[#E8EFE9] text-[#2F4133] border border-[#C3D6C6]'
                : saveStatus === 'saving'
                ? 'bg-[#3D413A] text-[#FAFAF7] opacity-80 cursor-wait'
                : 'bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7]'
            }`}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Journal</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Journal Writing Center Sheet */}
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex-1 flex flex-col">
        {/* Document Title Header */}
        <div className="mb-6 space-y-2">
          <input
            id="journal-title-input"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsDirty(true);
            }}
            placeholder={formattedDisplayDate || "Today's Reflection"}
            className="w-full font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1A1C18] bg-transparent border-none outline-none placeholder:text-[#A3A8A0] focus:ring-0 px-0"
          />
          <div className="h-px w-full bg-[#E5E7E2]" />
        </div>

        {/* Calm Rich-Text Formatting Toolbar */}
        {editor && (
          <div
            id="journal-editor-toolbar"
            className="mb-6 flex flex-wrap items-center gap-1 bg-white border border-[#E5E7E2] p-1.5 rounded-2xl shadow-xs sticky top-16 z-10"
          >
            {/* Text Hierarchy */}
            <button
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                editor.isActive('paragraph')
                  ? 'bg-[#E8EFE9] text-[#252723] font-semibold'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Paragraph"
            >
              Normal
            </button>

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('heading', { level: 1 })
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('heading', { level: 2 })
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('heading', { level: 3 })
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#E5E7E2] mx-1" />

            {/* Inline Formatting */}
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('bold')
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Bold (Cmd+B)"
            >
              <Bold className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('italic')
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Italic (Cmd+I)"
            >
              <Italic className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('underline')
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Underline (Cmd+U)"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#E5E7E2] mx-1" />

            {/* Lists & Quotes */}
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('bulletList')
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('orderedList')
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('blockquote')
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Quote"
            >
              <Quote className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const prev = editor.getAttributes('link').href || '';
                setLinkUrl(prev);
                setLinkModalOpen((o) => !o);
              }}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('link')
                  ? 'bg-[#E8EFE9] text-[#252723]'
                  : 'text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF]'
              }`}
              title="Insert Link"
            >
              <Link2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="p-1.5 rounded-lg text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF] cursor-pointer transition-colors"
              title="Horizontal Divider"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[#E5E7E2] mx-1" />

            {/* Undo / Redo */}
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-1.5 rounded-lg text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF] disabled:opacity-30 cursor-pointer transition-colors"
              title="Undo (Cmd+Z)"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-1.5 rounded-lg text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF] disabled:opacity-30 cursor-pointer transition-colors"
              title="Redo (Cmd+Y)"
            >
              <Redo className="w-4 h-4" />
            </button>

            {/* Word & Char counter on right side */}
            <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-[#737872] px-2">
              <span>{wordCount} words</span>
              <span>&bull;</span>
              <span>{charCount} characters</span>
            </div>
          </div>
        )}

        {/* Link Input Dialog Popup */}
        {linkModalOpen && (
          <div className="mb-4 p-3 bg-white border border-[#E5E7E2] rounded-xl shadow-md flex items-center gap-2 z-20">
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setLink();
                if (e.key === 'Escape') setLinkModalOpen(false);
              }}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[#E5E7E2] outline-none focus:border-[#6F8273]"
              autoFocus
            />
            <button
              onClick={setLink}
              className="px-3 py-1.5 bg-[#252723] text-white text-xs font-medium rounded-lg hover:bg-[#3D413A] cursor-pointer"
            >
              Apply
            </button>
            <button
              onClick={() => setLinkModalOpen(false)}
              className="px-2.5 py-1.5 text-xs text-[#737872] hover:text-[#252723] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Writing Paper Area */}
        <div
          id="journal-paper-container"
          className="flex-1 bg-white border border-[#E5E7E2] rounded-3xl p-6 sm:p-10 shadow-xs cursor-text focus-within:border-[#C3D6C6] transition-colors"
          onClick={() => {
            if (editor && !editor.isFocused) {
              editor.commands.focus();
            }
          }}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Footer info: Calm & Grounded */}
        <div className="mt-4 flex items-center justify-between text-xs text-[#737872] px-2">
          <span>{entry?.isDailyPrimary ? "Today's Primary Journal" : 'Journal Reflection'}</span>
          <span className="hidden sm:inline">Press Cmd+S or Ctrl+S to save anytime</span>
        </div>
      </div>
    </div>
  );
}
