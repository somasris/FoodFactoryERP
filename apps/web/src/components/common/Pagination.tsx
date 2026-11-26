import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { useTranslation } from '../../i18n/I18nContext';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (nextPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  onPageChange,
}) => {
  const { t, language } = useTranslation();
  if (totalPages <= 1 && !total) return null;

  return (
    <div className="flex items-center justify-between border-t border-[#E1E7DD] bg-white px-4 py-2.5 text-xs text-[#66756A] rounded-b-lg">
      <div className="tabular-nums">
        {t('common.page')} <span className="font-semibold text-[#24352A]">{page}</span>{' '}
        {t('common.of')}{' '}
        <span className="font-semibold text-[#24352A]">{Math.max(1, totalPages)}</span>
        {total !== undefined && (
          <span className="ml-2 text-[#8A958C]">
            ({total} {t('common.totalRecords')})
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={language === 'ta' ? t('common.prev') : 'Previous page'}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('common.prev')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={language === 'ta' ? t('common.next') : 'Next page'}
        >
          {t('common.next')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
