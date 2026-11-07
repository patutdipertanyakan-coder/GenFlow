import React, { useMemo } from 'react';
import { StageConfig, LOCKED_WPM } from '../lib/types';
import { Gauge, Lock } from 'lucide-react';

interface StoryFlowSpeedometerProps {
  durationMinutes: number;
  wpm?: number;
  stagePlan: { totalTargetWords: number; stages: StageConfig[] };
  onDurationChange: (duration: number) => void;
  onStructureChange?: (struktur: number[]) => void;
}

const DURATION_PRESETS = [2, 12, 20, 30, 50];

// Precomputed tachometer minor & major tick geometry for viewBox="0 0 220 130", center=(110, 108)
const TACHOMETER_TICKS = Array.from({ length: 21 }, (_, idx) => {
  const ratio = idx / 20; // 0..1 across 180deg semicircle
  const deg = -90 + ratio * 180; // -90deg (left) to +90deg (right)
  const rad = ((deg - 90) * Math.PI) / 180; // SVG polar angle (-180deg to 0deg)
  const isMajor = idx % 5 === 0;
  const presetIndex = isMajor ? idx / 5 : -1;
  const rOuter = 88;
  const rInner = isMajor ? 79 : 83.5;
  const rLabel = 98;
  return {
    idx,
    isMajor,
    presetIndex,
    label: isMajor ? `${DURATION_PRESETS[presetIndex]}m` : '',
    x1: Number((110 + rInner * Math.cos(rad)).toFixed(2)),
    y1: Number((108 + rInner * Math.sin(rad)).toFixed(2)),
    x2: Number((110 + rOuter * Math.cos(rad)).toFixed(2)),
    y2: Number((108 + rOuter * Math.sin(rad)).toFixed(2)),
    lx: Number((110 + rLabel * Math.cos(rad)).toFixed(2)),
    ly: Number((108 + rLabel * Math.sin(rad)).toFixed(2)),
  };
});

