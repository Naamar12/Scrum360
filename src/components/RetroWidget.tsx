import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, ThumbsUp, Copy, Check, RotateCcw, Flame, Trophy, Lightbulb } from 'lucide-react';

interface RetroItem {
  id: string;
  text: string;
  votes: number;
  createdAt: number;
}

interface RetroData {
  sprintName: string;
  friction: RetroItem[];
  wins: RetroItem[];
  ideas: RetroItem[];
}

type ColumnKey = 'friction' | 'wins' | 'ideas';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  icon: React.ReactNode;
  description: string;
  accent: string;
  headerGradient: string;
  headerText: string;
  border: string;
  bg: string;
  voteBg: string;
  voteText: string;
  badgeBg: string;
  badgeText: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: 'friction',
    label: 'Friction',
    icon: <Flame className="w-4 h-4" />,
    description: 'What slowed you down or felt stuck?',
    accent: '#ef4444',
    headerGradient: 'linear-gradient(135deg, #fee2e2, #fecaca)',
    headerText: '#991b1b',
    border: '#fca5a5',
    bg: '#fff5f5',
    voteBg: '#fee2e2',
    voteText: '#b91c1c',
    badgeBg: '#fee2e2',
    badgeText: '#991b1b',
  },
  {
    key: 'wins',
    label: 'Wins',
    icon: <Trophy className="w-4 h-4" />,
    description: 'What worked well and should be repeated?',
    accent: '#10b981',
    headerGradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    headerText: '#065f46',
    border: '#6ee7b7',
    bg: '#f0fdf9',
    voteBg: '#d1fae5',
    voteText: '#065f46',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
  },
  {
    key: 'ideas',
    label: 'Ideas',
    icon: <Lightbulb className="w-4 h-4" />,
    description: 'Things worth trying next sprint',
    accent: '#7c3aed',
    headerGradient: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    headerText: '#5b21b6',
    border: '#c4b5fd',
    bg: '#faf8ff',
    voteBg: '#ede9fe',
    voteText: '#5b21b6',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6',
  },
];

const EMPTY_DATA: RetroData = {
  sprintName: '',
  friction: [],
  wins: [],
  ideas: [],
};

function makeItem(text: string): RetroItem {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, votes: 0, createdAt: Date.now() };
}

interface Props {
  filter?: string;
}

