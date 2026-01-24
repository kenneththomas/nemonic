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
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Documents</h2>
        <label className="block">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            accept=".txt,.md,.pdf,.doc,.docx"
          />
          <div className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-2">
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
          <div className="text-gray-500 text-sm text-center mt-4">
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
                selectedDocuments.includes(fileName)
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
              onClick={() => toggleSelection(fileName)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={16} className="text-blue-400" />
                    <div className="font-semibold text-white text-sm">
                      {fileName}
                    </div>
                  </div>
                  <div className="text-gray-400 text-xs">
                    {chunkCount} chunk{chunkCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(fileName);
                  }}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <X size={16} />
                </button>
              </div>
              {selectedDocuments.includes(fileName) && (
                <div className="mt-2 text-xs text-blue-400">Selected for RAG</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
