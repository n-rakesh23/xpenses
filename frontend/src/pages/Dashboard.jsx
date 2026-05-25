import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import StatsRow from '../components/StatsRow.jsx';
import SpendingChart from '../components/SpendingChart.jsx';
import CategoryDonut from '../components/CategoryDonut.jsx';
import TransactionList from '../components/TransactionList.jsx';
import useDashboard from '../hooks/useDashboard.js';
import useExpenses from '../hooks/useExpenses.js';

const PERIODS = ['Daily', 'Weekly', 'Monthly'];

export default function Dashboard() {
  const [period, setPeriod] = useState('monthly');
  const { stats, summary, categories, loading } = useDashboard(period);
  const { expenses, loading: expLoading, deleteExpense } = useExpenses({ period, limit: 6 });

  return (
    <Layout>
      {/* Period selector */}
      <div className="flex gap-1.5 mb-5">
        {PERIODS.map((p) => {
          const val = p.toLowerCase();
          return (
            <button
              key={p}
              onClick={() => setPeriod(val)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                period === val
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Charts */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SpendingChart summary={summary} period={period} loading={loading} />
        <CategoryDonut categories={categories} loading={loading} />
      </div>

      {/* Recent transactions */}
      <div className="mt-4">
        <TransactionList
          expenses={expenses}
          loading={expLoading}
          limit={6}
          onDelete={deleteExpense}
        />
      </div>
    </Layout>
  );
}
