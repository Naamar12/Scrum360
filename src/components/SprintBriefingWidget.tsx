import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ClipboardList, Plus, GripVertical } from 'lucide-react';
import { JiraIssue } from './ItemDistributionWidget';

interface Props {
  issues: JiraIssue[];
  activeSprintName?: string;
}

interface CardItem { id: number; text: string; }
let nextId = 1;
function makeItem(text = ''): CardItem { return { id: nextId++, text }; }

const STORAGE_KEY = 'sprint-briefing-v1';

interface StoredData {
  cards: Record<string, { title: string; items: { id: number; text: string }[] }>;
  extraCards: string[];
  hiddenDevs: string[];
}

function load(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { cards: {}, extraCards: [], hiddenDevs: [] };
}

function save(data: StoredData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function DraggableCard({
  devKey, initialTitle, initialItems, onTitleChange, onItemsChange, onDelete,
}: {
  devKey: string;
  initialTitle: string;
  initialItems: CardItem[];
  onTitleChange: (t: string) => void;
  onItemsChange: (items: CardItem[]) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [items, setItems] = useState<CardItem[]>(initialItems.length ? initialItems : [makeItem()]);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragSrc = useRef<number | null>(null);
  const fromGrip = useRef(false);

  function changeTitle(t: string) { setTitle(t); onTitleChange(t); }

  function changeItems(next: CardItem[]) { setItems(next); onItemsChange(next); }

  function updateItem(id: number, text: string) {
    const next = items.map(it => it.id === id ? { ...it, text } : it);
    changeItems(next);
  }

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newItem = makeItem();
      const next = [...items];
      next.splice(idx + 1, 0, newItem);
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

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragSrc.current !== null && dragSrc.current !== idx) {
      const next = [...items];
      const [moved] = next.splice(dragSrc.current, 1);
      next.splice(idx, 0, moved);
      changeItems(next);
    }
    dragSrc.current = null;
    fromGrip.current = false;
    setOverIdx(null);
  }

  function onDragEnd() {
    dragSrc.current = null;
    fromGrip.current = false;
    setOverIdx(null);
  }

  return (
    <div
      data-card-id={devKey}
      className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-2xl p-4 flex flex-col gap-2 min-h-[180px]"
    >
      <input
        value={title}
        onChange={e => changeTitle(e.target.value)}
        dir="rtl"
        className="text-white text-sm font-semibold text-right bg-transparent focus:outline-none border-b border-transparent focus:border-[#555] pb-0.5 w-full transition-colors"
      />

      <div className="flex-1 flex flex-col gap-1 mt-1">
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
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-1">
        <button
          onClick={onDelete}
          className="text-xs text-[#888] border border-[#3a3a3a] rounded-full px-3 py-1 hover:border-red-800 hover:text-red-400 transition-colors"
        >
          מחק
        </button>
        <button
          onClick={() => changeItems([makeItem()])}
          className="text-xs text-[#888] border border-[#3a3a3a] rounded-full px-3 py-1 hover:border-[#666] hover:text-[#aaa] transition-colors"
        >
          נקה
        </button>
      </div>
    </div>
  );
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

  const stored = useMemo(() => load(), []);
  const [cardData, setCardData] = useState<StoredData['cards']>(stored.cards);
  const [extraCards, setExtraCards] = useState<string[]>(stored.extraCards);
  const [hiddenDevs, setHiddenDevs] = useState<Set<string>>(new Set(stored.hiddenDevs));

  useEffect(() => {
    save({ cards: cardData, extraCards, hiddenDevs: [...hiddenDevs] });
  }, [cardData, extraCards, hiddenDevs]);

  function updateCard(key: string, patch: Partial<{ title: string; items: CardItem[] }>) {
    setCardData(prev => ({
      ...prev,
      [key]: { title: prev[key]?.title ?? key, items: prev[key]?.items ?? [], ...patch },
    }));
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

  const visibleDevs = developers.filter(d => !hiddenDevs.has(d));
  const allCards = [
    ...visibleDevs.map(d => ({ key: d, isExtra: false })),
    ...extraCards.map(d => ({ key: d, isExtra: true })),
  ];
  const activeCount = issues.filter(i => i.sprintState === 'active').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">Sprint Briefing</h2>
          {activeSprintName && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{activeSprintName}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">{activeCount} נושאים פעילים</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {allCards.map(({ key, isExtra }) => (
          <DraggableCard
            key={key}
            devKey={key}
            initialTitle={cardData[key]?.title ?? key}
            initialItems={(cardData[key]?.items ?? []).map(i => ({ ...i }))}
            onTitleChange={t => updateCard(key, { title: t })}
            onItemsChange={items => updateCard(key, { items })}
            onDelete={() => deleteCard(key, isExtra)}
          />
        ))}

        <button
          onClick={addCard}
          className="bg-[#1e1e1e] border border-dashed border-[#3a3a3a] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[180px] hover:border-[#666] transition-colors group"
        >
          <Plus className="w-5 h-5 text-[#555] group-hover:text-[#888]" />
          <span className="text-xs text-[#555] group-hover:text-[#888]">חדש</span>
        </button>
      </div>
    </div>
  );
}
