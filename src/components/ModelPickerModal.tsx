import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, RefreshCw, ArrowUpDown, Filter } from 'lucide-react';
import { loadAPIKey, loadModelUsage } from '../services/storage';
import { getModels, ModelInfo } from '../services/openrouter';

interface ModelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (modelId: string) => void;
  currentModel: string;
  title?: string;
  confirmLabel?: string;
}

export default function ModelPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentModel,
  title = 'Select model for this run',
  confirmLabel = 'Rerun',
}: ModelPickerModalProps) {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'usage' | 'provider'>('usage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minContext, setMinContext] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(currentModel);
  const [usageData, setUsageData] = useState(loadModelUsage());

  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const apiKey = loadAPIKey();
      const models = await getModels(apiKey || undefined);
      setAvailableModels(models);
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedModel(currentModel);
      setUsageData(loadModelUsage());
      loadModels();
    }
  }, [isOpen, currentModel, loadModels]);

  const providers = useMemo(() => {
    const providerSet = new Set<string>();
    availableModels.forEach(m => {
      const provider = m.id.split('/')[0];
      if (provider) providerSet.add(provider);
    });
    return Array.from(providerSet).sort();
  }, [availableModels]);

  const filteredModels = useMemo(() => {
    return availableModels.filter(m => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !m.id.toLowerCase().includes(q) &&
          !m.name?.toLowerCase().includes(q) &&
          !m.description?.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterProvider && !m.id.startsWith(filterProvider + '/')) return false;
      if (maxPrice) {
        const p = parseFloat(m.pricing?.prompt || '0');
        if (p > parseFloat(maxPrice)) return false;
      }
      if (minContext) {
        const min = parseInt(minContext);
        if (!m.context_length || m.context_length < min) return false;
      }
      return true;
    });
  }, [availableModels, searchQuery, filterProvider, maxPrice, minContext]);

  const sortedModels = useMemo(() => {
    return [...filteredModels].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = (a.name || a.id).localeCompare(b.name || b.id);
          break;
        case 'price': {
          const ap = parseFloat(a.pricing?.prompt || '999999');
          const bp = parseFloat(b.pricing?.prompt || '999999');
          comparison = ap - bp;
          break;
        }
        case 'usage': {
          const au = usageData.find(u => u.modelId === a.id)?.requestCount || 0;
          const bu = usageData.find(u => u.modelId === b.id)?.requestCount || 0;
          comparison = au - bu;
          break;
        }
        case 'provider':
          comparison = (a.id.split('/')[0] || '').localeCompare(b.id.split('/')[0] || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredModels, sortBy, sortOrder, usageData]);

  const handleConfirm = () => {
    onSelect(selectedModel);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border"
        style={{
          backgroundColor: 'var(--theme-bg-panel)',
          borderColor: 'var(--theme-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:opacity-80"
            style={{ color: 'var(--theme-text-muted)' }}
            title="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs px-2 py-1.5 rounded flex items-center gap-1 transition-colors ${
              showFilters ? 'opacity-100' : 'opacity-80'
            }`}
            style={{
              backgroundColor: showFilters ? 'var(--theme-accent)' : 'var(--theme-button-inactive-bg)',
              color: showFilters ? '#fff' : 'var(--theme-button-inactive-text)',
            }}
          >
            <Filter size={12} />
            Filters
          </button>
          <button
            onClick={loadModels}
            disabled={isLoadingModels}
            className="text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
            style={{ color: 'var(--theme-accent)' }}
            title="Refresh model list"
          >
            <RefreshCw size={14} className={isLoadingModels ? 'animate-spin' : ''} />
            {isLoadingModels ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {isLoadingModels && availableModels.length === 0 ? (
          <div
            className="rounded-lg px-4 py-8 text-center border"
            style={{
              backgroundColor: 'var(--theme-input-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            Loading models...
          </div>
        ) : availableModels.length > 0 ? (
          <>
            <div className="relative mb-2">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2"
                size={16}
                style={{ color: 'var(--theme-text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full rounded-lg pl-10 pr-4 py-2 text-sm border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--theme-input-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-input-text)',
                  ['--tw-ring-color' as string]: 'var(--theme-accent)',
                }}
              />
            </div>

            {showFilters && (
              <div
                className="rounded-lg p-3 mb-2 border space-y-2"
                style={{
                  backgroundColor: 'var(--theme-input-bg)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                      Provider
                    </label>
                    <select
                      value={filterProvider}
                      onChange={(e) => setFilterProvider(e.target.value)}
                      className="w-full rounded px-2 py-1 text-xs border focus:outline-none focus:ring-1"
                      style={{
                        backgroundColor: 'var(--theme-bg-app)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text)',
                      }}
                    >
                      <option value="">All Providers</option>
                      {providers.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                      Max Price ($/1M)
                    </label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="No limit"
                      step="0.01"
                      className="w-full rounded px-2 py-1 text-xs border focus:outline-none focus:ring-1"
                      style={{
                        backgroundColor: 'var(--theme-bg-app)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text)',
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                    Min Context Length
                  </label>
                  <input
                    type="number"
                    value={minContext}
                    onChange={(e) => setMinContext(e.target.value)}
                    placeholder="No minimum"
                    className="w-full rounded px-2 py-1 text-xs border focus:outline-none focus:ring-1"
                    style={{
                      backgroundColor: 'var(--theme-bg-app)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="flex-1 rounded px-2 py-1 text-xs border focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--theme-input-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              >
                <option value="usage">Usage (Most Used)</option>
                <option value="price">Price (Lowest First)</option>
                <option value="name">Name (A–Z)</option>
                <option value="provider">Provider</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 rounded transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--theme-button-inactive-bg)',
                  color: 'var(--theme-text)',
                }}
                title={sortOrder === 'asc' ? 'Descending' : 'Ascending'}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>

            <div
              className="rounded-lg border max-h-64 overflow-y-auto"
              style={{
                backgroundColor: 'var(--theme-input-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              {sortedModels.length === 0 ? (
                <div className="p-4 text-center text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                  No models found matching your filters
                </div>
              ) : (
                sortedModels.map((m) => {
                  const usage = usageData.find(u => u.modelId === m.id);
                  const promptPrice = parseFloat(m.pricing?.prompt || '0');
                  const completionPrice = parseFloat(m.pricing?.completion || '0');
                  const isSelected = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`w-full text-left p-3 transition-colors border-t first:border-t-0 hover:opacity-90 ${
                        isSelected ? 'border-l-4' : ''
                      }`}
                      style={{
                        backgroundColor: isSelected ? 'var(--theme-conv-active-bg)' : 'transparent',
                        borderColor: 'var(--theme-border)',
                        ...(isSelected ? { borderLeftColor: 'var(--theme-accent)' } : {}),
                      }}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" style={{ color: 'var(--theme-text)' }}>
                            {m.name || m.id}
                          </div>
                          <div className="text-xs mt-1 space-y-0.5" style={{ color: 'var(--theme-text-muted)' }}>
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
                              <div style={{ color: 'var(--theme-accent)' }}>
                                Used {usage.requestCount} time{usage.requestCount !== 1 ? 's' : ''}{' '}
                                ({usage.totalTokens.toLocaleString()} tokens)
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-sm shrink-0" style={{ color: 'var(--theme-accent)' }}>✓</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              {sortedModels.length} of {availableModels.length} models shown
              {(filterProvider || maxPrice || minContext) ? ' (filtered)' : ''}
            </p>
          </>
        ) : (
          <div
            className="rounded-lg px-4 py-3 border"
            style={{
              backgroundColor: 'var(--theme-input-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            Enter API key in Settings and click Refresh to load models.
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: 'var(--theme-button-inactive-bg)',
              color: 'var(--theme-button-inactive-text)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={availableModels.length === 0}
            className="px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--theme-accent)',
              color: '#fff',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
