import React, { useState, useRef, useEffect } from 'react';
import {
  LineChart, Line, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid,
} from 'recharts';

// ── Constants ────────────────────────────────────────────────────────────────

const VERSIONS = [
  { id: 'v2.5.0', date: 'Apr 14, 2026', dotColor: '#d29922', badgeText: 'In Rollout', badgeBg: '#3d2e0a', badgeColor: '#d29922' },
  { id: 'v2.4.0', date: 'Mar 3, 2026',  dotColor: '#3fb950', badgeText: 'Stable',     badgeBg: '#1a3d28', badgeColor: '#3fb950' },
  { id: 'v2.3.1', date: 'Jan 28, 2026', dotColor: '#6e7681', badgeText: 'Deprecated', badgeBg: '#2d2d2d', badgeColor: '#6e7681' },
  { id: 'v2.3.0', date: 'Dec 12, 2025', dotColor: '#6e7681', badgeText: 'Deprecated', badgeBg: '#2d2d2d', badgeColor: '#6e7681' },
];

const SPARKLINES = {
  pages:    [4.1, 4.3, 4.5, 4.4, 4.6, 4.8, 4.9, 5.0, 5.02].map(v => ({ v })),
  visits:   [3.0, 3.1, 3.0, 3.2, 3.3, 3.4, 3.5, 3.55, 3.56].map(v => ({ v })),
  plays:    [2.2, 2.3, 2.35, 2.4, 2.42, 2.45, 2.48, 2.50, 2.51].map(v => ({ v })),
  duration: [26, 25.5, 24.8, 24, 23, 22.5, 21.2, 20.3, 19.85].map(v => ({ v })),
};

const DONUT_DATA = [
  { name: 'v2.5.0', value: 62, color: '#58a6ff' },
  { name: 'v2.4.0', value: 32, color: '#4a5568' },
  { name: 'v2.3.x', value: 6,  color: '#2d3748' },
];

const ADOPTION_DATA = [
  { date: 'Apr 14', pct: 2 },  { date: 'Apr 15', pct: 5 },  { date: 'Apr 16', pct: 9 },
  { date: 'Apr 17', pct: 14 }, { date: 'Apr 18', pct: 19 }, { date: 'Apr 19', pct: 24 },
  { date: 'Apr 20', pct: 29 }, { date: 'Apr 21', pct: 35 }, { date: 'Apr 22', pct: 40 },
  { date: 'Apr 23', pct: 44 }, { date: 'Apr 24', pct: 48 }, { date: 'Apr 25', pct: 52 },
  { date: 'Apr 26', pct: 55 }, { date: 'Apr 27', pct: 58 }, { date: 'Apr 28', pct: 60 },
  { date: 'Apr 29', pct: 62 },
];

const BAR_LABELS = ['Pages / User', 'Visits / User', 'Plays / User', 'Play Duration / User'];

const FILTER_DATA: Record<string, { old: number[]; new: number[] }> = {
  all:    { old: [4.72, 3.18, 2.41, 24.3], new: [5.02, 3.56, 2.51, 19.85] },
  web:    { old: [5.10, 3.45, 2.20, 22.1], new: [5.48, 3.88, 2.38, 21.5] },
  mobile: { old: [4.25, 2.95, 2.60, 26.8], new: [4.52, 3.20, 2.72, 21.9] },
  tv:     { old: [3.90, 2.10, 3.10, 38.4], new: [4.12, 2.25, 3.28, 35.7] },
};

