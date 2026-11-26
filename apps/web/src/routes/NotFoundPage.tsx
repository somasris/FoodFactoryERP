import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { getDefaultDashboardPath } from '../config/navigation';
import { useTranslation } from '../i18n/I18nContext';

export const NotFoundPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const homePath = getDefaultDashboardPath(user);

  return (
    <div className="flex justify-center items-center py-16">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAF1E8] text-[#245C3A] mb-2 border border-[#E1E7DD]">
            <HelpCircle className="h-5 w-5" />
          </div>
          <CardTitle className="text-base">404 — {t('auth.pageNotFound')}</CardTitle>
          <CardDescription>{t('common.noData')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <Link to={homePath}>
            <Button variant="default" size="sm">
              {t('auth.returnHome')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
