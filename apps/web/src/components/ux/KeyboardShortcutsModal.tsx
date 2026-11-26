import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { SHORTCUT_DEFINITIONS } from '../../config/shortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { hasPermission } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const permittedShortcuts = SHORTCUT_DEFINITIONS.filter(
    s => !s.requiredPermissions?.length || s.requiredPermissions.every(p => hasPermission(p)),
  );

  const categories: Array<{ id: 'general' | 'actions' | 'navigation'; label: string }> = [
    { id: 'general', label: t('shortcuts.general', 'General') },
    { id: 'actions', label: t('shortcuts.actions', 'Quick Actions') },
    { id: 'navigation', label: t('shortcuts.navigation', 'Navigation') },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#103B28]/40 px-4 backdrop-blur-[1px]"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('shortcuts.title', 'Keyboard Shortcuts')}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#E1E7DD] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E1E7DD] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[#245C3A]" />
            <h2 className="text-sm font-semibold text-[#17452C]">
              {t('shortcuts.title', 'Keyboard Shortcuts')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="rounded p-1 text-[#66756A] hover:bg-[#EAF1E8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5">
          {categories.map(cat => {
            const items = permittedShortcuts.filter(s => s.category === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8A958C]">
                  {cat.label}
                </h3>
                <div className="divide-y divide-[#E1E7DD] rounded-lg border border-[#E1E7DD]">
                  {items.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-[#24352A]">
                        {t(s.titleKey, s.defaultTitle)}
                      </span>
                      <kbd className="rounded border border-[#E1E7DD] bg-[#FAFBF8] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#17452C]">
                        {s.displayKeys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#E1E7DD] bg-[#FAFBF8] px-5 py-2.5 text-[11px] text-[#66756A]">
          {t('shortcuts.footerNote', 'Shortcuts are disabled while typing in text inputs.')}
        </div>
      </div>
    </div>
  );
};
