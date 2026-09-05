'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { JournalEntry, ChatMessage, ReflectionMode, EchoReference } from '@/lib/types';
import { EchoCard } from './EchoCard';
import {
  Send,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Brain,
  Feather,
  Lightbulb,
  Heart,
  Scale,
  RefreshCw,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface ReflectionChatProps {
  currentEntry: JournalEntry | null;
  mode: ReflectionMode;
  onSendMessage: (content: string, title?: string) => Promise<void>;
  onGenerateSummary: () => Promise<void>;
  isLoading: boolean;
  isSummarizing: boolean;
  onUpdateTitle: (title: string) => void;
  detectedEchoes?: EchoReference[];
  confirmedEchoes?: EchoReference[];
  onConfirmEcho?: (echo: EchoReference) => void;
  onDismissEcho?: (echo: EchoReference) => void;
  isSearchingEchoes?: boolean;
}

const PROMPT_SUGGESTIONS: Record<
  ReflectionMode,
  { title: string; prompt: string; starterQuestions: string[] }
> = {
  reflection: {
    title: 'Deep Reflection & Self-Discovery',
    prompt: 'What experience, realization, or dilemma has been lingering in your mind?',
    starterQuestions: [
      'What recent moment energized or drained me today, and why?',
      'What assumption am I making about my current challenge?',
      'How have my core priorities shifted over the past few weeks?',
      'What feeling am I trying to avoid or resist acknowledging right now?',
    ],
  },
  brainstorm: {
    title: 'Creative Brainstorming & Possibilities',
    prompt: 'Describe an idea, project, or bottleneck you want to explore novel angles for.',
    starterQuestions: [
      'What if I approached this project with zero constraints or fear?',
      'What is an unconventional, lateral way to solve this bottleneck?',
      'How would a wise mentor or artist approach this problem?',
      'What are 3 wild, experimental variations of this concept?',
    ],
  },
  gratitude: {
    title: 'Mindfulness & Gratitude Practice',
    prompt: 'What moments of grace, kindness, or progress are you grateful for today?',
    starterQuestions: [
      'What is one small, quiet detail that brought me comfort today?',
      'Who showed unexpected kindness or support recently, and how?',
      'What difficult challenge taught me a valuable personal strength?',
      'What about my present surroundings brings me peace right now?',
    ],
  },
  decision: {
    title: 'Strategic Decision & Trade-Off Clarifier',
    prompt: 'What difficult choice or crossroads are you navigating right now?',
    starterQuestions: [
      'What are Option A and Option B, and what are their 2nd-order consequences?',
      'Which path aligns closest with my core long-term peace vs. short-term comfort?',
      'If both choices had guaranteed outcomes, which would I intuitively pick?',
      'What is the reversible vs. irreversible risk of this decision?',
    ],
  },
  summary: {
    title: 'Journal Synthesis & Retrospective',
    prompt: 'Synthesize your reflections into overarching themes and lasting insights.',
    starterQuestions: [
      'What were the biggest lessons and breakthroughs from this period?',
      'What recurring emotional patterns keep appearing in my routine?',
    ],
  },
  daily: {
    title: 'Daily Reflection & Presence',
    prompt: 'A calm space to chronicle your day, thoughts, and realizations.',
    starterQuestions: [
      'What unfolded today that left an impression on you?',
      'What went well today, and what felt challenging?',
      'How are you feeling as you close out the day?',
    ],
  },
};

export function ReflectionChat({
  currentEntry,
  mode,
  onSendMessage,
  onGenerateSummary,
  isLoading,
  isSummarizing,
  onUpdateTitle,
  detectedEchoes = [],
  confirmedEchoes = [],
  onConfirmEcho,
  onDismissEcho,
  isSearchingEchoes = false,
}: ReflectionChatProps) {
  const [inputText, setInputText] = useState('');
  const [draftTitle, setDraftTitle] = useState(currentEntry?.title || '');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update draft title when switching entries
  const lastEntryIdRef = useRef(currentEntry?.id);
  if (lastEntryIdRef.current !== currentEntry?.id) {
    lastEntryIdRef.current = currentEntry?.id;
    setDraftTitle(currentEntry?.title || '');
  }

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentEntry?.messages, isLoading]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isLoading) return;

    setInputText('');
    await onSendMessage(textToSend, draftTitle.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const currentModeInfo = PROMPT_SUGGESTIONS[mode] || PROMPT_SUGGESTIONS.reflection;
  const messages = currentEntry?.messages || [];
  const isNewEntry = messages.length === 0;

  return (
    <div id="reflection-chat-container" className="flex-1 flex flex-col h-full bg-[#FAFAF7] text-[#252723] overflow-hidden relative font-sans">
      {/* Top Reflection Header / Title Bar */}
      <div
        id="reflection-chat-header"
        className="px-6 sm:px-12 py-3 border-b border-[#E5E7E2] bg-[#FAFAF7]/90 backdrop-blur-xs flex items-center justify-between gap-4 shrink-0"
      >
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="flex flex-col w-full max-w-xl">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#737872]">
              {currentEntry ? 'Active Reflection' : 'New Thought'}
            </span>
            <input
              id="reflection-title-input"
              type="text"
              placeholder="Name this reflection, or let Gemini name it..."
              value={draftTitle}
              onChange={(e) => {
                setDraftTitle(e.target.value);
                onUpdateTitle(e.target.value);
              }}
              className="bg-transparent border-b border-transparent hover:border-[#E5E7E2] focus:border-[#6F8273] focus:outline-none text-base sm:text-lg font-serif italic text-[#252723] placeholder-[#737872]/60 transition-colors py-0.5"
            />
          </div>
        </div>

        {/* Generate Summary Action Button */}
        {messages.length > 0 && (
          <button
            id="generate-summary-top-btn"
            onClick={onGenerateSummary}
            disabled={isSummarizing || isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E8EFE9] hover:bg-[#DCE8DE] text-[#252723] text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSummarizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6F8273]" />
            ) : (
              <Brain className="w-3.5 h-3.5 text-[#6F8273]" />
            )}
            <span>{isSummarizing ? 'Synthesizing...' : 'Synthesize Key Insights'}</span>
          </button>
        )}
      </div>

      {/* Main Conversation Stream or Blank Canvas Prompts */}
      <div
        id="messages-scroll-area"
        className="flex-1 overflow-y-auto px-6 sm:px-12 lg:px-16 py-8 sm:py-10 space-y-10 max-w-3xl mx-auto w-full"
      >
        {isNewEntry ? (
          /* Blank Canvas Entry Sparks */
          <div id="new-entry-starter-view" className="py-6 sm:py-10 space-y-8 animate-fade-in">
            <div className="text-center space-y-3 max-w-lg mx-auto">
              <div className="inline-flex p-3 rounded-full bg-[#E8EFE9] text-[#6F8273] mb-1">
                <Feather className="w-5 h-5" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-[#252723]">
                {currentModeInfo.title}
              </h2>
              <p className="text-sm sm:text-base font-serif italic text-[#737872] leading-relaxed">
                {currentModeInfo.prompt}
              </p>
            </div>

            {/* Spark questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {currentModeInfo.starterQuestions.map((q, idx) => (
                <button
                  key={idx}
                  id={`prompt-spark-${idx}`}
                  onClick={() => {
                    setInputText(q);
                    textareaRef.current?.focus();
                  }}
                  className="p-4 rounded-xl text-left bg-white border border-[#E5E7E2] hover:border-[#DCE8DE] hover:bg-[#F3F4EF]/70 text-xs font-serif italic text-[#252723] transition-all group flex items-start gap-3 cursor-pointer shadow-xs"
                >
                  <HelpCircle className="w-4 h-4 text-[#6F8273] shrink-0 mt-0.5 opacity-80 group-hover:opacity-100" />
                  <span className="leading-relaxed text-[#252723]">
                    &ldquo;{q}&rdquo;
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversational Transcript (Editorial & Companion Style) */
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isCopied = copiedMessageId === msg.id;

            return (
              <div
                key={msg.id || index}
                id={`message-bubble-${index}`}
                className="space-y-2 pt-6 first:pt-0"
              >
                {isUser ? (
                  /* User Written Thoughts (Paper Passage) */
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#737872]">
                        You
                      </span>
                      <span className="text-[10px] text-[#737872]/60">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-base sm:text-lg font-serif leading-relaxed text-[#252723] whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  /* Gemini Companion Reflection (Soft Pale Sage Accent Card) */
                  <div className="space-y-2 pl-4 sm:pl-6 border-l-2 border-[#6F8273] py-2 bg-[#F3F4EF]/50 rounded-r-2xl pr-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#6F8273]">
                          Gemini Companion
                        </span>
                        <span className="text-[10px] text-[#737872]/60">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Copy passage button */}
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        title="Copy reflection"
                        className="p-1 text-[#737872] hover:text-[#252723] text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-700" />
                            <span className="text-[10px] text-emerald-700 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-base sm:text-lg font-serif italic leading-relaxed text-[#404040] prose prose-neutral max-w-none prose-headings:font-serif prose-headings:text-[#252723] prose-strong:text-[#252723] prose-strong:font-semibold prose-blockquote:border-l-2 prose-blockquote:border-[#6F8273] prose-blockquote:bg-[#E8EFE9]/60 prose-blockquote:p-3 prose-blockquote:rounded-r-lg prose-blockquote:not-italic">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Calm AI Thinking State */}
        {isLoading && (
          <div id="ai-loading-bubble" className="space-y-2 pl-4 sm:pl-6 border-l-2 border-[#6F8273] py-3 bg-[#F3F4EF]/50 rounded-r-2xl pr-4 animate-pulse">
            <span className="text-[11px] font-medium text-[#6F8273]">
              Gemini Companion
            </span>
            <div className="flex items-center gap-2.5 text-sm font-serif italic text-[#737872]">
              <Loader2 className="w-4 h-4 animate-spin text-[#6F8273]" />
              <span>Reflecting on your thoughts with care...</span>
            </div>
          </div>
        )}

        {/* Gentle Background Echo Search Indicator */}
        {isSearchingEchoes && !isLoading && (
          <div id="echo-search-indicator" className="flex items-center gap-2 py-1 px-3 rounded-full bg-[#E8EFE9]/50 text-[#6F8273] text-[11px] font-serif italic w-fit mx-auto animate-pulse">
            <Sparkles className="w-3 h-3" />
            <span>Listening for resonant echoes in past reflections...</span>
          </div>
        )}

        {/* Detected and Confirmed Echoes */}
        {((detectedEchoes && detectedEchoes.length > 0) || (confirmedEchoes && confirmedEchoes.length > 0)) && (
          <div id="echoes-stream-section" className="space-y-3 pt-2">
            {/* Confirmed Echoes */}
            {confirmedEchoes?.map((echo) => (
              <EchoCard
                key={`confirmed-${echo.entryId}`}
                echo={echo}
                isConfirmed={true}
                onConfirm={onConfirmEcho || (() => {})}
                onDismiss={onDismissEcho || (() => {})}
              />
            ))}

            {/* Unconfirmed Detected Echoes */}
            {detectedEchoes
              ?.filter((echo) => !confirmedEchoes?.some((c) => c.entryId === echo.entryId))
              .map((echo) => (
                <EchoCard
                  key={`detected-${echo.entryId}`}
                  echo={echo}
                  isConfirmed={false}
                  onConfirm={onConfirmEcho || (() => {})}
                  onDismiss={onDismissEcho || (() => {})}
                />
              ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Follow-up Suggestions */}
      {messages.length > 0 && !isLoading && (
        <div id="quick-follow-up-chips" className="px-6 sm:px-12 py-2 border-t border-[#E5E7E2]/70 flex items-center gap-2 overflow-x-auto no-scrollbar max-w-3xl mx-auto w-full text-xs">
          <span className="text-[#737872] whitespace-nowrap text-[11px]">Follow up:</span>
          {[
            'What is the emotional root of this?',
            'What is the counter-perspective?',
            'How can I break this into 3 quiet actions?',
            'What is the most compassionate reframe?',
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="px-3 py-1 rounded-full border border-[#E5E7E2] bg-white hover:bg-[#E8EFE9] text-[#737872] hover:text-[#252723] whitespace-nowrap text-[11px] transition-all cursor-pointer shadow-xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Composer Footer */}
      <div id="reflection-composer" className="px-6 sm:px-12 pb-6 pt-3 bg-[#FAFAF7] border-t border-[#E5E7E2] shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-white border border-[#E5E7E2] rounded-2xl p-3 sm:p-4 shadow-xs focus-within:border-[#6F8273] focus-within:ring-1 focus-within:ring-[#DCE8DE] transition-all">
            <textarea
              ref={textareaRef}
              id="reflection-input-textarea"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isNewEntry
                  ? 'Pour your thoughts, questions, or realizations here...'
                  : 'Continue exploring your thoughts...'
              }
              className="w-full bg-transparent border-none text-base font-serif text-[#252723] focus:outline-none resize-none min-h-[64px] placeholder-[#737872]/60 leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#E5E7E2]/50">
              <span className="text-[10px] text-[#737872]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[#F3F4EF] border border-[#E5E7E2] text-[9px]">Enter</kbd> to reflect, <kbd className="px-1.5 py-0.5 rounded bg-[#F3F4EF] border border-[#E5E7E2] text-[9px]">Shift+Enter</kbd> for new line
              </span>

              <button
                id="send-reflection-btn"
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#252723] hover:bg-[#3D413A] text-[#FAFAF7] text-xs font-medium transition-all shadow-xs disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{isLoading ? 'Reflecting...' : 'Send'}</span>
              </button>
            </div>
          </div>

          <p className="text-center mt-2.5 text-[10px] text-[#737872]/80">
            A quiet space for thought &bull; Encrypted in Cloud Firestore
          </p>
        </div>
      </div>
    </div>
  );
}
