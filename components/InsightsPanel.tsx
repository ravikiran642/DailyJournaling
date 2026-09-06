'use client';

import React, { useState } from 'react';
import { JournalEntry } from '@/lib/types';
import {
  Sparkles,
  CheckCircle2,
  Tag,
  Copy,
  Check,
  Brain,
  Download,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  Feather,
} from 'lucide-react';

interface InsightsPanelProps {
  entry: JournalEntry | null;
  onGenerateSummary: () => Promise<void>;
  isSummarizing: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export function InsightsPanel({
  entry,
  onGenerateSummary,
  isSummarizing,
  isOpen,
  onToggle,
}: InsightsPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!entry) return null;

  const handleExportMarkdown = () => {
    let md = `# ${entry.title || 'Journal Reflection'}\n`;
    md += `*Date: ${new Date(entry.createdAt).toLocaleDateString()} | Type: ${entry.reflectionType}*\n\n`;

    if (entry.summary) {
      md += `## Executive Summary\n${entry.summary}\n\n`;
    }

    if (entry.synthesis) {
      md += `## Reflective Synthesis\n${entry.synthesis}\n\n`;
    }

    if (entry.keyInsights && entry.keyInsights.length > 0) {
      md += `## Key Insights & Takeaways\n`;
      entry.keyInsights.forEach((insight) => {
        md += `- ${insight}\n`;
      });
      md += `\n`;
    }

    if (entry.tags && entry.tags.length > 0) {
      md += `**Tags:** ${entry.tags.join(', ')}\n\n`;
    }

    if (entry.content) {
      md += `## Journal Content\n`;
      const plain = entry.content
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      md += `${plain}\n\n`;
    } else if (entry.messages && entry.messages.length > 0) {
      md += `## Full Conversation Transcript\n`;
      entry.messages.forEach((msg) => {
        md += `### ${msg.role === 'user' ? 'User' : 'Gemini AI'}\n${msg.content}\n\n`;
      });
    }

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside
      id="insights-side-panel"
      className={`border-l border-[#E5E7E2] bg-[#FAFAF7] text-[#252723] flex flex-col transition-all duration-300 ${
        isOpen ? 'w-80 sm:w-96' : 'w-0 overflow-hidden border-l-0'
      }`}
    >
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-[#E5E7E2] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center">
            <Brain className="w-3.5 h-3.5" />
          </div>
          <span className="font-serif italic text-base text-[#252723]">Synthesis &amp; Insights</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportMarkdown}
            title="Copy as Markdown"
            className="p-1.5 text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9] rounded-md transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-700" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onToggle}
            title="Close Panel"
            className="p-1.5 text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9] rounded-md cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
        {/* Synthesis Action if summary doesn't exist yet */}
        {!entry.summary && (
          <div className="p-5 bg-white border border-[#E5E7E2] rounded-2xl text-center space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-full bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center mx-auto">
              <Feather className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#252723]">
                Synthesize Takeaways
              </h4>
              <p className="text-xs font-serif italic text-[#737872] mt-1 leading-relaxed">
                Let Gemini gently extract core breakthroughs, recurring themes, and actionable wisdom from your writing.
              </p>
            </div>
            <button
              onClick={onGenerateSummary}
              disabled={isSummarizing || ((entry.messages?.length ?? 0) === 0 && !entry.content)}
              className="w-full py-2 px-3 rounded-xl bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7] text-xs font-medium transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSummarizing ? 'Synthesizing...' : 'Generate Key Insights'}
            </button>
          </div>
        )}

        {/* Executive Summary Card */}
        {entry.summary && (
          <div id="executive-summary-card" className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#737872] flex items-center gap-1.5">
              <span>Core Digest</span>
            </h4>
            <div className="p-4 bg-white border border-[#E5E7E2] rounded-2xl text-sm font-serif italic text-[#252723] leading-relaxed shadow-xs border-l-3 border-l-[#6F8273]">
              &ldquo;{entry.summary}&rdquo;
            </div>
          </div>
        )}

        {/* Reflective Synthesis Card */}
        {entry.synthesis && (
          <div id="reflective-synthesis-card" className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#737872] flex items-center gap-1.5">
              <span>Reflective Synthesis</span>
            </h4>
            <div className="p-4 bg-white border border-[#E5E7E2] rounded-2xl text-xs font-serif text-[#252723] leading-relaxed shadow-xs whitespace-pre-line">
              {entry.synthesis}
            </div>
          </div>
        )}

        {/* Key Takeaways & Realizations */}
        {entry.keyInsights && entry.keyInsights.length > 0 && (
          <div id="key-insights-list" className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#737872] flex items-center gap-1.5">
              <span>Synthesized Takeaways</span>
            </h4>
            <div className="space-y-2.5">
              {entry.keyInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-white border border-[#E5E7E2] rounded-xl text-xs font-serif text-[#252723] flex items-start gap-2.5 leading-relaxed shadow-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-[#E8EFE9] text-[#6F8273] text-[10px] font-medium flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-[#252723] leading-relaxed">{insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thematic Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div id="thematic-tags-card" className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#737872] flex items-center gap-1.5">
              <span>Themes &amp; Tags</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-full bg-[#E8EFE9] text-[#6F8273] text-xs font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Entry Metadata Details */}
        <div className="p-4 bg-white border border-[#E5E7E2] rounded-2xl space-y-2 text-xs text-[#737872]">
          <div className="flex items-center justify-between">
            <span>Category</span>
            <span className="font-medium text-[#252723] capitalize">{entry.reflectionType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{entry.content ? 'Format' : 'Passages'}</span>
            <span className="font-medium text-[#252723]">
              {entry.content
                ? entry.isDailyPrimary
                  ? 'Daily Reflection'
                  : 'Rich-Text Entry'
                : (entry.messages?.length ?? 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Date Created</span>
            <span className="font-medium text-[#252723]">
              {new Date(entry.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Storage</span>
            <span className="font-medium text-[#6F8273]">Encrypted (Firestore)</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
