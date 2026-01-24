import { useState, useEffect } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
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
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Memories</h2>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
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
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Memory content..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle('');
                  setNewContent('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {memories.length === 0 && (
          <div className="text-gray-500 text-sm text-center mt-4">
            No memories yet. Add one to get started.
          </div>
        )}
        {memories.map((memory) => (
          <div
            key={memory.id}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              selectedMemories.includes(memory.id)
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
            onClick={() => toggleSelection(memory.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-semibold text-white text-sm mb-1">
                  {memory.title}
                </div>
                <div className="text-gray-400 text-xs line-clamp-2">
                  {memory.content}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(memory.id);
                }}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
            {selectedMemories.includes(memory.id) && (
              <div className="mt-2 text-xs text-blue-400">Selected</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
