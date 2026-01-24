import { useState, useEffect } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { DocumentChunk } from '../types';
import { loadDocuments, saveDocuments } from '../services/storage';
import { processFile } from '../services/rag';

interface DocumentsPanelProps {
  selectedDocuments: string[];
  onSelectionChange: (fileNames: string[]) => void;
}

export default function DocumentsPanel({ selectedDocuments, onSelectionChange }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentChunk[]>(loadDocuments());
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    saveDocuments(documents);
  }, [documents]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const chunks = await processFile(file);
      setDocuments(prev => [...prev, ...chunks]);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Failed to process file. Please try again.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = (fileName: string) => {
    setDocuments(prev => prev.filter(d => d.metadata.fileName !== fileName));
    onSelectionChange(selectedDocuments.filter(fn => fn !== fileName));
  };

  const uniqueFiles = Array.from(
    new Set(documents.map(d => d.metadata.fileName))
  );

  const toggleSelection = (fileName: string) => {
    if (selectedDocuments.includes(fileName)) {
      onSelectionChange(selectedDocuments.filter(fn => fn !== fileName));
    } else {
      onSelectionChange([...selectedDocuments, fileName]);
    }
  };

  return (
    <div
      className="h-full flex flex-col border-r"
      style={{ backgroundColor: 'var(--theme-bg-panel)', borderColor: 'var(--theme-border)' }}
    >
      <div className="p-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--theme-text)' }}>
          Documents
        </h2>
        <label className="block">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            accept=".txt,.md,.pdf,.doc,.docx"
          />
          <div
            className={`text-white px-4 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-colors ${
              isUploading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            style={{ backgroundColor: 'var(--theme-accent)' }}
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Upload size={20} />
                <span>Upload Document</span>
              </>
            )}
          </div>
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {uniqueFiles.length === 0 && (
          <div className="text-sm text-center mt-4" style={{ color: 'var(--theme-text-muted)' }}>
            No documents yet. Upload a file to enable RAG.
          </div>
        )}
        {uniqueFiles.map((fileName) => {
          const fileChunks = documents.filter(d => d.metadata.fileName === fileName);
          const chunkCount = fileChunks.length;
          return (
            <div
              key={fileName}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                !selectedDocuments.includes(fileName) ? 'hover:bg-[var(--theme-bg-panel-hover)]' : ''
              }`}
              style={{
                backgroundColor: selectedDocuments.includes(fileName)
                  ? 'var(--theme-conv-active-bg)'
                  : 'var(--theme-bg-panel-hover)',
                borderColor: selectedDocuments.includes(fileName)
                  ? 'var(--theme-conv-active-border)'
                  : 'var(--theme-border)',
              }}
              onClick={() => toggleSelection(fileName)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={16} style={{ color: 'var(--theme-accent)' }} />
                    <div className="font-semibold text-sm" style={{ color: 'var(--theme-text)' }}>
                      {fileName}
                    </div>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {chunkCount} chunk{chunkCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(fileName);
                  }}
                  className="p-1 transition-colors"
                  style={{ color: 'var(--theme-delete-hover)' }}
                >
                  <X size={16} />
                </button>
              </div>
              {selectedDocuments.includes(fileName) && (
                <div className="mt-2 text-xs" style={{ color: 'var(--theme-accent)' }}>
                  Selected for RAG
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
