import { Plus } from 'lucide-react';
import type { AppSection } from '../types/vault';

interface TopNavProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  onTriggerImport: () => void;
}

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'gallery', label: 'Galería' },
  { id: 'archives', label: 'Archiveros' },
  { id: 'music', label: 'Música' },
  { id: 'security', label: 'Seguridad' },
];

export function TopNav({
  activeSection,
  onSelectSection,
  onTriggerImport,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.1] bg-slate-950/75 backdrop-blur-2xl shadow-[0_4px_24px_rgba(2,6,23,0.45)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-8 sm:py-3.5">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectSection('gallery')}
          className="font-display text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md px-1"
        >
          Prometheus
        </button>

        {/* Zone 2: Desktop single-line navigation */}
        <nav
          aria-label="Navegación principal"
          className="hidden sm:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md px-1 ${
                  active
                    ? 'text-white'
                    : 'text-slate-300/80 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-1 -bottom-0.5 h-[1.5px] bg-sky-400 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onTriggerImport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 sm:px-4 text-xs sm:text-sm font-medium text-slate-950 shadow-sm transition-all hover:bg-slate-100 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden">Importar</span>
            <span className="hidden sm:inline">Importar archivos</span>
          </button>
        </div>
      </div>

      {/* Compact mobile navigation strip so all 4 sections are visible without horizontal clipping */}
      <nav
        aria-label="Navegación móvil"
        className="flex sm:hidden items-center justify-around border-t border-white/[0.08] px-2 py-1.5"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-300/80 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
