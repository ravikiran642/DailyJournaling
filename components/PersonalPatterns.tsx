'use client';

import React, { useMemo, useState } from 'react';
import { JournalEntry } from '@/lib/types';
import { formatJournalDate, getCleanSnippet } from '@/lib/utils';
import {
  Sparkles,
  TrendingUp,
  Tag,
  Calendar,
  Compass,
  ArrowRight,
  Search,
  BookOpen,
  Lightbulb,
} from 'lucide-react';

interface PersonalPatternsProps {
  entries: JournalEntry[];
  onSelectEntryDate: (dateStr: string) => void;
  onSwitchToJournal: () => void;
}

export function PersonalPatterns({
  entries,
  onSelectEntryDate,
  onSwitchToJournal,
}: PersonalPatternsProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [patternSearch, setPatternSearch] = useState('');

  // 1. Calculate Writing Consistency & Rhythm
  const stats = useMemo(() => {
    const totalEntries = entries.length;
    let totalWords = 0;
    const dateSet = new Set<string>();

    entries.forEach((e) => {
      if (e.journalDate) dateSet.add(e.journalDate);
      const text = getCleanSnippet(e.content);
      if (text) {
        totalWords += text.split(/\s+/).filter(Boolean).length;
      }
    });

    const avgWordsPerEntry = totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0;

    return {
      totalEntries,
      uniqueDays: dateSet.size,
      totalWords,
      avgWordsPerEntry,
    };
  }, [entries]);

  // 2. Extract Recurring Themes & Tags
  const themeFrequencies = useMemo(() => {
    const tagCountMap: Record<string, number> = {};

    entries.forEach((entry) => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach((tag) => {
          const clean = tag.trim();
          if (clean) {
            tagCountMap[clean] = (tagCountMap[clean] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(tagCountMap)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [entries]);

  // 3. Extract Synthesized Insights Across Entries
  const crossEntryInsights = useMemo(() => {
    const insights: Array<{
      text: string;
      dateStr: string;
      entryTitle: string;
      entryId: string;
    }> = [];

    entries.forEach((entry) => {
      const dStr = entry.journalDate || (entry.createdAt ? entry.createdAt.split('T')[0] : '');
      if (entry.keyInsights && Array.isArray(entry.keyInsights)) {
        entry.keyInsights.forEach((insight) => {
          insights.push({
            text: insight,
            dateStr: dStr,
            entryTitle: entry.title || formatJournalDate(dStr),
            entryId: entry.id,
          });
        });
      }
    });

    return insights;
  }, [entries]);

  // Filtered insights based on active tag or search
  const filteredInsights = useMemo(() => {
    return crossEntryInsights.filter((item) => {
      const matchesTag = !selectedTag || true; // Can filter if connected
      const matchesSearch =
        !patternSearch ||
        item.text.toLowerCase().includes(patternSearch.toLowerCase()) ||
        item.entryTitle.toLowerCase().includes(patternSearch.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [crossEntryInsights, selectedTag, patternSearch]);

  return (
    <div
      id="personal-patterns-container"
      className="flex-1 overflow-y-auto bg-[#FAFAF7] text-[#252723] p-6 sm:p-10 lg:p-12"
    >
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header section with generous breathing room */}
        <div className="border-b border-[#E5E7E2] pb-6">
          <div className="flex items-center gap-2 text-xs text-[#6F8273] font-medium tracking-wide uppercase mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Longitudinal Reflection</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif text-[#1A1C18] tracking-tight">
                Personal Patterns
              </h1>
              <p className="text-sm text-[#737872] mt-1 font-serif italic max-w-xl">
                Synthesized insights, recurring emotional rhythms, and semantic themes discovered
                across your private journal corpus.
              </p>
            </div>
            <button
              onClick={onSwitchToJournal}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full bg-[#E8EFE9] text-[#2F4133] hover:bg-[#DCE8DE] transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              <span>Back to Journal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Cadence & Consistency Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[#E5E7E2]/80 shadow-xs">
            <span className="text-[11px] text-[#737872] uppercase tracking-wider font-medium block">
              Total Reflections
            </span>
            <span className="text-2xl font-serif text-[#1A1C18] font-semibold mt-1 block">
              {stats.totalEntries}
            </span>
            <span className="text-[11px] text-[#6F8273] mt-0.5 block">
              {stats.uniqueDays} active days logged
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E5E7E2]/80 shadow-xs">
            <span className="text-[11px] text-[#737872] uppercase tracking-wider font-medium block">
              Reflective Depth
            </span>
            <span className="text-2xl font-serif text-[#1A1C18] font-semibold mt-1 block">
              {stats.avgWordsPerEntry}
            </span>
            <span className="text-[11px] text-[#737872] mt-0.5 block">
              Avg words per entry
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E5E7E2]/80 shadow-xs">
            <span className="text-[11px] text-[#737872] uppercase tracking-wider font-medium block">
              Core Themes
            </span>
            <span className="text-2xl font-serif text-[#1A1C18] font-semibold mt-1 block">
              {themeFrequencies.length}
            </span>
            <span className="text-[11px] text-[#6F8273] mt-0.5 block">
              Identified by Gemini
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E5E7E2]/80 shadow-xs">
            <span className="text-[11px] text-[#737872] uppercase tracking-wider font-medium block">
              Synthesized Insights
            </span>
            <span className="text-2xl font-serif text-[#1A1C18] font-semibold mt-1 block">
              {crossEntryInsights.length}
            </span>
            <span className="text-[11px] text-[#737872] mt-0.5 block">
              Grounded takeaways
            </span>
          </div>
        </div>

        {/* Recurring Thematic Clusters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-medium text-[#1A1C18] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#6F8273]" />
              <span>Recurring Mindset & Focus Themes</span>
            </h2>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-xs text-[#6F8273] hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>

          {themeFrequencies.length === 0 ? (
            <div className="p-6 rounded-xl bg-white border border-[#E5E7E2] text-center text-[#737872]">
              <p className="text-sm font-serif italic">
                No recurring themes generated yet. As you write daily entries and run reflections,
                Gemini will extract recurring tags and patterns here.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {themeFrequencies.map(({ tag, count }) => {
                const isActive = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(isActive ? null : tag)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#252723] text-white shadow-xs'
                        : 'bg-white border border-[#E5E7E2] text-[#4A5048] hover:border-[#C3D6C6] hover:bg-[#F7F8F5]'
                    }`}
                  >
                    <span>#{tag}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.25 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#F3F4EF] text-[#737872]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Synthesized Key Insights Across Time */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-serif font-medium text-[#1A1C18] flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#6F8273]" />
              <span>Longitudinal Takeaways & Clarity Moments</span>
            </h2>

            {/* In-place search for patterns */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737872]" />
              <input
                type="text"
                placeholder="Search takeaways..."
                value={patternSearch}
                onChange={(e) => setPatternSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-white border border-[#E5E7E2] rounded-full text-xs placeholder:text-[#A3A8A0] focus:border-[#6F8273] outline-none text-[#252723]"
              />
            </div>
          </div>

          {filteredInsights.length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-[#E5E7E2] text-center text-[#737872] space-y-2">
              <Sparkles className="w-6 h-6 mx-auto text-[#C3D6C6] stroke-[1.5]" />
              <p className="text-sm font-serif italic">
                {patternSearch
                  ? 'No takeaways match your search query.'
                  : 'Start reflecting on your daily journals to unlock synthesized takeaways.'}
              </p>
              <p className="text-xs text-[#A3A8A0]">
                When an entry is saved, the Gemini reflection companion automatically distills core insights.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredInsights.slice(0, 8).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectEntryDate(item.dateStr)}
                  className="group p-4 rounded-xl bg-white border border-[#E5E7E2]/90 hover:border-[#6F8273] transition-all cursor-pointer flex flex-col justify-between space-y-2.5 shadow-xs hover:shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#6F8273] mt-2 shrink-0" />
                    <p className="text-xs leading-relaxed text-[#252723] font-sans">
                      {item.text}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#F3F4EF] text-[11px] text-[#737872]">
                    <span className="font-serif italic">
                      {formatJournalDate(item.dateStr)}
                    </span>
                    <span className="inline-flex items-center gap-1 group-hover:text-[#252723] transition-colors">
                      <span>View entry</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom invitation card */}
        <div className="p-6 rounded-2xl bg-[#E8EFE9]/60 border border-[#DCE8DE] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#6F8273] shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1A1C18]">
                Every day adds to your self-understanding
              </h3>
              <p className="text-xs text-[#5F6A5F] mt-0.5">
                Continue capturing honest thoughts. The patterns deepen naturally over time.
              </p>
            </div>
          </div>
          <button
            onClick={onSwitchToJournal}
            className="px-4 py-2 text-xs font-medium bg-[#252723] text-white rounded-lg hover:bg-[#3D413A] transition-colors cursor-pointer shrink-0"
          >
            Write Today&apos;s Entry
          </button>
        </div>
      </div>
    </div>
  );
}
