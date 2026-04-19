import React, { useState, useEffect } from 'react';
import { MessageSquare, Loader2, AlertTriangle } from 'lucide-react';

interface Message {
  timestamp: string;
  text: string;
}

const USER_NAMES: Record<string, string> = {
  v1:   'Naama Rotem Gelber',
  mako: 'Berti Levi Katan',
  N12:  'Hen',
  '12+': 'Aviran.Sa',
};

const PLATFORMS = [
  { pattern: /\bIOS\b/gi,                      label: 'iOS',         color: 'bg-sky-100 text-sky-700' },
  { pattern: /\bAndroid\b|אנדרואיד/gi,          label: 'Android',     color: 'bg-green-100 text-green-700' },
  { pattern: /רספונסיב|responsive/gi,           label: 'Responsive',  color: 'bg-violet-100 text-violet-700' },
  { pattern: /\bWADM\b|\bwadm\b/g,              label: 'WADM',        color: 'bg-orange-100 text-orange-700' },
  { pattern: /\bWEM\b|\bwem\b/g,                label: 'WEM',         color: 'bg-amber-100 text-amber-700' },
  { pattern: /\bDOMO\b|\bdomo\b/g,              label: 'DOMO',        color: 'bg-rose-100 text-rose-700' },
  { pattern: /\bFF\b/g,                         label: 'FF',          color: 'bg-fuchsia-100 text-fuchsia-700' },
  { pattern: /\bBQ\b|\bbq\b/g,                  label: 'BQ',          color: 'bg-teal-100 text-teal-700' },
];

const VERSION_RE = /\b(\d+\.\d+(?:\.\d+)?)\b/g;

function extractTags(text: string): { versions: string[]; platforms: string[] } {
  const versions = [...new Set(Array.from(text.matchAll(VERSION_RE), m => m[1]))];
  const platforms = PLATFORMS
    .filter(p => p.pattern.test(text))
    .map(p => ({ label: p.label, color: p.color }));
  // reset lastIndex after test()
  PLATFORMS.forEach(p => { p.pattern.lastIndex = 0; });
  return { versions, platforms: platforms.map(p => p.label) };
}

function platformColor(label: string): string {
  return PLATFORMS.find(p => p.label === label)?.color ?? 'bg-slate-100 text-slate-600';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function DeployedMessagesWidget({ filter }: { filter: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setMessages([]);
    fetch(`/api/slack/deployed-messages?filter=${encodeURIComponent(filter)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setMessages(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const userName = USER_NAMES[filter] ?? filter;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">הודעות {userName}</h2>
          <p className="text-sm text-slate-500">
            #deployed-versions{!loading && !error && ` · ${messages.length} הודעות`}
          </p>
        </div>
        <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

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
        <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1" dir="rtl">
          {messages.map((msg, idx) => {
            const { versions, platforms } = extractTags(msg.text);
            const hasTags = versions.length > 0 || platforms.length > 0;
            return (
              <div key={idx} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <span className="text-xs text-slate-400 block mb-1 font-mono" dir="ltr">
                  {formatDate(msg.timestamp)}
                </span>
                {hasTags && (
                  <div className="flex flex-wrap gap-1 mb-1.5" dir="ltr">
                    {versions.map(v => (
                      <span key={v} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        v{v}
                      </span>
                    ))}
                    {platforms.map(p => (
                      <span key={p} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${platformColor(p)}`}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {msg.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
