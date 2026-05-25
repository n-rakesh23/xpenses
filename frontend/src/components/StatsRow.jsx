import React from 'react';
import PlatformBadge from './PlatformBadge.jsx';

const CATEGORY_COLORS = {
  food: '#f97316',
  transport: '#3b82f6',
  shopping: '#a855f7',
  entertainment: '#ec4899',
  health: '#ef4444',
  other: '#6b7280',
};

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-xl font-bold text-gray-900 truncate">{value}</span>
        {icon && <span className="mb-0.5">{icon}</span>}
      </div>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function StatsRow({ stats }) {
  if (!stats) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-1 min-w-[120px] h-20 animate-pulse bg-gray-100" />
        ))}
      </div>
    );
  }

  const topCatColor = CATEGORY_COLORS[stats.topCategory] || '#6b7280';

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <StatCard
        label="Total Spent"
        value={formatINR(stats.total)}
        sub={`${stats.count} transactions`}
      />
      <StatCard
        label="Avg per Expense"
        value={formatINR(stats.avg)}
        sub="per transaction"
      />
      <StatCard
        label="Top Category"
        value={stats.topCategory ? stats.topCategory.charAt(0).toUpperCase() + stats.topCategory.slice(1) : '—'}
        icon={
          stats.topCategory ? (
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: topCatColor }}
            />
          ) : null
        }
        sub="this period"
      />
      <StatCard
        label="Platform"
        value=" "
        icon={<PlatformBadge platform={stats.platform} />}
        sub="connected"
      />
    </div>
  );
}
