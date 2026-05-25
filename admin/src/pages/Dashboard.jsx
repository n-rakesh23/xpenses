import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js';
import Layout from '../components/Layout.jsx';
import client from '../api/client.js';
import { isDemoMode, MOCK_STATS } from '../api/mockData.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

function StatCard({ label, value, sub, color = 'green' }) {
  const colors = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && (
        <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>
          {sub}
        </span>
      )}
    </div>
  );
}

function formatINR(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  function fetchStats() {
    if (isDemoMode()) {
      // Simulate live traffic fluctuation in demo mode
      setStats((prev) => ({
        ...(prev || MOCK_STATS),
        traffic: { last5Min: Math.floor(Math.random() * 40) + 10 },
        users: {
          ...(prev?.users || MOCK_STATS.users),
          active24h: MOCK_STATS.users.active24h + Math.floor(Math.random() * 5),
        },
      }));
      setLastUpdated(new Date());
      setLoading(false);
      return;
    }
    client.get('/stats')
      .then((r) => { setStats(r.data); setLastUpdated(new Date()); })
      .catch(() => setStats(MOCK_STATS))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds for live traffic + active users
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  const chartData = {
    labels: stats.signupTrend.map((d) => {
      const date = new Date(d.date);
      return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
    }),
    datasets: [{
      label: 'New signups',
      data: stats.signupTrend.map((d) => d.count),
      fill: true,
      borderColor: '#1D9E75',
      backgroundColor: 'rgba(29,158,117,0.1)',
      tension: 0.4,
      pointRadius: 3,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
      x: { ticks: { maxTicksLimit: 8 } },
    },
  };

  return (
    <Layout title="Dashboard">
      {isDemoMode() && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700 font-medium">
          Demo mode — showing mock data. Sign in with real credentials to see live data.
        </div>
      )}

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-gray-400 mb-3 text-right">
          Last updated {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30s
        </p>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard
          label="Total Users"
          value={stats.users.total.toLocaleString()}
          sub={`+${stats.users.newThisWeek} this week`}
          color="green"
        />
        <StatCard
          label="Pro Users"
          value={stats.users.pro.toLocaleString()}
          sub={`₹${formatINR(stats.revenue.monthly)}/mo revenue`}
          color="purple"
        />
        <StatCard
          label="Total Expenses"
          value={stats.expenses.total.toLocaleString()}
          sub={`${stats.expenses.thisMonth.toLocaleString()} this month`}
          color="blue"
        />
      </div>

      {/* Live metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Tracked"
          value={formatINR(stats.expenses.totalAmount)}
          sub="across all users"
          color="amber"
        />

        {/* Active users — live */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500">Active Users</p>
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.users.active24h?.toLocaleString() ?? '—'}</p>
          <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
            last 24 hours
          </span>
        </div>

        {/* Traffic right now — live */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500">Traffic Right Now</p>
            <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.traffic?.last5Min ?? '—'}</p>
          <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            requests / 5 min
          </span>
        </div>
      </div>

      {/* Platform breakdown + signup chart */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Platform pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Platform Split</h3>
          {Object.entries(stats.platforms).map(([platform, count]) => {
            const pct = Math.round((count / stats.users.total) * 100);
            return (
              <div key={platform} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium capitalize text-gray-700">{platform}</span>
                  <span className="text-gray-500">{count.toLocaleString()} ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: platform === 'telegram' ? '#3b82f6' : '#25D366',
                    }}
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Free users</span>
              <span className="font-medium text-gray-700">{stats.users.free.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className="text-gray-500">Pro users</span>
              <span className="font-medium text-green-600">{stats.users.pro.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Signup trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Signups — Last 30 days</h3>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </Layout>
  );
}
