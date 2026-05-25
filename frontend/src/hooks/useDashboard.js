import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';
import { isDemoUser, MOCK_STATS, MOCK_SUMMARY, MOCK_CATEGORIES } from '../api/mockData.js';

export default function useDashboard(period = 'monthly') {
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (isDemoUser()) {
      setStats(MOCK_STATS);
      setSummary(MOCK_SUMMARY);
      setCategories(MOCK_CATEGORIES);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [statsRes, summaryRes, catRes] = await Promise.all([
        client.get('/dashboard/stats', { params: { period } }),
        client.get('/dashboard/summary', { params: { period } }),
        client.get('/expenses/categories', { params: { period } }),
      ]);
      setStats(statsRes.data);
      setSummary(summaryRes.data);
      setCategories(catRes.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { stats, summary, categories, loading, error, refetch: fetchAll };
}
