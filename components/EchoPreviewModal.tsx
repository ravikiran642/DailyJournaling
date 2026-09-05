'use client';

import React from 'react';
import { EchoReference } from '@/lib/types';
import { X, Calendar, Tag, Brain, Sparkles, BookOpen, ExternalLink } from 'lucide-react';

interface EchoPreviewModalProps {
  echo: EchoReference | null;
  onClose: () => void;
  onConfirm?: (echo: EchoReference) => void;
  isConfirmed?: boolean;
}

export function EchoPreviewModal({
  echo,
  onClose,
  onConfirm,
  isConfirmed = false,
}: EchoPreviewModalProps) {
  if (!echo) return null;

  return (
    <div
      id="echo-preview-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/25 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        id="echo-preview-modal-dialog"
        className="w-full max-w-lg bg-[#FAFAF7] border border-[#E5E7E2] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#252723] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E7E2] flex items-center justify-between bg-[#FAFAF7]/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#737872]">
                Historical Memory Preview
              </span>
              <h3 className="font-serif text-lg font-medium text-[#252723] leading-snug">
                {echo.historicalTitle || 'Past Reflection'}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#737872] hover:text-[#252723] hover:bg-[#E8EFE9] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Metadata Bar */}
          <div className="flex items-center gap-4 text-xs text-[#737872] pb-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#6F8273]" />
              <span>{echo.date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#6F8273]" />
              <span>Past Journal Entry</span>
            </div>
          </div>

          {/* Connection Thesis */}
          <div className="p-4 rounded-2xl bg-[#E8EFE9]/60 border border-[#DCE8DE] space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6F8273] block">
              Observed Connection to Today
            </span>
            <p className="font-serif italic text-sm text-[#252723] leading-relaxed">
              &ldquo;{echo.connection}&rdquo;
            </p>
          </div>

          {/* Historical Summary */}
          {echo.historicalSummary && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737872] block">
                Executive Summary from That Day
              </span>
              <div className="p-4 rounded-2xl bg-white border border-[#E5E7E2] font-serif italic text-sm leading-relaxed text-[#252723] shadow-xs">
                {echo.historicalSummary}
              </div>
            </div>
          )}

          {/* Historical Key Insights */}
          {echo.historicalInsights && echo.historicalInsights.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737872] block">
                Takeaways Discovered
              </span>
              <div className="space-y-2">
                {echo.historicalInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white border border-[#E5E7E2] text-xs font-serif text-[#252723] flex items-start gap-2.5 shadow-xs"
                  >
                    <span className="w-4 h-4 rounded-full bg-[#E8EFE9] text-[#6F8273] text-[10px] font-medium flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {echo.historicalTags && echo.historicalTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {echo.historicalTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-full bg-[#E8EFE9] text-[#6F8273] text-xs font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#E5E7E2] bg-[#FAFAF7] flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#737872] hover:text-[#252723] transition-colors cursor-pointer"
          >
            Return to Active Reflection
          </button>

          {onConfirm && !isConfirmed && (
            <button
              onClick={() => {
                onConfirm(echo);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7] text-xs font-medium transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#DCE8DE]" />
              <span>Connect Context to Conversation</span>
            </button>
          )}

          {isConfirmed && (
            <span className="text-xs font-medium text-[#6F8273] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#6F8273]" />
              Active in Current Reflection
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
