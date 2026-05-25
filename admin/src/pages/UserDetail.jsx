import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '../components/Layout.jsx';
import client from '../api/client.js';
import { isDemoMode, MOCK_USERS, MOCK_EXPENSES } from '../api/mockData.js';

const CATEGORY_COLORS = {
  food: '#f97316', transport: '#3b82f6', shopping: '#a855f7',
  entertainment: '#ec4899', health: '#ef4444', other: '#6b7280',
};

function formatINR(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n || 0);
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isDemoMode()) {
      const user = MOCK_USERS.find((u) => u.id === id) || MOCK_USERS[0];
      setData({ user, recentExpenses: MOCK_EXPENSES.slice(0, 10) });
      setLoading(false);
      return;
    }
    client.get(`/users/${id}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  async function deleteUser() {
    if (!confirm('Delete this user and all their data permanently?')) return;
    setDeleting(true);
    if (!isDemoMode()) await client.delete(`/users/${id}`);
    navigate('/users');
  }

  if (loading) {
    return (
      <Layout title="User Detail">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  const { user, recentExpenses } = data;

  return (
    <Layout title="User Detail">
      {/* Back */}
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Users
      </button>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* User card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 text-lg font-bold flex items-center justify-center">
              {user.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{user.name || 'Unknown'}</h2>
              <p className="text-sm text-gray-500">{user.phone}</p>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Platform</dt>
              <dd className="font-medium capitalize text-gray-800">{user.platform}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Plan</dt>
              <dd>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full uppercase ${
                  user.plan === 'pro' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.plan}
                </span>
              </dd>
            </div>
            {user.plan_expires_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Plan expires</dt>
                <dd className="text-gray-800">{format(new Date(user.plan_expires_at), 'd MMM yyyy')}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Total expenses</dt>
              <dd className="font-medium text-gray-800">{user.expense_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total spent</dt>
              <dd className="font-semibold text-gray-900">{formatINR(user.total_spent)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Joined</dt>
              <dd className="text-gray-800">{format(new Date(user.created_at), 'd MMM yyyy')}</dd>
            </div>
            {user.last_active && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Last active</dt>
                <dd className="text-gray-800">{format(new Date(user.last_active), 'd MMM, h:mm a')}</dd>
              </div>
            )}
          </dl>

          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
            <button
              onClick={deleteUser}
              disabled={deleting}
              className="w-full py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete User'}
            </button>
          </div>
        </div>

        {/* Recent expenses */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Expenses</h3>
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No expenses yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentExpenses.map((exp) => (
                <li key={exp.id} className="flex items-center gap-3 py-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#6b7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{exp.description || exp.category}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{exp.category} · {format(new Date(exp.created_at), 'd MMM, h:mm a')}</p>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{formatINR(exp.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
