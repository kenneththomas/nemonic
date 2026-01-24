import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { Conversation } from '../types';

interface ConversationsPanelProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isThisYear) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ConversationsPanel({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationsPanelProps) {
  return (
    <div
      className="h-full flex flex-col border-r"
      style={{ backgroundColor: 'var(--theme-bg-panel)', borderColor: 'var(--theme-border)' }}
    >
      <div className="p-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
            Conversations
          </h2>
          <button
            onClick={onNew}
            className="text-white p-2 rounded-lg flex items-center gap-1.5 transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--theme-accent)' }}
            title="New conversation"
          >
            <MessageSquarePlus size={18} />
            <span className="text-sm">New</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <div className="text-sm text-center mt-6 px-2" style={{ color: 'var(--theme-text-muted)' }}>
            No conversations yet. Start one with &quot;New&quot;.
          </div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors border ${
              activeId !== conv.id ? 'hover:bg-[var(--theme-bg-panel-hover)]' : ''
            }`}
            style={{
              backgroundColor: activeId === conv.id ? 'var(--theme-conv-active-bg)' : 'transparent',
              borderColor: activeId === conv.id ? 'var(--theme-conv-active-border)' : 'transparent',
            }}
            onClick={() => onSelect(conv.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate" style={{ color: 'var(--theme-text)' }}>
                {conv.title}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                {formatDate(conv.updatedAt)}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-opacity"
              style={{ color: 'var(--theme-delete-hover)' }}
              title="Delete conversation"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
