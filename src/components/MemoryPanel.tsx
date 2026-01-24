import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Memory } from '../types';
import { loadMemories, saveMemories } from '../services/storage';

interface MemoryPanelProps {
  selectedMemories: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function MemoryPanel({ selectedMemories, onSelectionChange }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>(loadMemories());
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    saveMemories(memories);
  }, [memories]);

  const handleAdd = () => {
    if (!newTitle.trim() || !newContent.trim()) return;

    const newMemory: Memory = {
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      timestamp: Date.now(),
    };

    setMemories(prev => [...prev, newMemory]);
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    onSelectionChange(selectedMemories.filter(mid => mid !== id));
  };

  const toggleSelection = (id: string) => {
    if (selectedMemories.includes(id)) {
      onSelectionChange(selectedMemories.filter(mid => mid !== id));
    } else {
      onSelectionChange([...selectedMemories, id]);
    }
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {memories.length === 0 && (
          <div className="text-sm text-center mt-4" style={{ color: 'var(--theme-text-muted)' }}>
            No memories yet. Add one to get started.
          </div>
        )}
        {memories.map((memory) => (
          <div
            key={memory.id}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              !selectedMemories.includes(memory.id) ? 'hover:bg-[var(--theme-bg-panel-hover)]' : ''
            }`}
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
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--theme-text)' }}>
                  {memory.title}
                </div>
                <div className="text-xs line-clamp-2" style={{ color: 'var(--theme-text-muted)' }}>
                  {memory.content}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(memory.id);
                }}
                className="p-1 transition-colors"
                style={{ color: 'var(--theme-delete-hover)' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            {selectedMemories.includes(memory.id) && (
              <div className="mt-2 text-xs" style={{ color: 'var(--theme-accent)' }}>Selected</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
