import React from 'react';
import { format } from 'date-fns';
import PlatformBadge from './PlatformBadge.jsx';

const CATEGORY_COLORS = {
  food: '#f97316',
  transport: '#3b82f6',
  shopping: '#a855f7',
  entertainment: '#ec4899',
  health: '#ef4444',
  other: '#6b7280',
};

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function TransactionList({ expenses = [], loading, limit = 6, onDelete }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-3 h-3 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-2 bg-gray-100 rounded w-1/4" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const displayed = expenses.slice(0, limit);

  if (displayed.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Transactions</h3>
        <p className="text-gray-400 text-sm text-center py-4">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Transactions</h3>
      <ul className="divide-y divide-gray-50">
        {displayed.map((expense) => (
          <li key={expense.id} className="flex items-center gap-3 py-2.5 group">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[expense.category] || '#6b7280' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {expense.description || expense.category}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-gray-400">
                  {format(new Date(expense.created_at), 'd MMM, h:mm a')}
                </span>
                {expense.platform && (
                  <PlatformBadge platform={expense.platform} size="xs" />
                )}
              </div>
            </div>
            <span className="font-semibold text-gray-900 text-sm">
              {formatINR(expense.amount)}
            </span>
            {onDelete && (
              <button
                onClick={() => onDelete(expense.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity ml-1"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
