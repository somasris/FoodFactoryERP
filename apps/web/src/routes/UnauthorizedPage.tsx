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
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="inline-flex p-4 bg-amber-50 rounded-2xl ring-1 ring-amber-200 mb-5">
          <ShieldAlert className="w-10 h-10 text-amber-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Restricted</h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Your current account does not hold the necessary security permissions or facility
          authorization to view this resource.
        </p>

        {user && (
          <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs">
            <div className="text-slate-500 font-medium">Signed in as:</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {user.fullName} ({user.email})
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500">Assigned Roles:</span>
              {user.roles.map(r => (
                <span
                  key={r}
                  className="px-2 py-0.5 bg-slate-200 text-slate-800 font-semibold rounded text-[10px]"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
          <button
            onClick={() => navigate(homePath)}
            className="px-4 py-2 bg-[#172F50] hover:bg-[#1f3f6b] text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>My Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
