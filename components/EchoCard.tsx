'use client';

import React, { useState } from 'react';
import { EchoReference } from '@/lib/types';
import { Sparkles, BookOpen, Check, X, Eye, HelpCircle } from 'lucide-react';
import { EchoPreviewModal } from './EchoPreviewModal';

interface EchoCardProps {
  echo: EchoReference;
  onConfirm: (echo: EchoReference) => void;
  onDismiss: (echo: EchoReference) => void;
  isConfirmed?: boolean;
}

export function EchoCard({
  echo,
  onConfirm,
  onDismiss,
  isConfirmed = false,
}: EchoCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <>
      <div
        id={`echo-card-${echo.entryId}`}
        className={`my-4 p-4 sm:p-5 rounded-2xl border transition-all animate-fade-in ${
          isConfirmed
            ? 'bg-[#E8EFE9]/70 border-[#DCE8DE] shadow-xs'
            : 'bg-white border-[#E5E7E2] hover:border-[#DCE8DE] shadow-xs'
        }`}
      >
        {/* Top Header Badge */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#E8EFE9] text-[#6F8273] flex items-center justify-center">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#6F8273]">
              {isConfirmed ? 'Memory Connected' : 'Echo &bull; Something Feels Familiar'}
            </span>
          </div>

          <span className="text-[10px] text-[#737872]">
            {echo.date}
          </span>
        </div>

        {/* Narrative Connection */}
        <div className="space-y-2">
          <p className="text-sm sm:text-base font-serif text-[#252723] leading-relaxed">
            I noticed this may connect to something you explored previously in{' '}
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="font-medium underline decoration-[#6F8273]/60 hover:decoration-[#6F8273] text-[#252723] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>&ldquo;{echo.historicalTitle || 'Past Reflection'}&rdquo;</span>
            </button>
            .
          </p>

          <div className="p-3.5 rounded-xl bg-[#F3F4EF]/70 border border-[#E5E7E2] text-xs sm:text-sm font-serif italic text-[#404040] leading-relaxed border-l-2 border-l-[#6F8273]">
            &ldquo;{echo.connection}&rdquo;
          </div>

          {!isConfirmed ? (
            <p className="text-xs sm:text-sm font-serif italic text-[#737872] pt-1">
              Are you feeling something similar again, or is there something different this time?
            </p>
          ) : (
            <p className="text-xs font-serif italic text-[#6F8273] pt-0.5">
              &bull; Historical context active &bull; Gemini companion will weave this insight into future responses.
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-4 pt-3 border-t border-[#E5E7E2]/70 flex flex-wrap items-center justify-between gap-2">
          <button
            id={`view-echo-btn-${echo.entryId}`}
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E7E2] bg-white hover:bg-[#F3F4EF] text-xs font-medium text-[#252723] transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#6F8273]" />
            <span>View Reflection</span>
          </button>

          {!isConfirmed ? (
            <div className="flex items-center gap-2">
              <button
                id={`dismiss-echo-btn-${echo.entryId}`}
                onClick={() => onDismiss(echo)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-[#737872] hover:text-[#252723] hover:bg-[#F3F4EF] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>No, this is different</span>
              </button>

              <button
                id={`confirm-echo-btn-${echo.entryId}`}
                onClick={() => onConfirm(echo)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7] text-xs font-medium transition-all shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#DCE8DE]" />
                <span>Yes, this connects</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDismiss(echo)}
              className="text-[11px] text-[#737872] hover:text-red-700 transition-colors cursor-pointer"
            >
              Disconnect context
            </button>
          )}
        </div>
      </div>

      {/* Slide-over / Modal preview */}
      {isPreviewOpen && (
        <EchoPreviewModal
          echo={echo}
          onClose={() => setIsPreviewOpen(false)}
          onConfirm={onConfirm}
          isConfirmed={isConfirmed}
        />
      )}
    </>
  );
}
