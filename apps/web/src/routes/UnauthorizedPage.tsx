import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getDefaultDashboardPath } from '../config/navigation';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const homePath = getDefaultDashboardPath(user);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-slate-200 p-7 text-center">
        <div className="inline-flex p-3 bg-amber-50 rounded-lg border border-amber-200 mb-4">
          <ShieldAlert className="w-8 h-8 text-amber-700" />
        </div>

        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Access Restricted</h1>
        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
          Your current account does not hold the necessary security permissions or facility
          authorization to view this resource.
        </p>

        {user && (
          <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-md text-left text-xs">
            <div className="text-slate-500 font-medium">Signed in as</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {user.fullName} ({user.email})
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500">Assigned Roles:</span>
              {user.roles.map(r => (
                <span
                  key={r}
                  className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 font-semibold rounded text-[10px]"
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
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
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
