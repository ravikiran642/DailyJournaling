'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  JournalEntry,
  ChatMessage,
  ReflectionMode,
  EchoReference,
} from '@/lib/types';
import {
  subscribeToUserJournalEntries,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  saveOrUpdateDailyJournal,
} from '@/lib/firestore-service';
import {
  syncEntryEmbedding,
  syncMissingHistoricalEmbeddings,
} from '@/lib/embedding-sync';
import { getLocalCalendarDate } from '@/lib/utils';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { ReflectionChat } from './ReflectionChat';
import { DailyJournalEditor } from './DailyJournalEditor';
import { InsightsPanel } from './InsightsPanel';
import {
  Menu,
  Brain,
  AlertCircle,
  X,
  BookOpen,
} from 'lucide-react';

export function JournalDashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [currentMode, setCurrentMode] = useState<ReflectionMode>('reflection');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  // Daily Journaling State
  const [viewMode, setViewMode] = useState<'daily' | 'chat'>('daily');
  const [activeJournalDate, setActiveJournalDate] = useState<string>(getLocalCalendarDate());
  const [dailyEntry, setDailyEntry] = useState<JournalEntry | null>(null);
  const [isSynthesizingDaily, setIsSynthesizingDaily] = useState(false);
  const [dailySynthesisError, setDailySynthesisError] = useState<string | null>(null);
  const [lastDailySavedAt, setLastDailySavedAt] = useState<Date | null>(null);

  // Echoes semantic memory state
  const [detectedEchoes, setDetectedEchoes] = useState<EchoReference[]>([]);
  const [isSearchingEchoes, setIsSearchingEchoes] = useState(false);
  const dismissedEchoIdsRef = useRef<Set<string>>(new Set());
  const initialSyncCompletedRef = useRef(false);

  const confirmedEchoes = selectedEntry?.confirmedEchoContext || [];

  // Find today's daily entry for the sidebar badge / quick select
  const todayStr = getLocalCalendarDate();
  const todayEntry = entries.find(
    (e) => e.journalDate === todayStr && (e.isDailyPrimary || e.content)
  ) || null;

  // Subscribe to real-time Firestore updates for this user
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserJournalEntries(
      user.uid,
      (userEntries) => {
        setEntries(userEntries);

        // Keep selectedEntry reference fresh
        setSelectedEntry((prev) => {
          if (!prev) return null;
          const updated = userEntries.find((e) => e.id === prev.id);
          return updated || prev;
        });

        // Keep dailyEntry reference fresh for current active date
        setDailyEntry((prev) => {
          const match = userEntries.find(
            (e) => e.journalDate === activeJournalDate && (e.isDailyPrimary || e.content)
          );
          return match || prev;
        });

        // Background sync missing embeddings for existing memories
        if (!initialSyncCompletedRef.current && userEntries.length > 0) {
          initialSyncCompletedRef.current = true;
          syncMissingHistoricalEmbeddings(user.uid, userEntries).catch((err) => {
            console.warn('Initial historical embeddings sync error:', err);
          });
        }
      },
      (err) => {
        console.error('Realtime Firestore subscription error:', err);
        setErrorMessage('Failed to load journal history from Firestore.');
      }
    );

    return () => unsubscribe();
  }, [user?.uid, activeJournalDate]);

  // Handle selecting "Today's Journal"
  const handleSelectToday = useCallback(() => {
    const today = getLocalCalendarDate();
    setActiveJournalDate(today);
    setViewMode('daily');
    const match = entries.find(
      (e) => e.journalDate === today && (e.isDailyPrimary || e.content)
    );
    setDailyEntry(match || null);
    if (match) setSelectedEntry(match);
  }, [entries]);

  // Handle starting a fresh reflection
  const handleNewReflection = useCallback(() => {
    setViewMode('chat');
    setSelectedEntry(null);
    setErrorMessage(null);
    setDetectedEchoes([]);
    dismissedEchoIdsRef.current.clear();
  }, []);

  // Handle selecting an entry from sidebar
  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    if (entry.content !== undefined || entry.isDailyPrimary) {
      // It's a daily journal entry
      setViewMode('daily');
      setActiveJournalDate(entry.journalDate || getLocalCalendarDate());
      setDailyEntry(entry);
      setSelectedEntry(entry);
    } else {
      // It's a chat reflection
      setViewMode('chat');
      setSelectedEntry(entry);
      setCurrentMode(entry.reflectionType);
    }
    setDetectedEchoes([]);
    dismissedEchoIdsRef.current.clear();
  }, []);

  // Save or update daily journal from the rich-text editor
  const handleSaveDailyJournal = async ({ title, content }: { title: string; content: string }) => {
    if (!user?.uid) return;

    setSyncStatus('saving');
    setErrorMessage(null);
    try {
      const saved = await saveOrUpdateDailyJournal(user.uid, activeJournalDate, {
        id: dailyEntry?.id,
        content,
        title,
      });

      setDailyEntry(saved);
      setSelectedEntry(saved);
      setLastDailySavedAt(new Date());
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 3000);

      // Asynchronously trigger AI reflective synthesis in the background post-save
      // if text is substantive and synthesis has not already run on this version
      const plain = content.replace(/<[^>]+>/g, ' ').trim();
      if (plain.length >= 30) {
        triggerDailySynthesis(saved, content, activeJournalDate);
      }
    } catch (err: any) {
      console.error('Failed to save daily journal:', err);
      setSyncStatus('error');
      setErrorMessage('Failed to save journal to Firestore.');
    }
  };

  // Background AI synthesis for daily journal
  const triggerDailySynthesis = async (
    entryToSynthesize: JournalEntry,
    contentHtml: string,
    dateStr: string
  ) => {
    if (!user?.uid) return;
    setIsSynthesizingDaily(true);
    setDailySynthesisError(null);

    try {
      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentHtml,
          journalDate: dateStr,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to synthesize journal');
      }

      const data = await res.json();
      const updates: Partial<JournalEntry> = {
        synthesis: data.synthesis || '',
        summary: data.summary || '',
        keyInsights: data.keyInsights || [],
        observations: data.observations || [],
        tags: data.tags || entryToSynthesize.tags || [],
      };

      await updateJournalEntry(user.uid, entryToSynthesize.id, updates);

      const updated = {
        ...entryToSynthesize,
        ...updates,
      };

      setDailyEntry(updated);
      setSelectedEntry(updated);

      // Background sync vector embedding for semantic memory & echoes
      syncEntryEmbedding(user.uid, updated).catch((err) =>
        console.warn('Post-daily-synthesis embedding sync error:', err)
      );
    } catch (err: any) {
      console.warn('Background synthesis error:', err);
      setDailySynthesisError(err.message || 'AI synthesis delayed or unavailable.');
    } finally {
      setIsSynthesizingDaily(false);
    }
  };

  // Retry daily synthesis on user request
  const handleRetryDailySynthesis = async () => {
    if (!dailyEntry || !dailyEntry.content) return;
    await triggerDailySynthesis(dailyEntry, dailyEntry.content, activeJournalDate);
  };

  // Update draft title
  const handleUpdateTitle = async (newTitle: string) => {
    if (!selectedEntry || !user?.uid) return;
    try {
      setSelectedEntry((prev) => (prev ? { ...prev, title: newTitle } : null));
      await updateJournalEntry(user.uid, selectedEntry.id, { title: newTitle });
    } catch (err: any) {
      console.error('Failed to update title:', err);
    }
  };

  // Perform asynchronous Echo detection against user's historical corpus
  const searchForEchoes = async (promptText: string, activeEntryId: string, currentCandidateEntries: JournalEntry[]) => {
    if (!promptText || promptText.length < 15 || !user?.uid) return;

    // Filter historical candidates that have embeddings and exclude the current entry
    const validCandidates = currentCandidateEntries.filter(
      (e) => e.id !== activeEntryId && Array.isArray(e.embedding) && e.embedding.length > 0
    );

    if (validCandidates.length === 0) return;

    try {
      setIsSearchingEchoes(true);
      const res = await fetch('/api/gemini/echoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrompt: promptText,
          currentEntryId: activeEntryId,
          candidates: validCandidates.map((c) => ({
            id: c.id,
            title: c.title,
            summary: c.summary,
            initialPrompt: c.initialPrompt,
            tags: c.tags,
            keyInsights: c.keyInsights,
            createdAt: c.createdAt,
            embedding: c.embedding,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.hasEcho && Array.isArray(data.echoes)) {
          // Filter out echoes already dismissed or already confirmed
          const newEchoes = data.echoes.filter(
            (e: EchoReference) =>
              !dismissedEchoIdsRef.current.has(e.entryId) &&
              !confirmedEchoes.some((ce) => ce.entryId === e.entryId)
          );

          if (newEchoes.length > 0) {
            setDetectedEchoes((prev) => {
              const existingIds = new Set(prev.map((p) => p.entryId));
              const combined = [...prev, ...newEchoes.filter((ne: EchoReference) => !existingIds.has(ne.entryId))];
              return combined;
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Echo Detection] Non-blocking warning:', err);
    } finally {
      setIsSearchingEchoes(false);
    }
  };

  // User confirms an Echo connection
  const handleConfirmEcho = async (echo: EchoReference) => {
    if (!user?.uid || !selectedEntry) return;

    const updatedConfirmed = [...confirmedEchoes.filter((e) => e.entryId !== echo.entryId), echo];
    // Remove from unconfirmed detected list
    setDetectedEchoes((prev) => prev.filter((e) => e.entryId !== echo.entryId));
    setSelectedEntry((prev) => (prev ? { ...prev, confirmedEchoContext: updatedConfirmed } : null));

    try {
      await updateJournalEntry(user.uid, selectedEntry.id, {
        confirmedEchoContext: updatedConfirmed,
      });
    } catch (err) {
      console.error('Failed to persist confirmed echo context:', err);
    }
  };

  // User dismisses or disconnects an Echo
  const handleDismissEcho = async (echo: EchoReference) => {
    dismissedEchoIdsRef.current.add(echo.entryId);
    setDetectedEchoes((prev) => prev.filter((e) => e.entryId !== echo.entryId));

    const updatedConfirmed = confirmedEchoes.filter((e) => e.entryId !== echo.entryId);
    setSelectedEntry((prev) => (prev ? { ...prev, confirmedEchoContext: updatedConfirmed } : null));

    if (user?.uid && selectedEntry) {
      try {
        await updateJournalEntry(user.uid, selectedEntry.id, {
          confirmedEchoContext: updatedConfirmed,
        });
      } catch (err) {
        console.error('Failed to update dismissed echo context:', err);
      }
    }
  };

  // Handle sending a user message in multi-turn conversation
  const handleSendMessage = async (content: string, customTitle?: string) => {
    if (!user?.uid) return;

    setErrorMessage(null);
    setIsAiLoading(true);
    setSyncStatus('saving');

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    let activeEntryId = selectedEntry?.id;
    let currentMessages = selectedEntry?.messages ? [...selectedEntry.messages, userMessage] : [userMessage];
    let titleToUse = customTitle || selectedEntry?.title || content.slice(0, 45) + (content.length > 45 ? '...' : '');

    try {
      // Step 1: Save/update initial user message to Firestore immediately (Guaranteed Transaction Integrity)
      let persistedEntry: JournalEntry;
      if (!activeEntryId) {
        persistedEntry = await saveJournalEntry(user.uid, {
          userId: user.uid,
          title: titleToUse,
          reflectionType: currentMode,
          initialPrompt: content,
          messages: currentMessages,
          tags: [currentMode.charAt(0).toUpperCase() + currentMode.slice(1)],
          confirmedEchoContext: confirmedEchoes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        activeEntryId = persistedEntry.id;
        setSelectedEntry(persistedEntry);
      } else {
        await updateJournalEntry(user.uid, activeEntryId, {
          messages: currentMessages,
          title: titleToUse,
          confirmedEchoContext: confirmedEchoes,
        });
        setSelectedEntry((prev) =>
          prev ? { ...prev, messages: currentMessages, title: titleToUse } : null
        );
      }

      // Trigger asynchronous Echoes semantic memory check in background
      searchForEchoes(content, activeEntryId, entries);

      // Step 2: Request Gemini AI reflection with Fallback Protocol and confirmed Echo context
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: content,
          mode: currentMode,
          messages: currentMessages.slice(0, -1), // Prior history
          confirmedEchoContext: confirmedEchoes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Gemini API returned status ${response.status}`);
      }

      const { text } = await response.json();

      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        content: text,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...currentMessages, aiMessage];

      // Step 3: Save AI reflection to Firestore
      await updateJournalEntry(user.uid, activeEntryId, {
        messages: finalMessages,
      });

      const updatedEntryObj: JournalEntry = {
        ...(selectedEntry || persistedEntry!),
        messages: finalMessages,
      };

      setSelectedEntry(updatedEntryObj);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 3000);

      // Asynchronously embed entry if substantive
      if (finalMessages.length >= 2) {
        syncEntryEmbedding(user.uid, updatedEntryObj).catch((e) =>
          console.warn('Background embed sync error:', e)
        );
      }
    } catch (err: any) {
      console.error('Error during reflection flow:', err);
      setErrorMessage(err.message || 'Failed to complete reflection interaction.');
      setSyncStatus('error');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle generating executive summary & insights
  const handleGenerateSummary = async () => {
    if (!selectedEntry || !user?.uid) {
      return;
    }
    const hasMessages = (selectedEntry.messages?.length ?? 0) > 0;
    const hasContent = Boolean(selectedEntry.content && selectedEntry.content.trim());
    if (!hasMessages && !hasContent) {
      return;
    }

    setIsSummarizing(true);
    setSyncStatus('saving');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          hasContent
            ? {
                content: selectedEntry.content,
                journalDate: selectedEntry.journalDate || activeJournalDate,
              }
            : {
                messages: selectedEntry.messages || [],
                initialPrompt: selectedEntry.initialPrompt,
              }
        ),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to synthesize summary');
      }

      const { title, summary, keyInsights, tags } = await response.json();

      const updates: Partial<JournalEntry> = {
        summary,
        keyInsights,
        tags: tags && tags.length > 0 ? tags : selectedEntry.tags,
        ...(title && !selectedEntry.title ? { title } : {}),
      };

      await updateJournalEntry(user.uid, selectedEntry.id, updates);

      const updatedEntry: JournalEntry = {
        ...selectedEntry,
        ...updates,
      };

      setSelectedEntry(updatedEntry);
      setSyncStatus('saved');
      setIsInsightsOpen(true);
      setTimeout(() => setSyncStatus('idle'), 3000);

      // Immediately generate and persist semantic vector embedding for the summarized reflection
      syncEntryEmbedding(user.uid, updatedEntry).catch((err) =>
        console.warn('Post-summary embedding sync error:', err)
      );
    } catch (err: any) {
      console.error('Summarize error:', err);
      setErrorMessage(err.message || 'Failed to generate AI summary.');
      setSyncStatus('error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle entry deletion
  const handleDeleteEntry = async (entryId: string) => {
    if (!user?.uid) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
      if (selectedEntry?.id === entryId) {
        setSelectedEntry(null);
        setDetectedEchoes([]);
        dismissedEchoIdsRef.current.clear();
      }
    } catch (err: any) {
      console.error('Failed to delete entry:', err);
      setErrorMessage('Failed to delete journal entry.');
    }
  };

  const activeInsightsEntry = viewMode === 'daily' ? dailyEntry : selectedEntry;

  return (
    <div id="journal-app-root" className="h-screen w-screen flex flex-col bg-[#FAFAF7] text-[#252723] overflow-hidden">
      {/* Top Navigation */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={(mode) => {
          setCurrentMode(mode);
          setViewMode('chat');
          if (selectedEntry) {
            setSelectedEntry(null); // Fresh entry in this mode
            setDetectedEchoes([]);
            dismissedEchoIdsRef.current.clear();
          }
        }}
        syncStatus={syncStatus}
        onNewReflection={handleNewReflection}
        onSelectToday={handleSelectToday}
        isTodayActive={viewMode === 'daily' && activeJournalDate === todayStr}
        viewMode={viewMode}
        onSelectViewMode={(newView) => {
          setViewMode(newView);
          if (newView === 'daily') {
            handleSelectToday();
          }
        }}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          id="global-error-toast"
          className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-2 text-xs flex items-center justify-between z-30 shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 text-red-600 hover:text-red-900 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Sub-header to open library & insights */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2 bg-[#F3F4EF] border-b border-[#E5E7E2] text-xs">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E5E7E2] bg-white text-[#252723] text-xs font-medium cursor-pointer shadow-xs"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#6F8273]" />
          <span>Library ({entries.length})</span>
        </button>

        {activeInsightsEntry && (
          <button
            onClick={() => setIsInsightsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E5E7E2] bg-white text-[#252723] text-xs font-medium cursor-pointer shadow-xs"
          >
            <Brain className="w-3.5 h-3.5 text-[#6F8273]" />
            <span>{isInsightsOpen ? 'Hide Synthesis' : 'Reflective Layer'}</span>
          </button>
        )}
      </div>

      {/* Main Workspace: Sidebar + Center Writing Canvas + Insights */}
      <div id="workspace-layout" className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          entries={entries}
          selectedEntryId={
            viewMode === 'daily' ? dailyEntry?.id || null : selectedEntry?.id || null
          }
          onSelectEntry={handleSelectEntry}
          onNewReflection={handleNewReflection}
          onSelectToday={handleSelectToday}
          todayEntry={todayEntry}
          onDeleteEntry={handleDeleteEntry}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Center Writing Canvas: Dedicated Daily Journal Editor OR Guided Reflection */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          {viewMode === 'daily' ? (
            <DailyJournalEditor
              entry={dailyEntry}
              journalDate={activeJournalDate}
              onSave={handleSaveDailyJournal}
              saveStatus={syncStatus}
              isSynthesizing={isSynthesizingDaily}
              synthesisError={dailySynthesisError}
              onRetrySynthesis={handleRetryDailySynthesis}
              lastSavedAt={lastDailySavedAt}
              onOpenSynthesisDrawer={() => setIsInsightsOpen((prev) => !prev)}
              isSynthesisDrawerOpen={isInsightsOpen}
            />
          ) : (
            <ReflectionChat
              currentEntry={selectedEntry}
              mode={currentMode}
              onSendMessage={handleSendMessage}
              onGenerateSummary={handleGenerateSummary}
              isLoading={isAiLoading}
              isSummarizing={isSummarizing}
              onUpdateTitle={handleUpdateTitle}
              detectedEchoes={detectedEchoes}
              confirmedEchoes={confirmedEchoes}
              onConfirmEcho={handleConfirmEcho}
              onDismissEcho={handleDismissEcho}
              isSearchingEchoes={isSearchingEchoes}
            />
          )}
        </div>

        {/* Right Insights & Synthesis Panel (Reflective Layer) */}
        {activeInsightsEntry && (
          <InsightsPanel
            entry={activeInsightsEntry}
            onGenerateSummary={
              viewMode === 'daily' ? handleRetryDailySynthesis : handleGenerateSummary
            }
            isSummarizing={viewMode === 'daily' ? isSynthesizingDaily : isSummarizing}
            isOpen={isInsightsOpen}
            onToggle={() => setIsInsightsOpen((prev) => !prev)}
          />
        )}
      </div>
    </div>
  );
}

