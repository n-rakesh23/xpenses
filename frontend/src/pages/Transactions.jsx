import React, { useState, useMemo } from 'react';
import Layout from '../components/Layout.jsx';
import TransactionList from '../components/TransactionList.jsx';
import useExpenses from '../hooks/useExpenses.js';
import useAuth from '../hooks/useAuth.js';
import client from '../api/client.js';

const CATEGORIES = ['All', 'Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

const CATEGORY_COLORS = {
  food: '#f97316',
  transport: '#3b82f6',
  shopping: '#a855f7',
  entertainment: '#ec4899',
  health: '#ef4444',
  other: '#6b7280',
};

export default function Transactions() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [exportLoading, setExportLoading] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const { expenses, loading, hasMore, deleteExpense } = useExpenses({
    period: 'monthly',
    page: 1,
    limit: page * 50,
  });

  const filtered = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch =
        !search ||
        (exp.description || '').toLowerCase().includes(search.toLowerCase()) ||
        exp.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === 'all' || exp.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  async function handleExport(format) {
    if (user?.plan !== 'pro') {
      setShowUpgradePrompt(true);
      return;
    }
    setExportLoading(format);
    try {
      const res = await client.get(`/export/${format}`, { responseType: 'blob' });
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `xpense-export.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(null);
    }
  }

  return (
    <Layout>
      {/* Search + export */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exportLoading === 'csv'}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:text-green-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {exportLoading === 'csv' ? (
              <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v4m0 0l-3-3m3 3l3-3M12 4v8" />
              </svg>
            )}
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exportLoading === 'pdf'}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:text-green-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {exportLoading === 'pdf' ? (
              <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v4m0 0l-3-3m3 3l3-3M12 4v8" />
              </svg>
            )}
            PDF
          </button>
        </div>
      </div>

      {/* Upgrade prompt */}
      {showUpgradePrompt && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Pro feature</p>
            <p className="text-xs text-amber-600 mt-0.5">CSV and PDF export is available on the Pro plan (₹199/month).</p>
          </div>
          <button onClick={() => setShowUpgradePrompt(false)} className="text-amber-400 hover:text-amber-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CATEGORIES.map((cat) => {
          const val = cat.toLowerCase();
          const isActive = categoryFilter === val;
          const color = CATEGORY_COLORS[val];
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(val)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                isActive
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
              style={isActive ? { backgroundColor: color || '#22c55e', borderColor: color || '#22c55e' } : {}}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Transaction list */}
      <TransactionList
        expenses={filtered}
        loading={loading}
        limit={filtered.length}
        onDelete={deleteExpense}
      />

      {/* Load more */}
      {hasMore && !loading && filtered.length > 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-5 py-2 text-sm font-medium text-green-600 bg-white border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
          >
            Load more
          </button>
        </div>
      )}

      {/* Empty state after filters */}
      {!loading && filtered.length === 0 && expenses.length > 0 && (
        <p className="text-center text-sm text-gray-400 mt-4">No transactions match your filters.</p>
      )}
    </Layout>
  );
}
