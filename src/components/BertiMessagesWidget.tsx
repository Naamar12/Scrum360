import React, { useState, useEffect } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react';

interface BertiMessage {
  timestamp: string;
  text: string;
}

function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function BertiMessagesWidget() {
  const [messages, setMessages] = useState<BertiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/slack/berti-messages')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setMessages(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const displayMessages = expanded ? messages : messages.slice(-10);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">הודעות Berti Levi Katan</h2>
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
        <>
          <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1" dir="rtl">
            {displayMessages.map((msg, idx) => (
              <div key={idx} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <span className="text-xs text-slate-400 block mb-1 font-mono" dir="ltr">
                  {formatDate(msg.timestamp)}
                </span>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {msg.text}
                </p>
              </div>
            ))}
          </div>

          {messages.length > 10 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-4 flex items-center justify-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="w-3.5 h-3.5" /> הצג פחות</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> הצג את כל {messages.length} ההודעות</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
