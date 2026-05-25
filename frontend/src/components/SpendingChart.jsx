import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${formatINR(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => formatINR(value),
        maxTicksLimit: 6,
      },
      grid: { color: '#f3f4f6' },
    },
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 10 },
    },
  },
};

export default function SpendingChart({ summary, period, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-56 animate-pulse flex items-center justify-center">
        <div className="text-gray-300 text-sm">Loading chart...</div>
      </div>
    );
  }

  if (!summary || !summary.labels || summary.labels.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-56 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No data to display.</p>
      </div>
    );
  }

  const chartData = {
    labels: summary.labels,
    datasets: [
      {
        data: summary.data,
        backgroundColor:
          period === 'monthly'
            ? 'rgba(29, 158, 117, 0.7)'
            : 'rgba(29, 158, 117, 0.15)',
        borderColor: '#1D9E75',
        borderWidth: 2,
        fill: period !== 'monthly',
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#1D9E75',
      },
    ],
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Spending Over Time</h3>
      <div className="h-48">
        {period === 'monthly' ? (
          <Bar data={chartData} options={baseOptions} />
        ) : (
          <Line data={chartData} options={baseOptions} />
        )}
      </div>
    </div>
  );
}
