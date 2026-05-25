import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '../components/Layout.jsx';
import client from '../api/client.js';
import { isDemoMode, MOCK_USERS } from '../api/mockData.js';

const PLAN_COLORS = {
  pro: 'bg-purple-100 text-purple-700',
  free: 'bg-gray-100 text-gray-600',
};

const PLATFORM_COLORS = {
  telegram: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
};

function formatINR(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    if (isDemoMode()) {
      let filtered = MOCK_USERS;
      if (search) filtered = filtered.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.phone.includes(search)
      );
      if (planFilter) filtered = filtered.filter((u) => u.plan === planFilter);
      if (platformFilter) filtered = filtered.filter((u) => u.platform === platformFilter);
      setUsers(filtered.slice((page - 1) * 20, page * 20));
      setTotal(filtered.length);
      setLoading(false);
      return;
    }
    client.get('/users', { params: { search, plan: planFilter, platform: platformFilter, page, limit: 20 } })
      .then((r) => { setUsers(r.data.users); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [search, planFilter, platformFilter, page]);

  async function togglePlan(user) {
    const newPlan = user.plan === 'pro' ? 'free' : 'pro';
    setUpdatingId(user.id);
    if (isDemoMode()) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, plan: newPlan } : u));
      setUpdatingId(null);
      return;
    }
    try {
      await client.patch(`/users/${user.id}`, { plan: newPlan });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, plan: newPlan } : u));
    } finally {
      setUpdatingId(null);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <Layout title="Users">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white w-56"
        />
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">All plans</option>
          <option value="pro">Pro</option>
          <option value="free">Free</option>
        </select>
        <select
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">All platforms</option>
          <option value="telegram">Telegram</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <span className="ml-auto self-center text-sm text-gray-500">{total.toLocaleString()} users</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Expenses</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Spent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Active</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-100 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/users/${user.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {user.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{user.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLATFORM_COLORS[user.platform] || ''}`}>
                      {user.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full uppercase ${PLAN_COLORS[user.plan] || ''}`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{user.expense_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatINR(user.total_spent)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {user.last_active ? format(new Date(user.last_active), 'd MMM, h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {format(new Date(user.created_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => togglePlan(user)}
                      disabled={updatingId === user.id}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                        user.plan === 'pro'
                          ? 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'
                          : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                      }`}
                    >
                      {updatingId === user.id ? '…' : user.plan === 'pro' ? 'Downgrade' : 'Upgrade'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
