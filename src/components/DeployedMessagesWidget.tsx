import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Loader2, AlertTriangle, Search, X, ChevronDown } from 'lucide-react';

interface Message {
  timestamp: string;
  text: string;
}

interface MessageWithTags extends Message {
  versions: string[];
  platforms: string[];
}

const USER_NAMES: Record<string, string> = {
  v1:   'Naama Rotem Gelber',
  mako: 'Berti Levi Katan',
  N12:  'Hen',
  '12+': 'Aviran.Sa',
};

const PLATFORMS = [
  { pattern: /\bIOS\b/gi,               label: 'iOS',        color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { pattern: /\bAndroidTV\b|אנדרואיד טיוי|אנדרואיד TV/gi, label: 'AndroidTV', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { pattern: /\bAndroid\b|אנדרואיד/gi,  label: 'Android',    color: 'bg-green-100 text-green-700 border-green-200' },
  { pattern: /רספונסיב|responsive/gi,   label: 'Responsive', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { pattern: /\bWADM\b|\bwadm\b/g,      label: 'WADM',       color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { pattern: /\bWEM\b|\bwem\b/g,        label: 'WEM',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { pattern: /\bDOMO\b|\bdomo\b/g,      label: 'DOMO',       color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { pattern: /\bBQ\b|\bbq\b/g,          label: 'BQ',         color: 'bg-teal-100 text-teal-700 border-teal-200' },
];

const VERSION_RE = /\b(\d+\.\d+(?:\.\d+)?)\b/g;

function extractTags(text: string): { versions: string[]; platforms: string[] } {
  const versions = [...new Set(Array.from(text.matchAll(VERSION_RE), m => m[1]))];
  const platforms = PLATFORMS
    .filter(p => { const r = p.pattern.test(text); p.pattern.lastIndex = 0; return r; })
    .map(p => p.label);
  return { versions, platforms };
}

function platformColor(label: string): string {
  return PLATFORMS.find(p => p.label === label)?.color ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function getDayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Wraps matched query segments in a <mark> */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <>{text}</>;
  }
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic">{part}</mark>
          : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}

export default function DeployedMessagesWidget({ filter }: { filter: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [versionFilter, setVersionFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setMessages([]);
    setSearch('');
    setPlatformFilter('');
    setVersionFilter('');
    fetch(`/api/slack/deployed-messages?filter=${encodeURIComponent(filter)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setMessages(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const messagesWithTags = useMemo<MessageWithTags[]>(() =>
    messages.map(m => ({ ...m, ...extractTags(m.text) })),
    [messages]
  );

  const allVersions = useMemo(() => {
    const set = new Set<string>();
    messagesWithTags.forEach(m => m.versions.forEach(v => set.add(v)));
    return [...set].sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
  }, [messagesWithTags]);

  const allPlatforms = useMemo(() => {
    const set = new Set<string>();
    messagesWithTags.forEach(m => m.platforms.forEach(p => set.add(p)));
    return [...set];
  }, [messagesWithTags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messagesWithTags.filter(m => {
      if (q && !m.text.toLowerCase().includes(q)) return false;
      if (platformFilter && !m.platforms.includes(platformFilter)) return false;
      if (versionFilter && !m.versions.includes(versionFilter)) return false;
      return true;
    });
  }, [messagesWithTags, search, platformFilter, versionFilter]);

  // Group filtered messages by day
  const groupedByDay = useMemo(() => {
    const groups: { dayKey: string; label: string; messages: MessageWithTags[] }[] = [];
    filtered.forEach(m => {
      const key = getDayKey(m.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.dayKey === key) {
        last.messages.push(m);
      } else {
        groups.push({ dayKey: key, label: formatDayLabel(m.timestamp), messages: [m] });
      }
    });
    return groups;
  }, [filtered]);

  const hasActiveFilters = search || platformFilter || versionFilter;
  const userName = USER_NAMES[filter] ?? filter;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">הודעות {userName}</h2>
          <p className="text-sm text-slate-500">
            #deployed-versions
            {!loading && !error && (
              <span>
                {' · '}
                {hasActiveFilters
                  ? <><span className="text-indigo-600 font-medium">{filtered.length}</span>/{messages.length} הודעות</>
                  : <>{messages.length} הודעות</>
                }
              </span>
            )}
          </p>
        </div>
        <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

      {/* Filter Bar — order: Search · Platform · Version */}
      {!loading && !error && messages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-100">

          {/* 1. Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by message content or changes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-8 pl-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400 text-slate-700"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Platform Dropdown */}
          <div className="relative group">
            <select
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
              title="Filter by platform"
              className={`appearance-none pl-7 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent cursor-pointer transition-colors ${
                platformFilter
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              <option value="">All Platforms</option>
              {allPlatforms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 3. Version Dropdown */}
          <div className="relative group">
            <select
              value={versionFilter}
              onChange={e => setVersionFilter(e.target.value)}
              title="Filter by version"
              className={`appearance-none pl-7 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent cursor-pointer transition-colors ${
                versionFilter
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              <option value="">All Versions</option>
              {allVersions.map(v => (
                <option key={v} value={v}>v{v}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setPlatformFilter(''); setVersionFilter(''); }}
              className="flex items-center gap-1 px-2.5 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">טוען הודעות...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Search className="w-8 h-8 opacity-40" />
              <p className="text-sm">No messages match your search</p>
              <button
                onClick={() => { setSearch(''); setPlatformFilter(''); setVersionFilter(''); }}
                className="text-xs text-indigo-500 hover:text-indigo-700 underline mt-1"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[460px] pl-1">
              {groupedByDay.map(group => (
                <div key={group.dayKey}>
                  {/* Day divider */}
                  <div className="flex items-center gap-3 sticky top-0 z-10 bg-white py-2 mb-2">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap px-1">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {/* Messages for this day */}
                  <div className="space-y-3 mb-4">
                    {group.messages.map((msg, idx) => {
                      const hasTags = msg.versions.length > 0 || msg.platforms.length > 0;
                      return (
                        <div key={idx} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                          <span className="text-xs text-slate-400 block mb-1 font-mono" dir="ltr">
                            {formatTime(msg.timestamp)}
                          </span>
                          {hasTags && (
                            <div className="flex flex-wrap gap-1 mb-1.5" dir="ltr">
                              {msg.versions.map(v => (
                                <button
                                  key={v}
                                  onClick={() => setVersionFilter(versionFilter === v ? '' : v)}
                                  title={versionFilter === v ? 'Remove version filter' : `Filter by v${v}`}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border transition-all cursor-pointer ${
                                    versionFilter === v
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 hover:shadow-sm'
                                  }`}
                                >
                                  v{v}
                                </button>
                              ))}
                              {msg.platforms.map(p => (
                                <button
                                  key={p}
                                  onClick={() => setPlatformFilter(platformFilter === p ? '' : p)}
                                  title={platformFilter === p ? 'Remove platform filter' : `Filter by ${p}`}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border transition-all cursor-pointer ${
                                    platformFilter === p
                                      ? 'ring-2 ring-indigo-400 ring-offset-1 ' + platformColor(p) + ' shadow-sm'
                                      : platformColor(p) + ' hover:opacity-90 hover:shadow-sm'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                            <HighlightedText text={msg.text} query={search} />
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
