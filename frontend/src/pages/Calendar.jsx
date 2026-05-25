import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import Layout from '../components/Layout.jsx';
import CalendarGrid from '../components/CalendarGrid.jsx';
import YearGrid from '../components/YearGrid.jsx';
import PlatformBadge from '../components/PlatformBadge.jsx';
import client from '../api/client.js';
import { isDemoUser, MOCK_CALENDAR, MOCK_EXPENSES } from '../api/mockData.js';

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

export default function Calendar() {
  const today = new Date();
  const [view, setView] = useState('month'); // 'month' | 'year'
  const [currentDate, setCurrentDate] = useState(today);
  const [calendarData, setCalendarData] = useState({});
  const [monthTotals, setMonthTotals] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayExpenses, setDayExpenses] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch month heatmap data
  useEffect(() => {
    if (view !== 'month') return;
    setSelectedDay(null);
    setDayExpenses([]);
    if (isDemoUser()) {
      setCalendarData(MOCK_CALENDAR);
      return;
    }
    setLoadingCalendar(true);
    client
      .get('/expenses/calendar', { params: { year, month } })
      .then((res) => setCalendarData(res.data))
      .catch(() => setCalendarData({}))
      .finally(() => setLoadingCalendar(false));
  }, [year, month, view]);

  // Fetch all 12 months for year view
  useEffect(() => {
    if (view !== 'year') return;
    if (isDemoUser()) {
      const totals = {};
      for (let m = 1; m <= 12; m++) {
        totals[m] = m <= new Date().getMonth() + 1 ? Math.floor(Math.random() * 15000) + 3000 : 0;
      }
      setMonthTotals(totals);
      return;
    }
    const requests = Array.from({ length: 12 }, (_, i) =>
      client
        .get('/expenses/calendar', { params: { year, month: i + 1 } })
        .then((res) => {
          const total = Object.values(res.data).reduce((sum, v) => sum + (v || 0), 0);
          return { month: i + 1, total };
        })
        .catch(() => ({ month: i + 1, total: 0 }))
    );
    Promise.all(requests).then((results) => {
      const totals = {};
      results.forEach(({ month: m, total }) => { totals[m] = total; });
      setMonthTotals(totals);
    });
  }, [year, view]);

  // Fetch day transactions
  useEffect(() => {
    if (!selectedDay) return;
    if (isDemoUser()) {
      setDayExpenses(MOCK_EXPENSES.slice(0, 3));
      return;
    }
    setLoadingDay(true);
    client
      .get('/expenses', { params: { period: 'daily', page: 1, limit: 50, date: selectedDay } })
      .then((res) => setDayExpenses(res.data.expenses || []))
      .catch(() => setDayExpenses([]))
      .finally(() => setLoadingDay(false));
  }, [selectedDay]);

  function handleDayClick(dateKey) {
    setSelectedDay((prev) => (prev === dateKey ? null : dateKey));
  }

  function handleMonthClick(m) {
    setCurrentDate(new Date(year, m - 1, 1));
    setView('month');
  }

  return (
    <Layout>
      {/* Sub-tabs */}
      <div className="flex gap-1.5 mb-5">
        {['Month', 'Year'].map((v) => {
          const val = v.toLowerCase();
          return (
            <button
              key={v}
              onClick={() => setView(val)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                view === val
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>

      {view === 'month' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentDate((d) => subMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm font-semibold text-gray-800">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentDate((d) => addMonths(d, 1))}
              disabled={
                currentDate.getFullYear() === today.getFullYear() &&
                currentDate.getMonth() === today.getMonth()
              }
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {loadingCalendar ? (
            <div className="h-48 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent" />
            </div>
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              calendarData={calendarData}
              selectedDay={selectedDay}
              onDayClick={handleDayClick}
            />
          )}

          {/* Day detail panel */}
          {selectedDay && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                {format(new Date(selectedDay), 'EEEE, d MMMM')}
              </h3>
              {loadingDay ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-gray-200" />
                      <div className="flex-1 h-3 bg-gray-100 rounded" />
                      <div className="w-14 h-3 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : dayExpenses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">No expenses on this day.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {dayExpenses.map((exp) => (
                    <li key={exp.id} className="flex items-center gap-3 py-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#6b7280' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">
                          {exp.description || exp.category}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-400 capitalize">{exp.category}</span>
                          {exp.platform && <PlatformBadge platform={exp.platform} size="xs" />}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatINR(exp.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentDate(new Date(year - 1, 0, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm font-semibold text-gray-800">{year}</h2>
            <button
              onClick={() => setCurrentDate(new Date(year + 1, 0, 1))}
              disabled={year >= today.getFullYear()}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <YearGrid year={year} monthTotals={monthTotals} onMonthClick={handleMonthClick} />
        </div>
      )}
    </Layout>
  );
}
