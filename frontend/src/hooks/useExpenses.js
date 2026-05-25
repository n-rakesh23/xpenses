import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';
import { isDemoUser, MOCK_EXPENSES, MOCK_CALENDAR } from '../api/mockData.js';

export default function useExpenses({ period = 'monthly', page = 1, limit = 50, date } = {}) {
  const [expenses, setExpenses] = useState([]);
  const [calendarData, setCalendarData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchExpenses = useCallback(async () => {
    if (isDemoUser()) {
      setExpenses(MOCK_EXPENSES);
      setCalendarData(MOCK_CALENDAR);
      setHasMore(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await client.get('/expenses', {
        params: { period, page, limit, ...(date ? { date } : {}) },
      });
      setExpenses(res.data.expenses);
      setHasMore(res.data.expenses.length === limit);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [period, page, limit, date]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const deleteExpense = useCallback(async (id) => {
    if (isDemoUser()) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    await client.delete(`/expenses/${id}`);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { expenses, calendarData, loading, error, hasMore, refetch: fetchExpenses, deleteExpense };
}
