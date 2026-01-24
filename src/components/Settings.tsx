import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { loadAPIKey, saveAPIKey, loadModel, saveModel } from '../services/storage';
import { getModels } from '../services/openrouter';

interface SettingsProps {
  onModelChange: (model: string) => void;
}

export default function Settings({ onModelChange }: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(loadAPIKey());
  const [model, setModel] = useState(loadModel());
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    if (isOpen && apiKey) {
      loadAvailableModels();
    }
  }, [isOpen, apiKey]);

  const loadAvailableModels = async () => {
    if (!apiKey) return;
    setIsLoadingModels(true);
    try {
      const models = await getModels(apiKey);
      setAvailableModels(models);
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSave = () => {
    saveAPIKey(apiKey);
    saveModel(model);
    onModelChange(model);
    setIsOpen(false);
  };

  const popularModels = [
    'openai/gpt-4-turbo',
    'openai/gpt-4',
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    'google/gemini-pro',
    'meta-llama/llama-3-70b-instruct',
  ];

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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {popularModels.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadAvailableModels}
                  disabled={!apiKey || isLoadingModels}
                  className="mt-2 text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-600"
                >
                  {isLoadingModels ? 'Loading...' : 'Load All Models'}
                </button>
                {availableModels.length > 0 && (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 mt-2"
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id} {m.pricing?.prompt && `($${m.pricing.prompt}/1M tokens)`}
                      </option>
                    ))}
                  </select>
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
