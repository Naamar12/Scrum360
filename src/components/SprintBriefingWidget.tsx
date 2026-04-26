import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ClipboardList, Plus, GripVertical, Send, X, Bookmark, CheckSquare, Bug, Loader2 } from 'lucide-react';
import { JiraIssue } from './ItemDistributionWidget';

interface Props {
  issues: JiraIssue[];
  activeSprintName?: string;
}

interface CardItem { id: number; text: string; issueType?: string; }
let nextId = 1;
function makeItem(text = '', issueType?: string): CardItem { return { id: nextId++, text, issueType }; }

function issueCategory(type?: string): 'story' | 'task' | 'bug' | null {
  const t = (type ?? '').toLowerCase();
  if (t.includes('bug')) return 'bug';
  if (t.includes('story')) return 'story';
  if (t.includes('task') && !t.includes('sub')) return 'task';
  return null;
}

function IssueTypeIcon({ type }: { type?: string }) {
  const cat = issueCategory(type);
  if (cat === 'story') return <Bookmark className="w-3.5 h-3.5 shrink-0 fill-emerald-500 text-emerald-500" />;
  if (cat === 'task')  return <CheckSquare className="w-3.5 h-3.5 shrink-0 text-blue-400" />;
  if (cat === 'bug')   return <Bug className="w-3.5 h-3.5 shrink-0 text-red-400" />;
  return null;
}

