import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[#E1E7DD] bg-white py-3 px-6 text-xs text-[#66756A]">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1440px] mx-auto">
        <p>
          <span className="font-semibold text-[#24352A]">FoodFactory ERP</span> — Manufacturing,
          Inventory &amp; Compliance Platform
        </p>
        <p>Centre for Digital Infrastructure, NIT Tiruchirappalli &copy; {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
};
