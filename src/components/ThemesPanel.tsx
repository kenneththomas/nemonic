import { Palette } from 'lucide-react';
import type { ThemeId } from '../services/storage';

interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
}

const THEMES: ThemeOption[] = [
  { id: 'default', name: 'Default', description: 'Dark gray and blue' },
  { id: 'ios', name: 'iOS', description: 'Light, clean, system-style' },
];

interface ThemesPanelProps {
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
}

export default function ThemesPanel({ theme, onThemeChange }: ThemesPanelProps) {
  return (
    <div
      className="h-full flex flex-col border-r"
      style={{
        backgroundColor: 'var(--theme-bg-panel)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div
        className="p-4 border-b"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Palette size={20} style={{ color: 'var(--theme-text)' }} />
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--theme-text)' }}
          >
            Theme
          </h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => onThemeChange(t.id)}
            className="w-full text-left rounded-xl px-4 py-3 transition-colors border-2"
            style={{
              backgroundColor: theme === t.id ? 'var(--theme-conv-active-bg)' : 'transparent',
              borderColor: theme === t.id ? 'var(--theme-conv-active-border)' : 'var(--theme-border)',
            }}
          >
            <div
              className="font-medium text-sm"
              style={{ color: 'var(--theme-text)' }}
            >
              {t.name}
            </div>
            <div
              className="text-xs mt-0.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              {t.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
