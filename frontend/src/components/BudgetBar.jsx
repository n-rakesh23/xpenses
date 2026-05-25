import React from 'react';

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function BudgetBar({ budget }) {
  const { category, monthly_limit, spent = 0, percentage = 0 } = budget;
  const pct = Math.min(percentage, 100);

  const barColor =
    percentage >= 100
      ? 'bg-red-500'
      : percentage >= 80
      ? 'bg-yellow-500'
      : 'bg-green-500';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-gray-700 capitalize">{category}</span>
        <span className="text-xs text-gray-500">
          {formatINR(spent)} / {formatINR(monthly_limit)}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-1">
        <span
          className={`text-xs font-medium ${
            percentage >= 100
              ? 'text-red-600'
              : percentage >= 80
              ? 'text-yellow-600'
              : 'text-green-600'
          }`}
        >
          {percentage}% used
        </span>
        <span className="text-xs text-gray-400">
          {formatINR(Math.max(0, monthly_limit - spent))} left
        </span>
      </div>
    </div>
  );
}
