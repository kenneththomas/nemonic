import { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings as SettingsIcon, X, Search, RefreshCw, ArrowUpDown, Filter } from 'lucide-react';
import { loadAPIKey, saveAPIKey, loadModel, saveModel, loadSystemPrompt, saveSystemPrompt, loadModelUsage, loadLLMSettings, saveLLMSettings, LLMSettings } from '../services/storage';
import { getModels, ModelInfo } from '../services/openrouter';

interface SettingsProps {
  onModelChange: (model: string) => void;
}

export default function Settings({ onModelChange }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(loadAPIKey());
  const [model, setModel] = useState(loadModel());
  const [systemPrompt, setSystemPrompt] = useState(loadSystemPrompt());
  const [llmSettings, setLlmSettings] = useState<LLMSettings>(loadLLMSettings());
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLoadedModels, setHasLoadedModels] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'usage' | 'provider'>('usage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minContext, setMinContext] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [usageData, setUsageData] = useState(loadModelUsage());

  const refreshUsageData = useCallback(() => {
    setUsageData(loadModelUsage());
  }, []);

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
      // Reset form state from storage when opening (so Cancel properly discards)
      setApiKey(loadAPIKey());
      setModel(loadModel());
      setSystemPrompt(loadSystemPrompt());
      setLlmSettings(loadLLMSettings());
      setUsageData(loadModelUsage());
      loadAvailableModels();
      refreshUsageData();
    }
  }, [isOpen, loadAvailableModels, refreshUsageData]);

  useEffect(() => {
    // Reload models when API key changes (if we've already loaded once)
    if (isOpen && apiKey && hasLoadedModels) {
      loadAvailableModels();
    }
  }, [apiKey, isOpen, hasLoadedModels, loadAvailableModels]);

  const handleExit = () => {
    saveAPIKey(apiKey);
    saveModel(model);
    saveSystemPrompt(systemPrompt);
    saveLLMSettings(llmSettings);
    onModelChange(model);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };


  // Get unique providers
  const providers = useMemo(() => {
    const providerSet = new Set<string>();
    availableModels.forEach(m => {
      const provider = m.id.split('/')[0];
      if (provider) providerSet.add(provider);
    });
    return Array.from(providerSet).sort();
  }, [availableModels]);

  // Filter models
  const filteredModels = useMemo(() => {
    return availableModels.filter(m => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          m.id.toLowerCase().includes(query) ||
          m.name?.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Provider filter
      if (filterProvider) {
        if (!m.id.startsWith(filterProvider + '/')) return false;
      }

      // Price filter
      if (maxPrice) {
        const promptPrice = parseFloat(m.pricing?.prompt || '0');
        const maxPriceNum = parseFloat(maxPrice);
        if (promptPrice > maxPriceNum) return false;
      }

      // Context length filter
      if (minContext) {
        const minContextNum = parseInt(minContext);
        if (!m.context_length || m.context_length < minContextNum) return false;
      }

      return true;
    });
  }, [availableModels, searchQuery, filterProvider, maxPrice, minContext]);

  // Sort models
  const sortedModels = useMemo(() => {
    const sorted = [...filteredModels].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = (a.name || a.id).localeCompare(b.name || b.id);
          break;
        
        case 'price':
          const aPrice = parseFloat(a.pricing?.prompt || '999999');
          const bPrice = parseFloat(b.pricing?.prompt || '999999');
          comparison = aPrice - bPrice;
          break;
        
        case 'usage':
          const aUsage = usageData.find(u => u.modelId === a.id);
          const bUsage = usageData.find(u => u.modelId === b.id);
          const aCount = aUsage?.requestCount || 0;
          const bCount = bUsage?.requestCount || 0;
          comparison = aCount - bCount;
          break;
        
        case 'provider':
          const aProvider = a.id.split('/')[0] || '';
          const bProvider = b.id.split('/')[0] || '';
          comparison = aProvider.localeCompare(bProvider);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredModels, sortBy, sortOrder, usageData]);

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
                onClick={handleExit}
                className="text-gray-400 hover:text-white"
                title="Close and save"
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                        showFilters 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <Filter size={12} />
                      Filters
                    </button>
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

                    {showFilters && (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Provider</label>
                            <select
                              value={filterProvider}
                              onChange={(e) => setFilterProvider(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                            >
                              <option value="">All Providers</option>
                              {providers.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Max Price ($/1M)</label>
                            <input
                              type="number"
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              placeholder="No limit"
                              step="0.01"
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Min Context Length</label>
                          <input
                            type="number"
                            value={minContext}
                            onChange={(e) => setMinContext(e.target.value)}
                            placeholder="No minimum"
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs text-gray-400">Sort by:</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="usage">Usage (Most Used)</option>
                        <option value="price">Price (Lowest First)</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="provider">Provider</option>
                      </select>
                      <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-1 rounded"
                        title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                      >
                        <ArrowUpDown size={14} />
                      </button>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                      {sortedModels.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                          No models found matching your filters
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-700">
                          {sortedModels.map((m) => {
                            const usage = usageData.find(u => u.modelId === m.id);
                            const promptPrice = parseFloat(m.pricing?.prompt || '0');
                            const completionPrice = parseFloat(m.pricing?.completion || '0');
                            const isSelected = model === m.id;
                            
                            return (
                              <button
                                key={m.id}
                                onClick={() => setModel(m.id)}
                                className={`w-full text-left p-3 hover:bg-gray-700 transition-colors ${
                                  isSelected ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white text-sm truncate">
                                      {m.name || m.id}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                                      {m.context_length && (
                                        <div>Context: {(m.context_length / 1000).toFixed(0)}k tokens</div>
                                      )}
                                      {promptPrice > 0 && (
                                        <div>
                                          ${promptPrice}/1M prompt
                                          {completionPrice > 0 && `, $${completionPrice}/1M completion`}
                                        </div>
                                      )}
                                      {usage && usage.requestCount > 0 && (
                                        <div className="text-blue-400">
                                          Used {usage.requestCount} time{usage.requestCount !== 1 ? 's' : ''} 
                                          {' '}({usage.totalTokens.toLocaleString()} tokens)
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="text-blue-400 text-xs">✓</div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {sortedModels.length} of {availableModels.length} models shown
                      {filterProvider || maxPrice || minContext ? ' (filtered)' : ''}
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter a system prompt to guide the AI's behavior (optional)..."
                  rows={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This prompt will be included as a system message in every conversation. Leave empty to disable.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  LLM Parameters
                </label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400">Temperature</label>
                      <span className="text-xs text-gray-500">{llmSettings.temperature ?? 0.7}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={llmSettings.temperature ?? 0.7}
                      onChange={(e) => setLlmSettings({ ...llmSettings, temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Controls randomness. Lower = more focused, Higher = more creative (0.0-2.0)
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max Tokens</label>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={llmSettings.max_tokens ?? 2000}
                      onChange={(e) => setLlmSettings({ ...llmSettings, max_tokens: parseInt(e.target.value) || undefined })}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum number of tokens in the response
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400">Top P</label>
                      <span className="text-xs text-gray-500">{llmSettings.top_p ?? 1.0}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={llmSettings.top_p ?? 1.0}
                      onChange={(e) => setLlmSettings({ ...llmSettings, top_p: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nucleus sampling: considers tokens with top_p probability mass (0.0-1.0)
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400">Frequency Penalty</label>
                      <span className="text-xs text-gray-500">{llmSettings.frequency_penalty ?? 0.0}</span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={llmSettings.frequency_penalty ?? 0.0}
                      onChange={(e) => setLlmSettings({ ...llmSettings, frequency_penalty: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Reduces repetition based on token frequency (-2.0 to 2.0)
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400">Presence Penalty</label>
                      <span className="text-xs text-gray-500">{llmSettings.presence_penalty ?? 0.0}</span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={llmSettings.presence_penalty ?? 0.0}
                      onChange={(e) => setLlmSettings({ ...llmSettings, presence_penalty: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Encourages new topics by penalizing already used tokens (-2.0 to 2.0)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCancel}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
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
