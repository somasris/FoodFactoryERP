import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
        <p>
          <strong className="text-brand-navy">FoodFactory ERP</strong> — Small-Scale South Indian
          Packaged Food Manufacturer ERP
        </p>
        <p>
          Centre for Digital Infrastructure, NIT Tiruchirappalli &copy; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
};
