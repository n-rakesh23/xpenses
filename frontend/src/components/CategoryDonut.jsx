import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

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

export default function CategoryDonut({ categories, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-56 animate-pulse flex items-center justify-center">
        <div className="text-gray-300 text-sm">Loading...</div>
      </div>
    );
  }

  const entries = categories ? Object.entries(categories).filter(([, v]) => v > 0) : [];

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-56 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No category data yet.</p>
      </div>
    );
  }

  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  const chartData = {
    labels: entries.map(([cat]) => cat),
    datasets: [
      {
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map(([cat]) => CATEGORY_COLORS[cat] || '#6b7280'),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const pct = Math.round((ctx.parsed / total) * 100);
            return ` ${formatINR(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
    cutout: '65%',
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">By Category</h3>
      <div className="flex gap-4 items-center">
        <div className="h-36 w-36 flex-shrink-0">
          <Doughnut data={chartData} options={options} />
        </div>
        <ul className="flex-1 space-y-1.5 min-w-0">
          {entries.map(([cat, amt]) => {
            const pct = Math.round((amt / total) * 100);
            return (
              <li key={cat} className="flex items-center gap-2 text-sm min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] || '#6b7280' }}
                />
                <span className="capitalize text-gray-600 flex-1 truncate">{cat}</span>
                <span className="text-gray-400 text-xs">{pct}%</span>
                <span className="font-medium text-gray-800">{formatINR(amt)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
