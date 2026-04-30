import React from 'react';

// ── Mock Data ────────────────────────────────────────────────────────────────

const teams = [
  {
    id: '12plus',
    name: '12+',
    logo: '/small_12+_logo.png',
    logoClass: 'h-8 object-contain',
    runNumber: '#232',
    total: 171,
    passed: 91,
    failed: 80,
    skipped: 0,
    passRate: 53,
    defects: { productBug: 0, automationBug: 0, systemIssue: 0, toInvestigate: 80 },
  },
  {
    id: 'mako',
    name: 'MAKO',
    logo: '/small_mako_logo.png',
    logoClass: 'h-8 object-contain',
    runNumber: '#258',
    total: 68,
    passed: 52,
    failed: 16,
    skipped: 0,
    passRate: 76,
    defects: { productBug: 2, automationBug: 0, systemIssue: 0, toInvestigate: 14 },
  },
  {
    id: 'v1',
    name: 'V1',
    logo: '/small_v1_logo.png',
    logoClass: 'h-8 object-contain',
    runNumber: '#202',
    total: 20,
    passed: 15,
    failed: 5,
    skipped: 0,
    passRate: 75,
    defects: { productBug: 0, automationBug: 0, systemIssue: 0, toInvestigate: 5 },
  },
];

const platforms = [
  { name: 'androidweb', passingRate: 40.81, testCases: 1720 },
  { name: 'iosweb',     passingRate: 48.10, testCases: 1740 },
  { name: 'web',        passingRate: 58.82, testCases: 1768 },
  { name: 'android',    passingRate: 66.55, testCases: 1393 },
  { name: 'ios',        passingRate: 72.00, testCases: 1250 },
];

const suites = [
  { name: 'ClickLive8BTest',                    desc: 'Click on live — check click and pv',                  status: 'Passed', duration: '1m 26s' },
  { name: 'ScrollInHomePage2Test',              desc: 'Scroll in homePage screen — check second play',       status: 'Passed', duration: '2m 07s' },
  { name: 'ExtendedUserNoAddsInLive11Test',     desc: 'Login extended user — play live, check no ads',      status: 'Passed', duration: '2m 27s' },
  { name: 'ClickPrograms8ATest',                desc: 'Click on programs — check click and pv',             status: 'Passed', duration: '0m 44s' },
  { name: 'ClickTeaser8CTest',                  desc: 'Click on vod — check click and pv',                  status: 'Passed', duration: '1m 24s' },
  { name: 'ExtendedUserNoAddsInVOD12Test',      desc: 'Login extended user — play vod, check no ads',       status: 'Passed', duration: '2m 39s' },
  { name: 'PlayLiveSomeActions5Test',           desc: 'Play live — pause, play, backToLive, start',         status: 'Passed', duration: '2m 10s' },
  { name: 'ExtendedUserBraze14Test',            desc: 'Login extended user — play vod, check Braze reporting', status: 'Passed', duration: '3m 24s' },
  { name: 'FullLoginProcessExtendedUser10Test', desc: 'Login extended user — check click and pv',           status: 'Passed', duration: '3m 27s' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function passRateColor(rate: number) {
  if (rate >= 80) return '#22c55e';
  if (rate >= 60) return '#f59e0b';
  return '#ef4444';
}

function platformBarColor(rate: number) {
  if (rate > 80) return '#22c55e';
  if (rate >= 50) return '#f59e0b';
  return '#ef4444';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TeamCard({ team }: { team: typeof teams[0] }) {
  const { passed, failed, skipped, total, passRate, defects, runNumber, logo, logoClass, name } = team;
  const passW  = total > 0 ? (passed  / total) * 100 : 0;
  const failW  = total > 0 ? (failed  / total) * 100 : 0;
  const skipW  = total > 0 ? (skipped / total) * 100 : 0;
  const color  = passRateColor(passRate);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/70 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            <img src={logo} alt={name} className={logoClass} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Team</span>
            <h3 className="text-base font-bold text-slate-100 leading-none mt-0.5">{name}</h3>
          </div>
        </div>
        <span className="text-xs font-mono bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
          Run {runNumber}
        </span>
      </div>

      {/* Pass rate */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-3xl font-extrabold leading-none" style={{ color }}>{passRate}%</span>
          <span className="text-xs text-slate-500 ml-1.5">pass rate</span>
        </div>
        <span className="text-xs text-slate-400">{total} tests total</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        <div className="bg-green-500 rounded-l-full transition-all" style={{ width: `${passW}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${failW}%` }} />
        {skipped > 0 && <div className="bg-slate-500 rounded-r-full transition-all" style={{ width: `${skipW}%` }} />}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{passed} passed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{failed} failed</span>
        {skipped > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />{skipped} skipped</span>}
      </div>

      {/* Defect breakdown */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {[
          ['Product Bug',     defects.productBug,     '#ef4444'],
          ['Automation Bug',  defects.automationBug,  '#f59e0b'],
          ['System Issue',    defects.systemIssue,    '#6366f1'],
          ['To Investigate',  defects.toInvestigate,  '#94a3b8'],
        ].map(([label, count, dot]) => (
          <div key={label as string} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dot as string }} />
              {label}
            </span>
            <span className="font-semibold text-slate-200">{count as number}</span>
          </div>
        ))}
      </div>

      {/* Link */}
      <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors self-start mt-auto">
        View Full Report →
      </button>
    </div>
  );
}

function PlatformTile({ platform }: { platform: typeof platforms[0] }) {
  const { name, passingRate, testCases } = platform;
  const color = platformBarColor(passingRate);
  const passing = passingRate >= 50;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/70 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200 capitalize">{name}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={passing
            ? { background: '#14532d44', color: '#4ade80' }
            : { background: '#4c0519aa', color: '#f87171' }}
        >
          {passing ? 'Passing' : 'Failing'}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Pass rate</span>
          <span className="font-semibold" style={{ color }}>{passingRate.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${passingRate}%`, background: color }}
          />
        </div>
      </div>

      <span className="text-xs text-slate-500">{testCases.toLocaleString()} test cases</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AutomationResultsView() {
  return (
    <div className="min-h-screen rounded-2xl" style={{ background: '#0f172a' }}>
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Automation Results</h1>
            <p className="text-sm text-slate-400 mt-1">Nightly Run Summary — Latest Builds</p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full mt-1">
            Last updated: today
          </span>
        </div>

        {/* Team cards */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {teams.map(t => <TeamCard key={t.id} team={t} />)}
          </div>
        </section>

        {/* Platform breakdown */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Platforms Breakdown
            <span className="ml-2 text-slate-600 normal-case tracking-normal font-normal">(12+ Latest)</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {platforms.map(p => <PlatformTile key={p.name} platform={p} />)}
          </div>
        </section>

        {/* Test suite spotlight */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Test Suite Spotlight</h2>
          <div className="rounded-xl border border-slate-700/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/80">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Suite</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Description</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {suites.map((s, i) => (
                  <tr key={i} className="bg-slate-800/40 hover:bg-slate-700/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-slate-300">{s.name}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-400">{s.desc}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: '#14532d55', color: '#4ade80' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono text-xs text-slate-400">{s.duration}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mt-2.5 text-right">Ran ~11 hours ago</p>
        </section>

      </div>
    </div>
  );
}