// Dynamic color mapping for the 5 StoryFlow stages
const STAGE_COLORS = [
  { name: 'Hook', color: 'from-amber-500 to-amber-600', text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  { name: 'Akar Masalah', color: 'from-sky-500 to-sky-600', text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
  { name: 'Inti Masalah', color: 'from-purple-500 to-purple-600', text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  { name: 'Penyelesaian', color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  { name: 'Kesimpulan', color: 'from-rose-500 to-rose-600', text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
];

export const StoryFlowSpeedometer: React.FC<StoryFlowSpeedometerProps> = ({
  durationMinutes,
  wpm = LOCKED_WPM,
  stagePlan,
  onDurationChange,
  onStructureChange,
}) => {
  // Determine index of active duration preset or closest
  const activePresetIndex = useMemo(() => {
    const idx = DURATION_PRESETS.indexOf(durationMinutes);
    if (idx !== -1) return idx;
    let closestIdx = 0;
    let minDiff = Math.abs(durationMinutes - DURATION_PRESETS[0]);
    DURATION_PRESETS.forEach((p, i) => {
      const diff = Math.abs(durationMinutes - p);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    });
    return closestIdx;
  }, [durationMinutes]);

  // LAYER 1 (DATA LAYER): Base needle angle strictly follows selected duration (-90deg for 2min to +90deg for 50min)
  // 5 points: angle = -90 + (index * 45) -> -90, -45, 0, +45, +90
  const needleAngle = -90 + activePresetIndex * 45;
  const totalWords = durationMinutes * wpm;

  // Active arc percentage along semicircular gauge (minimum 7% glow cap at 2m so starting sector is illuminated)
  const activeArcPercent = activePresetIndex === 0 ? 7 : (activePresetIndex / 4) * 100;

  // LAYER 2 (ANIMATION LAYER): Pure visual RPM idle class bounded within dial stops (-90deg..+90deg)
  const idleNeedleClass =
    activePresetIndex === 0
      ? 'gennas-rpm-needle-idle-low'
      : activePresetIndex === 4
      ? 'gennas-rpm-needle-idle-high'
      : 'gennas-rpm-needle-idle';

  // Proportional car horizontal position strictly contained inside the speedometer box (14% to 82%)
  const carTrackPercent = 14 + activePresetIndex * 17;

  return (
    <div
      data-testid="storyflow-speedometer-panel"
      className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3 overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="text-xs font-semibold tracking-wide text-slate-100 uppercase">
            DURASI & STORYFLOW
          </h3>
        </div>
        <span
          data-tooltip="Kecepatan baca lisan dikunci pada 135 kata/menit."
          className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25"
        >
          <Lock className="w-3 h-3" />
          <span>{wpm} WPM</span>
        </span>
      </div>

      {/* Speedometer Gauge Visual + Contained Proportional Mini Car */}
      <div className="flex flex-col items-center justify-center relative">
        <div
          data-testid="speedometer-gauge-box"
          className="w-full max-w-[244px] bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 border border-slate-800/90 rounded-xl pt-2 pb-2.5 px-3 flex flex-col items-center overflow-hidden select-none relative shadow-inner"
        >
          {/* Full Unclipped Semicircular Racing Tachometer SVG */}
          <div className="w-full aspect-[220/128] max-h-[132px] relative flex items-center justify-center">
            <svg
              data-testid="speedometer-svg-dial"
              className="w-full h-full overflow-visible"
              viewBox="0 0 220 130"
              aria-label={`Speedometer durasi ${durationMinutes} menit`}
            >
              <defs>
                <linearGradient id="speedometerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="needleBodyGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="70%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#fef08a" />
                </linearGradient>
                <radialGradient id="dialAmbientGlow" cx="50%" cy="84%" r="62%">
                  <stop offset="0%" stopColor="rgba(245, 158, 11, 0.16)" />
                  <stop offset="65%" stopColor="rgba(56, 189, 248, 0.05)" />
                  <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
                </radialGradient>
                <filter id="needleSoftGlow" x="-35%" y="-35%" width="170%" height="170%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Subtle cockpit ambient glow */}
              <ellipse cx="110" cy="106" rx="86" ry="74" fill="url(#dialAmbientGlow)" />

              {/* Outer fine instrument bezel arc */}
              <path
                d="M 22 108 A 88 88 0 0 1 198 108"
                fill="none"
                stroke="#1e293b"
                strokeWidth="1.25"
                strokeOpacity="0.85"
              />

              {/* Background semicircular gauge track (full 180deg arc, never clipped) */}
              <path
                d="M 38 108 A 72 72 0 0 1 182 108"
                fill="none"
                stroke="#0f172a"
                strokeWidth="12"
                strokeLinecap="round"
                pathLength="100"
              />
              <path
                d="M 38 108 A 72 72 0 0 1 182 108"
                fill="none"
                stroke="#1e293b"
                strokeWidth="10"
                strokeLinecap="round"
                pathLength="100"
              />

              {/* Active illuminated gauge arc with gentle pulse */}
              <path
                data-testid="speedometer-active-arc"
                d="M 38 108 A 72 72 0 0 1 182 108"
                fill="none"
                stroke="url(#speedometerGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={`${activeArcPercent} 100`}
                className="transition-all duration-500 ease-out gennas-arc-pulse"
              />

              {/* Inner cockpit telemetry reference arc */}
              <path
                d="M 52 108 A 58 58 0 0 1 168 108"
                fill="none"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2.5 3.5"
                strokeOpacity="0.55"
              />

              {/* Tachometer ticks & 5 preset scale labels */}
              {TACHOMETER_TICKS.map((t) => {
                const isReached = t.presetIndex !== -1 && t.presetIndex <= activePresetIndex;
                const isSelected = t.presetIndex === activePresetIndex;
                return (
                  <g key={t.idx}>
                    <line
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      stroke={
                        isSelected
                          ? '#fbbf24'
                          : isReached
                          ? '#38bdf8'
                          : t.isMajor
                          ? '#64748b'
                          : '#334155'
                      }
                      strokeWidth={t.isMajor ? 2 : 1}
                      strokeLinecap="round"
                    />
                    {t.isMajor && (
                      <text
                        x={t.lx}
                        y={t.ly}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="7.5"
                        fontWeight={isSelected ? '700' : '600'}
                        fill={isSelected ? '#fbbf24' : isReached ? '#bae6fd' : '#64748b'}
                        className="font-mono"
                      >
                        {t.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Small RPM label inside dial */}
              <text
                x="110"
                y="78"
                textAnchor="middle"
                fontSize="6.5"
                letterSpacing="1.4"
                fill="#64748b"
                className="font-mono uppercase"
              >
                RPM · SCTF
              </text>

              {/* LAYER 1: Data Layer Base Needle Rotation (strictly bound to durationMinutes) */}
              <g
                data-testid="speedometer-needle-base"
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                  transformOrigin: '110px 108px',
                  transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {/* LAYER 2: Visual Idle RPM Oscillation Layer (never mutates duration state) */}
                <g
                  data-testid="speedometer-needle-idle"
                  className={idleNeedleClass}
                  style={{ transformOrigin: '110px 108px' }}
                >
                  {/* Tapered Racing Tachometer Needle pointing straight up at 0deg from pivot (110, 108) to tip (110, 38) */}
                  <polygon
                    points="107.8,108 109.2,40 110,36 110.8,40 112.2,108"
                    fill="url(#needleBodyGrad)"
                    filter="url(#needleSoftGlow)"
                  />
                  {/* Illuminated Needle Tip */}
                  <circle cx="110" cy="40" r="1.9" fill="#fef9c3" />
                </g>
              </g>

              {/* Center Hub Pivot with Soft Glow */}
              <circle
                cx="110"
                cy="108"
                r="11"
                fill="rgba(245, 158, 11, 0.22)"
                className="gennas-hub-glow"
              />
              <circle
                cx="110"
                cy="108"
                r="7.5"
                fill="#0f172a"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <circle cx="110" cy="108" r="2.6" fill="#fbbf24" />
            </svg>
          </div>

          {/* Contained Proportional Mini Car Track */}
          <div className="w-full h-6 mt-0.5 relative bg-slate-950/90 rounded-md border border-slate-800/80 overflow-hidden flex items-center px-2">
            <div className="w-full border-t border-dashed border-slate-700/70 pointer-events-none" />
            <div
              data-testid="speedometer-car-indicator"
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out flex items-center pointer-events-none"
              style={{ left: `${carTrackPercent}%` }}
            >
              <div className="w-4 h-1.5 bg-gradient-to-l from-amber-400/50 to-transparent rounded-full blur-[1px] -mr-0.5" />
              <svg
                className="w-6 h-3.5 text-amber-400 drop-shadow-sm shrink-0"
                viewBox="0 0 64 32"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4,18 L12,18 L18,10 L38,10 L48,16 L60,18 C62,18 63,19 63,21 L63,24 L56,24 L56,22 C56,20 53,20 53,22 L53,24 L20,24 L20,22 C20,20 17,20 17,22 L17,24 L1,24 L1,21 C1,19 2,18 4,18 Z" />
                <path d="M22,12 L35,12 L43,16 L22,16 Z" fill="#0f172a" />
                <circle cx="50" cy="23" r="4.5" fill="#020617" stroke="#f59e0b" strokeWidth="2" />
                <circle cx="15" cy="23" r="4.5" fill="#020617" stroke="#f59e0b" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Dynamic Readout display */}
        <div className="text-center mt-2">
          <div
            data-testid="speedometer-duration-readout"
            className="text-lg font-bold font-mono text-amber-400 tabular-nums leading-tight"
          >
            {durationMinutes} <span className="text-xs font-sans text-slate-400 font-normal">Menit</span>
          </div>
          <div
            data-testid="speedometer-words-readout"
            className="text-[11px] font-mono text-slate-400 tabular-nums"
          >
            Target: <strong className="text-slate-200">{totalWords} Kata</strong>
          </div>
        </div>
      </div>

      {/* Preset Selector Buttons */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-medium text-slate-400 text-center uppercase tracking-wider">
          PILIH DURASI NASKAH
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {DURATION_PRESETS.map((preset) => {
            const isActive = durationMinutes === preset;
            return (
              <button
                key={preset}
                type="button"
                data-testid={`duration-preset-${preset}`}
                onClick={() => onDurationChange(preset)}
                data-tooltip={`Setel durasi ${preset} menit (${preset * wpm} kata).`}
                className={`py-1.5 px-1 rounded-lg text-xs font-mono font-semibold tabular-nums transition-all border text-center cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>{preset}m</div>
                <div className="text-[10px] opacity-75 font-normal">{preset * wpm}kt</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5-Stage StoryFlow Allocation Visual Cards */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
          <span>BOBOT 5 BLOK STORYFLOW</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="apply-storyflow-button"
              data-tooltip="Ganti proporsi Inti Masalah (45% vs 60%)."
              onClick={() => {
                const isCurrent60 = stagePlan.stages[2]?.weightPercent === 60;
                const newStruktur = isCurrent60
                  ? [8, 17, 45, 20, 10]
                  : [5, 10, 60, 15, 10];
                if (onStructureChange) {
                  onStructureChange(newStruktur);
                }
              }}
              className="px-2 py-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 rounded transition-colors cursor-pointer"
            >
              Ubah Bobot
            </button>
            <span className="font-mono text-[10px] text-slate-400">100%</span>
          </div>
        </div>

        {/* Progress Bar Breakdown */}
        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
          {stagePlan.stages.map((st, i) => (
            <div
              key={st.id}
              style={{ width: `${st.weightPercent}%` }}
              data-tooltip={`${st.name}: ${st.weightPercent}% (${st.targetWords} kata)`}
              className={`h-full bg-gradient-to-r ${STAGE_COLORS[i]?.color || 'from-amber-500 to-amber-600'} border-r border-slate-950/40 last:border-0`}
            />
          ))}
        </div>

        {/* Detailed Stage Word Distribution List */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 pt-0.5">
          {stagePlan.stages.map((st, i) => {
            const col = STAGE_COLORS[i] || STAGE_COLORS[0];
            return (
              <div
                key={st.id}
                className={`p-1.5 rounded-lg border text-xs space-y-0.5 ${col.bg} ${col.border}`}
              >
                <div className={`font-semibold text-[10px] truncate ${col.text}`}>
                  {st.id}. {st.name}
                </div>
                <div className="flex items-baseline justify-between font-mono text-[10px] text-slate-200 tabular-nums">
                  <span>{st.weightPercent}%</span>
                  <span className="text-[9px] text-slate-400">{st.targetWords}kt</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