const TYPE_OPTIONS: { type: string; label: string; icon: React.ReactNode }[] = [
  { type: 'Story', label: 'Story', icon: <Bookmark className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" /> },
  { type: 'Bug',   label: 'Bug',   icon: <Bug className="w-3.5 h-3.5 text-red-400" /> },
  { type: 'Task',  label: 'Task',  icon: <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> },
];

function TypePicker({ current, onChange }: { current?: string; onChange: (t: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const cat = issueCategory(current);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center justify-center w-4 h-4 rounded transition-opacity ${cat ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-60 hover:!opacity-100'}`}
        title="בחר סוג"
        tabIndex={-1}
      >
        {cat ? <IssueTypeIcon type={current} /> : <span className="text-[#444] text-xs leading-none">◈</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-20 bg-[#2a2a2a] border border-[#444] rounded-lg shadow-lg p-1 flex flex-col gap-0.5 min-w-[90px]">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => { onChange(opt.type); setOpen(false); }}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-[#ccc] hover:bg-[#383838] transition-colors ${current === opt.type ? 'bg-[#333]' : ''}`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
          {cat && (
            <button
              onClick={() => { onChange(undefined); setOpen(false); }}
              className="flex items-center gap-2 px-2 py-1 rounded text-xs text-[#666] hover:bg-[#383838] hover:text-[#999] transition-colors mt-0.5 border-t border-[#333] pt-1"
            >
              <X className="w-3 h-3" /> הסר
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = 'sprint-briefing-v3';
type CardStatus = 'empty' | 'draft' | 'ready';

interface StoredCard {
  title: string;
  items: { id: number; text: string; issueType?: string }[];
  isReady?: boolean;
}

interface StoredData {
  cards: Record<string, StoredCard>;
  extraCards: string[];
  hiddenDevs: string[];
  cardOrder?: string[];
}

function loadStored(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { cards: {}, extraCards: [], hiddenDevs: [] };
}

function saveStored(data: StoredData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// Strip legacy [KESHET-xxx] prefixes from items loaded from old storage
function migrateItems(items: StoredCard['items']): StoredCard['items'] {
  return items.map(i => ({ ...i, text: i.text.replace(/^\[[\w-]+\]\s*/, '') }));
}

function cardStatus(card?: StoredCard): CardStatus {
  if (!card) return 'empty';
  if (card.isReady) return 'ready';
  if (card.items?.some(i => i.text.trim())) return 'draft';
  return 'empty';
}

function StatusDot({ status }: { status: CardStatus }) {
  const config = {
    empty: { color: 'bg-[#444]', label: 'ריק' },
    draft: { color: 'bg-amber-500', label: 'טיוטה' },
    ready: { color: 'bg-emerald-500', label: 'מוכן' },
  }[status];
  return (
    <div className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      <span className="text-[10px] text-[#666]">{config.label}</span>
    </div>
  );
}

// Minimal markdown renderer for Claude output
function renderInline(text: string, baseKey: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;
  while (remaining) {
    const m = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (m) {
      const before = remaining.slice(0, m.index);
      if (before) parts.push(<span key={`${baseKey}-${i++}`}>{applyBold(before, `${baseKey}-b${i}`)}</span>);
      parts.push(
        <a key={`${baseKey}-${i++}`} href={m[2]} target="_blank" rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 hover:underline">{m[1]}</a>
      );
      remaining = remaining.slice((m.index ?? 0) + m[0].length);
    } else {
      parts.push(<span key={`${baseKey}-${i++}`}>{applyBold(remaining, `${baseKey}-b${i}`)}</span>);
      break;
    }
  }
  return parts;
}

function applyBold(text: string, baseKey: string): React.ReactNode {
  const segs = text.split(/\*\*([^*]+)\*\*/g);
  if (segs.length === 1) return text;
  return segs.map((s, i) =>
    i % 2 === 1
      ? <strong key={`${baseKey}-${i}`} className="text-white font-semibold">{s}</strong>
      : s || null
  );
}

function MarkdownView({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listOrdered = false;
  let listCount = 0;

  function flushList() {
    if (!listItems.length) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    const cls = listOrdered ? 'list-decimal' : 'list-disc';
    elements.push(
      <Tag key={`list-${listCount++}`} className={`${cls} list-inside space-y-0.5 pr-2 mb-1`}>
        {listItems}
      </Tag>
    );
    listItems = [];
  }

  lines.forEach((line, idx) => {
    const k = String(idx);
    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={k} className="text-white font-bold text-sm mt-3 first:mt-0 border-b border-[#333] pb-1 mb-1">{renderInline(line.slice(3), k)}</h2>);
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={k} className="text-indigo-300 font-semibold text-xs mt-2 mb-0.5 uppercase tracking-wide">{renderInline(line.slice(4), k)}</h3>);
    } else if (line.trim() === '---') {
      flushList();
      elements.push(<hr key={k} className="border-[#333] my-2" />);
    } else if (/^\d+\.\s/.test(line)) {
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(<li key={k} className="text-[#c8c8c8] text-xs">{renderInline(line.replace(/^\d+\.\s/, ''), k)}</li>);
    } else if (/^[-*]\s/.test(line)) {
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push(<li key={k} className="text-[#c8c8c8] text-xs">{renderInline(line.slice(2), k)}</li>);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(<p key={k} className="text-[#c8c8c8] text-xs leading-relaxed">{renderInline(line, k)}</p>);
    }
  });
  flushList();

  return <div className="space-y-0.5 overflow-y-auto max-h-56 pr-1">{elements}</div>;
}

function DraggableCard({
  devKey, initialTitle, initialItems, isReady, onTitleChange, onItemsChange, onDelete, onToggleReady, onSendToSlack,
  onCardGripMouseDown, onCardGripMouseUp,
}: React.Attributes & {
  devKey: string;
  initialTitle: string;
  initialItems: CardItem[];
  isReady?: boolean;
  onTitleChange: (t: string) => void;
  onItemsChange: (items: CardItem[]) => void;
  onDelete: () => void;
  onToggleReady: () => void;
  onSendToSlack: (text: string) => Promise<void>;
  onCardGripMouseDown?: () => void;
  onCardGripMouseUp?: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [items, setItems] = useState<CardItem[]>(initialItems.length ? initialItems : [makeItem()]);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [slackOpen, setSlackOpen] = useState(false);
  const [slackChannel, setSlackChannel] = useState('');
  const [slackSending, setSlackSending] = useState(false);
  const [slackError, setSlackError] = useState('');
  const [slackSuccess, setSlackSuccess] = useState(false);
  const [undoItems, setUndoItems] = useState<CardItem[] | null>(null);
  const dragSrc = useRef<number | null>(null);
  const fromGrip = useRef(false);


  const status = cardStatus({ title, items, isReady });

  function changeTitle(t: string) { setTitle(t); onTitleChange(t); }
  function changeItems(next: CardItem[]) { setItems(next); onItemsChange(next); }
  function updateItem(id: number, text: string) {
    changeItems(items.map(it => it.id === id ? { ...it, text } : it));
  }
  function updateItemType(id: number, issueType: string | undefined) {
    changeItems(items.map(it => it.id === id ? { ...it, issueType } : it));
  }

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = [...items];
      next.splice(idx + 1, 0, makeItem());
      changeItems(next);
      setTimeout(() => {
        document.querySelectorAll<HTMLInputElement>(`[data-card-id="${devKey}"] .item-input`)[idx + 1]?.focus();
      }, 0);
    }
    if (e.key === 'Backspace' && items[idx].text === '' && items.length > 1) {
      e.preventDefault();
      changeItems(items.filter((_, i) => i !== idx));
      setTimeout(() => {
        document.querySelectorAll<HTMLInputElement>(`[data-card-id="${devKey}"] .item-input`)[Math.max(0, idx - 1)]?.focus();
      }, 0);
    }
  }

  function onDragStart(e: React.DragEvent, idx: number) {
    if (!fromGrip.current) { e.preventDefault(); return; }
    dragSrc.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setOverIdx(idx); }
  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragSrc.current !== null && dragSrc.current !== idx) {
      const next = [...items];
      const [moved] = next.splice(dragSrc.current, 1);
      next.splice(idx, 0, moved);
      changeItems(next);
    }
    dragSrc.current = null; fromGrip.current = false; setOverIdx(null);
  }
  function onDragEnd() { dragSrc.current = null; fromGrip.current = false; setOverIdx(null); }

  const slackErrorMessages: Record<string, string> = {
    missing_scope: 'לבוט חסרות הרשאות – יש להוסיף את הסקופ chat:write',
    channel_not_found: 'ערוץ או משתמש לא נמצא',
    not_in_channel: 'הבוט לא חבר בערוץ זה',
    invalid_auth: 'טוקן סלאק לא תקין',
    account_inactive: 'חשבון הסלאק לא פעיל',
    is_archived: 'הערוץ ארכיוני',
    msg_too_long: 'ההודעה ארוכה מדי',
  };

  async function handleSendSlack() {
    if (!slackChannel.trim()) return;
    setSlackSending(true);
    setSlackError('');
    try {
      const text = items.filter(i => i.text.trim()).map(i => `• ${i.text}`).join('\n');
      await onSendToSlack(`${slackChannel.trim()}|||${text}`);
      setSlackSuccess(true);
      setTimeout(() => {
        setSlackOpen(false);
        setSlackChannel('');
        setSlackSuccess(false);
      }, 1200);
    } catch (err: any) {
      const raw: string = err.message ?? 'שגיאה';
      const key = raw.split(' ')[0];
      setSlackError(slackErrorMessages[key] ?? raw);
    } finally {
      setSlackSending(false);
    }
  }

  return (
    <div
      data-card-id={devKey}
      className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-2xl p-4 flex flex-col gap-2 min-h-[200px] group/card"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <GripVertical
          className="w-4 h-4 text-[#444] cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity"
          onMouseDown={() => onCardGripMouseDown?.()}
          onMouseUp={() => onCardGripMouseUp?.()}
        />
        <input
          value={title}
          onChange={e => changeTitle(e.target.value)}
          dir="rtl"
          className="text-white text-sm font-semibold text-right bg-transparent focus:outline-none border-b border-transparent focus:border-[#555] pb-0.5 flex-1 min-w-0 transition-colors"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={status} />
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1"
        onClick={e => {
          const target = e.target as HTMLElement;
          if (target.closest('input, button, .item-input')) return;
          const newItem = makeItem();
          const next = [...items, newItem];
          changeItems(next);
          setTimeout(() => {
            const inputs = document.querySelectorAll<HTMLInputElement>(`[data-card-id="${devKey}"] .item-input`);
            inputs[inputs.length - 1]?.focus();
          }, 0);
        }}
      >
        <div className="flex flex-col gap-1">
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={e => onDragStart(e, idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDrop={e => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-1 group/item rounded transition-colors ${overIdx === idx && dragSrc.current !== idx ? 'bg-[#2a2a2a]' : ''}`}
            >
              <GripVertical
                className="w-3.5 h-3.5 text-[#444] cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                onMouseDown={() => { fromGrip.current = true; }}
                onMouseUp={() => { fromGrip.current = false; }}
              />
              <input
                value={item.text}
                onChange={e => updateItem(item.id, e.target.value)}
                onKeyDown={e => handleKeyDown(e, idx)}
                placeholder="הוסף פריט..."
                dir="rtl"
                draggable={false}
                className="item-input flex-1 bg-transparent text-[#d4d4d4] text-sm focus:outline-none placeholder:text-[#444] min-w-0"
              />
              <TypePicker current={item.issueType} onChange={t => updateItemType(item.id, t)} />
            </div>
          ))}
        </div>
      </div>

      {/* Slack inline form */}
      {slackOpen && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex gap-1.5">
            <input
              value={slackChannel}
              onChange={e => { setSlackChannel(e.target.value); setSlackError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSendSlack()}
              placeholder="#channel או @user"
              dir="ltr"
              autoFocus
              disabled={slackSending || slackSuccess}
              className="flex-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-600 placeholder:text-[#555] disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleSendSlack}
              disabled={slackSending || slackSuccess || !slackChannel.trim()}
              className={`px-2.5 py-1 rounded-lg text-xs text-white transition-colors flex items-center gap-1 ${
                slackSuccess
                  ? 'bg-emerald-600'
                  : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {slackSuccess
                ? <><span className="text-xs">✓</span> נשלח</>
                : slackSending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <><Send className="w-3 h-3" /> שלח</>
              }
            </button>
            <button
              onClick={() => { setSlackOpen(false); setSlackError(''); setSlackSuccess(false); }}
              className="px-2 py-1 text-[#666] hover:text-[#999] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {slackError && (
            <p className="text-xs text-red-400 px-0.5">{slackError}</p>
          )}
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex justify-between mt-1">
        <button
          onClick={onDelete}
          className="text-xs text-[#888] border border-[#3a3a3a] rounded-full px-3 py-1 hover:border-red-800 hover:text-red-400 transition-colors"
        >
          מחק
        </button>
        <div className="flex gap-1.5">
          {status !== 'empty' && (
            <button
              onClick={() => { setSlackOpen(v => !v); setSlackError(''); setSlackSuccess(false); }}
              title="שלח לסלאק"
              className={`text-xs border rounded-full px-3 py-1 transition-colors flex items-center gap-1 ${
                slackOpen
                  ? 'border-indigo-600 text-indigo-400 bg-indigo-900/20'
                  : 'text-[#888] border-[#3a3a3a] hover:border-indigo-600 hover:text-indigo-400'
              }`}
            >
              <Send className="w-3 h-3" />
              סלאק
            </button>
          )}
          {undoItems && (
            <button
              onClick={() => { changeItems(undoItems); setUndoItems(null); }}
              className="text-xs text-[#888] border border-[#3a3a3a] rounded-full px-3 py-1 hover:border-indigo-600 hover:text-indigo-400 transition-colors"
            >
              שחזר
            </button>
          )}
          <button
            onClick={() => { setUndoItems(items); changeItems([makeItem()]); }}
            className="text-xs text-[#888] border border-[#3a3a3a] rounded-full px-3 py-1 hover:border-[#666] hover:text-[#aaa] transition-colors"
          >
            נקה
          </button>
          <button
            onClick={onToggleReady}
            className={`text-xs border rounded-full px-3 py-1 transition-colors ${
              isReady
                ? 'border-emerald-600 text-emerald-400 hover:border-red-700 hover:text-red-400'
                : 'border-[#3a3a3a] text-[#888] hover:border-emerald-600 hover:text-emerald-400'
            }`}
          >
            {isReady ? 'מוכן ✓' : 'סמן כמוכן'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Parse Claude's markdown response into per-developer sections
function parseGeneratedSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = markdown.split(/\n(?=## )/);
  for (const part of parts) {
    const match = part.match(/^##\s+(.+)/);
    if (match) {
      const name = match[1].trim();
      sections[name.toLowerCase()] = part.trim();
    }
  }
  return sections;
}

// Find best matching section for a card title
function matchSection(title: string, sections: Record<string, string>): string | undefined {
  const normalized = title.toLowerCase().trim();
  if (sections[normalized]) return sections[normalized];
  // partial match
  for (const [key, val] of Object.entries(sections)) {
    if (key.includes(normalized) || normalized.includes(key)) return val;
  }
  return undefined;
}

export default function SprintBriefingWidget({ issues, activeSprintName }: Props) {
  const developers = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const issue of issues) {
      if (issue.sprintState === 'active' && issue.assignee && issue.assignee !== 'Unassigned') {
        if (!seen.has(issue.assignee)) { seen.add(issue.assignee); list.push(issue.assignee); }
      }
    }
    return list;
  }, [issues]);

  // Issues grouped by assignee for auto-populate
  const issuesByDev = useMemo(() => {
    const map: Record<string, JiraIssue[]> = {};
    for (const issue of issues) {
      if (issue.sprintState === 'active' && issue.assignee && issue.assignee !== 'Unassigned') {
        if (!map[issue.assignee]) map[issue.assignee] = [];
        map[issue.assignee].push(issue);
      }
    }
    return map;
  }, [issues]);

  const stored = useMemo(() => {
    const s = loadStored();
    // migrate old [KEY] prefixes
    Object.values(s.cards).forEach(c => { c.items = migrateItems(c.items); });
    return s;
  }, []);
  const [cardData, setCardData] = useState<Record<string, StoredCard>>(() => {
    // Auto-populate new dev cards from Jira
    const initial = { ...stored.cards };
    for (const dev of Object.keys(issuesByDev)) {
      if (!initial[dev] || !initial[dev].items?.some(i => i.text.trim())) {
        const devIssues = issuesByDev[dev] ?? [];
        initial[dev] = {
          title: dev,
          items: devIssues.filter(i => issueCategory(i.type) !== null).map(i => makeItem(i.summary, i.type)),
          generatedContent: initial[dev]?.generatedContent,
        };
      }
    }
    return initial;
  });
  const [extraCards, setExtraCards] = useState<string[]>(stored.extraCards);
  const [hiddenDevs, setHiddenDevs] = useState<Set<string>>(new Set(stored.hiddenDevs));
  const [cardOrder, setCardOrder] = useState<string[]>(stored.cardOrder ?? []);
  const cardDragSrc = useRef<string | null>(null);
  const cardFromGrip = useRef(false);
  const [cardOverKey, setCardOverKey] = useState<string | null>(null);

  useEffect(() => {
    saveStored({ cards: cardData, extraCards, hiddenDevs: [...hiddenDevs], cardOrder });
  }, [cardData, extraCards, hiddenDevs, cardOrder]);

  function updateCard(key: string, patch: Partial<StoredCard>) {
    setCardData(prev => {
      const existing = prev[key] as StoredCard | undefined;
      return {
        ...prev,
        [key]: { title: existing?.title ?? key, items: existing?.items ?? [], isReady: existing?.isReady, ...patch },
      };
    });
  }

  function deleteCard(key: string, isExtra: boolean) {
    if (isExtra) setExtraCards(prev => prev.filter(d => d !== key));
    else setHiddenDevs(prev => new Set([...prev, key]));
  }

  function addCard() {
    const key = `extra-${Date.now()}`;
    setExtraCards(prev => [...prev, key]);
    setCardData(prev => ({ ...prev, [key]: { title: `חבר צוות ${extraCards.length + 1}`, items: [] } }));
  }

  function toggleReady(key: string) {
    setCardData(prev => {
      const existing = prev[key] as StoredCard | undefined;
      return { ...prev, [key]: { ...existing, title: existing?.title ?? key, items: existing?.items ?? [], isReady: !existing?.isReady } };
    });
  }

  async function handleSendToSlack(devKey: string, payload: string) {
    const [channel, ...textParts] = payload.split('|||');
    const text = textParts.join('|||');
    const res = await fetch('/api/slack/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channel.trim(), text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `שגיאת שרת ${res.status}`);
    }
  }

  const visibleDevs = developers.filter(d => !hiddenDevs.has(d));
  const baseCards: { cardKey: string; isExtra: boolean }[] = [
    ...visibleDevs.map(d => ({ cardKey: d, isExtra: false as const })),
    ...extraCards.map(d => ({ cardKey: d, isExtra: true as const })),
  ];
  const orderMap = useMemo(() => new Map(cardOrder.map((k, i) => [k, i])), [cardOrder]);
  const allCards: { cardKey: string; isExtra: boolean }[] = useMemo(() =>
    [...baseCards].sort((a, b) => {
      const ia = orderMap.get(a.cardKey) ?? Infinity;
      const ib = orderMap.get(b.cardKey) ?? Infinity;
      return ia - ib;
    }),
  [baseCards, orderMap]);

  function onCardDragStart(e: React.DragEvent, cardKey: string) {
    if (!cardFromGrip.current) { e.preventDefault(); return; }
    cardDragSrc.current = cardKey;
    e.dataTransfer.effectAllowed = 'move';
  }
  function onCardDragOver(e: React.DragEvent, cardKey: string) {
    e.preventDefault();
    setCardOverKey(cardKey);
  }
  function onCardDrop(e: React.DragEvent, cardKey: string) {
    e.preventDefault();
    const src = cardDragSrc.current;
    if (src && src !== cardKey) {
      setCardOrder(() => {
        const keys = allCards.map(c => c.cardKey);
        const from = keys.indexOf(src);
        const to = keys.indexOf(cardKey);
        if (from === -1 || to === -1) return keys;
        const next = [...keys];
        next.splice(from, 1);
        next.splice(to, 0, src);
        return next;
      });
    }
    cardDragSrc.current = null;
    cardFromGrip.current = false;
    setCardOverKey(null);
  }
  function onCardDragEnd() {
    cardDragSrc.current = null;
    cardFromGrip.current = false;
    setCardOverKey(null);
  }
  const activeCount = issues.filter(i => i.sprintState === 'active').length;
  const readyCount = allCards.filter(({ cardKey }) => cardStatus(cardData[cardKey]) === 'ready').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">Sprint Briefing</h2>
          {activeSprintName && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{activeSprintName}</span>
          )}
          {readyCount > 0 && (
            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              {readyCount}/{allCards.length} מוכנים
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {allCards.map(({ cardKey, isExtra }) => {
          const card = cardData[cardKey] as StoredCard | undefined;
          const isOver = cardOverKey === cardKey && cardDragSrc.current !== cardKey;
          return (
            <div
              key={cardKey}
              draggable
              onDragStart={e => onCardDragStart(e, cardKey)}
              onDragOver={e => onCardDragOver(e, cardKey)}
              onDrop={e => onCardDrop(e, cardKey)}
              onDragEnd={onCardDragEnd}
              className={`transition-transform ${isOver ? 'scale-[1.02] ring-2 ring-indigo-500/40 rounded-2xl' : ''}`}
            >
              <DraggableCard
                key={cardKey}
                devKey={cardKey}
                initialTitle={card?.title ?? cardKey}
                initialItems={(card?.items ?? []).map((i: StoredCard['items'][number]) => ({ ...i }))}
                isReady={card?.isReady}
                onTitleChange={(t: string) => updateCard(cardKey, { title: t })}
                onItemsChange={(items: CardItem[]) => updateCard(cardKey, { items })}
                onDelete={() => deleteCard(cardKey, isExtra)}
                onToggleReady={() => toggleReady(cardKey)}
                onSendToSlack={(payload: string) => handleSendToSlack(cardKey, payload)}
                onCardGripMouseDown={() => { cardFromGrip.current = true; }}
                onCardGripMouseUp={() => { cardFromGrip.current = false; }}
              />
            </div>
          );
        })}

        <button
          onClick={addCard}
          className="bg-[#1e1e1e] border border-dashed border-[#3a3a3a] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[200px] hover:border-[#666] transition-colors group"
        >
          <Plus className="w-5 h-5 text-[#555] group-hover:text-[#888]" />
          <span className="text-xs text-[#555] group-hover:text-[#888]">חדש</span>
        </button>
      </div>
    </div>
  );
}
