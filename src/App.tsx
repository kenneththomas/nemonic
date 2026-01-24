import { useState, useEffect, useCallback, useMemo } from 'react';
import Chat from './components/Chat';
import MemoryPanel from './components/MemoryPanel';
import DocumentsPanel from './components/DocumentsPanel';
import Settings from './components/Settings';
import ConversationsPanel from './components/ConversationsPanel';
import { Message, Conversation } from './types';
import {
  loadSelectedMemories,
  saveSelectedMemories,
  loadSelectedDocuments,
  saveSelectedDocuments,
  loadModel,
  ensureConversationsInitialized,
  loadConversations,
  getActiveConversationId,
  setActiveConversationId,
  createConversation,
  deleteConversation,
  loadMessagesForConversation,
  saveMessagesForConversation,
  updateConversation,
} from './services/storage';

const MAX_TITLE_LENGTH = 45;

function App() {
  const [selectedMemories, setSelectedMemories] = useState<string[]>(loadSelectedMemories());
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(loadSelectedDocuments());
  const [model, setModel] = useState(loadModel());
  const [showMemoryPanel, setShowMemoryPanel] = useState(true);
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(true);
  const [showConversationsPanel, setShowConversationsPanel] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(() =>
    getActiveConversationId()
  );
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    ensureConversationsInitialized();
    setConversations(loadConversations());
    setActiveConversationIdState(getActiveConversationId());
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;
    setMessages(loadMessagesForConversation(activeConversationId));
  }, [activeConversationId]);

  useEffect(() => {
    saveSelectedMemories(selectedMemories);
  }, [selectedMemories]);

  useEffect(() => {
    saveSelectedDocuments(selectedDocuments);
  }, [selectedDocuments]);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setActiveConversationIdState(id);
  }, []);

  const handleNewConversation = useCallback(() => {
    createConversation();
    setConversations(loadConversations());
    setActiveConversationIdState(getActiveConversationId());
    setMessages([]);
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id);
    ensureConversationsInitialized();
    setConversations(loadConversations());
    setActiveConversationIdState(getActiveConversationId());
    const nextId = getActiveConversationId();
    setMessages(nextId ? loadMessagesForConversation(nextId) : []);
  }, []);

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  const handleMessagesChange = useCallback(
    (next: Message[] | ((prev: Message[]) => Message[])) => {
      setMessages((prev) => {
        const updated = typeof next === 'function' ? next(prev) : next;
        if (activeConversationId) {
          saveMessagesForConversation(activeConversationId, updated);
          const now = Date.now();
          const firstUser = updated.find((m) => m.role === 'user');
          const convs = loadConversations();
          const currentConv = convs.find((c) => c.id === activeConversationId);
          if (currentConv && firstUser && currentConv.title === 'New conversation') {
            const title =
              firstUser.content.length > MAX_TITLE_LENGTH
                ? firstUser.content.slice(0, MAX_TITLE_LENGTH) + '…'
                : firstUser.content;
            updateConversation(activeConversationId, { title, updatedAt: now });
          } else if (currentConv) {
            updateConversation(activeConversationId, { updatedAt: now });
          }
          setConversations(loadConversations());
        }
        return updated;
      });
    },
    [activeConversationId]
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Nemonic</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConversationsPanel(!showConversationsPanel)}
            className={`px-3 py-1 rounded text-sm ${
              showConversationsPanel
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Conversations
          </button>
          <button
            onClick={() => setShowMemoryPanel(!showMemoryPanel)}
            className={`px-3 py-1 rounded text-sm ${
              showMemoryPanel
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Memories
          </button>
          <button
            onClick={() => setShowDocumentsPanel(!showDocumentsPanel)}
            className={`px-3 py-1 rounded text-sm ${
              showDocumentsPanel
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Documents
          </button>
          <Settings onModelChange={setModel} />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {showConversationsPanel && (
          <div className="w-64 flex-shrink-0">
            <ConversationsPanel
              conversations={sortedConversations}
              activeId={activeConversationId}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onDelete={handleDeleteConversation}
            />
          </div>
        )}
        {showMemoryPanel && (
          <div className="w-64 flex-shrink-0">
            <MemoryPanel
              selectedMemories={selectedMemories}
              onSelectionChange={setSelectedMemories}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <Chat
            conversationId={activeConversationId}
            messages={messages}
            onMessagesChange={handleMessagesChange}
            selectedMemories={selectedMemories}
            selectedDocuments={selectedDocuments}
            model={model}
          />
        </div>

        {showDocumentsPanel && (
          <div className="w-64 flex-shrink-0">
            <DocumentsPanel
              selectedDocuments={selectedDocuments}
              onSelectionChange={setSelectedDocuments}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
