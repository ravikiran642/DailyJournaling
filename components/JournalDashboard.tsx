'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { JournalEntry } from '@/lib/types';
import {
  subscribeToUserJournalEntries,
  deleteJournalEntry,
  saveOrUpdateDailyJournal,
  updateJournalEntry,
} from '@/lib/firestore-service';
import {
  syncEntryEmbedding,
  syncMissingHistoricalEmbeddings,
} from '@/lib/embedding-sync';
import { getLocalCalendarDate } from '@/lib/utils';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { DailyJournalEditor } from './DailyJournalEditor';
import { InsightsPanel } from './InsightsPanel';
import { PersonalPatterns } from './PersonalPatterns';
import { AlertCircle, X, Menu } from 'lucide-react';

export function JournalDashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeJournalDate, setActiveJournalDate] = useState<string>(getLocalCalendarDate());
  const [activeViewTab, setActiveViewTab] = useState<'journal' | 'patterns'>('journal');

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isSynthesizingDaily, setIsSynthesizingDaily] = useState(false);
  const [dailySynthesisError, setDailySynthesisError] = useState<string | null>(null);
  const [lastDailySavedAt, setLastDailySavedAt] = useState<Date | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  const initialSyncCompletedRef = useRef(false);

  // Derive active daily entry from real-time entries for selected date
  const dailyEntry = useMemo(() => {
    return (
      entries.find(
        (e) => e.journalDate === activeJournalDate && (e.isDailyPrimary || Boolean(e.content))
      ) || null
    );
  }, [entries, activeJournalDate]);

  // Real-time Firestore subscription isolated to authenticated user UID
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserJournalEntries(
      user.uid,
      (userEntries) => {
        setEntries(userEntries);

        // Background sync missing embeddings for past memories without blocking UI
        if (!initialSyncCompletedRef.current && userEntries.length > 0) {
          initialSyncCompletedRef.current = true;
          syncMissingHistoricalEmbeddings(user.uid, userEntries).catch((err) => {
            console.warn('Historical embeddings sync notice:', err);
          });
        }
      },
      (err) => {
        console.error('Realtime Firestore subscription error:', err);
        setErrorMessage('Failed to load journal history from Firestore.');
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [pendingTargetDate, setPendingTargetDate] = useState<string | null>(null);

  // Handle selecting any date
  const handleSelectDate = useCallback((dateStr: string) => {
    if (dateStr === activeJournalDate) return;
    if (isEditorDirty) {
      setPendingTargetDate(dateStr);
      return;
    }
    setActiveJournalDate(dateStr);
    setIsMobileSidebarOpen(false);
    setErrorMessage(null);
  }, [activeJournalDate, isEditorDirty]);

  // 1. Save journal content with tags ONLY (without creating any synthesis or summary)
  const handleSaveOnly = async ({
    title,
    content,
    tags,
    manualTags,
  }: {
    title: string;
    content: string;
    tags?: string[];
    manualTags?: string[];
  }) => {
    if (!user?.uid) return;

    setSyncStatus('saving');
    setErrorMessage(null);

    try {
      await saveOrUpdateDailyJournal(user.uid, activeJournalDate, {
        id: dailyEntry?.id,
        content,
        title,
        tags: tags || dailyEntry?.tags || [],
        manualTags: manualTags !== undefined ? manualTags : dailyEntry?.manualTags || [],
      });

      setLastDailySavedAt(new Date());
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 3000);
      // Strictly no synthesis or summary created
    } catch (err: any) {
      console.error('Failed to save daily journal:', err);
      setSyncStatus('error');
      setErrorMessage('Failed to save journal entry to Firestore.');
    }
  };

  // 2. Save AND Synthesis (saves journal content and synthesizes journals data using existing API)
  const handleSaveAndSynthesize = async ({
    title,
    content,
    tags,
    manualTags,
  }: {
    title: string;
    content: string;
    tags?: string[];
    manualTags?: string[];
  }) => {
    if (!user?.uid) return;

    setSyncStatus('saving');
    setErrorMessage(null);

    try {
      // Save the journal entry content and tags first
      const saved = await saveOrUpdateDailyJournal(user.uid, activeJournalDate, {
        id: dailyEntry?.id,
        content,
        title,
        tags: tags || dailyEntry?.tags || [],
        manualTags: manualTags !== undefined ? manualTags : dailyEntry?.manualTags || [],
      });

      // Optimistically update entries in state with the saved entry
      setEntries((prev) => {
        const exists = prev.some((e) => e.id === saved.id);
        return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev];
      });

      setLastDailySavedAt(new Date());
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 3000);

      // Open synthesis drawer to present generated insights
      setIsInsightsOpen(true);

      // Synthesize using existing /api/gemini/summarize API
      const synthesized = await triggerDailySynthesis(saved, content, activeJournalDate);
      return synthesized || saved;
    } catch (err: any) {
      console.error('Failed to save and synthesize daily journal:', err);
      setSyncStatus('error');
      setErrorMessage('Failed to save and synthesize journal entry.');
      return null;
    }
  };

  // Background AI synthesis for daily reflection
  const triggerDailySynthesis = async (
    entryToSynthesize: JournalEntry,
    contentHtml: string,
    dateStr: string
  ): Promise<JournalEntry | null> => {
    if (!user?.uid) return null;
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

      // Only pick the manual tags so previous AI tags are replaced by fresh generated tags while manual tags are preserved
      const currentManualTags = entryToSynthesize.manualTags || [];
      const currentTags = currentManualTags;
      const generatedTags: string[] = Array.isArray(data.tags) ? data.tags : [];

      // Combine manual tags and append newly generated tags (case-insensitive deduplication)
      const combinedTags = [...currentTags];
      for (const genTag of generatedTags) {
        const clean = genTag.trim().replace(/^#/, '');
        if (clean && !combinedTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
          combinedTags.push(clean);
        }
      }

      const updates: Partial<JournalEntry> = {
        synthesis: data.synthesis || '',
        summary: data.summary || '',
        keyInsights: data.keyInsights || [],
        observations: data.observations || [],
        tags: combinedTags.length > 0 ? combinedTags : ['Daily'],
        manualTags: currentManualTags,
      };

      await updateJournalEntry(user.uid, entryToSynthesize.id, updates);

      const updated: JournalEntry = {
        ...entryToSynthesize,
        ...updates,
      };

      // Optimistically update entries in state so dailyEntry immediately reflects updated tags and synthesis
      setEntries((prev) =>
        prev.map((e) => (e.id === entryToSynthesize.id ? updated : e))
      );

      // Background sync vector embedding for semantic memory
      syncEntryEmbedding(user.uid, updated).catch((err) =>
        console.warn('Post-daily-synthesis embedding sync notice:', err)
      );

      return updated;
    } catch (err: any) {
      console.warn('Background synthesis notice:', err);
      setDailySynthesisError(err.message || 'AI reflection temporarily delayed.');
      return null;
    } finally {
      setIsSynthesizingDaily(false);
    }
  };

  // Retry daily synthesis
  const handleRetryDailySynthesis = async () => {
    if (!dailyEntry || !dailyEntry.content) return;
    await triggerDailySynthesis(dailyEntry, dailyEntry.content, activeJournalDate);
  };

  // Delete journal entry from Firestore
  const handleDeleteEntry = async (entryId: string) => {
    if (!user?.uid) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
    } catch (err: any) {
      console.error('Failed to delete entry:', err);
      setErrorMessage('Failed to delete journal entry.');
    }
  };

  return (
    <div
      id="journal-app-root"
      className="h-screen w-screen flex flex-col bg-[#FBF9F5] text-[#252723] overflow-hidden font-sans"
    >
      {/* Top Window Navigation Bar (Matching wireframe) */}
      <Navbar
        activeJournalDate={activeJournalDate}
        onSelectDate={handleSelectDate}
        syncStatus={syncStatus}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        activeViewTab={activeViewTab}
        onSelectViewTab={(tab) => {
          setActiveViewTab(tab);
          setErrorMessage(null);
        }}
      />

      {/* Global Error Toast */}
      {errorMessage && (
        <div
          id="global-error-toast"
          className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-2 text-xs flex items-center justify-between z-30 shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-900 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div id="journal-main-layout" className="flex-1 flex overflow-hidden relative">
        {activeViewTab === 'journal' ? (
          <>
            {/* Left Date List Sidebar */}
            <Sidebar
              entries={entries}
              activeJournalDate={activeJournalDate}
              onSelectDate={handleSelectDate}
              onDeleteEntry={handleDeleteEntry}
              isOpenMobile={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            />

            {/* Central Daily Journal Writing Area */}
            <main
              id="journal-content-area"
              className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#FBF9F5]"
            >
              {/* Mobile Sidebar Toggle Button */}
              <div className="lg:hidden px-4 py-2 bg-[#F7F5F0] border-b border-[#E5E7E2] flex items-center justify-between">
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-[#737872] hover:text-[#252723] py-1 px-2.5 rounded-lg bg-[#EAE7DF] cursor-pointer"
                >
                  <Menu className="w-3.5 h-3.5" />
                  <span>Dates</span>
                </button>
              </div>

              {/* Daily Journal Sacred Canvas */}
              <DailyJournalEditor
                entry={dailyEntry}
                journalDate={activeJournalDate}
                onSave={handleSaveOnly}
                onSaveOnly={handleSaveOnly}
                onSaveAndSynthesize={handleSaveAndSynthesize}
                saveStatus={syncStatus}
                isSynthesizing={isSynthesizingDaily}
                synthesisError={dailySynthesisError}
                onRetrySynthesis={handleRetryDailySynthesis}
                lastSavedAt={lastDailySavedAt}
                onOpenSynthesisDrawer={() => setIsInsightsOpen((prev) => !prev)}
                isSynthesisDrawerOpen={isInsightsOpen}
                onSelectDate={(newDate) => {
                  setActiveJournalDate(newDate);
                  setIsMobileSidebarOpen(false);
                  setPendingTargetDate(null);
                }}
                onDirtyChange={setIsEditorDirty}
                externalPendingDate={pendingTargetDate}
                onClearExternalPendingDate={() => setPendingTargetDate(null)}
                allEntries={entries}
              />
            </main>

            {/* Reflective Insights Slide-out Drawer */}
            <InsightsPanel
              entry={dailyEntry}
              onGenerateSummary={handleRetryDailySynthesis}
              isSummarizing={isSynthesizingDaily}
              isOpen={isInsightsOpen}
              onToggle={() => setIsInsightsOpen((prev) => !prev)}
            />
          </>
        ) : (
          /* Personal Patterns View */
          <PersonalPatterns
            entries={entries}
            onSelectEntryDate={(dateStr) => {
              setActiveJournalDate(dateStr);
              setActiveViewTab('journal');
            }}
            onSwitchToJournal={() => setActiveViewTab('journal')}
          />
        )}
      </div>
    </div>
  );
}
