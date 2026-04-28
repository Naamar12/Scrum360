import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, GripVertical } from 'lucide-react';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface CardData {
  id: string;
  title: string;
  items: ChecklistItem[];
}

const INITIAL_CARDS: CardData[] = [
  { id: 'bugs', title: 'באגים', items: [] },
  { id: 'features', title: 'פיצ\'רים', items: [] },
  { id: 'connections', title: 'חיבורים', items: [] },
];

const CARD_COLORS: Record<string, { header: string; headerText: string; border: string; bg: string; checkColor: string }> = {
  bugs:        { header: 'linear-gradient(135deg,#fee2e2,#fecaca)', headerText: '#991b1b', border: '#fca5a5', bg: '#fff5f5', checkColor: '#ef4444' },
  features:    { header: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', headerText: '#5b21b6', border: '#c4b5fd', bg: '#faf8ff', checkColor: '#7c3aed' },
  connections: { header: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', headerText: '#065f46', border: '#6ee7b7', bg: '#f0fdf9', checkColor: '#059669' },
};

const COLLAPSE_THRESHOLD = 2;

// ─── ItemRow ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ChecklistItem;
  cardId: string;
  colors: typeof CARD_COLORS[string];
  isDragOver: boolean;
  onToggle: (cardId: string, itemId: string) => void;
  onDelete: (cardId: string, itemId: string) => void;
  onEdit: (cardId: string, itemId: string, text: string) => void;
  onDragStart: (itemId: string) => void;
  onDragOver: (e: React.DragEvent, itemId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ItemRow({ item, cardId, colors, isDragOver, onToggle, onDelete, onEdit, onDragStart, onDragOver, onDrop, onDragEnd }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const fromGrip = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // keep draft in sync if item.text changes externally
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
          className="flex-1 text-sm leading-snug cursor-text select-none"
          style={{
            color: item.checked ? '#a0a0a0' : '#334155',
            textDecoration: item.checked ? 'line-through' : 'none',
            textDecorationColor: '#a0a0a0',
          }}
          onClick={() => setEditing(true)}
        >
          {item.text}
        </span>
      )}

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

function DraggableList({ items, cardId, colors, onToggle, onDelete, onEdit, onReorder }: {
  items: ChecklistItem[];
  cardId: string;
  colors: typeof CARD_COLORS[string];
  onToggle: (cardId: string, itemId: string) => void;
  onDelete: (cardId: string, itemId: string) => void;
  onEdit: (cardId: string, itemId: string, text: string) => void;
  onReorder: (cardId: string, fromId: string, toId: string) => void;
}) {
  const dragSrc = useRef<string | null>(null);
  const [overItemId, setOverItemId] = useState<string | null>(null);

  const handleDragStart = useCallback((itemId: string) => {
    dragSrc.current = itemId;
  }, []);

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

function ChecklistCard({ card, onToggle, onAdd, onDelete, onEdit, onReorder }: {
  card: CardData;
  onToggle: (cardId: string, itemId: string) => void;
  onAdd: (cardId: string, text: string) => void;
  onDelete: (cardId: string, itemId: string) => void;
  onEdit: (cardId: string, itemId: string, text: string) => void;
  onReorder: (cardId: string, fromId: string, toId: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);
  const colors = CARD_COLORS[card.id];

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
      <div className="px-4 py-3 flex items-center relative" style={{ background: colors.header }}>
        {card.items.length > 0 && (
          <span className="absolute left-4 text-xs font-semibold opacity-70 tabular-nums" style={{ color: colors.headerText }}>
            {checked.length}/{card.items.length}
          </span>
        )}
        <h3 className="flex-1 text-sm font-bold tracking-wide text-center" style={{ color: colors.headerText }}>
          {card.title}
        </h3>
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
          onReorder={onReorder}
        />

        {unchecked.length === 0 && checked.length === 0 && (
          <p className="text-xs text-slate-400 py-3 text-center">אין פריטים עדיין</p>
        )}

        {/* Completed section */}
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

const STORAGE_KEY = 'more-widget-cards';

function loadCards(): CardData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_CARDS;
    const parsed: CardData[] = JSON.parse(raw);
    return INITIAL_CARDS.map(def => parsed.find(c => c.id === def.id) ?? def);
  } catch {
    return INITIAL_CARDS;
  }
}

export default function MoreWidget() {
  const [cards, setCards] = useState<CardData[]>(loadCards);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  const handleToggle = useCallback((cardId: string, itemId: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      const toggled = card.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i);
      // move newly checked to end, newly unchecked before first checked
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
      const newItem: ChecklistItem = { id: `${cardId}-${Date.now()}-${Math.random()}`, text, checked: false };
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

  // Reorder: move `fromId` to just before `toId` (within same checked/unchecked group)
  const handleReorder = useCallback((cardId: string, fromId: string, toId: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== cardId) return card;
      const items = [...card.items];
      const fromIdx = items.findIndex(i => i.id === fromId);
      const toIdx = items.findIndex(i => i.id === toId);
      if (fromIdx === -1 || toIdx === -1) return card;
      const [moved] = items.splice(fromIdx, 1);
      const insertAt = items.findIndex(i => i.id === toId);
      items.splice(insertAt, 0, moved);
      return { ...card, items };
    }));
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(card => (
        <ChecklistCard
          key={card.id}
          card={card}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onReorder={handleReorder}
        />
      ))}
    </div>
  );
}
