import React from 'react';
import { X } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const trendData = [
  { day: 'Apr 24', pct: 99.6 },
  { day: 'Apr 25', pct: 99.7 },
  { day: 'Apr 26', pct: 99.9 },
  { day: 'Apr 27', pct: 99.8 },
  { day: 'Apr 28', pct: 99.7 },
  { day: 'Apr 29', pct: 99.9 },
  { day: 'Apr 30', pct: 99.8 },
];

const topCrashes = [
  { issue: 'NullPointerException in HomeFragment',      occurrences: 5, affected: 3, last: '2h ago' },
  { issue: 'IndexOutOfBoundsException in FeedAdapter',  occurrences: 4, affected: 2, last: '5h ago' },
  { issue: 'ANR in MainActivity',                       occurrences: 3, affected: 2, last: '1d ago' },
  { issue: 'IllegalStateException in PlayerService',    occurrences: 1, affected: 1, last: '2d ago' },
];

export default function CrashlyticsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100">
          <span className="text-2xl leading-none">🔥</span>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Crash-Free Users</h2>
            <p className="text-xs text-slate-400">Firebase Crashlytics · Last 7 days</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Crash-Free Users', value: '99.8%',  color: '#1fb893' },
              { label: 'Total Crashes',    value: '12',     color: '#f59e0b' },
              { label: 'Affected Users',   value: '7',      color: '#ef4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-2xl font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 mb-3">Daily Crash-Free % — Last 7 Days</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1fb893" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1fb893" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis domain={[99.4, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v: number) => [`${v}%`, 'Crash-Free']}
                />
                <Area type="monotone" dataKey="pct" stroke="#1fb893" strokeWidth={2} fill="url(#cfGrad)" dot={{ r: 3, fill: '#1fb893' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top crashes table */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <p className="text-xs font-medium text-slate-500 px-4 pt-4 pb-2">Top Crashes</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-slate-200 bg-slate-100">
                  <th className="text-left text-xs font-medium text-slate-400 px-4 py-2">Issue</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Occurrences</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Affected</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 py-2">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {topCrashes.map((row, i) => (
                  <tr key={i} className="border-t border-slate-200 hover:bg-slate-100 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 font-mono text-xs max-w-xs truncate">{row.issue}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{row.occurrences}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{row.affected}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400 text-xs">{row.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-400 text-center">
            Data sourced from Firebase Crashlytics · Last 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
