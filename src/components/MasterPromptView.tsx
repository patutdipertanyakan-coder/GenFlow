/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GENNAS_STUDIO_PROMPT } from '../lib/gennasStudioPrompt';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface MasterPromptViewProps {
  config?: any;
  onNavigateToLexicon?: () => void;
  onBackToStudio?: () => void;
}

export const MasterPromptView: React.FC<MasterPromptViewProps> = ({
  onBackToStudio,
}) => {
  return (
    <section
      aria-label="Tampilan Master Prompt Final GenNAS Pro Studio"
      className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
    >
      {/* Header Utama Statis */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex flex-wrap items-center gap-3">
          {onBackToStudio && (
            <button
              type="button"
              data-testid="back-to-studio-btn"
              onClick={onBackToStudio}
              data-tooltip="Kembali ke Studio Naskah."
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span>← Kembali</span>
            </button>
          )}
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>PROMPT UTAMA AI</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Instruksi utama AI: gaya lisan Gue–Lo, 5 blok StoryFlow, EYD V &amp; SAP, serta bebas petik (SQNN).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="btn-gennas-studio-prompt"
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1.5 cursor-default"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>INSTRUKSI FINAL — READ ONLY</span>
          </button>
        </div>
      </div>

      {/* Area Tampilan Pembaca Master Prompt Final (Read-only) */}
      <pre
        data-testid="master-prompt-readonly-viewer"
        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-5 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[750px] overflow-y-auto select-text selection:bg-amber-500/30 selection:text-amber-200"
      >
        {GENNAS_STUDIO_PROMPT}
      </pre>
    </section>
  );
};
