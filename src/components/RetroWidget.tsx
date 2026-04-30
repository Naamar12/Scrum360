import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, ThumbsUp, Check, RotateCcw, Flame, Trophy, Lightbulb, Send, Loader2, AlertCircle, GripVertical } from 'lucide-react';


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
  activeSprintName?: string;
}

export default function RetroWidget({ filter = 'v1', activeSprintName }: Props) {
  const [data, setData] = useState<RetroData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<ColumnKey | null>(null);
  const [draftText, setDraftText] = useState('');
  const [editingSprintName, setEditingSprintName] = useState(false);
  const [draftSprintName, setDraftSprintName] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [clearedColumn, setClearedColumn] = useState<ColumnKey | null>(null);
  const [editingItem, setEditingItem] = useState<{ col: ColumnKey; id: string } | null>(null);
  const [editText, setEditText] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ col: ColumnKey; id: string } | null>(null);
  const dragSrc = useRef<{ col: ColumnKey; id: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/slack/channels')
      .then(r => r.ok ? r.json() : [])
      .then((list: { id: string; name: string }[]) => {
        setChannels(list);
        if (list.length > 0) setSelectedChannel(list[0].id);
      })
      .catch(() => {});
  }, []);

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

  function startEdit(col: ColumnKey, id: string, text: string) {
    setEditingItem({ col, id });
    setEditText(text);
  }

  function saveEdit() {
    if (!editingItem) return;
    const text = editText.trim();
    if (text) {
      update({
        ...data,
        [editingItem.col]: data[editingItem.col].map(item =>
          item.id === editingItem.id ? { ...item, text } : item
        ),
      });
    }
    setEditingItem(null);
    setEditText('');
  }

  function handleDragStart(col: ColumnKey, id: string) {
    dragSrc.current = { col, id };
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, col: ColumnKey, id: string) {
    e.preventDefault();
    setDragOver({ col, id });
  }

  function handleDrop(e: React.DragEvent, col: ColumnKey, id: string) {
    e.preventDefault();
    if (!dragSrc.current) return;
    const { col: srcCol, id: srcId } = dragSrc.current;
    if (srcCol === col && srcId === id) {
      dragSrc.current = null;
      setDraggingId(null);
      setDragOver(null);
      return;
    }

    const srcItem = data[srcCol].find(i => i.id === srcId);
    if (!srcItem) return;

    const next: RetroData = {
      ...data,
      friction: data.friction.filter(i => i.id !== srcId),
      wins: data.wins.filter(i => i.id !== srcId),
      ideas: data.ideas.filter(i => i.id !== srcId),
    };

    const destItems = [...next[col]];
    if (id === '__end__') {
      destItems.push(srcItem);
    } else {
      const idx = destItems.findIndex(i => i.id === id);
      destItems.splice(idx >= 0 ? idx : destItems.length, 0, srcItem);
    }
    next[col] = destItems;

    update(next);
    dragSrc.current = null;
    setDraggingId(null);
    setDragOver(null);
  }

  function handleDragEnd() {
    dragSrc.current = null;
    setDraggingId(null);
    setDragOver(null);
  }

  async function sendToSlack() {
    if (sendStatus === 'sending') return;
    const channel = selectedChannel.trim();
    if (!channel) return;
    const sprintLabel = data.sprintName || activeSprintName;
    const sections = COLUMNS.map(col => {
      const items = data[col.key];
      if (!items.length) return null;
      const emoji = col.key === 'friction' ? '🔴' : col.key === 'wins' ? '🏆' : '💡';
      const lines = items.map(i => `• ${i.text}${i.votes > 0 ? ` (${i.votes} votes)` : ''}`).join('\n');
      return `${emoji} *${col.label}*\n${lines}`;
    }).filter(Boolean);

    if (!sections.length) return;

    const header = sprintLabel ? `*Retro Agenda – ${sprintLabel}*` : `*Retro Agenda*`;
    const intro = `Here are the topics submitted so far for our retro meeting. If there's something you'd like to discuss that isn't on the list yet, please add it before the session so we can make the most of our time together.`;
    const text = `${header}\n\n${intro}\n\n${sections.join('\n\n')}`;

    setSendStatus('sending');
    try {
      const res = await fetch('/api/slack/post-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: selectedChannel, text }),
      });
      if (!res.ok) throw new Error();
      setSendStatus('success');
    } catch {
      setSendStatus('error');
    } finally {
      setTimeout(() => setSendStatus('idle'), 3000);
    }
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
            <img src="/retro_logo.png" alt="Retro" className="w-5 h-5 object-contain" style={{ filter: 'invert(35%) sepia(80%) saturate(800%) hue-rotate(230deg)' }} />
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
                  {data.sprintName || activeSprintName || '+ Add sprint name'}
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
          {channels.length > 0 ? (
            <select
              value={selectedChannel}
              onChange={e => setSelectedChannel(e.target.value)}
              className="text-xs rounded-lg border px-2 py-1.5 outline-none focus:ring-1 focus:ring-violet-400 bg-white text-slate-600"
              style={{ borderColor: '#e2e8f0' }}
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>#{ch.name}</option>
              ))}
            </select>
          ) : (
            <input
              value={selectedChannel}
              onChange={e => setSelectedChannel(e.target.value)}
              placeholder="#channel"
              className="text-xs rounded-lg border px-2 py-1.5 outline-none focus:ring-1 focus:ring-violet-400 bg-white text-slate-600 w-48"
              style={{ borderColor: '#e2e8f0' }}
            />
          )}
          <button
            onClick={sendToSlack}
            disabled={totalItems === 0 || sendStatus === 'sending'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={
              sendStatus === 'success' ? { background: '#d1fae5', borderColor: '#6ee7b7', color: '#065f46' } :
              sendStatus === 'error'   ? { background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' } :
                                         { background: '#f8f9fc', borderColor: '#e2e8f0', color: '#475569' }
            }
            title="Send to Slack"
          >
            {sendStatus === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {sendStatus === 'success' && <Check className="w-3.5 h-3.5" />}
            {sendStatus === 'error'   && <AlertCircle className="w-3.5 h-3.5" />}
            {sendStatus === 'idle'    && <Send className="w-3.5 h-3.5" />}
            {sendStatus === 'sending' ? 'Sending…' : sendStatus === 'success' ? 'Sent!' : sendStatus === 'error' ? 'Failed' : 'Send to Slack'}
          </button>
        </div>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const items = data[col.key];
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
              <div className="flex-1 px-3 pb-3 mt-1 flex flex-col gap-2">
                {items.length === 0 && !isAdding && (
                  <div
                    className="rounded-lg border-2 border-dashed transition-colors"
                    style={
                      dragOver?.col === col.key && dragOver?.id === '__end__'
                        ? { borderColor: col.accent, background: 'rgba(124,58,237,0.04)' }
                        : { borderColor: col.border }
                    }
                    onDragOver={e => handleDragOver(e, col.key, '__end__')}
                    onDrop={e => handleDrop(e, col.key, '__end__')}
                    onDragLeave={() => setDragOver(null)}
                  >
                    <button
                      onClick={() => { setAddingTo(col.key); setDraftText(''); }}
                      className="w-full text-center text-xs py-5"
                      style={{ color: col.headerText, opacity: 0.5 }}
                    >
                      Click + to add the first item
                    </button>
                  </div>
                )}

                {items.map(item => {
                  const isEditing = editingItem?.col === col.key && editingItem?.id === item.id;
                  const isDragging = draggingId === item.id;
                  const isDropTarget = dragOver?.col === col.key && dragOver?.id === item.id;

                  return (
                    <div key={item.id}>
                      {/* Drop indicator line */}
                      {isDropTarget && (
                        <div className="h-0.5 rounded-full mx-1 mb-1.5" style={{ background: col.accent }} />
                      )}
                      <div
                        draggable
                        onDragStart={() => handleDragStart(col.key, item.id)}
                        onDragOver={e => handleDragOver(e, col.key, item.id)}
                        onDrop={e => handleDrop(e, col.key, item.id)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={() => setDragOver(null)}
                        className="flex items-start gap-2 bg-white rounded-lg px-3 py-2.5 border group transition-opacity"
                        style={{
                          borderColor: col.border,
                          opacity: isDragging ? 0.4 : 1,
                          cursor: 'grab',
                        }}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0 group-hover:text-slate-400 transition-colors" />

                        {isEditing ? (
                          <input
                            autoFocus
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') { setEditingItem(null); setEditText(''); }
                            }}
                            className="flex-1 text-sm py-0 border-b outline-none bg-transparent min-w-0"
                            style={{ borderColor: col.accent }}
                          />
                        ) : (
                          <p
                            className="flex-1 text-sm text-slate-700 leading-snug min-w-0 cursor-text"
                            onClick={() => startEdit(col.key, item.id, item.text)}
                            title="Click to edit"
                          >
                            {item.text}
                          </p>
                        )}

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
                    </div>
                  );
                })}

                {/* Drop zone at end of non-empty column */}
                {items.length > 0 && (
                  <div
                    className="h-6 rounded-lg transition-all"
                    style={
                      dragOver?.col === col.key && dragOver?.id === '__end__'
                        ? { background: `${col.accent}18`, border: `2px dashed ${col.accent}` }
                        : {}
                    }
                    onDragOver={e => handleDragOver(e, col.key, '__end__')}
                    onDrop={e => handleDrop(e, col.key, '__end__')}
                    onDragLeave={() => setDragOver(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
