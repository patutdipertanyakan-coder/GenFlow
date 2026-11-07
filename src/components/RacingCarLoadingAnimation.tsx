import React from 'react';
import { GenerationStageStep, OperationMode } from '../lib/types';
import { Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';
export const GENERATION_STAGE_STEPS: Array<{
  step: GenerationStageStep;
  label: string;
  detail: string;
}> = [
  {
    step: 1,
    label: 'Upload Kerangka & Ekstraksi Sumber',
    detail: 'Mengekstrak fakta sumber & mendeteksi Protected Tokens SAP.',
  },
  {
    step: 2,
    label: 'Generate Naskah Terintegrasi & F7 Guard',
    detail: 'Menyerap Leksikon F1–F8, Kata Kasar H, Frasa G1–G11, & penyaringan F7 Guard.',
  },
  {
    step: 3,
    label: 'Audit Dashboard 02 & Pengesahan Status Final',
    detail: 'Menjalankan diagnostik kualitas, Quality Gate, & pengesahan status final.',
  },
];

export interface RacingCarLoadingAnimationProps {
  activeStep?: GenerationStageStep | number;
  totalSteps?: number;
  stageName?: string;
  operation?: OperationMode | null;
  isFinished?: boolean;
  isFailed?: boolean;
  errorMessage?: string;
}

export const RacingCarLoadingAnimation: React.FC<RacingCarLoadingAnimationProps> = ({
  activeStep = 1,
  totalSteps = 8,
  stageName = 'Produksi Naskah',
  isFinished = false,
  isFailed = false,
  errorMessage,
}) => {
  const safeTotal = Math.max(1, totalSteps);
  const clampedStep = Math.min(safeTotal, Math.max(1, Number(activeStep) || 1));
  const isRunning = !isFailed && !isFinished;

  // Engine-authoritative stage percentage (never mutated by timers or CSS animations)
  const stageProgressPercent = Math.round((clampedStep / safeTotal) * 100);

  // LAYER 1 (PRIMARY PROGRESS LAYER): Car base position strictly follows active workflow checkpoint (1..8)
  // Bounded within each checkpoint slot so cruise drift never crosses the next checkpoint prematurely
  const carLeftPercent = isFinished
    ? 83
    : Math.min(80, Math.max(6, Math.round(((clampedStep - 0.55) / safeTotal) * 76) + 6));

  // Highlighted track trail behind the car
  const completedTrailPercent = isFinished ? 94 : Math.min(86, carLeftPercent + 4);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="racing-car-track-animation"
      className={`w-full max-w-2xl mx-auto rounded-xl border p-4 space-y-3 shadow-lg relative overflow-hidden transition-colors ${
        isFailed
          ? 'bg-rose-950/30 border-rose-500/50'
          : isFinished
          ? 'bg-emerald-950/30 border-emerald-500/40'
          : 'bg-[#0b101d] border-amber-500/40'
      }`}
    >
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isFailed
                ? 'bg-rose-500'
                : isFinished
                ? 'bg-emerald-400'
                : 'bg-amber-400 animate-ping'
            }`}
          />
          <span
            data-testid="processing-stage-indicator"
            className="font-mono font-semibold text-slate-200"
          >
            {isFailed ? (
              <span className="text-rose-300">
                Terhenti pada Tahap {clampedStep}/{safeTotal} · {stageName}
              </span>
            ) : isFinished ? (
              <span className="text-emerald-300">
                Seluruh Tahap Selesai ({safeTotal}/{safeTotal}) · {stageName}
              </span>
            ) : (
              <>
                <span>
                  Sedang Memproses: Tahap {clampedStep}/{safeTotal}
                </span>
                <span className="text-slate-500 mx-1.5">·</span>
                <span className="text-amber-300 font-sans font-medium">{stageName}</span>
              </>
            )}
          </span>
        </div>

        <div
          data-testid="racing-car-progress-percent"
          className="font-mono text-xs tabular-nums text-amber-400"
        >
          {isFailed ? (
            <span className="text-rose-400 font-semibold">GAGAL</span>
          ) : isFinished ? (
            <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% SELESAI
            </span>
          ) : (
            <span>{stageProgressPercent}%</span>
          )}
        </div>
      </div>

      {/* Horizontal Racing Track & Dynamic Moving Racing Car */}
      <div className="relative py-4 px-3 bg-slate-950/95 rounded-lg border border-slate-800/90 overflow-hidden select-none">
        {/* Subtle Upper & Lower Parallax Track Kerb Markings */}
        <div className="absolute inset-x-4 top-1.5 h-1 overflow-hidden opacity-30 pointer-events-none">
          <div
            data-testid="racing-track-parallax"
            className={`w-[calc(100%+64px)] h-full flex items-center ${
              isRunning ? 'gennas-track-parallax' : ''
            }`}
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #334155 0px, #334155 12px, transparent 12px, transparent 24px)',
            }}
          />
        </div>
        <div className="absolute inset-x-4 bottom-3.5 h-1 overflow-hidden opacity-30 pointer-events-none">
          <div
            className={`w-[calc(100%+64px)] h-full flex items-center ${
              isRunning ? 'gennas-track-parallax' : ''
            }`}
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #334155 0px, #334155 12px, transparent 12px, transparent 24px)',
            }}
          />
        </div>

        {/* Soft Highlight on Traversed Track Path */}
        <div
          data-testid="racing-track-completed-highlight"
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-6 rounded-r-full transition-all duration-700 ease-out pointer-events-none ${
            isFailed
              ? 'bg-gradient-to-r from-rose-500/5 via-rose-500/15 to-rose-500/25'
              : isFinished
              ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/20 to-emerald-400/25'
              : 'bg-gradient-to-r from-sky-500/5 via-amber-500/12 to-amber-400/25'
          }`}
          style={{ width: `${completedTrailPercent}%` }}
        />

        {/* Moving Dashed Road Center Line */}
        <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 h-1 overflow-hidden opacity-45 pointer-events-none">
          <div
            data-testid="racing-road-dashes"
            className={`w-[calc(100%+64px)] h-0.5 ${isRunning ? 'gennas-road-dashes' : ''}`}
            style={{
              backgroundImage: isFailed
                ? 'repeating-linear-gradient(90deg, rgba(244,63,94,0.55) 0px, rgba(244,63,94,0.55) 16px, transparent 16px, transparent 32px)'
                : isFinished
                ? 'repeating-linear-gradient(90deg, rgba(52,211,153,0.65) 0px, rgba(52,211,153,0.65) 16px, transparent 16px, transparent 32px)'
                : 'repeating-linear-gradient(90deg, rgba(251,191,36,0.75) 0px, rgba(251,191,36,0.75) 16px, transparent 16px, transparent 32px)',
            }}
          />
        </div>

        {/* Start Line Gantry */}
        <div
          data-testid="racing-start-line"
          className="absolute left-2.5 top-1 bottom-3 w-2 bg-slate-800/95 rounded-sm border border-slate-700/70 flex flex-col justify-around py-0.5 z-10"
        >
          <div className="w-full h-1.5 bg-slate-300" />
          <div className="w-full h-1.5 bg-slate-700" />
          <div className="w-full h-1.5 bg-slate-300" />
          <div className="w-full h-1.5 bg-slate-700" />
        </div>

        {/* Finish Line Checkered Pillar */}
        <div
          data-testid="racing-finish-line"
          className={`absolute right-2.5 top-1 bottom-3 w-4 rounded-sm border flex flex-col justify-around items-center z-10 transition-colors ${
            isFinished
              ? 'bg-emerald-500/25 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
              : 'bg-gradient-to-b from-amber-400/85 via-slate-900 to-amber-400/85 border-amber-500/40 opacity-90'
          }`}
        >
          <Trophy
            className={`w-3 h-3 ${isFinished ? 'text-emerald-300' : 'text-amber-300'}`}
          />
        </div>

        {/* Car Movement Lane */}
        <div className="relative h-12 w-full flex items-center px-6">
          {/* LAYER 1: Primary Checkpoint Progress Position */}
          <div
            data-testid="racing-car-vehicle"
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out z-20"
            style={{ left: `${carLeftPercent}%` }}
          >
            {/* LAYER 2: Visual Cruising Micro-Drift within Current Checkpoint */}
            <div
              data-testid="racing-car-cruise-drift"
              className={`relative flex items-center ${
                isRunning ? 'gennas-car-cruise-drift' : ''
              }`}
            >
              {/* Animated Exhaust Smoke & Thin Speed Lines (Active strictly while RUNNING) */}
              {isRunning && (
                <div
                  data-testid="racing-car-exhaust-smoke"
                  className="absolute right-full top-1/2 -translate-y-1/2 flex items-center pr-0.5 pointer-events-none"
                >
                  {/* Thin Aerodynamic Speed Lines */}
                  <div className="flex flex-col gap-1.5 items-end mr-1">
                    <div className="w-9 h-[1.5px] bg-gradient-to-l from-amber-300/75 to-transparent rounded-full gennas-speed-line" />
                    <div className="w-12 h-[1px] bg-gradient-to-l from-sky-300/60 to-transparent rounded-full gennas-speed-line" />
                    <div className="w-6 h-[1.5px] bg-gradient-to-l from-amber-400/60 to-transparent rounded-full gennas-speed-line" />
                  </div>

                  {/* Limited Translucent Gray Exhaust Smoke Particles (4 puffs) */}
                  <div className="relative w-7 h-5 flex items-center justify-end">
                    <span className="absolute right-0 top-2 w-2.5 h-2.5 rounded-full bg-slate-300/40 blur-[1px] gennas-exhaust-puff-1" />
                    <span className="absolute right-0.5 top-1.5 w-3 h-3 rounded-full bg-slate-400/35 blur-[1.5px] gennas-exhaust-puff-2" />
                    <span className="absolute right-0 top-2.5 w-2.5 h-2.5 rounded-full bg-slate-300/35 blur-[1px] gennas-exhaust-puff-3" />
                    <span className="absolute right-1 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-400/30 blur-[1.5px] gennas-exhaust-puff-4" />
                  </div>
                </div>
              )}

              {/* Refined Aerodynamic Racing Car SVG */}
              <svg
                className={`w-16 h-9 overflow-visible ${
                  isFailed
                    ? 'drop-shadow-[0_3px_8px_rgba(244,63,94,0.35)]'
                    : isFinished
                    ? 'drop-shadow-[0_3px_10px_rgba(16,185,129,0.4)]'
                    : 'drop-shadow-[0_4px_10px_rgba(245,158,11,0.35)]'
                }`}
                viewBox="0 0 88 40"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="carBodyMainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    {isFailed ? (
                      <>
                        <stop offset="0%" stopColor="#be123c" />
                        <stop offset="55%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#fb7185" />
                      </>
                    ) : isFinished ? (
                      <>
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="55%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </>
                    ) : (
                      <>
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="55%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </>
                    )}
                  </linearGradient>
                  <linearGradient id="cockpitGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="45%" stopColor="#0f172a" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
                  </linearGradient>
                  <linearGradient id="headlightConeGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#fef08a" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Soft Ground Shadow under the Car */}
                <ellipse
                  cx="42"
                  cy="34.5"
                  rx="34"
                  ry="2.8"
                  fill="rgba(2, 6, 23, 0.8)"
                />

                {/* LAYER 3: Isolated Chassis Suspension Bounce Group */}
                <g
                  data-testid="racing-car-chassis-suspension"
                  className={isRunning ? 'gennas-car-suspension' : ''}
                >
                  {/* Rear Exhaust Pipe & Subtle Flame Tip */}
                  <rect x="4" y="24.5" width="5" height="2.2" rx="1" fill="#475569" />
                  {isRunning && (
                    <ellipse cx="3.2" cy="25.6" rx="2.4" ry="1.1" fill="#38bdf8" opacity="0.85" />
                  )}

                  {/* Multi-Element Rear Wing Spoiler */}
                  <path
                    d="M 5 11.5 L 14 11.5 L 13 14.2 L 4 14.2 Z"
                    fill="url(#carBodyMainGrad)"
                  />
                  <path d="M 8 14.2 L 11 14.2 L 12.5 21 L 9.5 21 Z" fill="#334155" />
                  <rect x="4.5" y="10.8" width="2" height="5" rx="0.8" fill="#fbbf24" />

                  {/* Lower Carbon Underbody & Front Splitter */}
                  <path
                    d="M 6 26.5 L 79 26.5 L 81 28.5 L 7 28.5 Z"
                    fill="#1e293b"
                  />

                  {/* Main Aerodynamic GT/LMP Body Shell */}
                  <path
                    d="M 7 21.5 L 17 20.5 L 26 12.5 C 28.5 10.5 32 9.8 36 9.8 L 49 9.8 C 53 9.8 57 11.2 61 14.5 L 71 19.5 L 78 21.5 C 80 22 81 23.2 81 25 L 81 27 L 6 27 L 6 23.5 C 6 22.3 6.5 21.6 7 21.5 Z"
                    fill="url(#carBodyMainGrad)"
                  />

                  {/* Cockpit Glass Canopy & Specular Windshield Highlight */}
                  <path
                    d="M 27.5 13.5 C 29.5 11.6 32.5 11 36 11 L 47.5 11 C 51 11 54.5 12.2 58 15 L 62 18.2 L 24.5 18.2 Z"
                    fill="url(#cockpitGlassGrad)"
                  />
                  <path
                    d="M 46 11.8 L 54 12.8 L 58.5 16.8 L 55 16.8 L 46 12.6 Z"
                    fill="#e0f2fe"
                    opacity="0.45"
                  />

                  {/* Side Aerodynamic Air Intake & Racing Livery Stripe */}
                  <path
                    d="M 30 20.5 L 54 20.5 L 51 24.2 L 33 24.2 Z"
                    fill="#0f172a"
                    opacity="0.65"
                  />
                  <path
                    d="M 14 20.2 L 73 21.2"
                    stroke="#fef08a"
                    strokeWidth="0.9"
                    strokeOpacity="0.7"
                  />

                  {/* Rear LED Tail Light */}
                  <rect
                    x="5.5"
                    y="21.5"
                    width="2"
                    height="2.6"
                    rx="0.8"
                    fill="#f43f5e"
                  />

                  {/* Front LED Headlight Housing & Beam Cone */}
                  <path d="M 75 21.5 L 79.8 22.4 L 79.5 24.2 L 74.5 23.5 Z" fill="#fef9c3" />
                  {!isFailed && (
                    <polygon
                      points="79.5,22 88,18.5 88,26.5 79.5,24.2"
                      fill="url(#headlightConeGrad)"
                    />
                  )}
                </g>

                {/* Wheel Arches Cutout Backing */}
                <circle cx="22" cy="27.5" r="7.4" fill="#020617" />
                <circle cx="64" cy="27.5" r="7.4" fill="#020617" />

                {/* LAYER 4A: Rear Wheel with Rotating Rim Spokes */}
                <g
                  data-testid="racing-car-wheel-rear"
                  className={isRunning ? 'gennas-wheel-spin' : ''}
                  style={{ transformOrigin: '22px 27.5px' }}
                >
                  <circle
                    cx="22"
                    cy="27.5"
                    r="6.4"
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="2"
                  />
                  <circle
                    cx="22"
                    cy="27.5"
                    r="4.3"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                  {/* Wheel Spokes (make rotation clearly visible) */}
                  <line x1="22" y1="23.2" x2="22" y2="31.8" stroke="#94a3b8" strokeWidth="1.1" />
                  <line x1="17.7" y1="27.5" x2="26.3" y2="27.5" stroke="#94a3b8" strokeWidth="1.1" />
                  <line x1="19" y1="24.5" x2="25" y2="30.5" stroke="#64748b" strokeWidth="0.9" />
                  <circle
                    cx="22"
                    cy="27.5"
                    r="1.7"
                    fill={isFailed ? '#f43f5e' : isFinished ? '#10b981' : '#f59e0b'}
                  />
                </g>

                {/* LAYER 4B: Front Wheel with Rotating Rim Spokes */}
                <g
                  data-testid="racing-car-wheel-front"
                  className={isRunning ? 'gennas-wheel-spin' : ''}
                  style={{ transformOrigin: '64px 27.5px' }}
                >
                  <circle
                    cx="64"
                    cy="27.5"
                    r="6.4"
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="2"
                  />
                  <circle
                    cx="64"
                    cy="27.5"
                    r="4.3"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                  {/* Wheel Spokes (make rotation clearly visible) */}
                  <line x1="64" y1="23.2" x2="64" y2="31.8" stroke="#94a3b8" strokeWidth="1.1" />
                  <line x1="59.7" y1="27.5" x2="68.3" y2="27.5" stroke="#94a3b8" strokeWidth="1.1" />
                  <line x1="61" y1="24.5" x2="67" y2="30.5" stroke="#64748b" strokeWidth="0.9" />
                  <circle
                    cx="64"
                    cy="27.5"
                    r="1.7"
                    fill={isFailed ? '#f43f5e' : isFinished ? '#10b981' : '#f59e0b'}
                  />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Track Stage Checkpoints (1..8) */}
        <div
          data-testid="racing-track-checkpoints"
          className="grid grid-cols-8 gap-1 pt-1 px-2 relative z-10"
        >
          {Array.from({ length: safeTotal }, (_, idx) => {
            const stepNum = idx + 1;
            const passed = isFinished || stepNum < clampedStep;
            const current = !isFinished && stepNum === clampedStep;
            return (
              <div
                key={stepNum}
                data-testid={`racing-checkpoint-${stepNum}`}
                className={`h-1.5 rounded-full transition-colors ${
                  isFailed && current
                    ? 'bg-rose-500'
                    : passed
                    ? 'bg-emerald-400'
                    : current
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-800'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Failure message if stopped due to error */}
      {isFailed && errorMessage && (
        <div
          data-testid="racing-car-error-banner"
          className="text-xs text-rose-200 bg-rose-950/70 border border-rose-700/70 rounded-lg p-2.5 flex items-center gap-2 text-left"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

