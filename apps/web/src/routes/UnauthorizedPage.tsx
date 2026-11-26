import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getDefaultDashboardPath } from '../config/navigation';
import { useTranslation } from '../i18n/I18nContext';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const homePath = getDefaultDashboardPath(user);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8F2] p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-[#E1E7DD] p-7 text-center">
        <div className="inline-flex p-3 bg-[#C58A25]/10 rounded-lg border border-[#C58A25]/30 mb-4">
          <ShieldAlert className="w-8 h-8 text-[#C58A25]" />
        </div>

        <h1 className="text-lg font-semibold text-[#24352A] tracking-tight">
          {t('auth.accessRestricted')}
        </h1>
        <p className="text-xs text-[#66756A] mt-1.5 leading-relaxed">
          {t('auth.unauthorizedMessage')}
        </p>

        {user && (
          <div className="mt-5 p-3.5 bg-[#FAFBF8] border border-[#E1E7DD] rounded-md text-left text-xs">
            <div className="text-[#66756A] font-medium">Signed in as</div>
            <div className="font-semibold text-[#24352A] mt-0.5">
              {user.fullName} ({user.email})
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[#66756A]">Assigned Roles:</span>
              {user.roles.map(r => (
                <span
                  key={r}
                  className="px-2 py-0.5 bg-[#EAF1E8] border border-[#E1E7DD] text-[#17452C] font-semibold rounded text-[10px]"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-[#E1E7DD] bg-white hover:bg-[#EAF1E8] text-[#24352A] font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(homePath)}
            className="px-4 py-2 bg-[#245C3A] hover:bg-[#17452C] text-white font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>My Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
