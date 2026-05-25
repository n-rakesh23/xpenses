import React from 'react';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatINR(amount) {
  if (!amount) return '₹0';
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${Math.round(amount)}`;
}

export default function YearGrid({ year, monthTotals = {}, onMonthClick }) {
  const totals = MONTHS.map((_, i) => monthTotals[i + 1] || 0);
  const max = Math.max(...totals, 1);

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {MONTHS.map((name, i) => {
        const month = i + 1;
        const total = totals[i];
        const pct = Math.round((total / max) * 100);

        return (
          <button
            key={month}
            onClick={() => onMonthClick && onMonthClick(month)}
            className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-left hover:border-green-300 transition-colors group"
          >
            <p className="text-xs font-semibold text-gray-500 group-hover:text-green-600 transition-colors">
              {name}
            </p>
            <p className="text-sm font-bold text-gray-900 mt-1">{formatINR(total)}</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
