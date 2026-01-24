import { useState, useEffect } from 'react';
import Chat from './components/Chat';
import MemoryPanel from './components/MemoryPanel';
import DocumentsPanel from './components/DocumentsPanel';
import Settings from './components/Settings';
import { loadSelectedMemories, saveSelectedMemories, loadSelectedDocuments, saveSelectedDocuments, loadModel } from './services/storage';

function App() {
  const [selectedMemories, setSelectedMemories] = useState<string[]>(loadSelectedMemories());
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(loadSelectedDocuments());
  const [model, setModel] = useState(loadModel());
  const [showMemoryPanel, setShowMemoryPanel] = useState(true);
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(true);

  useEffect(() => {
    saveSelectedMemories(selectedMemories);
  }, [selectedMemories]);

  useEffect(() => {
    saveSelectedDocuments(selectedDocuments);
  }, [selectedDocuments]);

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Nemonic</h1>
        <div className="flex items-center gap-2">
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
