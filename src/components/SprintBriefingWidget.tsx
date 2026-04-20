import React, { useState } from 'react';
import { Loader2, Wand2, ClipboardList } from 'lucide-react';
import { JiraIssue } from './ItemDistributionWidget';

interface Props {
  issues: JiraIssue[];
  activeSprintName?: string;
}

export default function SprintBriefingWidget({ issues, activeSprintName }: Props) {
  const [freeText, setFreeText] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!freeText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sprint-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeText, issues }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'API error');
      }
      const data = await res.json();
      setMarkdown(data.markdown);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const activeCount = issues.filter(i => i.sprintState === 'active').length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">Sprint Briefing Generator</h2>
          {activeSprintName && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{activeSprintName}</span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-4">הכנס טקסט חופשי</p>
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          placeholder=""
          className="w-full h-44 p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
          dir="auto"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-400">
            {activeCount} active sprint issues loaded from Jira
          </p>
          <button
            onClick={generate}
            disabled={loading || !freeText.trim()}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'מייצר...' : 'Generate Briefing'}
          </button>
        </div>
        {error && (
          <p className="text-sm text-rose-600 mt-3 bg-rose-50 border border-rose-100 p-3 rounded-lg">{error}</p>
        )}
      </div>

      {markdown && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <MarkdownRenderer content={markdown} />
        </div>
      )}
    </div>
  );
}

function parseInline(text: string, baseKey: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`${baseKey}-${i++}`}>{token.slice(2, -2)}</strong>);
    } else {
      const m = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (m) {
        parts.push(
          <a
            key={`${baseKey}-${i++}`}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
          >
            {m[1]}
          </a>
        );
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ol' | 'ul' | null = null;
  let k = 0;

  function flushList() {
    if (!listItems.length) return;
    if (listType === 'ol') {
      elements.push(
        <ol key={k++} className="list-decimal list-inside space-y-2 ml-2 my-2">
          {listItems}
        </ol>
      );
    } else {
      elements.push(
        <ul key={k++} className="list-disc list-inside space-y-1.5 ml-2 my-2">
          {listItems}
        </ul>
      );
    }
    listItems = [];
    listType = null;
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={k++} className="text-lg font-bold text-slate-900 mt-8 mb-3 pb-2 border-b-2 border-indigo-100 first:mt-0">
          {parseInline(line.slice(3), `h2-${k}`)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={k++} className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mt-4 mb-1.5">
          {parseInline(line.slice(4), `h3-${k}`)}
        </h3>
      );
    } else if (/^\d+\. /.test(line)) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listItems.push(
        <li key={k++} className="text-sm text-slate-700">
          {parseInline(line.replace(/^\d+\. /, ''), `li-${k}`)}
        </li>
      );
    } else if (line.startsWith('- ')) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listItems.push(
        <li key={k++} className="text-sm text-slate-700">
          {parseInline(line.slice(2), `li-${k}`)}
        </li>
      );
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={k++} className="text-sm text-slate-700 my-1.5" dir="auto">
          {parseInline(line, `p-${k}`)}
        </p>
      );
    }
  }
  flushList();

  return <div dir="auto">{elements}</div>;
}
