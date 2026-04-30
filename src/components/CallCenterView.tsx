import React, { useState } from 'react';

// ── Mock Data ─────────────────────────────────────────────────────────────────

interface SlaRow {
  id: string;
  subject: string;
  openedAt: string;
  openedMinutesAgo: number;
  threadLength: number;
  copilotSummary?: string;
  label: 'V1' | 'Mako' | 'N12';
}

const ALL_ROWS: SlaRow[] = [
  {
    id: 'e1',
    subject: 'VOD playback failure on Android 14 — app crashes after 3 seconds',
    openedAt: '10:51 AM',
    openedMinutesAgo: 8,
    threadLength: 0,
    label: 'V1',
  },
  {
    id: 'e2',
    subject: 'Login loop: user cannot authenticate after password reset',
    openedAt: '10:38 AM',
    openedMinutesAgo: 21,
    threadLength: 2,
    copilotSummary: 'Customer resolved after agent confirmed account reset and cleared token cache.',
    label: 'Mako',
  },
  {
    id: 'e3',
    subject: 'Missing subtitles on live broadcast — N12 evening news',
    openedAt: '10:14 AM',
    openedMinutesAgo: 45,
    threadLength: 0,
    label: 'N12',
  },
  {
    id: 'e4',
    subject: 'Billing discrepancy: charged twice for monthly subscription',
    openedAt: '09:55 AM',
    openedMinutesAgo: 64,
    threadLength: 0,
    label: 'V1',
  },
  {
    id: 'e5',
    subject: 'Push notifications not arriving on iOS 17.4',
    openedAt: '09:42 AM',
    openedMinutesAgo: 77,
    threadLength: 3,
    copilotSummary: 'Agent identified APNS certificate expiry; DevOps notified and renewal in progress.',
    label: 'Mako',
  },
  {
    id: 'e6',
    subject: 'Casting to Chromecast freezes after 10 minutes of playback',
    openedAt: '09:30 AM',
    openedMinutesAgo: 89,
    threadLength: 0,
    label: 'N12',
  },
  {
    id: 'e7',
    subject: 'Search results returning empty for Hebrew content since last deploy',
    openedAt: '10:29 AM',
    openedMinutesAgo: 30,
    threadLength: 1,
    copilotSummary: 'Elasticsearch index rebuild triggered; customer asked to retry in 30 minutes.',
    label: 'V1',
  },
  {
    id: 'e8',
    subject: 'Home screen thumbnails broken — shows grey placeholder on all tiles',
    openedAt: '10:05 AM',
    openedMinutesAgo: 54,
    threadLength: 0,
    label: 'Mako',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function agingLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
}

type SlaState = 'green' | 'yellow' | 'red' | 'replied';

function slaState(row: SlaRow): SlaState {
  if (row.threadLength > 0) return 'replied';
  if (row.openedMinutesAgo >= 60) return 'red';
  if (row.openedMinutesAgo >= 30) return 'yellow';
  return 'green';
}

const LABEL_OPTIONS = ['All', 'V1', 'Mako', 'N12'] as const;
type LabelFilter = typeof LABEL_OPTIONS[number];

// ── Sub-components ────────────────────────────────────────────────────────────

function SlaStatusDot({ state }: { state: SlaState }) {
  const configs: Record<SlaState, { bg: string; label: string }> = {
    green:   { bg: 'bg-emerald-500', label: 'Open < 15 min' },
    yellow:  { bg: 'bg-amber-400',   label: '> 30 min, no reply' },
    red:     { bg: 'bg-red-500',     label: 'SLA breach > 1 hr' },
    replied: { bg: 'bg-slate-500',   label: 'Replied' },
  };
  const { bg, label } = configs[state];
  return (
    <span title={label} className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1 ${bg}`} />
  );
}

function SubjectCell({ row }: { row: SlaRow }) {
  const state = slaState(row);

  const textClass =
    state === 'green'   ? 'text-emerald-400' :
    state === 'yellow'  ? 'text-amber-400' :
    state === 'red'     ? 'text-red-400 animate-pulse' :
    'text-slate-300';

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {row.copilotSummary && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Copilot summary</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-700/60 rounded-full px-2.5 py-1 w-fit max-w-full">
            <span>✨</span>
            <span className="truncate">{row.copilotSummary}</span>
          </span>
        </div>
      )}
      <span className={`text-sm font-medium leading-snug ${textClass}`}>
        {row.subject}
      </span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`w-2 h-2 rounded-full inline-block ${color}`} />
      {label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CallCenterView() {
  const [activeLabel, setActiveLabel] = useState<LabelFilter>('All');

  const filtered = ALL_ROWS
    .filter(r => activeLabel === 'All' || r.label === activeLabel)
    .sort((a, b) => a.openedMinutesAgo - b.openedMinutesAgo);

  const breachCount  = ALL_ROWS.filter(r => slaState(r) === 'red').length;
  const warningCount = ALL_ROWS.filter(r => slaState(r) === 'yellow').length;
  const openCount    = ALL_ROWS.filter(r => r.threadLength === 0).length;

  return (
    <div className="min-h-screen rounded-2xl" style={{ background: '#0f172a' }}>
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              Call Center — External Support
            </h1>
            <p className="text-sm text-slate-400 mt-1">SLA Monitoring · Outlook Inbox</p>
          </div>

          {/* Label filter pills */}
          <div className="flex items-center gap-2">
            {LABEL_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setActiveLabel(opt)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  activeLabel === opt
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-800/70 border border-slate-700/60 px-5 py-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Open Threads</span>
            <span className="text-3xl font-extrabold text-slate-100">{openCount}</span>
            <span className="text-xs text-slate-500">Awaiting first reply</span>
          </div>
          <div className="rounded-xl bg-slate-800/70 border border-amber-600/30 px-5 py-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-widest">SLA Warning</span>
            <span className="text-3xl font-extrabold text-amber-400">{warningCount}</span>
            <span className="text-xs text-slate-500">&gt; 30 min, no reply</span>
          </div>
          <div className="rounded-xl bg-slate-800/70 border border-red-600/40 px-5 py-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-red-500 uppercase tracking-widest">SLA Breach</span>
            <span className="text-3xl font-extrabold text-red-400 animate-pulse">{breachCount}</span>
            <span className="text-xs text-slate-500">&gt; 1 hr, no reply</span>
          </div>
        </div>

        {/* SLA table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Inbox — sorted newest first
            </h2>
            <div className="flex items-center gap-4">
              <LegendItem color="bg-emerald-500" label="< 15 min" />
              <LegendItem color="bg-amber-400"   label="> 30 min" />
              <LegendItem color="bg-red-500"     label="Breach" />
              <LegendItem color="bg-slate-500"   label="Replied" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/80">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-8" />
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Opened At</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Aging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map(row => {
                  const state = slaState(row);
                  return (
                    <tr key={row.id} className="bg-slate-800/40 hover:bg-slate-700/40 transition-colors align-top">
                      <td className="px-5 py-4">
                        <SlaStatusDot state={state} />
                      </td>
                      <td className="px-5 py-4">
                        <SubjectCell row={row} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-semibold text-slate-300 bg-slate-700 px-2 py-0.5 rounded-full">
                          {row.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs text-slate-400 font-mono">{row.openedAt}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold font-mono ${
                            state === 'red'    ? 'text-red-400' :
                            state === 'yellow' ? 'text-amber-400' :
                            state === 'green'  ? 'text-emerald-400' :
                            'text-slate-500'
                          }`}
                        >
                          {agingLabel(row.openedMinutesAgo)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mt-2.5 text-right">
            Simulated data · Outlook Copilot summaries powered by Microsoft 365
          </p>
        </section>

      </div>
    </div>
  );
}
