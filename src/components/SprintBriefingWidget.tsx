import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ClipboardList, Plus, GripVertical, Send, X, Bookmark, CheckSquare, Bug, Loader2, LayoutGrid, List as ListIcon, Archive, ChevronDown, ChevronUp, ExternalLink, Palette } from 'lucide-react';
import { JiraIssue } from './ItemDistributionWidget';

interface Props {
  issues: JiraIssue[];
  activeSprintName?: string;
}

interface CardItem { id: number; text: string; issueType?: string; }
let nextId = (() => {
  try {
    const raw = localStorage.getItem('sprint-briefing-v3');
    if (raw) {
      const data = JSON.parse(raw) as { cards?: Record<string, { items?: { id: number }[] }> };
      const ids = Object.values(data.cards ?? {}).flatMap(c => (c.items ?? []).map(i => i.id));
      if (ids.length) return Math.max(...ids) + 1;
    }
  } catch {}
  return 1;
})();
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

function TypePicker({ current, onChange, isEmpty }: { current?: string; onChange: (t: string | undefined) => void; isEmpty?: boolean }) {
  const [open, setOpen] = useState(false);
  const cat = issueCategory(current);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center justify-center w-4 h-4 rounded transition-opacity ${cat ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
        title="בחר סוג"
        tabIndex={-1}
      >
        {cat ? <IssueTypeIcon type={current} /> : <svg viewBox="0 0 10 10" className="w-2.5 h-2.5"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#888]"/></svg>}
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-20 bg-[#2c2c2c] border border-[#404040] rounded-lg shadow-lg p-1 flex flex-col gap-0.5 min-w-[90px]">
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

const CARD_COLORS = [
  { key: 'default', swatch: '#444444', card: '#252525', header: '#2c2c2c', border: '#353535' },
  { key: 'red',     swatch: '#b85c5c', card: '#2d1c1c', header: '#321f1f', border: '#4a2828' },
  { key: 'orange',  swatch: '#c47c3a', card: '#2d2118', header: '#32261b', border: '#4a3520' },
  { key: 'yellow',  swatch: '#b8a83a', card: '#2c2a18', header: '#302e1b', border: '#484220' },
  { key: 'green',   swatch: '#4a9d5a', card: '#1c2d1e', header: '#1f3221', border: '#28482e' },
  { key: 'teal',    swatch: '#3a9d8e', card: '#1c2b2a', header: '#1f302f', border: '#284644' },
  { key: 'blue',    swatch: '#5b82c4', card: '#1c1f2d', header: '#1f2332', border: '#28304a' },
  { key: 'purple',  swatch: '#8a5bc4', card: '#241c2d', header: '#291f32', border: '#3e284a' },
  { key: 'pink',    swatch: '#c45b8a', card: '#2d1c24', header: '#321f29', border: '#4a283c' },
] as const;
type CardColorKey = typeof CARD_COLORS[number]['key'];
function cardColorStyles(key?: string) {
  return CARD_COLORS.find(c => c.key === key) ?? CARD_COLORS[0];
}

interface StoredCard {
  title: string;
  items: { id: number; text: string; issueType?: string }[];
  isReady?: boolean;
  bgColor?: string;
  generatedContent?: string;
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

function BacklogImportPopup({
  backlogIssues,
  allBacklogIssues,
  currentItems,
  onAdd,
  onClose,
}: {
  backlogIssues: JiraIssue[];
  allBacklogIssues?: JiraIssue[];
  currentItems: CardItem[];
  onAdd: (issue: JiraIssue) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    function mouseHandler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const currentTexts = new Set(currentItems.map(i => i.text.trim()));
  const typeOrder: Record<string, number> = { story: 0, bug: 1, task: 2 };
  const sourceIssues = showAll && allBacklogIssues ? allBacklogIssues : backlogIssues;
  const available = sourceIssues
    .filter(i => !['done', 'closed', 'resolved'].includes(i.status?.toLowerCase() ?? ''))
    .sort((a, b) => (typeOrder[issueCategory(a.type) ?? 'task'] ?? 2) - (typeOrder[issueCategory(b.type) ?? 'task'] ?? 2));

  return (
    <div ref={ref} className="absolute left-0 bottom-6 z-30 bg-[#2c2c2c] border border-[#404040] rounded-xl shadow-2xl p-2 w-64 max-h-52 flex flex-col gap-1">
      <div className="flex items-center justify-between px-1 mb-0.5">
        <span className="text-[10px] text-[#888] uppercase tracking-wide">Backlog</span>
        <div className="flex items-center gap-2">
          {allBacklogIssues && allBacklogIssues.length > backlogIssues.length && (
            <button
              onClick={() => setShowAll(v => !v)}
              className={`text-[10px] transition-colors ${showAll ? 'text-[#5b9bd5]' : 'text-[#555] hover:text-[#888]'}`}
            >
              הצג הכל
            </button>
          )}
          <button onClick={onClose} className="text-[#555] hover:text-[#888] transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {available.length === 0 ? (
        <p className="text-xs text-[#555] px-1 py-2 text-center">אין פריטים ב-Backlog</p>
      ) : (
        <div className="overflow-y-auto flex flex-col gap-0.5">
          {available.map(issue => {
            const added = currentTexts.has(issue.summary.trim());
            return (
              <button
                key={issue.id}
                onClick={() => !added && onAdd(issue)}
                disabled={added}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-right transition-colors group ${added ? 'text-[#555] cursor-default' : 'hover:bg-[#383838] text-[#ccc] cursor-pointer'}`}
                title={issue.summary}
              >
                {issue.url && (
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[#555] hover:text-[#5b9bd5] transition-colors shrink-0"
                    title="פתח בג'ירה"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <IssueTypeIcon type={issue.type} />
                <span dir="rtl" className={`flex-1 text-right truncate ${added ? 'line-through' : ''}`}>{issue.summary}</span>
                {showAll && issue.assignee && issue.assignee !== 'Unassigned' && !added && (
                  <span className="text-[9px] text-[#666] shrink-0 max-w-[40px] truncate">{issue.assignee.split(' ')[0]}</span>
                )}
                {added
                  ? <CheckSquare className="w-3 h-3 text-[#4a9d5a] shrink-0" />
                  : <Plus className="w-3 h-3 text-[#555] group-hover:text-[#888] shrink-0" />
                }
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraggableCard({
  devKey, initialTitle, initialItems, isReady, onTitleChange, onItemsChange, onDelete, onToggleReady, onSendToSlack,
  onCardGripMouseDown, onCardGripMouseUp, compact, backlogIssues, allBacklogIssues, initialBgColor, onBgColorChange,
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
  compact?: boolean;
  backlogIssues?: JiraIssue[];
  allBacklogIssues?: JiraIssue[];
  initialBgColor?: string;
  onBgColorChange: (color: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [items, setItems] = useState<CardItem[]>(initialItems.length ? initialItems : [makeItem()]);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [slackOpen, setSlackOpen] = useState(false);
  const [slackChannel, setSlackChannel] = useState('');
  const [slackSending, setSlackSending] = useState(false);
  const [slackError, setSlackError] = useState('');
  const [undoItems, setUndoItems] = useState<CardItem[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [bgColorKey, setBgColorKey] = useState<string>(initialBgColor ?? 'default');
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const dragSrc = useRef<number | null>(null);
  const fromGrip = useRef(false);

  useEffect(() => {
    if (!colorPickerOpen) return;
    function handler(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) setColorPickerOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickerOpen]);

  function changeBgColor(key: string) { setBgColorKey(key); onBgColorChange(key); setColorPickerOpen(false); }
  const colors = cardColorStyles(bgColorKey);

  const status = cardStatus({ title, items, isReady });
  const filledCount = items.filter(i => i.text.trim()).length;

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
      const emptyIdx = items.findIndex(it => it.text === '');
      if (emptyIdx !== -1) {
        setTimeout(() => {
          document.querySelectorAll<HTMLInputElement>(`[data-card-id="${devKey}"] .item-input`)[emptyIdx]?.focus();
        }, 0);
        return;
      }
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
    e.stopPropagation();
    dragSrc.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); e.stopPropagation(); setOverIdx(idx); }
  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault(); e.stopPropagation();
    if (dragSrc.current !== null && dragSrc.current !== idx) {
      const next = [...items];
      const [moved] = next.splice(dragSrc.current, 1);
      next.splice(idx, 0, moved);
      changeItems(next);
    }
    dragSrc.current = null; fromGrip.current = false; setOverIdx(null);
  }
  function onDragEnd() { dragSrc.current = null; fromGrip.current = false; setOverIdx(null); }

  async function handleSendSlack() {
    if (!slackChannel.trim()) return;
    setSlackSending(true);
    setSlackError('');
    try {
      const text = items.filter(i => i.text.trim()).map(i => `• ${i.text}`).join('\n');
      await onSendToSlack(`${slackChannel.trim()}|||${text}`);
      setSlackOpen(false);
      setSlackChannel('');
    } catch (err: any) {
      setSlackError(err.message ?? 'שגיאה');
    } finally {
      setSlackSending(false);
    }
  }

  function handleBodyClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, .item-input')) return;
    const emptyIdx = items.findIndex(it => it.text === '');
    if (emptyIdx !== -1) {
      setTimeout(() => {
        document.querySelectorAll<HTMLInputElement>(`[data-card-id="${devKey}"] .item-input`)[emptyIdx]?.focus();
      }, 0);
      return;
    }
    const newItem = makeItem();
    changeItems([...items, newItem]);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(`[data-card-id="${devKey}"] .item-input`);
      inputs[inputs.length - 1]?.focus();
    }, 0);
  }

  const itemsBody = (
    <div className="flex-1">
      <div className="flex flex-col gap-1">
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable={item.text.trim() !== ''}
            onDragStart={e => onDragStart(e, idx)}
            onDragOver={e => { if (item.text.trim() !== '') onDragOver(e, idx); }}
            onDrop={e => { if (item.text.trim() !== '') onDrop(e, idx); }}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-1 group/item rounded transition-colors ${overIdx === idx && dragSrc.current !== idx ? 'bg-[#333]' : ''}`}
          >
            <button
              onClick={() => { if (items.length > 1) changeItems(items.filter((_, i) => i !== idx)); }}
              tabIndex={-1}
              className={`shrink-0 opacity-0 transition-opacity text-[#555] hover:text-red-400 ${item.text.trim() !== '' && items.length > 1 ? 'group-hover/item:opacity-100' : 'pointer-events-none'}`}
            >
              <X className="w-3 h-3" />
            </button>
            <input
              value={item.text}
              onChange={e => updateItem(item.id, e.target.value)}
              onKeyDown={e => handleKeyDown(e, idx)}
              placeholder="הוסף פריט..."
              dir="rtl"
              draggable={false}
              className="item-input flex-1 bg-transparent text-[#d4d4d4] text-sm focus:outline-none placeholder:text-[#444] min-w-0"
            />
            <TypePicker current={item.issueType} onChange={t => updateItemType(item.id, t)} isEmpty={item.text.trim() === ''} />
            <GripVertical
              className={`w-3.5 h-3.5 text-[#444] shrink-0 opacity-0 transition-opacity ${item.text.trim() !== '' ? 'cursor-grab active:cursor-grabbing group-hover/item:opacity-100' : 'pointer-events-none'}`}
              onMouseDown={() => { if (item.text.trim() !== '') fromGrip.current = true; }}
              onMouseUp={() => { fromGrip.current = false; }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const footerButtons = (
    <div className="flex justify-between mt-1">
      <button
        onClick={onDelete}
        className="text-xs text-[#777] border border-[#404040] rounded-full px-3 py-1 hover:border-red-800 hover:text-red-400 transition-colors"
      >
        מחק
      </button>
      <div className="flex gap-1.5">
        {status !== 'empty' && (
          <button
            onClick={() => setSlackOpen(v => !v)}
            title="שלח לסלאק"
            className="text-xs text-[#777] border border-[#404040] rounded-full px-3 py-1 hover:border-indigo-600 hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            סלאק
          </button>
        )}
        {undoItems && (
          <button
            onClick={() => { changeItems(undoItems); setUndoItems(null); }}
            className="text-xs text-[#777] border border-[#404040] rounded-full px-3 py-1 hover:border-indigo-600 hover:text-indigo-400 transition-colors"
          >
            שחזר
          </button>
        )}
        <button
          onClick={() => { setUndoItems(items); changeItems([makeItem()]); }}
          className="text-xs text-[#777] border border-[#404040] rounded-full px-3 py-1 hover:border-[#666] hover:text-[#aaa] transition-colors"
        >
          נקה
        </button>
        <button
          onClick={onToggleReady}
          className={`text-xs border rounded-full px-3 py-1 transition-colors ${
            isReady
              ? 'border-emerald-600 text-emerald-400 hover:border-red-700 hover:text-red-400'
              : 'border-[#404040] text-[#777] hover:border-emerald-600 hover:text-emerald-400'
          }`}
        >
          {isReady ? 'מוכן ✓' : 'סמן כמוכן'}
        </button>
      </div>
    </div>
  );

  // Compact / list-row mode
  if (compact) {
    return (
      <div
        data-card-id={devKey}
        className="border rounded-xl group/card"
        style={{ background: colors.card, borderColor: colors.border }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
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
          <div className="flex items-center gap-2 shrink-0">
            {filledCount > 0 && (
              <span className="text-[10px] text-[#666] bg-[#2d2d2d] border border-[#404040] px-1.5 py-0.5 rounded-full">{filledCount}</span>
            )}
            <StatusDot status={status} />
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[#555] hover:text-[#888] transition-colors p-0.5"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {expanded && (
          <div className="border-t px-3 py-2 flex flex-col gap-2" style={{ borderColor: colors.border }} onClick={handleBodyClick}>
            {itemsBody}
            {((backlogIssues && backlogIssues.length > 0) || (allBacklogIssues && allBacklogIssues.length > 0)) && (
              <div className="relative">
                <button
                  onClick={() => setBacklogOpen(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>ייבוא מ-Backlog</span>
                </button>
                {backlogOpen && (
                  <BacklogImportPopup
                    backlogIssues={backlogIssues ?? []}
                    allBacklogIssues={allBacklogIssues}
                    currentItems={items}
                    onAdd={issue => {
                      const filled = items.filter(it => it.text.trim() !== '');
                      changeItems([...filled, makeItem(issue.summary, issue.type)]);
                    }}
                    onClose={() => setBacklogOpen(false)}
                  />
                )}
              </div>
            )}
            {slackOpen && (
              <div className="flex gap-1.5">
                <input
                  value={slackChannel}
                  onChange={e => setSlackChannel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendSlack()}
                  placeholder="#channel או @user"
                  dir="ltr"
                  autoFocus
                  className="flex-1 bg-[#2c2c2c] border border-[#404040] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#555] placeholder:text-[#555]"
                />
                <button
                  onClick={handleSendSlack}
                  disabled={slackSending}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
                >
                  {slackSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </button>
                <button onClick={() => { setSlackOpen(false); setSlackError(''); }}
                  className="px-2 py-1 text-[#666] hover:text-[#999] transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {slackError && <p className="text-xs text-red-400">{slackError}</p>}
            {footerButtons}
          </div>
        )}
      </div>
    );
  }

  // Full grid card mode
  return (
    <div
      data-card-id={devKey}
      className="border rounded-2xl flex flex-col group/card"
      style={{ background: colors.card, borderColor: colors.border }}
    >
      {/* Header – distinct background */}
      <div className="border-b px-3 py-2 flex items-center gap-2 rounded-t-2xl" style={{ background: colors.header, borderColor: colors.border }}>
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
          <div ref={colorPickerRef} className="relative">
            <button
              onClick={() => setColorPickerOpen(v => !v)}
              className="text-[#555] hover:text-[#888] transition-colors opacity-0 group-hover/card:opacity-100 p-0.5"
              title="שנה צבע"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            {colorPickerOpen && (
              <div className="absolute left-0 top-6 z-30 bg-[#2c2c2c] border border-[#404040] rounded-xl shadow-2xl p-2 flex gap-1.5">
                {CARD_COLORS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => changeBgColor(c.key)}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: c.swatch, borderColor: bgColorKey === c.key ? '#fff' : 'transparent' }}
                    title={c.key}
                  />
                ))}
              </div>
            )}
          </div>
          <StatusDot status={status} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-3 pt-2.5 pb-1 min-h-[120px]" onClick={handleBodyClick}>
        {itemsBody}
        {/* Backlog import button */}
        {((backlogIssues && backlogIssues.length > 0) || (allBacklogIssues && allBacklogIssues.length > 0)) && (
          <div className="relative mt-2">
            <button
              onClick={() => setBacklogOpen(v => !v)}
              className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>ייבוא מ-Backlog ({(backlogIssues ?? []).filter(i => !items.some(ci => ci.text.trim() === i.summary.trim())).length})</span>
            </button>
            {backlogOpen && (
              <BacklogImportPopup
                backlogIssues={backlogIssues ?? []}
                allBacklogIssues={allBacklogIssues}
                currentItems={items}
                onAdd={issue => {
                  const filled = items.filter(it => it.text.trim() !== '');
                  changeItems([...filled, makeItem(issue.summary, issue.type)]);
                }}
                onClose={() => setBacklogOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Slack inline form */}
      {slackOpen && (
        <div className="flex gap-1.5 px-3 mt-1">
          <input
            value={slackChannel}
            onChange={e => setSlackChannel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendSlack()}
            placeholder="#channel או @user"
            dir="ltr"
            autoFocus
            className="flex-1 bg-[#2c2c2c] border border-[#404040] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#555] placeholder:text-[#555]"
          />
          <button
            onClick={handleSendSlack}
            disabled={slackSending}
            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
          >
            {slackSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </button>
          <button onClick={() => { setSlackOpen(false); setSlackError(''); }}
            className="px-2 py-1 text-[#666] hover:text-[#999] transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {slackError && <p className="text-xs text-red-400 px-3">{slackError}</p>}

      {/* Footer */}
      <div className="px-3 pb-3">
        {footerButtons}
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
      if ((issue.sprintState === 'active' || issue.sprintState === 'next') && issue.assignee && issue.assignee !== 'Unassigned') {
        if (!seen.has(issue.assignee)) { seen.add(issue.assignee); list.push(issue.assignee); }
      }
    }
    return list;
  }, [issues]);

  // Issues grouped by assignee for auto-populate (active + next sprint)
  const issuesByDev = useMemo(() => {
    const map: Record<string, JiraIssue[]> = {};
    for (const issue of issues) {
      if ((issue.sprintState === 'active' || issue.sprintState === 'next') && issue.assignee && issue.assignee !== 'Unassigned') {
        if (!map[issue.assignee]) map[issue.assignee] = [];
        map[issue.assignee].push(issue);
      }
    }
    return map;
  }, [issues]);

  // Backlog issues grouped by assignee for quick import (all assigned items)
  const backlogIssuesByDev = useMemo(() => {
    const map: Record<string, JiraIssue[]> = {};
    for (const issue of issues) {
      if (issue.sprintState === 'backlog' && issue.assignee && issue.assignee !== 'Unassigned') {
        if (!map[issue.assignee]) map[issue.assignee] = [];
        map[issue.assignee].push(issue);
      }
    }
    return map;
  }, [issues]);

  const allBacklogIssues = useMemo(
    () => issues.filter(i => i.sprintState === 'backlog' && issueCategory(i.type) !== null),
    [issues],
  );

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
          bgColor: initial[dev]?.bgColor,
        };
      }
    }
    return initial;
  });
  const [extraCards, setExtraCards] = useState<string[]>(stored.extraCards);
  const [hiddenDevs, setHiddenDevs] = useState<Set<string>>(new Set(stored.hiddenDevs));
  const [cardOrder, setCardOrder] = useState<string[]>(stored.cardOrder ?? []);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
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
        [key]: { title: existing?.title ?? key, items: existing?.items ?? [], isReady: existing?.isReady, bgColor: existing?.bgColor, ...patch },
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

  function archiveAndReset() {
    try {
      const archiveKey = `sprint-briefing-archive-${Date.now()}`;
      localStorage.setItem(archiveKey, JSON.stringify({
        cards: cardData, extraCards, hiddenDevs: [...hiddenDevs], cardOrder,
        archivedAt: new Date().toISOString(),
        sprintName: activeSprintName,
      }));
    } catch {}
    // Re-populate from current Jira active sprint
    const fresh: Record<string, StoredCard> = {};
    for (const dev of Object.keys(issuesByDev)) {
      const devIssues = issuesByDev[dev] ?? [];
      fresh[dev] = {
        title: dev,
        items: devIssues.filter(i => issueCategory(i.type) !== null).map(i => makeItem(i.summary, i.type)),
      };
    }
    setCardData(fresh);
    setExtraCards([]);
    setHiddenDevs(new Set());
    setCardOrder([]);
    setArchiveModalOpen(false);
    setBoardKey(k => k + 1);
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

  const readyCount = allCards.filter(({ cardKey }) => cardStatus(cardData[cardKey]) === 'ready').length;

  return (
    <div className="space-y-4">
      {/* Archive confirmation modal */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setArchiveModalOpen(false)}>
          <div
            className="bg-[#1e1e1e] border border-[#404040] rounded-2xl shadow-2xl p-6 w-[360px] flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-white font-semibold text-sm">סיום ספרינט</h3>
                {activeSprintName && (
                  <p className="text-[#888] text-xs mt-0.5">{activeSprintName}</p>
                )}
              </div>
              <button onClick={() => setArchiveModalOpen(false)} className="text-[#555] hover:text-[#888] transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#2c2c2c] border border-[#353535] rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#888]">כרטיסים שיארכבו</span>
                <span className="text-white font-medium">{allCards.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#888]">מוכנים</span>
                <span className="text-emerald-400 font-medium">{readyCount}/{allCards.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#888]">לאחר הסגירה</span>
                <span className="text-[#aaa]">הלוח יתאפס ויתמלא מג'ירה</span>
              </div>
            </div>

            <p className="text-[#777] text-xs leading-relaxed">
              הנתונים יישמרו בארכיון המקומי ולא יימחקו. ניתן לשחזר אותם ב-localStorage תחת המפתח <span className="text-[#aaa] font-mono">sprint-briefing-archive-*</span>.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setArchiveModalOpen(false)}
                className="text-sm text-[#888] border border-[#404040] rounded-full px-4 py-1.5 hover:border-[#666] hover:text-[#aaa] transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={archiveAndReset}
                className="text-sm text-white bg-amber-600 hover:bg-amber-500 rounded-full px-4 py-1.5 font-medium transition-colors flex items-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                ארכב וסגור ספרינט
              </button>
            </div>
          </div>
        </div>
      )}
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

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Archive / New sprint */}
          <button
            onClick={() => setArchiveModalOpen(true)}
            title="ארכב וניקוי לקראת ספרינט הבא"
            className="flex items-center gap-1.5 text-xs text-[#666] border border-[#d0d0d0] rounded-full px-3 py-1 hover:border-amber-500 hover:text-amber-600 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
            ספרינט חדש
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              title="תצוגת כרטיסים"
              className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="תצוגת רשימה"
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 md:grid-cols-3' : 'flex flex-col gap-1.5'}>
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
              className={`transition-transform ${isOver ? (viewMode === 'grid' ? 'scale-[1.02] ring-2 ring-indigo-500/40 rounded-2xl' : 'ring-1 ring-indigo-500/40 rounded-xl') : ''}`}
            >
              <DraggableCard
                key={`${boardKey}-${cardKey}`}
                devKey={cardKey}
                initialTitle={card?.title ?? cardKey}
                initialItems={(card?.items ?? []).map((i: StoredCard['items'][number]) => ({ ...i }))}
                isReady={card?.isReady}
                initialBgColor={card?.bgColor}
                onTitleChange={(t: string) => updateCard(cardKey, { title: t })}
                onItemsChange={(items: CardItem[]) => updateCard(cardKey, { items })}
                onBgColorChange={(bgColor: string) => updateCard(cardKey, { bgColor })}
                onDelete={() => deleteCard(cardKey, isExtra)}
                onToggleReady={() => toggleReady(cardKey)}
                onSendToSlack={(payload: string) => handleSendToSlack(cardKey, payload)}
                onCardGripMouseDown={() => { cardFromGrip.current = true; }}
                onCardGripMouseUp={() => { cardFromGrip.current = false; }}
                compact={viewMode === 'list'}
                backlogIssues={isExtra ? undefined : backlogIssuesByDev[cardKey]}
                allBacklogIssues={isExtra ? undefined : allBacklogIssues}
              />
            </div>
          );
        })}

        <button
          onClick={addCard}
          className={`bg-[#252525] border border-dashed border-[#404040] rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-[#666] transition-colors group ${
            viewMode === 'grid' ? 'p-4 min-h-[120px]' : 'p-3 rounded-xl min-h-[44px] flex-row'
          }`}
        >
          <Plus className={`text-[#555] group-hover:text-[#888] ${viewMode === 'grid' ? 'w-5 h-5' : 'w-4 h-4'}`} />
          <span className="text-xs text-[#555] group-hover:text-[#888]">חדש</span>
        </button>
      </div>
    </div>
  );
}