function buildBarData(platformKey: string) {
  const d = FILTER_DATA[platformKey];
  return BAR_LABELS.map((label, i) => {
    const max = Math.max(d.old[i], d.new[i]);
    return {
      label,
      oldNorm: parseFloat((d.old[i] / max * 100).toFixed(1)),
      newNorm: parseFloat((d.new[i] / max * 100).toFixed(1)),
      oldRaw: d.old[i],
      newRaw: d.new[i],
    };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VersionQualityView() {
  const [selectedVersion, setSelectedVersion] = useState('v2.5.0');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [platform, setPlatform] = useState('all');
  const [alertDismissed, setAlertDismissed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const currentVersion = VERSIONS.find(v => v.id === selectedVersion) ?? VERSIONS[0];
  const barData = buildBarData(platform);

  return (
    <div className="bg-[#0d1117] rounded-xl p-6 space-y-5 text-[#e6edf3] text-[13px]">

      {/* REGRESSION ALERT */}
      {!alertDismissed && (
        <div className="bg-[#3d1a1a] border border-[#f85149] rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 text-xs">
          <span className="text-base shrink-0">⚠</span>
          <span className="text-[#ffb3b0]">
            <strong className="text-[#f85149]">Regression detected:</strong>{' '}
            Play Duration per User dropped <strong className="text-[#f85149]">−18.3%</strong> in v2.5.0 vs v2.4.0 across Mobile platform. Investigate before full rollout.
          </span>
          <button
            onClick={() => setAlertDismissed(true)}
            className="ml-auto text-[#f85149] opacity-60 hover:opacity-100 text-base leading-none shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* VERSION HEADER */}
      <div className="bg-[#1c2333] border border-[#2d3748] rounded-xl p-5 flex items-center justify-between gap-5 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <div>
            <div className="text-[18px] font-bold">Version Quality Metrics</div>
            <div className="text-xs text-[#566573] mt-0.5">Tracking quality KPIs across software releases</div>
          </div>

          {/* Version dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="bg-[#161b22] border border-[#2d3748] hover:border-[#58a6ff] rounded-lg px-3.5 py-2 flex items-center gap-2 text-[14px] font-semibold transition-colors min-w-[140px]"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: currentVersion.dotColor }} />
              <span>{selectedVersion}</span>
              <span className="ml-auto text-[10px] text-[#566573]">▾</span>
            </button>
            {dropdownOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 bg-[#1c2333] border border-[#2d3748] rounded-lg p-1.5 min-w-[200px] z-50 shadow-2xl">
                {VERSIONS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVersion(v.id); setDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-[#161b22] transition-colors text-left ${
                      v.id === selectedVersion ? 'bg-[#1f3a5f]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: v.dotColor }} />
                      <div>
                        <div className="text-[13px] font-semibold text-[#e6edf3]">{v.id}</div>
                        <div className="text-[11px] text-[#566573]">Released {v.date}</div>
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0"
                      style={{ background: v.badgeBg, color: v.badgeColor }}
                    >
                      {v.badgeText}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Release meta */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-[#8b98a9]">
            <span className="flex items-center gap-1.5">
              📅 Released <strong className="text-[#e6edf3]">{currentVersion.date}</strong>
            </span>
            <span className="flex items-center gap-1.5">⏱ 15 days since release</span>
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: currentVersion.badgeBg, color: currentVersion.badgeColor }}
            >
              {currentVersion.badgeText}
            </span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button className="px-3.5 py-1.5 text-xs border border-[#2d3748] rounded-md text-[#8b98a9] hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors">
            ⚙ Configure
          </button>
          <button className="px-3.5 py-1.5 text-xs bg-[#58a6ff] text-[#0d1117] font-semibold rounded-md hover:bg-[#79b8ff] transition-colors">
            + Create Alert
          </button>
        </div>
      </div>

      {/* PRE / POST COMPARISON */}
      <div className="bg-[#1c2333] border border-[#2d3748] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <span>◆</span>
            Pre / Post Release Comparison
            <span className="text-[11px] text-[#566573] font-normal hidden sm:inline">
              Comparing 14-day windows around release date
            </span>
          </div>
          <div className="flex bg-[#161b22] border border-[#2d3748] rounded-md overflow-hidden text-[12px]">
            {['14-day window', '7-day window', '30-day window'].map((w, i) => (
              <div
                key={w}
                className={`px-3 py-1.5 cursor-pointer ${i === 0 ? 'bg-[#1c2333] text-[#e6edf3]' : 'text-[#8b98a9] hover:text-[#e6edf3]'}`}
              >
                {w}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_80px_1fr] gap-0 items-start">
          {/* Before */}
          <div className="bg-[#161b22] rounded-lg overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[#2d3748]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#6e7681]" />
                <span className="text-[#8b98a9]">Before v2.5.0</span>
                <span className="text-[11px] text-[#566573]">Mar 31 – Apr 13</span>
              </div>
              <span className="text-[10px] text-[#566573]">v2.4.0</span>
            </div>
            <div className="p-2">
              {[
                { name: 'Pages / User',        val: '4.72' },
                { name: 'Visits / User',        val: '3.18' },
                { name: 'Plays / User',         val: '2.41' },
                { name: 'Play Duration / User', val: '24m 18s' },
              ].map(m => (
                <div key={m.name} className="grid grid-cols-[1fr_auto] items-center px-2 py-2 rounded-md hover:bg-[#1c2333] transition-colors">
                  <div className="text-xs text-[#8b98a9]">{m.name}</div>
                  <div className="text-[15px] font-bold text-[#e6edf3] tabular-nums">{m.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Delta column */}
          <div className="hidden lg:flex flex-col items-center pt-[52px] gap-0">
            {[
              { text: '▲ 6.4%',  pos: true },
              { text: '▲ 11.9%', pos: true },
              { text: '▲ 4.1%',  pos: true },
              { text: '▼ 18.3%', pos: false },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-center h-[44px]">
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-bold"
                  style={{ background: d.pos ? '#1a3d28' : '#3d1a1a', color: d.pos ? '#3fb950' : '#f85149' }}
                >
                  {d.text}
                </span>
              </div>
            ))}
          </div>

          {/* After */}
          <div className="bg-[#161b22] rounded-lg overflow-hidden mt-3 lg:mt-0">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[#2d3748]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#58a6ff]" />
                <span className="text-[#58a6ff]">After v2.5.0</span>
                <span className="text-[11px] text-[#566573]">Apr 14 – Apr 27</span>
              </div>
              <span className="text-[10px] text-[#566573]">v2.5.0</span>
            </div>
            <div className="p-2">
              {[
                { name: 'Pages / User',        val: '5.02',    color: '#3fb950' },
                { name: 'Visits / User',        val: '3.56',    color: '#3fb950' },
                { name: 'Plays / User',         val: '2.51',    color: '#3fb950' },
                { name: 'Play Duration / User', val: '19m 51s', color: '#f85149' },
              ].map(m => (
                <div key={m.name} className="grid grid-cols-[1fr_auto] items-center px-2 py-2 rounded-md hover:bg-[#1c2333] transition-colors">
                  <div className="text-xs text-[#8b98a9]">{m.name}</div>
                  <div className="text-[15px] font-bold tabular-nums" style={{ color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KEY METRIC CARDS */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[#566573] mb-3">
          Key Quality Metrics — v2.5.0 · Last 7 days
          <div className="flex-1 h-px bg-[#2d3748]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '📄', label: 'Pages Viewed / User', value: '5.02',    change: '▲ 6.4%',  pos: true,  spark: 'pages'    as const, color: '#58a6ff', iconBg: '#1f3a5f' },
            { icon: '🔁', label: 'Visits / User',       value: '3.56',    change: '▲ 11.9%', pos: true,  spark: 'visits'   as const, color: '#3fb950', iconBg: '#1a3d28' },
            { icon: '▶',  label: 'Plays / User',        value: '2.51',    change: '▲ 4.1%',  pos: true,  spark: 'plays'    as const, color: '#a371f7', iconBg: 'rgba(163,113,247,0.15)' },
            { icon: '⏱', label: 'Play Duration / User', value: '19m 51s', change: '▼ 18.3%', pos: false, spark: 'duration' as const, color: '#f85149', iconBg: 'rgba(248,81,73,0.12)' },
          ].map(card => (
            <div
              key={card.label}
              className="bg-[#1c2333] border border-[#2d3748] rounded-xl p-5 hover:border-[#3a4a5c] hover:-translate-y-px hover:shadow-2xl transition-all cursor-default relative overflow-hidden group"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#58a6ff] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between mb-3.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: card.iconBg }}
                >
                  {card.icon}
                </div>
                <span
                  className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: card.pos ? '#1a3d28' : '#3d1a1a',
                    color:      card.pos ? '#3fb950' : '#f85149',
                  }}
                >
                  {card.change}
                </span>
              </div>
              <div className="text-[26px] font-extrabold tracking-tight tabular-nums mb-1">{card.value}</div>
              <div className="text-xs text-[#8b98a9] mb-3.5">{card.label}</div>
              <Sparkline data={SPARKLINES[card.spark]} color={card.color} />
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">

        {/* USER SEGMENTATION */}
        <div className="bg-[#1c2333] border border-[#2d3748] rounded-xl p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-2">
            <span>◉</span> User Segmentation by Version
          </div>

          {/* Donut chart */}
          <div className="relative w-40 h-40 mx-auto my-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DONUT_DATA}
                  dataKey="value"
                  innerRadius="65%"
                  outerRadius="90%"
                  strokeWidth={3}
                  stroke="#1c2333"
                  startAngle={90}
                  endAngle={-270}
                >
                  {DONUT_DATA.map(entry => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1c2333', border: '1px solid #2d3748', borderRadius: '6px', fontSize: '11px' }}
                  formatter={(v: number) => [`${v}% of active users`]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[22px] font-extrabold text-[#58a6ff]">62%</div>
              <div className="text-[10px] text-[#566573] mt-0.5">on v2.5.0</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 mt-3">
            {[
              { dot: '#58a6ff', name: 'v2.5.0 · In Rollout', count: '834,221 active users', pct: '62%' },
              { dot: '#6e7681', name: 'v2.4.0 · Stable',     count: '432,108 active users', pct: '32%' },
              { dot: '#3d4960', name: 'v2.3.x · Deprecated', count: '81,095 active users',  pct: '6%' },
            ].map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.dot }} />
                  <div>
                    <div className="text-xs text-[#8b98a9]">{item.name}</div>
                    <div className="text-[11px] text-[#566573]">{item.count}</div>
                  </div>
                </div>
                <div className="text-xs font-bold">{item.pct}</div>
              </div>
            ))}
          </div>

          {/* Adoption timeline */}
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#566573] mb-2">
              Adoption Rate — v2.5.0
            </div>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ADOPTION_DATA} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="adoptionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#58a6ff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#58a6ff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="pct" stroke="#58a6ff" strokeWidth={2} fill="url(#adoptionGrad)" dot={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#1c2333', border: '1px solid #2d3748', borderRadius: '6px', fontSize: '11px' }}
                    formatter={(v: number) => [`${v}% on v2.5.0`]}
                    labelStyle={{ color: '#8b98a9' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#566573]">Apr 14</span>
              <span className="text-[10px] text-[#566573]">Apr 21</span>
              <span className="text-[10px] text-[#566573]">Apr 28</span>
            </div>
          </div>
        </div>

        {/* GROUPED BAR CHART */}
        <div className="bg-[#1c2333] border border-[#2d3748] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <span>▦</span> Old vs New Version — All Metrics
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'web', 'mobile', 'tv'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-2.5 py-1 text-[11px] border rounded transition-colors ${
                    platform === p
                      ? 'border-[#58a6ff] text-[#58a6ff] bg-[#1f3a5f]'
                      : 'border-[#2d3748] text-[#8b98a9] bg-[#161b22] hover:border-[#58a6ff] hover:text-[#58a6ff] hover:bg-[#1f3a5f]'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mb-2 items-center flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-[#8b98a9]">
              <div className="w-3 h-1 rounded" style={{ background: '#6e7681' }} />
              v2.4.0 (baseline)
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8b98a9]">
              <div className="w-3 h-1 rounded" style={{ background: '#58a6ff' }} />
              v2.5.0 (current)
            </div>
            <div className="ml-auto text-[11px] text-[#566573] hidden sm:block">
              Normalized values (higher = better)
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#8b98a9', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8b98a9', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                  domain={[0, 110]}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ background: '#1c2333', border: '1px solid #2d3748', borderRadius: '6px', fontSize: '11px' }}
                  formatter={(value: number, name: string, item: any) => {
                    const raw = name === 'oldNorm' ? item.payload.oldRaw : item.payload.newRaw;
                    const label = name === 'oldNorm' ? 'v2.4.0' : 'v2.5.0';
                    return [String(raw), label];
                  }}
                  labelStyle={{ color: '#8b98a9' }}
                />
                <Bar dataKey="oldNorm" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill="rgba(110,118,129,0.5)" />
                  ))}
                </Bar>
                <Bar dataKey="newNorm" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {barData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.newNorm > entry.oldNorm
                          ? 'rgba(63,185,80,0.6)'
                          : entry.newNorm < entry.oldNorm
                          ? 'rgba(248,81,73,0.6)'
                          : 'rgba(88,166,255,0.6)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