export default function RetroWidget({ filter = 'v1' }: Props) {
  const [data, setData] = useState<RetroData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<ColumnKey | null>(null);
  const [draftText, setDraftText] = useState('');
  const [editingSprintName, setEditingSprintName] = useState(false);
  const [draftSprintName, setDraftSprintName] = useState('');
  const [copied, setCopied] = useState(false);
  const [clearedColumn, setClearedColumn] = useState<ColumnKey | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/retro/${filter}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d ?? EMPTY_DATA);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  const scheduleSave = useCallback((next: RetroData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/retro/${filter}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 1000);
  }, [filter]);

  function update(next: RetroData) {
    setData(next);
    scheduleSave(next);
  }

  function addItem(col: ColumnKey) {
    const text = draftText.trim();
    if (!text) { setAddingTo(null); return; }
    const next = { ...data, [col]: [...data[col], makeItem(text)] };
    update(next);
    setDraftText('');
    setAddingTo(null);
  }

  function vote(col: ColumnKey, id: string) {
    const next = {
      ...data,
      [col]: data[col].map(item => item.id === id ? { ...item, votes: item.votes + 1 } : item),
    };
    update(next);
  }

  function deleteItem(col: ColumnKey, id: string) {
    const next = { ...data, [col]: data[col].filter(item => item.id !== id) };
    update(next);
  }

  function clearColumn(col: ColumnKey) {
    setClearedColumn(col);
    const next = { ...data, [col]: [] };
    update(next);
    setTimeout(() => setClearedColumn(null), 1500);
  }

  function saveSprintName() {
    const next = { ...data, sprintName: draftSprintName.trim() };
    update(next);
    setEditingSprintName(false);
  }

  function copyForSlack() {
    const sprintLabel = data.sprintName ? ` — ${data.sprintName}` : '';
    const sections = COLUMNS.map(col => {
      const items = [...data[col.key]].sort((a, b) => b.votes - a.votes);
      if (!items.length) return null;
      const emoji = col.key === 'friction' ? '🚧' : col.key === 'wins' ? '🏆' : '💡';
      const lines = items.map(i => `• ${i.text}${i.votes > 0 ? ` _(${i.votes} 👍)_` : ''}`).join('\n');
      return `${emoji} *${col.label}*\n${lines}`;
    }).filter(Boolean);

    if (!sections.length) return;

    const text = `🔄 *Retro${sprintLabel}*\n\n${sections.join('\n\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    if (addingTo && addInputRef.current) addInputRef.current.focus();
  }, [addingTo]);

  const totalItems = data.friction.length + data.wins.length + data.ideas.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading retro...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}>
            <RotateCcw className="w-4 h-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">Retro Agenda</span>
              {editingSprintName ? (
                <input
                  autoFocus
                  value={draftSprintName}
                  onChange={e => setDraftSprintName(e.target.value)}
                  onBlur={saveSprintName}
                  onKeyDown={e => { if (e.key === 'Enter') saveSprintName(); if (e.key === 'Escape') setEditingSprintName(false); }}
                  className="text-sm border border-violet-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-violet-400 w-44"
                  placeholder="Sprint name..."
                />
              ) : (
                <button
                  onClick={() => { setDraftSprintName(data.sprintName); setEditingSprintName(true); }}
                  className="text-sm text-slate-400 hover:text-violet-600 transition-colors px-1.5 py-0.5 rounded hover:bg-violet-50"
                >
                  {data.sprintName || '+ Add sprint name'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Drop thoughts here as they happen — the board shapes your retro discussion</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalItems > 0 && (
            <span className="text-xs text-slate-400 hidden sm:block">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
          )}
          <button
            onClick={copyForSlack}
            disabled={totalItems === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={copied
              ? { background: '#d1fae5', borderColor: '#6ee7b7', color: '#065f46' }
              : { background: '#f8f9fc', borderColor: '#e2e8f0', color: '#475569' }}
            title="Copy formatted summary for Slack"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy for Slack'}
          </button>
        </div>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const items = [...data[col.key]].sort((a, b) => b.votes - a.votes);
          const isAdding = addingTo === col.key;
          return (
            <div
              key={col.key}
              className="rounded-xl border overflow-hidden flex flex-col"
              style={{ borderColor: col.border, background: col.bg }}
            >
              {/* Column header */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ background: col.headerGradient }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: col.headerText }}>{col.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: col.headerText }}>{col.label}</span>
                  {items.length > 0 && (
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: col.badgeBg, color: col.badgeText, border: `1px solid ${col.border}` }}
                    >
                      {items.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {items.length > 0 && (
                    <button
                      onClick={() => clearColumn(col.key)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/50 transition-colors"
                      title="Clear all"
                      style={{ color: col.headerText, opacity: 0.6 }}
                    >
                      {clearedColumn === col.key ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => { setAddingTo(isAdding ? null : col.key); setDraftText(''); }}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/50 transition-colors"
                    title="Add item"
                    style={{ color: col.headerText }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs px-4 pt-2.5 pb-1" style={{ color: col.headerText, opacity: 0.7 }}>{col.description}</p>

              {/* Add input */}
              {isAdding && (
                <div className="px-3 pt-1 pb-2">
                  <div className="flex gap-2">
                    <input
                      ref={addInputRef}
                      value={draftText}
                      onChange={e => setDraftText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addItem(col.key);
                        if (e.key === 'Escape') { setAddingTo(null); setDraftText(''); }
                      }}
                      placeholder="Type and press Enter..."
                      className="flex-1 text-sm px-3 py-1.5 rounded-lg border bg-white outline-none focus:ring-2 min-w-0"
                      style={{ borderColor: col.border, '--tw-ring-color': col.accent } as React.CSSProperties}
                    />
                    <button
                      onClick={() => addItem(col.key)}
                      className="px-2.5 py-1.5 rounded-lg text-white text-sm font-medium shrink-0"
                      style={{ background: col.accent }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="flex-1 px-3 pb-3 space-y-2 mt-1">
                {items.length === 0 && !isAdding && (
                  <button
                    onClick={() => { setAddingTo(col.key); setDraftText(''); }}
                    className="w-full text-center text-xs py-5 rounded-lg border-2 border-dashed transition-colors"
                    style={{ borderColor: col.border, color: col.headerText, opacity: 0.5 }}
                  >
                    Click + to add the first item
                  </button>
                )}
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 bg-white rounded-lg px-3 py-2.5 border group"
                    style={{ borderColor: col.border }}
                  >
                    <p className="flex-1 text-sm text-slate-700 leading-snug min-w-0">{item.text}</p>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button
                        onClick={() => vote(col.key, item.id)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors"
                        style={{ background: item.votes > 0 ? col.voteBg : 'transparent', color: item.votes > 0 ? col.voteText : '#94a3b8' }}
                        title="Vote"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {item.votes > 0 && <span>{item.votes}</span>}
                      </button>
                      <button
                        onClick={() => deleteItem(col.key, item.id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
