import React from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { AllergenProfileData } from '../../services/manufacturing-intelligence.service';
import { useTranslation } from '../../i18n/I18nContext';

interface AllergenAlertBannerProps {
  profile?: AllergenProfileData | null;
  isLoading?: boolean;
}

export const AllergenAlertBanner: React.FC<AllergenAlertBannerProps> = ({
  profile,
  isLoading,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#E1E7DD] bg-[#FAFBF8] p-3 text-xs text-[#66756A]">
        {t('mi.loadingAllergens', 'Checking recipe allergen declarations...')}
      </div>
    );
  }

  if (!profile) return null;

  const hasConfirmed = profile.confirmedAllergens.length > 0;
  const hasCrossContact = profile.crossContactAllergens.length > 0;
  const hasUnknown = profile.hasUnknownIngredients;

  const containerStyle = hasConfirmed
    ? 'border-red-300 bg-red-50 text-red-900'
    : hasUnknown
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-emerald-300 bg-emerald-50 text-emerald-900';

  return (
    <div
      role="region"
      aria-label={t('mi.allergenProfileTitle', 'Allergen Profile')}
      className={`rounded-lg border p-3.5 text-xs space-y-2 ${containerStyle}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          {hasConfirmed ? (
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          ) : hasUnknown ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          )}
          <span>
            {hasConfirmed
              ? t('mi.allergenContainsTitle', 'ALLERGEN ALERT: Confirmed Allergens Present')
              : hasUnknown
                ? t('mi.allergenUnknownTitle', 'ALLERGEN WARNING: Incomplete Ingredient Declarations')
                : t('mi.allergenNoneTitle', 'No Known Allergens Declared in Active BOM')}
          </span>
        </div>

        <span className="inline-flex items-center gap-1 rounded border border-current/25 bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
          <Info className="h-3 w-3" aria-hidden="true" />
          {profile.isHistoricalSnapshot
            ? t('mi.historicalSnapshot', 'Historical Batch Snapshot')
            : t('mi.liveBomProfile', 'Derived from BOM')}
        </span>
      </div>

      {hasConfirmed && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{t('mi.contains', 'Contains')}:</span>
          {profile.confirmedAllergens.map(code => (
            <span
              key={code}
              className="rounded border border-red-400 bg-white px-2 py-0.5 text-[11px] font-bold text-red-800"
            >
              {code}
            </span>
          ))}
        </div>
      )}

      {hasCrossContact && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{t('mi.mayContain', 'May Contain (Cross-Contact)')}:</span>
          {profile.crossContactAllergens.map(code => (
            <span
              key={code}
              className="rounded border border-amber-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900"
            >
              {code}
            </span>
          ))}
        </div>
      )}

      {hasUnknown && (
        <div className="rounded border border-amber-300 bg-white/80 p-2 text-[11px] text-amber-950">
          <span className="font-semibold">
            {t('mi.unknownDeclarationWarning', 'Incomplete Allergen Data')}:
          </span>{' '}
          {profile.unknownIngredients.map(u => `${u.code} (${u.name})`).join(', ')}.{' '}
          {t(
            'mi.notAllergenFreeNotice',
            'Do not label as allergen-free until all ingredient declarations are verified.',
          )}
        </div>
      )}
    </div>
  );
};
