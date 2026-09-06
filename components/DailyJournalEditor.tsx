'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/lib/auth-context';
import { updateJournalEntry, saveOrUpdateDailyJournal } from '@/lib/firestore-service';
import { JournalEntry, SilentGuideSuggestion, ChatMessage } from '@/lib/types';
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
  RotateCw,
  MessageSquare,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Send,
  Copy,
  PenLine,
  Feather,
  ShieldCheck,
  FileText,
  Hash,
  Share2,
} from 'lucide-react';

export type CanvasMode = 'raw' | 'chat' | 'synthesis';

let msgCounter = 0;
function generateChatId(prefix: string): string {
  msgCounter += 1;
  return `${prefix}-${msgCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

interface DailyJournalEditorProps {
  entry: JournalEntry | null;
  journalDate: string; // YYYY-MM-DD
  onSave?: (data: { title: string; content: string; tags?: string[]; manualTags?: string[] }) => Promise<void>;
  onSaveOnly: (data: { title: string; content: string; tags?: string[]; manualTags?: string[] }) => Promise<void>;
  onSaveAndSynthesize: (data: { title: string; content: string; tags?: string[]; manualTags?: string[] }) => Promise<JournalEntry | null | void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isSynthesizing: boolean;
  synthesisError: string | null;
  onRetrySynthesis?: () => void;
  lastSavedAt: Date | null;
  onOpenChat?: () => void;
  onSelectDate?: (dateStr: string) => void;
  allEntries?: JournalEntry[];
  onUpdateEntry?: (updated: JournalEntry) => void;
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
  onOpenChat,
  onSelectDate,
  allEntries = [],
  onUpdateEntry,
}: DailyJournalEditorProps) {
  const { user } = useAuth();
  const formattedDate = formatJournalDate(journalDate);

  // Full-Canvas State Management System (3 States: raw, chat, synthesis)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('raw');
  const [previousCanvasMode, setPreviousCanvasMode] = useState<'raw' | 'chat'>('raw');

  // Deep Chat Canvas State (State B)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(entry?.messages || []);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Synthesis Canvas State (State C)
  const [copiedSynthesis, setCopiedSynthesis] = useState(false);

  // Title state with fallback to expressed date format: e.g. "Saturday, September 5, 2026"
  const [currentTitle, setCurrentTitle] = useState<string>(entry?.title || formattedDate);

  // Contextual Popovers (Contextual Utility Directive)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isFlipPageOpen, setIsFlipPageOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Typography Settings
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl'>('lg');

  // Tags (currentTags: all active tags, manualTags: flagged tags manually added by user)
  const [currentTags, setCurrentTags] = useState<string[]>(entry?.tags || []);
  const [manualTags, setManualTags] = useState<string[]>(entry?.manualTags || entry?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');

  // The Silent Guide State (State 1 & State 2)
  const [isStalled, setIsStalled] = useState(false);
  const [isStallMenuOpen, setIsStallMenuOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ top: number; left: number } | null>(null);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<SilentGuideSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionTone, setSuggestionTone] = useState<string | null>(null);
  const [lastAnalyzedText, setLastAnalyzedText] = useState('');
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editorCanvasRef = useRef<HTMLDivElement | null>(null);
  const stallMenuRef = useRef<HTMLDivElement | null>(null);

  // Intelligent Raw Data Saving (3-second debounce on text input)
  const isSavePendingRef = useRef(false);
  const [isDebouncePending, setIsDebouncePending] = useState(false);
  const debounceSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<{
    content: string;
    title: string;
    tags: string[];
    manualTags: string[];
  } | null>(null);

  // Flush routine to persist pending changes immediately
  const flushPendingSave = useCallback(async () => {
    if (debounceSaveTimerRef.current) {
      clearTimeout(debounceSaveTimerRef.current);
      debounceSaveTimerRef.current = null;
    }

    if (!isSavePendingRef.current || !pendingContentRef.current) {
      return;
    }

    const payload = pendingContentRef.current;
    isSavePendingRef.current = false;
    setIsDebouncePending(false);

    const saveFn = onSaveOnly || onSave;
    if (saveFn) {
      await saveFn({
        title: payload.title.trim() || formattedDate,
        content: payload.content,
        tags: payload.tags,
        manualTags: payload.manualTags,
      });
    }
  }, [onSaveOnly, onSave, formattedDate]);

  // Queue debounced save (3s) when content or title updates
  const queueDebouncedSave = useCallback(
    (newContent?: string, newTitle?: string, newTags?: string[], newManualTags?: string[]) => {
      const contentToSave =
        newContent !== undefined
          ? newContent
          : pendingContentRef.current?.content || entry?.content || '';
      const titleToSave = newTitle !== undefined ? newTitle : currentTitle;
      const tagsToSave = newTags !== undefined ? newTags : currentTags;
      const manualTagsToSave = newManualTags !== undefined ? newManualTags : manualTags;

      pendingContentRef.current = {
        content: contentToSave,
        title: titleToSave,
        tags: tagsToSave,
        manualTags: manualTagsToSave,
      };
      isSavePendingRef.current = true;
      setIsDebouncePending(true);

      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
      }

      debounceSaveTimerRef.current = setTimeout(() => {
        flushPendingSave();
      }, 3000);
    },
    [entry?.content, currentTitle, currentTags, manualTags, flushPendingSave]
  );

  // Application Exit Safety: Bind a final flush routine to browser visibility/unload events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isSavePendingRef.current) {
        flushPendingSave();
      }
    };

    const handleBeforeUnload = () => {
      if (isSavePendingRef.current) {
        flushPendingSave();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
      }
      if (isSavePendingRef.current) {
        flushPendingSave();
      }
    };
  }, [flushPendingSave]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (canvasMode === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading, canvasMode]);

  const triggerStallRef = useRef<() => void>(() => {});

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
        'data-placeholder': 'You can dump anything here. No structure, no pressure.',
      },
      handleKeyDown: () => {
        // Typing instantly forces stall icon & micro-menu to vanish
        setIsStalled(false);
        setIsStallMenuOpen(false);
        if (stallTimerRef.current) {
          clearTimeout(stallTimerRef.current);
        }
        stallTimerRef.current = setTimeout(() => {
          triggerStallRef.current();
        }, 45000);
        return false;
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor: activeEditor }) => {
      queueDebouncedSave(activeEditor.getHTML());
      setIsStalled(false);
      setIsStallMenuOpen(false);
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
      }
      stallTimerRef.current = setTimeout(() => {
        triggerStallRef.current();
      }, 45000);
    },
  });

  // Calculate live word count and empty state
  const editorText = editor?.getText() || '';
  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;
  const isCanvasEmpty = !editorText.trim();

  // Update cursor position directly below cursor line
  const updateCursorCoords = useCallback(() => {
    if (!editor || !editorCanvasRef.current) return;

    try {
      const { view } = editor;
      const { selection } = view.state;
      const coords = view.coordsAtPos(selection.from);
      const containerRect = editorCanvasRef.current.getBoundingClientRect();

      const relTop = coords.bottom - containerRect.top + 8;
      const maxLeft = Math.max(12, containerRect.width - 340);
      const relLeft = Math.max(12, Math.min(coords.left - containerRect.left, maxLeft));

      setCursorCoords({
        top: Math.max(20, relTop),
        left: relLeft,
      });
    } catch {
      setCursorCoords(null);
    }
  }, [editor]);

  // Extracts the trailing sentence/clause before the user stalled
  const extractLastSentence = (text: string): string => {
    if (!text) return '';
    const trimmed = text.trim();
    const sentences = trimmed.split(/(?<=[.?!;:\n])\s+/);
    if (sentences.length > 0) {
      const last = sentences[sentences.length - 1];
      return last.trim() || trimmed.slice(-140);
    }
    return trimmed.slice(-140);
  };

  // Real-time Contextual AI Generation for The Silent Guide
  const fetchDynamicSuggestions = useCallback(
    async (textToAnalyze: string, force = false) => {
      const trimmed = textToAnalyze.trim();
      if (!trimmed) return;

      if (!force && lastAnalyzedText === trimmed && dynamicSuggestions.length > 0) {
        return;
      }

      setLastAnalyzedText(trimmed);
      setIsGeneratingSuggestions(true);

      try {
        const lastSentence = extractLastSentence(trimmed);

        const res = await fetch('/api/gemini/silent-guide', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentText: trimmed,
            lastSentence,
            journalDate,
            allEntries,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            setDynamicSuggestions(data.suggestions.slice(0, 2));
            setSuggestionTone(data.detectedTone || null);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic suggestions:', err);
      } finally {
        setIsGeneratingSuggestions(false);
      }
    },
    [allEntries, dynamicSuggestions.length, journalDate, lastAnalyzedText]
  );

  // Trigger stall state and pre-warm dynamic contextual suggestions
  const triggerStall = useCallback(() => {
    if (!editor) return;
    const currentText = editor.getText() || '';
    if (!currentText.trim()) return;

    updateCursorCoords();
    setIsStalled(true);

    // Asynchronously fetch contextual suggestions on stall event
    fetchDynamicSuggestions(currentText);
  }, [editor, updateCursorCoords, fetchDynamicSuggestions]);

  useEffect(() => {
    triggerStallRef.current = triggerStall;
  }, [triggerStall]);

  // Clean up idle stall timer on unmount and when transitioning canvas modes (away from State A)
  useEffect(() => {
    if (canvasMode !== 'raw') {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    }
    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
  }, [canvasMode]);

  // Dismiss floating micro-menu on outside click
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        stallMenuRef.current &&
        !stallMenuRef.current.contains(e.target as Node)
      ) {
        setIsStallMenuOpen(false);
      }
    };
    if (isStallMenuOpen) {
      document.addEventListener('mousedown', handleDocumentClick);
      return () => document.removeEventListener('mousedown', handleDocumentClick);
    }
  }, [isStallMenuOpen]);

  // The Silent Guide: Fallback suggestions if AI response is loading or offline
  const yesterdayDateStr = addDaysToDate(journalDate, -1);
  const previousEntry = (allEntries || []).find((e) => {
    const eDate = e.journalDate || (e.createdAt ? e.createdAt.split('T')[0] : '');
    return eDate === yesterdayDateStr || (eDate && eDate < journalDate);
  });
  const prevDate = previousEntry?.journalDate || (previousEntry?.createdAt ? previousEntry.createdAt.split('T')[0] : '');
  const historicalSuggestion =
    previousEntry?.title && (!prevDate || previousEntry.title !== formatJournalDate(prevDate))
      ? `Let's pivot and write about that funny thing Jelia did yesterday to break the tension, or revisit "${previousEntry.title}".`
      : "Let's pivot and write about that funny thing Jelia did yesterday to break the tension.";

  const curveballSuggestion =
    "Curveball: Close your eyes for 3 seconds. What's the weirdest sound you hear right now, or what is one thing you really want to eat tonight?";

  const lastTypedSnippet = extractLastSentence(editor?.getText() || '');
  const dumpSuggestion = lastTypedSnippet
    ? `Finish this without filtering: 'What I really wanted to say after "${lastTypedSnippet.slice(0, 50)}..." is...'`
    : "Write one raw, unedited sentence about what is actually stalling your train of thought right now.";

  const defaultFallbackSuggestions: SilentGuideSuggestion[] = [
    {
      category: 'historical_pivot',
      label: 'Historically-Linked Pivot',
      badge: 'Past Echo',
      prompt: historicalSuggestion,
      rationale: 'Reconnects present thought with prior memory.',
    },
    {
      category: 'zero_pressure_dump',
      label: 'Zero-Pressure Dump',
      badge: 'Raw Stream',
      prompt: dumpSuggestion,
      rationale: 'Permits completely unfiltered, unstructured output.',
    },
  ];

  const displayedSuggestions: SilentGuideSuggestion[] =
    dynamicSuggestions.length > 0 ? dynamicSuggestions : defaultFallbackSuggestions;

  const getBadgeStyle = (category?: string) => {
    switch (category) {
      case 'historical_pivot':
        return 'text-[#4E6852] font-semibold';
      case 'mood_curveball':
        return 'text-amber-800/85 font-semibold';
      case 'zero_pressure_dump':
        return 'text-[#626860] font-semibold';
      case 'physical_grounding':
        return 'text-teal-800/85 font-semibold';
      case 'sensory_anchor':
        return 'text-sky-800/85 font-semibold';
      case 'perspective_shift':
        return 'text-indigo-800/85 font-semibold';
      default:
        return 'text-[#6F8273] font-semibold';
    }
  };

  const handleInsertPrompt = useCallback(
    (promptText: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent(`<p><em>${promptText}</em></p><p></p>`)
        .run();
      setIsStalled(false);
      setIsStallMenuOpen(false);
      queueDebouncedSave(editor.getHTML());
    },
    [editor, queueDebouncedSave]
  );

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

  // Handle Save Journal (content + tags only, immediately flushes debounced save)
  const handleSaveOnly = useCallback(async () => {
    await flushPendingSave();
  }, [flushPendingSave]);

  // Handle Save and Synthesis (flushes debounced save, then executes synthesis)
  const handleSaveAndSynthesize = useCallback(async () => {
    if (saveStatus === 'saving' || isSynthesizing) return;
    await flushPendingSave();
    const contentHtml = editor && !editor.isDestroyed ? editor.getHTML() : entry?.content || '';
    const titleToSave = currentTitle.trim() || formattedDate;
    if (onSaveAndSynthesize) {
      const updatedEntry = await onSaveAndSynthesize({
        title: titleToSave,
        content: contentHtml,
        tags: currentTags,
        manualTags: manualTags,
      });
      if (updatedEntry && updatedEntry.tags) {
        setCurrentTags(updatedEntry.tags);
        if (updatedEntry.manualTags) {
          setManualTags(updatedEntry.manualTags);
        }
      }
    }
  }, [saveStatus, isSynthesizing, flushPendingSave, editor, entry?.content, currentTitle, formattedDate, onSaveAndSynthesize, currentTags, manualTags]);

  // Seamless Date navigation initiator with immediate flush (no warning popup)
  const handleInitiateDateChange = (targetDate: string) => {
    if (!targetDate || targetDate === journalDate) return;
    setIsCalendarOpen(false);
    setIsFlipPageOpen(false);
    flushPendingSave();
    if (onSelectDate) {
      onSelectDate(targetDate);
    }
  };

  // TRIGGER A (USER ACTION): Flip Page transitions to State C and immediately executes synthesis
  const handleFlipPageClick = useCallback(async () => {
    setPreviousCanvasMode(canvasMode === 'chat' ? 'chat' : 'raw');
    setCanvasMode('synthesis');
    setIsSettingsOpen(false);
    setIsCalendarOpen(false);
    setIsTagsOpen(false);
    setIsFlipPageOpen(false);

    // Flush any pending text memory
    await flushPendingSave();

    // Trigger centralized synthesis API immediately
    const contentHtml = editor && !editor.isDestroyed ? editor.getHTML() : entry?.content || '';
    const titleToSave = currentTitle.trim() || formattedDate;
    if (onSaveAndSynthesize) {
      const updatedEntry = await onSaveAndSynthesize({
        title: titleToSave,
        content: contentHtml,
        tags: currentTags,
        manualTags: manualTags,
      });
      if (updatedEntry && updatedEntry.tags) {
        setCurrentTags(updatedEntry.tags);
        if (updatedEntry.manualTags) {
          setManualTags(updatedEntry.manualTags);
        }
      }
    }
  }, [canvasMode, flushPendingSave, editor, entry?.content, currentTitle, formattedDate, onSaveAndSynthesize, currentTags, manualTags]);

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
      queueDebouncedSave(undefined, undefined, updatedTags, updatedManual);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = currentTags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    const updatedManual = manualTags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    setCurrentTags(updatedTags);
    setManualTags(updatedManual);
    queueDebouncedSave(undefined, undefined, updatedTags, updatedManual);
  };

  const getContextSnippet = (): string => {
    if (entry?.summary) {
      return entry.summary.length > 120 ? entry.summary.slice(0, 120) + '…' : entry.summary;
    }
    if (editor && !editor.isDestroyed) {
      const text = editor.getText().trim();
      if (text) {
        return text.length > 120 ? text.slice(0, 120) + '…' : text;
      }
    }
    if (entry?.content) {
      const plain = entry.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (plain) {
        return plain.length > 120 ? plain.slice(0, 120) + '…' : plain;
      }
    }
    return 'Daily journal reflection draft';
  };

  const handleSendChatMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInputText).trim();
    if (!text || isChatLoading) return;

    setChatError(null);
    const userMsg: ChatMessage = {
      id: generateChatId('user'),
      role: 'user',
      content: text,
      timestamp: getCurrentTimestamp(),
    };

    const newMsgs = [...chatMessages, userMsg];
    setChatMessages(newMsgs);
    setChatInputText('');
    setIsChatLoading(true);

    // Maintain immediate execution: update messages array in Firestore instantly
    let activeEntryId = entry?.id;
    if (user?.uid) {
      try {
        if (activeEntryId) {
          await updateJournalEntry(user.uid, activeEntryId, { messages: newMsgs });
          if (entry) {
            onUpdateEntry?.({ ...entry, messages: newMsgs });
          }
        } else {
          const saved = await saveOrUpdateDailyJournal(user.uid, journalDate, {
            title: currentTitle || formattedDate,
            content: editor && !editor.isDestroyed ? editor.getHTML() : entry?.content || '',
            tags: currentTags,
            manualTags: manualTags,
          });
          activeEntryId = saved.id;
          await updateJournalEntry(user.uid, saved.id, { messages: newMsgs });
          onUpdateEntry?.({ ...saved, messages: newMsgs });
        }
      } catch (chatPersistErr) {
        console.warn('Immediate chat message persistence notice:', chatPersistErr);
      }
    }

    try {
      const journalText = editor && !editor.isDestroyed ? editor.getText() : (entry?.content || '').replace(/<[^>]+>/g, ' ');

      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          messages: newMsgs,
          mode: 'reflection',
          journalContext: journalText,
          journalDate,
          journalTitle: currentTitle,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Reflection service unavailable');
      }

      const resData = await response.json();
      const modelMsg: ChatMessage = {
        id: generateChatId('model'),
        role: 'model',
        content: resData.text || 'I have reflected on your thoughts.',
        timestamp: resData.timestamp || getCurrentTimestamp(),
      };

      const finalMsgs = [...newMsgs, modelMsg];
      setChatMessages(finalMsgs);

      // Persist to Firestore with user boundary validation
      if (user?.uid && activeEntryId) {
        await updateJournalEntry(user.uid, activeEntryId, { messages: finalMsgs });
        if (entry) {
          onUpdateEntry?.({ ...entry, messages: finalMsgs });
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatError(err.message || 'Unable to generate reflection. Please try again.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleCopySynthesisMarkdown = () => {
    let md = `# ${currentTitle || formattedDate}\n\n`;
    md += `*Journal Date: ${formattedDate}*\n\n`;
    if (entry?.summary) {
      md += `## Core Digest\n${entry.summary}\n\n`;
    }
    if (entry?.synthesis) {
      md += `## Reflective Synthesis\n${entry.synthesis}\n\n`;
    }
    if (entry?.keyInsights && entry.keyInsights.length > 0) {
      md += `## Key Takeaways & Insights\n`;
      entry.keyInsights.forEach((item) => {
        md += `- ${item}\n`;
      });
      md += `\n`;
    }
    if (entry?.tags && entry.tags.length > 0) {
      md += `**Themes & Tags:** ${entry.tags.join(', ')}\n\n`;
    }
    navigator.clipboard.writeText(md);
    setCopiedSynthesis(true);
    setTimeout(() => setCopiedSynthesis(false), 2000);
  };

  const getWordAndCharCount = () => {
    let text = '';
    if (editor && !editor.isDestroyed) {
      text = editor.getText().trim();
    } else if (entry?.content) {
      text = entry.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    return { words, chars };
  };

  return (
    <div
      id="daily-journal-canvas"
      className={`flex-1 flex flex-col h-full bg-[#FBF9F5] overflow-y-auto relative select-text ${
        isFocusMode ? 'fixed inset-0 z-50 bg-[#FBF9F5]' : ''
      }`}
    >
      <AnimatePresence mode="wait">
        {canvasMode === 'raw' && (
          <motion.div
            key="canvas-mode-raw"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex-1 flex flex-col w-full h-full"
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
                  queueDebouncedSave(undefined, e.target.value);
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
              {isDebouncePending && (
                <span className="inline-flex items-center gap-1 text-[#7A7E76] text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A3A89F] animate-pulse" /> Auto-saving in 3s...
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

            <div className="h-4 w-px bg-[#E2DED5] mx-0.5 hidden sm:block" />

            {/* Chat Icon - Transitions to State B (The Deep Chat Canvas) */}
            <div className="relative">
              <button
                id="btn-journal-chat"
                onClick={() => {
                  setPreviousCanvasMode('raw');
                  setCanvasMode('chat');
                  setIsSettingsOpen(false);
                  setIsCalendarOpen(false);
                  setIsTagsOpen(false);
                  setIsFlipPageOpen(false);
                }}
                title="Open Deep Chat Canvas (State B)"
                className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-[#EAE7DF]/70 hover:text-[#1A1C18]"
              >
                <MessageSquare className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {/* Flip Page Icon - Transitions to State C (The Synthesis Canvas) */}
            <div className="relative">
              <button
                id="btn-journal-flip-page"
                onClick={handleFlipPageClick}
                title="Flip to Synthesis Canvas (State C)"
                className="p-2 rounded-lg transition-colors cursor-pointer hover:bg-[#EAE7DF]/70 hover:text-[#1A1C18]"
              >
                <BookOpen className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {/* 1. Settings Gear Icon (Hidden from UI) */}
            <div className="hidden">
              <button
                id="btn-journal-settings"
                onClick={() => {
                  setIsSettingsOpen((prev) => !prev);
                  setIsCalendarOpen(false);
                  setIsTagsOpen(false);
                  setIsFlipPageOpen(false);
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
                  setIsFlipPageOpen(false);
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
                  setIsFlipPageOpen(false);
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

                  {/* Existing Tags (All tags look alike, clean and unified) */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {currentTags.length === 0 ? (
                      <span className="text-[11px] text-[#8F948C] italic">
                        No tags assigned to this entry yet.
                      </span>
                    ) : (
                      currentTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-[#EBF3EC] text-[#243B29] border border-[#C8DACB] transition-colors"
                        >
                          <span className="font-medium">#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-[#6F8273] hover:text-red-600 cursor-pointer ml-0.5"
                            title={`Remove #${tag}`}
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
                      type="button"
                      onClick={handleAddTag}
                      className="p-1.5 rounded-lg bg-[#252723] text-white hover:bg-[#3D413A] cursor-pointer"
                      title="Add tag"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Tags on Canvas (All tags look alike, clean and unified without flags) */}
        {currentTags.length > 0 && (
          <div id="journal-canvas-tags" className="flex flex-wrap items-center gap-1.5 pt-3 pb-4 select-none">
            <span className="text-[11px] text-[#8F948C] font-serif italic mr-1">Tags:</span>
            {currentTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-[#EBF3EC] text-[#243B29] border border-[#C8DACB] transition-colors"
              >
                <span className="font-medium">#{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-[#6F8273] hover:text-red-600 cursor-pointer ml-0.5"
                  title={`Remove #${tag}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
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
        <div ref={editorCanvasRef} className="flex-1 min-h-[500px] relative">
          {/* STATE 1: THE EMPTY CANVAS ONBOARDING - The Silent Guide */}
          {isCanvasEmpty && (
            <div
              id="silent-guide-empty-canvas"
              className="absolute top-0 left-0 pt-0.5 pointer-events-none select-none text-[#8A9086]/55 font-serif italic text-base sm:text-lg leading-relaxed transition-opacity duration-200"
            >
              You can dump anything here. No structure, no pressure.
            </div>
          )}

          <EditorContent editor={editor} />

          {/* STATE 2: THE MID-WRITE STALL (45-SECOND IDLE STATE) - The Silent Guide */}
          {isStalled && !isCanvasEmpty && (
            <div
              id="silent-guide-stall-container"
              ref={stallMenuRef}
              className="absolute z-20 select-none transition-all duration-700 ease-out"
              style={
                cursorCoords
                  ? { top: `${cursorCoords.top}px`, left: `${cursorCoords.left}px` }
                  : { bottom: '28px', left: '16px' }
              }
            >
              {/* Ultra-faint (20% opacity) minimalist icon just below cursor line */}
              <button
                id="btn-silent-guide-sparkle"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextOpen = !isStallMenuOpen;
                  setIsStallMenuOpen(nextOpen);
                  if (nextOpen && dynamicSuggestions.length === 0 && editor) {
                    fetchDynamicSuggestions(editor.getText() || '');
                  }
                }}
                title="The Silent Guide: Click for friendly momentum recommendations"
                className={`p-1.5 rounded-full cursor-pointer transition-all duration-500 ${
                  isStallMenuOpen
                    ? 'opacity-100 bg-[#2F4133] text-white shadow-md scale-105'
                    : 'opacity-20 hover:opacity-85 text-[#4E544B] hover:text-[#1A1C18] hover:bg-[#EAE7DF] hover:scale-110'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>

              {/* Floating Micro-Menu (Completely un-bordered) */}
              {isStallMenuOpen && (
                <div
                  id="silent-guide-micro-menu"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 w-[320px] sm:w-[380px] max-w-[calc(100vw-3rem)] bg-[#FAF8F5]/98 text-[#252723] rounded-2xl shadow-2xl p-4 border-0 border-none ring-0 space-y-3 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 text-left select-text"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-[#EAE7DF]/70">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-[#6F746C]">
                      <Sparkles className="w-3 h-3 text-[#506A55]" />
                      <span>The Silent Guide</span>
                      {suggestionTone && (
                        <span className="text-[9px] lowercase font-normal px-1.5 py-0.5 rounded-full bg-[#EAE7DF]/70 text-[#545A50] tracking-normal">
                          {suggestionTone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchDynamicSuggestions(editor?.getText() || '', true);
                        }}
                        disabled={isGeneratingSuggestions}
                        className="text-[#9BA098] hover:text-[#252723] p-1 rounded-md hover:bg-[#EAE7DF]/50 cursor-pointer transition-colors"
                        title="Refresh dynamic sparks"
                      >
                        <RotateCw
                          className={`w-3 h-3 ${
                            isGeneratingSuggestions ? 'animate-spin text-[#506A55]' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsStallMenuOpen(false)}
                        className="text-[#9BA098] hover:text-[#252723] p-1 rounded-md hover:bg-[#EAE7DF]/50 cursor-pointer transition-colors"
                        title="Dismiss guide"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#6F746C] leading-snug">
                    {isGeneratingSuggestions && dynamicSuggestions.length === 0
                      ? 'Sensing your writing flow and reading historical context...'
                      : 'Stalled on thoughts? Pick a friendly spark tailored to your immediate flow:'}
                  </p>

                  {isGeneratingSuggestions && dynamicSuggestions.length === 0 ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 text-[#6F746C]">
                      <Sparkles className="w-5 h-5 animate-spin text-[#506A55]" />
                      <p className="text-xs font-serif italic text-[#3C4238]">
                        The Silent Guide is sensing your momentum...
                      </p>
                      <span className="text-[10px] text-[#8F948C]">
                        Reading tone and previous journal echoes
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-0.5">
                      {displayedSuggestions.map((item, idx) => (
                        <button
                          key={`${item.category}-${idx}`}
                          type="button"
                          onClick={() => handleInsertPrompt(item.prompt)}
                          className="w-full text-left p-2.5 rounded-xl bg-white/85 hover:bg-white text-xs text-[#252723] transition-all hover:shadow-xs group cursor-pointer border border-[#EAE7DF]/40 hover:border-[#D5D0C5]"
                        >
                          <div className="flex items-center justify-between text-[10px] uppercase font-medium tracking-wider mb-1">
                            <span className={getBadgeStyle(item.category)}>
                              {item.label || item.badge}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#2F4133] font-medium">
                              Insert ↵
                            </span>
                          </div>
                          <p className="font-serif italic text-[13px] text-[#2B3028] leading-relaxed">
                            &ldquo;{item.prompt}&rdquo;
                          </p>
                          {item.rationale && (
                            <p className="mt-1 text-[9px] text-[#8A9086] line-clamp-1 italic">
                              {item.rationale}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[10px] text-[#8F948C]">
                    <span>Tip: Simply typing closes this instantly.</span>
                    <button
                      type="button"
                      onClick={() => setIsStallMenuOpen(false)}
                      className="hover:text-[#252723] underline cursor-pointer"
                    >
                      Resume Writing
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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


    </motion.div>
  )}

  {/* STATE B: THE DEEP CHAT CANVAS (Conversation Mode) */}
  {canvasMode === 'chat' && (
    <motion.div
      key="canvas-mode-chat"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex-1 flex flex-col w-full h-full bg-[#FAF8F5] select-text"
    >
      {/* Contextual Header for State B */}
      <div className="px-6 sm:px-12 py-4 border-b border-[#EAE7DF] bg-[#FAF8F5] flex items-center justify-between gap-4 shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="btn-journal-canvas-back-top"
            onClick={() => setCanvasMode('raw')}
            title="Return to Journal Canvas"
            className="p-1.5 rounded-lg text-[#5A6057] hover:bg-[#EAE7DF] hover:text-[#1A1C18] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg text-[#1A1C18] truncate">
                {currentTitle || formattedDate}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#4F574E]">
                Deep Chat
              </span>
            </div>
            <p className="text-[11px] text-[#737872] truncate">
              {formattedDate} • Conversational Companion
            </p>
          </div>
        </div>

        {/* Header Actions Cluster */}
        <div className="flex items-center gap-2">
          {/* Dynamic 'Journal Canvas' action button */}
          <button
            id="btn-journal-canvas-back"
            onClick={() => setCanvasMode('raw')}
            title="Return to Journal Canvas (State A)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D5D2C8] bg-white text-[#2B3028] hover:bg-[#F3EFE6] hover:border-[#C4BFB2] transition-colors cursor-pointer shadow-xs"
          >
            <PenLine className="w-3.5 h-3.5 text-[#6F8273]" />
            <span>Journal Canvas</span>
          </button>

          {/* Flip Page Icon: Routes directly to State C */}
          <button
            id="btn-journal-flip-page-from-chat"
            onClick={handleFlipPageClick}
            title="Flip to Synthesis Canvas (State C)"
            className="p-2 rounded-lg text-[#5A6057] hover:bg-[#EAE7DF]/70 hover:text-[#1A1C18] transition-colors cursor-pointer"
          >
            <BookOpen className="w-5 h-5 stroke-[1.75]" />
          </button>
        </div>
      </div>

      {/* Context Anchor Line */}
      <div
        id="chat-context-anchor"
        className="px-6 sm:px-12 py-2.5 bg-[#F6F4EE]/90 border-b border-[#EAE7DF] text-xs text-[#737872] flex items-center justify-between gap-3 shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <Sparkles className="w-3.5 h-3.5 text-[#6F8273] shrink-0" />
          <span className="font-semibold uppercase tracking-wider text-[10px] text-[#6F8273] shrink-0">
            Context Anchor
          </span>
          <span className="text-[#B5B0A4] shrink-0">•</span>
          <span className="font-serif italic truncate text-[#373B34]">
            {currentTitle || formattedDate}: &ldquo;{getContextSnippet()}&rdquo;
          </span>
        </div>
        <span className="text-[10px] text-[#8F948C] shrink-0 font-sans hidden md:inline-block">
          Anchored to {journalDate}
        </span>
      </div>

      {/* Conversational Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 flex flex-col justify-between">
        <div className="max-w-3xl w-full mx-auto space-y-6 flex-1">
          {chatMessages.length === 0 ? (
            <div className="py-12 text-center space-y-6 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-full bg-[#EAE7DF] mx-auto flex items-center justify-center text-[#5A6057]">
                <MessageSquare className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-xl font-serif text-[#1A1C18]">
                  Deep Reflection for {formattedDate}
                </h3>
                <p className="text-sm text-[#737872] mt-2 leading-relaxed font-serif">
                  Explore themes, clarify emotions, or unpack patterns rooted in your journal entry for this day.
                </p>
              </div>

              {/* Starter prompt chips */}
              <div className="pt-2 space-y-2 text-left">
                <p className="text-[11px] uppercase tracking-wider text-[#8F948C] text-center font-medium">
                  Suggested Reflection Prompts
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    'What deeper feeling or need lies beneath my journal today?',
                    'What blind spots or limiting perspectives might I be holding onto?',
                    'What is one gentle, compassionate action I can take next?',
                    'Help me synthesize the emotional arc of this entry.',
                  ].map((promptText, idx) => (
                    <button
                      key={idx}
                      id={`btn-starter-prompt-${idx}`}
                      onClick={() => handleSendChatMessage(promptText)}
                      className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-[#E5E7E2] bg-white hover:bg-[#F7F5F0] hover:border-[#D5D2C8] text-[#373B34] transition-colors cursor-pointer"
                    >
                      &ldquo;{promptText}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-[#8F948C]">
                    <span className="font-medium text-[#5A6057]">
                      {msg.role === 'user' ? 'You' : 'Gemini Companion'}
                    </span>
                    <span>•</span>
                    <span>
                      {msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  <div
                    className={`relative max-w-2xl px-5 py-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#2F4133] text-white rounded-br-xs'
                        : 'bg-white border border-[#E5E7E2] text-[#252723] rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap font-serif">{msg.content}</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="prose prose-sm prose-stone max-w-none text-[#252723] font-serif leading-relaxed">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        <div className="flex items-center justify-end pt-2 border-t border-[#F0EFEA] mt-3">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            title="Copy response"
                            className="text-[11px] text-[#8F948C] hover:text-[#1A1C18] flex items-center gap-1 cursor-pointer"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-[#8F948C]">
                    <span className="font-medium text-[#5A6057]">Gemini Companion</span>
                    <span>•</span>
                    <span>Reflecting</span>
                  </div>
                  <div className="bg-white border border-[#E5E7E2] rounded-2xl rounded-bl-xs px-5 py-3.5 shadow-xs flex items-center gap-2.5 text-xs text-[#737872]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#6F8273]" />
                    <span className="font-serif italic">Attuning to your reflections...</span>
                  </div>
                </div>
              )}

              {chatError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
                  <span>{chatError}</span>
                  <button
                    onClick={() => setChatError(null)}
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Composer */}
        <div className="max-w-3xl w-full mx-auto pt-4 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage();
            }}
            className="bg-white border border-[#D5D2C8] focus-within:border-[#6F8273] rounded-2xl p-2 shadow-xs transition-colors"
          >
            <textarea
              id="chat-input-textarea"
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
              placeholder={`Reflect on ${formattedDate} (Press Enter to send, Shift+Enter for newline)...`}
              rows={2}
              className="w-full bg-transparent px-3 py-1 text-sm text-[#1A1C18] placeholder-[#989E95] focus:outline-none resize-none font-serif leading-relaxed"
            />
            <div className="flex items-center justify-between px-2 pt-1 border-t border-[#F0ECE1]">
              <div className="flex items-center gap-1.5 text-[11px] text-[#8F948C]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#6F8273]" />
                <span>Encrypted in Cloud Firestore</span>
              </div>
              <button
                id="btn-send-chat-message"
                type="submit"
                disabled={!chatInputText.trim() || isChatLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#2F4133] text-white hover:bg-[#202E24] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {isChatLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  )}

  {/* STATE C: THE SYNTHESIS CANVAS (Insights Mode) */}
  {canvasMode === 'synthesis' && (
    <motion.div
      key="canvas-mode-synthesis"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex-1 flex flex-col w-full h-full bg-[#FAF8F5] overflow-y-auto select-text"
    >
      {/* Contextual Toolbar for State C with Dynamic Back-Routing */}
      <div className="px-6 sm:px-12 py-4 border-b border-[#EAE7DF] bg-[#FAF8F5] flex items-center justify-between gap-4 shrink-0 select-none sticky top-0 z-20 backdrop-blur-xs">
        <div className="flex items-center gap-3 min-w-0">
          {/* Dynamic Back-Routing Button */}
          <button
            id="btn-synthesis-back"
            onClick={() => setCanvasMode(previousCanvasMode)}
            title={`Return to ${previousCanvasMode === 'chat' ? 'Deep Chat' : 'Journal Canvas'}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D5D2C8] bg-white text-[#2B3028] hover:bg-[#F3EFE6] transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#6F8273]" />
            <span>
              {previousCanvasMode === 'chat' ? 'Back to Deep Chat' : 'Back to Journal Canvas'}
            </span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg text-[#1A1C18] truncate">
                {currentTitle || formattedDate}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#EAE7DF] text-[#4F574E]">
                Synthesis Canvas
              </span>
            </div>
            <p className="text-[11px] text-[#737872] truncate">
              {formattedDate} • 5-Key Architectural Metadata
            </p>
          </div>
        </div>

        {/* Right Toolbar Cluster */}
        <div className="flex items-center gap-2">
          <button
            id="btn-synthesis-to-raw"
            onClick={() => setCanvasMode('raw')}
            title="Switch to Journal Canvas (State A)"
            className="p-2 rounded-lg text-[#5A6057] hover:bg-[#EAE7DF] hover:text-[#1A1C18] transition-colors cursor-pointer"
          >
            <PenLine className="w-4 h-4" />
          </button>
          <button
            id="btn-synthesis-to-chat"
            onClick={() => {
              setPreviousCanvasMode('raw');
              setCanvasMode('chat');
            }}
            title="Switch to Deep Chat (State B)"
            className="p-2 rounded-lg text-[#5A6057] hover:bg-[#EAE7DF] hover:text-[#1A1C18] transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-[#E2DED5] mx-0.5 hidden sm:block" />
          <button
            id="btn-synthesis-export-markdown"
            onClick={handleCopySynthesisMarkdown}
            title="Copy synthesis summary as Markdown"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D5D2C8] bg-white text-[#2B3028] hover:bg-[#F3EFE6] transition-colors cursor-pointer shadow-xs"
          >
            {copiedSynthesis ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied MD</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#5A6057]" />
                <span>Export MD</span>
              </>
            )}
          </button>
          <button
            id="btn-synthesis-resynthesize"
            onClick={handleSaveAndSynthesize}
            disabled={isSynthesizing || saveStatus === 'saving'}
            title="Re-synthesize this journal reflection with Gemini AI"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2F4133] text-white hover:bg-[#202E24] transition-colors cursor-pointer shadow-xs disabled:opacity-60"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin text-amber-200' : ''}`}
            />
            <span>{isSynthesizing ? 'Synthesizing...' : 'Re-Synthesize'}</span>
          </button>
        </div>
      </div>

      {/* 5-Key Spacious Metadata Content Area */}
      <div className="max-w-4xl w-full mx-auto px-6 sm:px-12 py-10 sm:py-16 space-y-12">
        {!entry?.summary && !entry?.synthesis && (!entry?.keyInsights || entry.keyInsights.length === 0) ? (
          <div className="py-16 text-center space-y-5 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-full bg-[#EAE7DF] mx-auto flex items-center justify-center text-[#5A6057]">
              <Feather className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div>
              <h3 className="text-2xl font-serif text-[#1A1C18]">
                No Synthesis Generated Yet
              </h3>
              <p className="text-sm text-[#737872] mt-2 font-serif leading-relaxed">
                Transform your writing from {formattedDate} into distilled thematic insights, emotional arcs, and core takeaways.
              </p>
            </div>
            <button
              id="btn-synthesis-generate-now"
              onClick={handleSaveAndSynthesize}
              disabled={isSynthesizing || saveStatus === 'saving'}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-xl bg-[#2F4133] text-white hover:bg-[#202E24] transition-colors cursor-pointer shadow-xs"
            >
              {isSynthesizing ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-300" />
              )}
              <span>Synthesize Today&apos;s Journal</span>
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Executive Summary / Core Digest (Hidden from UI) */}
            <section id="synthesis-key-1-core-digest" className="hidden">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6F8273] font-semibold">
                <Quote className="w-3.5 h-3.5" />
                <span>Core Digest</span>
              </div>
              <div className="pl-4 sm:pl-6 border-l-2 border-[#6F8273] py-1">
                <p className="text-lg sm:text-xl font-serif italic text-[#1A1C18] leading-relaxed">
                  &ldquo;{entry?.summary || 'Summary unavailable'}&rdquo;
                </p>
              </div>
            </section>

            {/* Reflective Synthesis */}
            <section id="synthesis-key-2-reflective-synthesis" className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6F8273] font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Reflective Synthesis</span>
              </div>
              <div className="prose prose-stone max-w-none text-[#2B3028] font-serif leading-relaxed text-base whitespace-pre-line">
                {entry?.synthesis || 'Synthesis in progress...'}
              </div>
            </section>

            {/* Synthesized Key Insights & Takeaways */}
            <section id="synthesis-key-3-insights" className="space-y-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6F8273] font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Key Insights &amp; Takeaways</span>
              </div>
              {entry?.keyInsights && entry.keyInsights.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {entry.keyInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[#E5E7E2] bg-white text-xs sm:text-sm text-[#2B3028] leading-relaxed font-serif flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#EAE7DF] text-[#4F574E] text-[10px] font-sans font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="flex-1">{insight}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8F948C] font-serif italic">
                  No distinct takeaways itemized.
                </p>
              )}
            </section>

            {/* KEY 4: Thematic Tags & Explored Concepts */}
            <section id="synthesis-key-4-tags" className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6F8273] font-semibold">
                <Tag className="w-3.5 h-3.5" />
                <span>Key 4: Thematic Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {entry?.tags && entry.tags.length > 0 ? (
                  entry.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#EAE7DF] text-[#373B34] border border-[#D5D2C8]"
                    >
                      <Hash className="w-3 h-3 text-[#6F8273]" />
                      <span>{t}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#8F948C] font-serif italic">
                    No tags assigned yet.
                  </span>
                )}
              </div>
            </section>

            {/* KEY 5: Architectural & Temporal Metadata */}
            <section id="synthesis-key-5-metadata" className="space-y-3 pt-6 border-t border-[#EAE7DF]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#6F8273] font-semibold">
                <FileText className="w-3.5 h-3.5" />
                <span>Key 5: Architectural &amp; Temporal Metadata</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E7E2] rounded-xl text-xs space-y-1">
                  <span className="text-[#8F948C] block text-[10px] uppercase">Word Count</span>
                  <span className="font-semibold text-sm text-[#1A1C18]">
                    {getWordAndCharCount().words} words
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E7E2] rounded-xl text-xs space-y-1">
                  <span className="text-[#8F948C] block text-[10px] uppercase">Format</span>
                  <span className="font-semibold text-sm text-[#1A1C18]">
                    Daily Primary
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E7E2] rounded-xl text-xs space-y-1">
                  <span className="text-[#8F948C] block text-[10px] uppercase">Created</span>
                  <span className="font-semibold text-xs text-[#1A1C18] block truncate">
                    {entry?.createdAt ? new Date(entry.createdAt).toLocaleDateString() : formattedDate}
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5E7E2] rounded-xl text-xs space-y-1">
                  <span className="text-[#8F948C] block text-[10px] uppercase">Persistence</span>
                  <div className="flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Firestore Verified</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
    </div>
  );
}
