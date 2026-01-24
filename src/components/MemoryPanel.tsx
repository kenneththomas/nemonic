import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Memory } from '../types';
import { loadMemories, saveMemories } from '../services/storage';

function parseTriggerWords(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatTriggerWords(words: string[]): string {
  return words.join(', ');
}

function matchesTrigger(input: string, trigger: string): boolean {
  const a = input.trim().toLowerCase();
  const b = trigger.trim().toLowerCase();
  if (!a || !b) return false;
  return a.includes(b);
}

interface MemoryPanelProps {
  selectedMemories: string[];
  onSelectionChange: (ids: string[]) => void;
  chatInput?: string;
  memoryUsageVersion?: number;
}

export default function MemoryPanel({
  selectedMemories,
  onSelectionChange,
  chatInput = '',
  memoryUsageVersion = 0,
}: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>(loadMemories());
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTriggerWords, setEditTriggerWords] = useState('');

  useEffect(() => {
    saveMemories(memories);
  }, [memories]);

  useEffect(() => {
    setMemories(loadMemories());
  }, [memoryUsageVersion]);

  const triggeredIds = useMemo(() => {
    if (!chatInput.trim()) return new Set<string>();
    const ids = new Set<string>();
    for (const m of memories) {
      const words = m.triggerWords ?? [];
      for (const w of words) {
        if (matchesTrigger(chatInput, w)) {
          ids.add(m.id);
          break;
        }
      }
    }
    return ids;
  }, [memories, chatInput]);

  const sortedMemories = useMemo(() => {
    const byUse = (a: Memory, b: Memory) => (b.useCount ?? 0) - (a.useCount ?? 0);
    const triggered = memories.filter((m) => triggeredIds.has(m.id));
    const rest = memories.filter((m) => !triggeredIds.has(m.id));
    triggered.sort(byUse);
    rest.sort(byUse);
    return [...triggered, ...rest];
  }, [memories, triggeredIds]);

  const handleAdd = () => {
    if (!newTitle.trim() || !newContent.trim()) return;

    const newMemory: Memory = {
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      timestamp: Date.now(),
      useCount: 0,
    };

    setMemories((prev) => [...prev, newMemory]);
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    onSelectionChange(selectedMemories.filter((mid) => mid !== id));
    if (editingId === id) setEditingId(null);
  };

  const toggleSelection = (id: string) => {
    if (selectedMemories.includes(id)) {
      onSelectionChange(selectedMemories.filter((mid) => mid !== id));
    } else {
      onSelectionChange([...selectedMemories, id]);
    }
  };

  const openEdit = (m: Memory) => {
    setEditingId(m.id);
    setEditTitle(m.title);
    setEditContent(m.content);
    setEditTriggerWords(formatTriggerWords(m.triggerWords ?? []));
  };

  const saveEdit = () => {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;
    const words = parseTriggerWords(editTriggerWords);
    setMemories((prev) =>
      prev.map((m) =>
        m.id === editingId
          ? {
              ...m,
              title: editTitle.trim(),
              content: editContent.trim(),
              triggerWords: words.length ? words : undefined,
            }
          : m
      )
    );
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditTriggerWords('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditTriggerWords('');
  };

  return (
    <div
      className="h-full flex flex-col border-r"
      style={{ backgroundColor: 'var(--theme-bg-panel)', borderColor: 'var(--theme-border)' }}
    >
      <div className="p-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
            Memories
          </h2>
          <button
            onClick={() => setIsAdding(true)}
            className="text-white p-2 rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--theme-accent)' }}
          >
            <Plus size={20} />
          </button>
        </div>
        {isAdding && (
          <div className="space-y-2 mb-4">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Memory title..."
              className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:border-2 focus:border-[var(--theme-accent)] border"
              style={{
                backgroundColor: 'var(--theme-input-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-input-text)',
              }}
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Memory content..."
              rows={3}
              className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:border-2 focus:border-[var(--theme-accent)] border resize-none"
              style={{
                backgroundColor: 'var(--theme-input-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-input-text)',
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle('');
                  setNewContent('');
                }}
                className="flex-1 px-3 py-1 rounded text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--theme-button-inactive-bg)',
                  color: 'var(--theme-button-inactive-text)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {memories.length === 0 && (
          <div className="text-sm text-center mt-4" style={{ color: 'var(--theme-text-muted)' }}>
            No memories yet. Add one to get started.
          </div>
        )}
        {sortedMemories.map((memory) => {
          const isTriggered = triggeredIds.has(memory.id);
          return (
            <div
              key={memory.id}
              className={`border rounded-xl p-4 min-h-[7rem] cursor-pointer transition-colors relative ${
                isTriggered ? 'animate-memory-suggest' : ''
              } ${!selectedMemories.includes(memory.id) ? 'hover:bg-[var(--theme-bg-panel-hover)]' : ''}`}
              style={{
                backgroundColor: selectedMemories.includes(memory.id)
                  ? 'var(--theme-conv-active-bg)'
                  : 'var(--theme-bg-panel-hover)',
                borderColor: selectedMemories.includes(memory.id)
                  ? 'var(--theme-conv-active-border)'
                  : 'var(--theme-border)',
              }}
              onClick={() => toggleSelection(memory.id)}
            >
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <span
                  className="text-xs font-medium tabular-nums px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--theme-button-inactive-bg)',
                    color: 'var(--theme-text-muted)',
                  }}
                  title="Times used"
                >
                  {memory.useCount ?? 0}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(memory);
                  }}
                  className="p-1.5 rounded transition-colors hover:bg-[var(--theme-bg-panel-hover)]"
                  style={{ color: 'var(--theme-text-muted)' }}
                  title="Edit memory"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(memory.id);
                  }}
                  className="p-1.5 transition-colors"
                  style={{ color: 'var(--theme-delete-hover)' }}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="pr-24">
                <div className="font-semibold text-base mb-1.5" style={{ color: 'var(--theme-text)' }}>
                  {memory.title}
                </div>
                <div className="text-sm line-clamp-4 leading-snug" style={{ color: 'var(--theme-text-muted)' }}>
                  {memory.content}
                </div>
              </div>
              {selectedMemories.includes(memory.id) && (
                <div className="mt-2.5 text-sm" style={{ color: 'var(--theme-accent)' }}>
                  Selected
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => e.target === e.currentTarget && cancelEdit()}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm shadow-xl border max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--theme-bg-panel)',
              borderColor: 'var(--theme-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>
              Edit memory
            </h3>
            <div className="space-y-3 mb-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Memory title..."
                className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:border-2 focus:border-[var(--theme-accent)] border"
                style={{
                  backgroundColor: 'var(--theme-input-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-input-text)',
                }}
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Memory content..."
                rows={3}
                className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:border-2 focus:border-[var(--theme-accent)] border resize-none"
                style={{
                  backgroundColor: 'var(--theme-input-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-input-text)',
                }}
              />
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>
                  Trigger words
                </label>
                <p className="text-xs mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                  When you type these in chat, this memory is suggested (moved to top, flash).
                  Comma- or newline-separated.
                </p>
                <textarea
                  value={editTriggerWords}
                  onChange={(e) => setEditTriggerWords(e.target.value)}
                  placeholder="e.g. project X, vacation, work"
                  rows={2}
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:border-2 focus:border-[var(--theme-accent)] border resize-none"
                  style={{
                    backgroundColor: 'var(--theme-input-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-input-text)',
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={!editTitle.trim() || !editContent.trim()}
                className="flex-1 px-3 py-1.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--theme-accent)',
                  color: '#fff',
                }}
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 px-3 py-1.5 rounded text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--theme-button-inactive-bg)',
                  color: 'var(--theme-button-inactive-text)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
