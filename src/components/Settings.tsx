import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, X, Search, RefreshCw } from 'lucide-react';
import { loadAPIKey, saveAPIKey, loadModel, saveModel } from '../services/storage';
import { getModels, ModelInfo } from '../services/openrouter';

interface SettingsProps {
  onModelChange: (model: string) => void;
}

export default function Settings({ onModelChange }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(loadAPIKey());
  const [model, setModel] = useState(loadModel());
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLoadedModels, setHasLoadedModels] = useState(false);

  const loadAvailableModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      // Try with API key if available, otherwise try public endpoint
      const models = await getModels(apiKey || undefined);
      setAvailableModels(models);
      setHasLoadedModels(true);
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (isOpen) {
      // Try to load models immediately when settings open
      loadAvailableModels();
    }
  }, [isOpen, loadAvailableModels]);

  useEffect(() => {
    // Reload models when API key changes (if we've already loaded once)
    if (isOpen && apiKey && hasLoadedModels) {
      loadAvailableModels();
    }
  }, [apiKey, isOpen, hasLoadedModels, loadAvailableModels]);

  const handleSave = () => {
    saveAPIKey(apiKey);
    saveModel(model);
    onModelChange(model);
    setIsOpen(false);
  };

  const filteredModels = availableModels.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.id.toLowerCase().includes(query) ||
      m.name?.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query)
    );
  });

  // Sort models: popular ones first, then alphabetically
  const sortedModels = [...filteredModels].sort((a, b) => {
    const popular = ['openai/gpt-4', 'openai/gpt-3.5', 'anthropic/claude', 'google/gemini'];
    const aIsPopular = popular.some(p => a.id.includes(p));
    const bIsPopular = popular.some(p => b.id.includes(p));
    if (aIsPopular && !bIsPopular) return -1;
    if (!aIsPopular && bIsPopular) return 1;
    return a.id.localeCompare(b.id);
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg"
        title="Settings"
      >
        <SettingsIcon size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    openrouter.ai/keys
                  </a>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Model
                  </label>
                  <button
                    onClick={loadAvailableModels}
                    disabled={isLoadingModels}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 flex items-center gap-1"
                    title="Refresh model list"
                  >
                    <RefreshCw size={14} className={isLoadingModels ? 'animate-spin' : ''} />
                    {isLoadingModels ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                
                {isLoadingModels && availableModels.length === 0 ? (
                  <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-8 text-center text-gray-400">
                    Loading models...
                  </div>
                ) : availableModels.length > 0 ? (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search models..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      {sortedModels.map((m) => {
                        const pricing = m.pricing?.prompt 
                          ? ` ($${m.pricing.prompt}/1M prompt`
                          : '';
                        const completionPricing = m.pricing?.completion
                          ? `, $${m.pricing.completion}/1M completion)`
                          : pricing ? ')' : '';
                        const context = m.context_length 
                          ? ` - ${(m.context_length / 1000).toFixed(0)}k ctx`
                          : '';
                        return (
                          <option key={m.id} value={m.id}>
                            {m.name || m.id}{pricing}{completionPricing}{context}
                          </option>
                        );
                      })}
                    </select>
                    {sortedModels.length === 0 && searchQuery && (
                      <p className="text-xs text-gray-500 mt-1">No models found matching "{searchQuery}"</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {sortedModels.length} of {availableModels.length} models shown
                    </p>
                  </>
                ) : (
                  <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-transparent focus:outline-none"
                    >
                      <option value={model}>{model}</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter API key and click Refresh to load available models
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
