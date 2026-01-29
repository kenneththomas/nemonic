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
  loadTheme,
  saveTheme,
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
import type { ThemeId } from './services/storage';
import ThemesPanel from './components/ThemesPanel';

const MAX_TITLE_LENGTH = 45;

function App() {
  const [selectedMemories, setSelectedMemories] = useState<string[]>(loadSelectedMemories());
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(loadSelectedDocuments());
  const [model, setModel] = useState(loadModel());
  const [showMemoryPanel, setShowMemoryPanel] = useState(true);
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(true);
  const [showConversationsPanel, setShowConversationsPanel] = useState(true);
  const [showThemesPanel, setShowThemesPanel] = useState(false);
  const [theme, setThemeState] = useState<ThemeId>(loadTheme());
  const [chatInput, setChatInput] = useState('');
  const [memoryUsageVersion, setMemoryUsageVersion] = useState(0);

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
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

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

  const activeConversationTitle = useMemo(() => {
    const c = sortedConversations.find((x) => x.id === activeConversationId);
    return c?.title ?? undefined;
  }, [sortedConversations, activeConversationId]);

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
    <div
      className="h-screen flex flex-col"
      style={{ backgroundColor: 'var(--theme-bg-app)' }}
    >
      <header
        className="border-b px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: 'var(--theme-bg-header)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--theme-text)' }}
          >
            Nemonic
          </h1>
          <span
            className="px-2 py-0.5 rounded text-xs font-medium opacity-80"
            style={{
              backgroundColor: 'var(--theme-button-inactive-bg)',
              color: 'var(--theme-button-inactive-text)',
            }}
          >
            v1.17
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowThemesPanel(!showThemesPanel)}
            className="px-3 py-1 rounded-lg text-sm transition-colors hover:opacity-90"
            style={{
              backgroundColor: showThemesPanel
                ? 'var(--theme-button-active-bg)'
                : 'var(--theme-button-inactive-bg)',
              color: showThemesPanel ? '#fff' : 'var(--theme-button-inactive-text)',
            }}
          >
            Themes
          </button>
          <button
            onClick={() => setShowConversationsPanel(!showConversationsPanel)}
            className="px-3 py-1 rounded-lg text-sm transition-colors hover:opacity-90"
            style={{
              backgroundColor: showConversationsPanel
                ? 'var(--theme-button-active-bg)'
                : 'var(--theme-button-inactive-bg)',
              color: showConversationsPanel ? '#fff' : 'var(--theme-button-inactive-text)',
            }}
          >
            Conversations
          </button>
          <button
            onClick={() => setShowMemoryPanel(!showMemoryPanel)}
            className="px-3 py-1 rounded-lg text-sm transition-colors hover:opacity-90"
            style={{
              backgroundColor: showMemoryPanel
                ? 'var(--theme-button-active-bg)'
                : 'var(--theme-button-inactive-bg)',
              color: showMemoryPanel ? '#fff' : 'var(--theme-button-inactive-text)',
            }}
          >
            Memories
          </button>
          <button
            onClick={() => setShowDocumentsPanel(!showDocumentsPanel)}
            className="px-3 py-1 rounded-lg text-sm transition-colors hover:opacity-90"
            style={{
              backgroundColor: showDocumentsPanel
                ? 'var(--theme-button-active-bg)'
                : 'var(--theme-button-inactive-bg)',
              color: showDocumentsPanel ? '#fff' : 'var(--theme-button-inactive-text)',
            }}
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
              chatInput={chatInput}
              memoryUsageVersion={memoryUsageVersion}
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
            conversationTitle={activeConversationTitle}
            onInputChange={setChatInput}
            onMemoriesUsed={() => setMemoryUsageVersion((v) => v + 1)}
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
        {showThemesPanel && (
          <div className="w-64 flex-shrink-0">
            <ThemesPanel theme={theme} onThemeChange={setThemeState} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
