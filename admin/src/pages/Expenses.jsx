import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Layout from '../components/Layout.jsx';
import client from '../api/client.js';
import { isDemoMode, MOCK_EXPENSES } from '../api/mockData.js';

const CATEGORY_COLORS = {
  food: '#f97316', transport: '#3b82f6', shopping: '#a855f7',
  entertainment: '#ec4899', health: '#ef4444', other: '#6b7280',
};

const PLATFORM_BADGE = {
  telegram: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
};

function formatINR(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n || 0);
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    if (isDemoMode()) {
      const slice = MOCK_EXPENSES.slice((page - 1) * 50, page * 50);
      setExpenses(slice);
      setTotal(MOCK_EXPENSES.length);
      setLoading(false);
      return;
    }
    client.get('/expenses', { params: { page, limit: 50 } })
      .then((r) => { setExpenses(r.data.expenses); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <Layout title="All Expenses">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{total.toLocaleString()} total expenses</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{exp.user_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{exp.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium capitalize text-gray-700">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#6b7280' }}
                      />
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLATFORM_BADGE[exp.user_platform] || 'bg-gray-100 text-gray-600'}`}>
                      {exp.user_platform}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatINR(exp.amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{format(new Date(exp.created_at), 'd MMM yyyy, h:mm a')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
