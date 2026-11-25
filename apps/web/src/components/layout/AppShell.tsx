import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('ff_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem('ff_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg font-sans text-brand-text">
      <Navbar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />
      <div className="flex flex-1 min-w-0">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};
