import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-3 px-6 text-xs text-slate-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1440px] mx-auto">
        <p>
          <span className="font-semibold text-slate-700">FoodFactory ERP</span> — Manufacturing,
          Inventory &amp; Compliance Platform
        </p>
        <p>Centre for Digital Infrastructure, NIT Tiruchirappalli &copy; {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
};
