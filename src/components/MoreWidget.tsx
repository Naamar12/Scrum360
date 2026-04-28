import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, GripVertical, Eye, Trash2 } from 'lucide-react';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  notes?: string;
  createdAt?: number;
}

interface CardData {
  id: string;
  title: string;
  items: ChecklistItem[];
  colorKey?: string;
}

const COLOR_PALETTE: Record<string, { header: string; headerText: string; border: string; bg: string; checkColor: string }> = {
  red:    { header: 'linear-gradient(135deg,#fee2e2,#fecaca)', headerText: '#991b1b', border: '#fca5a5', bg: '#fff5f5', checkColor: '#ef4444' },
  purple: { header: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', headerText: '#5b21b6', border: '#c4b5fd', bg: '#faf8ff', checkColor: '#7c3aed' },
  green:  { header: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', headerText: '#065f46', border: '#6ee7b7', bg: '#f0fdf9', checkColor: '#059669' },
  yellow: { header: 'linear-gradient(135deg,#fef3c7,#fde68a)', headerText: '#92400e', border: '#fcd34d', bg: '#fffbeb', checkColor: '#d97706' },
  blue:   { header: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', headerText: '#1e40af', border: '#93c5fd', bg: '#eff6ff', checkColor: '#3b82f6' },
  pink:   { header: 'linear-gradient(135deg,#fce7f3,#fbcfe8)', headerText: '#9d174d', border: '#f9a8d4', bg: '#fdf2f8', checkColor: '#ec4899' },
  teal:   { header: 'linear-gradient(135deg,#ccfbf1,#99f6e4)', headerText: '#134e4a', border: '#5eead4', bg: '#f0fdfa', checkColor: '#14b8a6' },
  orange: { header: 'linear-gradient(135deg,#ffedd5,#fed7aa)', headerText: '#9a3412', border: '#fdba74', bg: '#fff7ed', checkColor: '#f97316' },
};

const COLOR_KEYS = Object.keys(COLOR_PALETTE);

const CARD_COLOR_MAP: Record<string, string> = {
  bugs: 'red',
  features: 'purple',
  connections: 'green',
};

function getCardColors(card: CardData) {
  const key = card.colorKey ?? CARD_COLOR_MAP[card.id] ?? 'blue';
  return COLOR_PALETTE[key] ?? COLOR_PALETTE.blue;
}

const INITIAL_CARDS: CardData[] = [
  { id: 'bugs', title: 'באגים', items: [] },
  { id: 'features', title: 'פיצ\'רים', items: [] },
  { id: 'connections', title: 'חיבורים', items: [] },
];

const COLLAPSE_THRESHOLD = 2;
const STORAGE_KEY = 'more-widget-cards';

// ─── ItemDetailModal ──────────────────────────────────────────────────────────

function ItemDetailModal({ item, cardTitle, colors, onClose, onSave }: {
  item: ChecklistItem;
  cardTitle: string;
  colors: typeof COLOR_PALETTE[string];
  onClose: () => void;
  onSave: (updated: ChecklistItem) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = item.notes ?? '';
      editorRef.current.focus();
      // place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  const commit = () => {
    onSave({ ...item, notes: editorRef.current?.innerHTML ?? '' });
    onClose();
  };

  const handleBold = (e: React.MouseEvent) => {
    e.preventDefault(); // keep focus in editor
    document.execCommand('bold');
    editorRef.current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm"
      onClick={commit}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 rounded-t-2xl flex items-center gap-3"
          style={{ background: colors.header, boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}
          dir="rtl"
        >
          <button
            onClick={commit}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
            style={{ color: colors.headerText }}
          >
            <X className="w-4 h-4" />
          </button>
          <span
            className="flex-1 text-sm font-bold leading-snug"
            style={{ color: colors.headerText, textAlign: 'right' }}
          >
            {item.text}
          </span>
        </div>

        {/* Toolbar */}
        <div className="px-6 pt-4 pb-1 flex justify-end">
          <button
            onMouseDown={handleBold}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors select-none"
            title="בולד (Ctrl+B)"
          >
            B
          </button>
        </div>

        {/* Editor */}
        <div className="px-6 pb-6">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dir="rtl"
            className="w-full text-sm rounded-xl px-4 py-3 outline-none"
            style={{
              border: `1.5px solid ${colors.border}`,
              color: '#334155',
              lineHeight: '1.7',
              minHeight: 200,
              background: '#fafafa',
              textAlign: 'right',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            data-placeholder="פרטים נוספים..."
            onKeyDown={e => { if (e.key === 'Escape') commit(); }}
          />
          {/* placeholder */}
          <style>{`
            [contenteditable]:empty::before {
              content: attr(data-placeholder);
              color: #94a3b8;
              pointer-events: none;
            }
          `}</style>
          {/* set placeholder via attribute after mount */}
        </div>
      </div>
    </div>
  );
}

// ─── AddCardModal ─────────────────────────────────────────────────────────────

function AddCardModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (title: string, colorKey: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [colorKey, setColorKey] = useState('blue');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleAdd = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, colorKey);
    onClose();
  };

  const colors = COLOR_PALETTE[colorKey];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4" style={{ background: colors.header }}>
          <h3 className="text-sm font-bold text-center" style={{ color: colors.headerText }}>כרטיסיה חדשה</h3>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4" dir="rtl">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">שם</label>
            <input
              ref={inputRef}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #e2e8f0', color: '#334155' }}
              placeholder="שם הכרטיסיה..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              dir="rtl"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">צבע</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_KEYS.map(key => (
                <button
                  key={key}
                  onClick={() => setColorKey(key)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    background: COLOR_PALETTE[key].checkColor,
                    borderColor: colorKey === key ? '#1e293b' : 'transparent',
                    transform: colorKey === key ? 'scale(1.2)' : 'scale(1)',
                  }}
                  title={key}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-start gap-2">
          <button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ background: colors.checkColor }}
          >
            הוסף
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ChecklistItem;
  cardId: string;
  colors: typeof COLOR_PALETTE[string];
  isDragOver: boolean;
  onToggle: (cardId: string, itemId: string) => void;
  onDelete: (cardId: string, itemId: string) => void;
  onEdit: (cardId: string, itemId: string, text: string) => void;
  onOpenDetail: (cardId: string, itemId: string) => void;
  onDragStart: (itemId: string) => void;
  onDragOver: (e: React.DragEvent, itemId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ItemRow({ item, cardId, colors, isDragOver, onToggle, onDelete, onEdit, onOpenDetail, onDragStart, onDragOver, onDrop, onDragEnd }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const fromGrip = useRef(false);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => { setDraft(item.text); }, [item.text]);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.text) onEdit(cardId, item.id, trimmed);
    else setDraft(item.text);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') { setDraft(item.text); setEditing(false); }
  };

  const hasDetail = !!item.notes;

  return (
    <div
      draggable
      onDragStart={e => {
        if (!fromGrip.current) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(item.id);
      }}
      onDragOver={e => onDragOver(e, item.id)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="flex items-center gap-1.5 group py-1 px-1 rounded-lg transition-all"
      style={{
        opacity: item.checked ? 0.45 : 1,
        borderTop: isDragOver ? '2px solid #6366f1' : '2px solid transparent',
      }}
    >
      {/* Grip */}
      <span
        className="shrink-0 cursor-grab text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity active:cursor-grabbing"
        onMouseDown={() => { fromGrip.current = true; }}
        onMouseUp={() => { fromGrip.current = false; }}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>

      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(cardId, item.id)}
        className="shrink-0 w-4 h-4 rounded cursor-pointer"
        style={{ accentColor: colors.checkColor }}
      />

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm rounded px-1 py-0 outline-none bg-white border-b"
          style={{ borderColor: colors.checkColor, color: '#334155', direction: 'rtl' }}
          dir="rtl"
        />
      ) : (
        <span
          className="flex-1 text-sm leading-snug cursor-text select-none flex items-center gap-1.5"
          style={{
            color: item.checked ? '#a0a0a0' : '#334155',
            textDecoration: item.checked ? 'line-through' : 'none',
            textDecorationColor: '#a0a0a0',
          }}
          onClick={() => setEditing(true)}
        >
          {hasDetail && (
            <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-400" title="יש פרטים נוספים" />
          )}
          {item.text}
        </span>
      )}

      {/* Eye / detail button — always visible on hover, highlighted when item has data */}
      <button
        onClick={() => onOpenDetail(cardId, item.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100"
        style={{ color: hasDetail ? colors.checkColor : '#94a3b8' }}
        title="פרטים נוספים"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onDelete(cardId, item.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-red-400"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── DraggableList ────────────────────────────────────────────────────────────

function DraggableList({ items, cardId, colors, onToggle, onDelete, onEdit, onOpenDetail, onReorder }: {
  items: ChecklistItem[];
  cardId: string;
  colors: typeof COLOR_PALETTE[string];
  onToggle: (cardId: string, itemId: string) => void;
  onDelete: (cardId: string, itemId: string) => void;
  onEdit: (cardId: string, itemId: string, text: string) => void;
  onOpenDetail: (cardId: string, itemId: string) => void;
  onReorder: (cardId: string, fromId: string, toId: string) => void;
}) {
  const dragSrc = useRef<string | null>(null);
  const [overItemId, setOverItemId] = useState<string | null>(null);

  const handleDragStart = useCallback((itemId: string) => { dragSrc.current = itemId; }, []);

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (itemId !== dragSrc.current) setOverItemId(itemId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragSrc.current && overItemId && dragSrc.current !== overItemId) {
      onReorder(cardId, dragSrc.current, overItemId);
    }
    dragSrc.current = null;
    setOverItemId(null);
  }, [cardId, overItemId, onReorder]);

  const handleDragEnd = useCallback(() => {
    dragSrc.current = null;
    setOverItemId(null);
  }, []);

  return (
    <>
      {items.map(item => (
        <ItemRow
          key={item.id}
          item={item}
          cardId={cardId}
          colors={colors}
          isDragOver={overItemId === item.id}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          onOpenDetail={onOpenDetail}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      ))}
    </>
  );
}

// ─── ChecklistCard ────────────────────────────────────────────────────────────

function ChecklistCard({ card, onToggle, onAdd, onDelete, onEdit, onOpenDetail, onReorder, onDeleteCard }: {
  card: CardData;
  onToggle: (cardId: string, itemId: string) => void;
  onAdd: (cardId: string, text: string) => void;
  onDelete: (cardId: string, itemId: string) => void;
  onEdit: (cardId: string, itemId: string, text: string) => void;
  onOpenDetail: (cardId: string, itemId: string) => void;
  onReorder: (cardId: string, fromId: string, toId: string) => void;
  onDeleteCard: (cardId: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colors = getCardColors(card);

  const unchecked = card.items.filter(i => !i.checked);
  const checked = card.items.filter(i => i.checked);
  const shouldCollapse = checked.length > COLLAPSE_THRESHOLD;

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAdd(card.id, trimmed);
    setInputValue('');
  };

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col shadow-sm"
      style={{ border: `1px solid ${colors.border}`, background: colors.bg, minHeight: 280 }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center relative group/header" style={{ background: colors.header }}>
        {card.items.length > 0 && (
          <span className="absolute left-4 text-xs font-semibold opacity-70 tabular-nums" style={{ color: colors.headerText }}>
            {checked.length}/{card.items.length}
          </span>
        )}
        <h3 className="flex-1 text-sm font-bold tracking-wide text-center" style={{ color: colors.headerText }}>
          {card.title}
        </h3>
        {confirmDelete ? (
          <div className="absolute right-2 flex items-center gap-1">
            <button
              onClick={() => onDeleteCard(card.id)}
              className="text-xs px-2 py-0.5 rounded text-white font-medium"
              style={{ background: '#ef4444' }}
            >
              מחק
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-0.5 rounded border"
              style={{ color: colors.headerText, borderColor: colors.headerText, opacity: 0.6 }}
            >
              ביטול
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="absolute right-2 opacity-0 group-hover/header:opacity-40 hover:!opacity-100 transition-opacity p-1 rounded"
            style={{ color: colors.headerText }}
            title="מחק כרטיסיה"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto" dir="rtl">
        <DraggableList
          items={unchecked}
          cardId={card.id}
          colors={colors}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          onOpenDetail={onOpenDetail}
          onReorder={onReorder}
        />

        {unchecked.length === 0 && checked.length === 0 && (
          <p className="text-xs text-slate-400 py-3 text-center">אין פריטים עדיין</p>
        )}

        {checked.length > 0 && (
          <div className="mt-1">
            {shouldCollapse ? (
              <>
                <button
                  onClick={() => setCompletedOpen(o => !o)}
                  className="w-full flex items-center gap-1.5 py-1 px-1 text-xs text-slate-400 hover:text-slate-500 transition-colors select-none"
                  dir="rtl"
                >
                  <ChevronDown
                    className="w-3.5 h-3.5 transition-transform shrink-0"
                    style={{ transform: completedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                  <span>הושלמו ({checked.length})</span>
                  <div className="flex-1 h-px bg-slate-200 mr-1" />
                </button>
                {completedOpen && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <DraggableList
                      items={checked}
                      cardId={card.id}
                      colors={colors}
                      onToggle={onToggle}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onOpenDetail={onOpenDetail}
                      onReorder={onReorder}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 px-1" dir="rtl">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 shrink-0">הושלמו</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <DraggableList
                    items={checked}
                    cardId={card.id}
                    colors={colors}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onOpenDetail={onOpenDetail}
                    onReorder={onReorder}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add input */}
      <div className="px-3 pb-3 pt-1 flex gap-2" dir="rtl">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="הוסף פריט..."
          className="flex-1 text-sm rounded-lg px-3 py-1.5 outline-none transition-colors"
          style={{ background: 'white', border: `1px solid ${colors.border}`, color: '#1e293b' }}
          dir="rtl"
        />
        <button
          onClick={handleAdd}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-75"
          style={{ background: colors.checkColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── MoreWidget ───────────────────────────────────────────────────────────────

function loadCards(): CardData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_CARDS;
    const parsed: CardData[] = JSON.parse(raw);
    const initialMerged = INITIAL_CARDS.map(def => parsed.find(c => c.id === def.id) ?? def);
    const initialIds = new Set(INITIAL_CARDS.map(c => c.id));
    const customCards = parsed.filter(c => !initialIds.has(c.id));
    return [...initialMerged, ...customCards];
  } catch {
    return INITIAL_CARDS;
  }
}

export default function MoreWidget() {
  const [cards, setCards] = useState<CardData[]>(loadCards);
  const [detailState, setDetailState] = useState<{ cardId: string; itemId: string } | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  const handleToggle = useCallback((cardId: string, itemId: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      const toggled = card.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i);
      const item = toggled.find(i => i.id === itemId)!;
      const rest = toggled.filter(i => i.id !== itemId);
      const newItems = item.checked
        ? [...rest, item]
        : (() => {
            const firstCheckedIdx = rest.findIndex(i => i.checked);
            if (firstCheckedIdx === -1) return [...rest, item];
            return [...rest.slice(0, firstCheckedIdx), item, ...rest.slice(firstCheckedIdx)];
          })();
      return { ...card, items: newItems };
    }));
  }, []);

  const handleAdd = useCallback((cardId: string, text: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      const newItem: ChecklistItem = {
        id: `${cardId}-${Date.now()}-${Math.random()}`,
        text,
        checked: false,
        createdAt: Date.now(),
      };
      return { ...card, items: [...card.items, newItem] };
    }));
  }, []);

  const handleDelete = useCallback((cardId: string, itemId: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      return { ...card, items: card.items.filter(i => i.id !== itemId) };
    }));
  }, []);

  const handleEdit = useCallback((cardId: string, itemId: string, text: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      return { ...card, items: card.items.map(i => i.id === itemId ? { ...i, text } : i) };
    }));
  }, []);

  const handleReorder = useCallback((cardId: string, fromId: string, toId: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      const items = [...card.items];
      const fromIdx = items.findIndex(i => i.id === fromId);
      if (fromIdx === -1) return card;
      const [moved] = items.splice(fromIdx, 1);
      const insertAt = items.findIndex(i => i.id === toId);
      if (insertAt === -1) return card;
      items.splice(insertAt, 0, moved);
      return { ...card, items };
    }));
  }, []);

  const handleOpenDetail = useCallback((cardId: string, itemId: string) => {
    setDetailState({ cardId, itemId });
  }, []);

  const handleSaveItem = useCallback((updated: ChecklistItem) => {
    if (!detailState) return;
    setCards(prev => prev.map(card => {
      if (card.id !== detailState.cardId) return card;
      return { ...card, items: card.items.map(i => i.id === updated.id ? updated : i) };
    }));
  }, [detailState]);

  const handleAddCard = useCallback((title: string, colorKey: string) => {
    const newCard: CardData = {
      id: `card-${Date.now()}`,
      title,
      items: [],
      colorKey,
    };
    setCards(prev => [...prev, newCard]);
  }, []);

  const handleDeleteCard = useCallback((cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
  }, []);

  const detailCard = detailState ? cards.find(c => c.id === detailState.cardId) : null;
  const detailItem = detailCard ? detailCard.items.find(i => i.id === detailState?.itemId) : null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(card => (
          <ChecklistCard
            key={card.id}
            card={card}
            onToggle={handleToggle}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onOpenDetail={handleOpenDetail}
            onReorder={handleReorder}
            onDeleteCard={handleDeleteCard}
          />
        ))}

        {/* Add card button */}
        <button
          onClick={() => setShowAddCard(true)}
          className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:border-slate-400 hover:bg-slate-50 group"
          style={{ borderColor: '#cbd5e1', minHeight: 280 }}
        >
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed transition-colors group-hover:border-slate-400"
            style={{ borderColor: '#cbd5e1' }}
          >
            <Plus className="w-5 h-5 text-slate-400 group-hover:text-slate-500" />
          </span>
          <span className="text-sm text-slate-400 group-hover:text-slate-500 font-medium">כרטיסיה חדשה</span>
        </button>
      </div>

      {showAddCard && (
        <AddCardModal
          onClose={() => setShowAddCard(false)}
          onAdd={handleAddCard}
        />
      )}

      {detailState && detailItem && detailCard && (
        <ItemDetailModal
          item={detailItem}
          cardTitle={detailCard.title}
          colors={getCardColors(detailCard)}
          onClose={() => setDetailState(null)}
          onSave={handleSaveItem}
        />
      )}
    </>
  );
}
