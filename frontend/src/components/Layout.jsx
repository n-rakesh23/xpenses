import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import PlatformBadge from './PlatformBadge.jsx';
import useAuth from '../hooks/useAuth.js';

function XpenseLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1D9E75' }}>
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-lg font-bold text-gray-900">Xpense</span>
    </div>
  );
}

const SUB_TABS = [
  { label: 'Overview', path: '/dashboard' },
  { label: 'Calendar', path: '/dashboard/calendar' },
  { label: 'Transactions', path: '/dashboard/transactions' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <XpenseLogo />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-bold">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-800 leading-tight">{user?.name || 'User'}</p>
              {user?.platform && <PlatformBadge platform={user.platform} size="xs" />}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
          >
            Logout
          </button>
        </div>

        {/* Sub-nav tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex gap-1">
            {SUB_TABS.map((tab) => {
              const isActive =
                tab.path === '/dashboard'
                  ? location.pathname === '/dashboard'
                  : location.pathname.startsWith(tab.path);
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
