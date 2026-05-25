import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.get('/auth/me');
      setUser(res.data.user);
      setError(null);
    } catch (err) {
      if (err.response?.status === 401) {
        setUser(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for mock demo user in sessionStorage
    const mockUser = sessionStorage.getItem('xpense_demo_user');
    if (mockUser) {
      try {
        setUser(JSON.parse(mockUser));
        setLoading(false);
        return;
      } catch {
        sessionStorage.removeItem('xpense_demo_user');
      }
    }
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      sessionStorage.removeItem('xpense_demo_user');
      await client.post('/auth/logout');
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const setMockUser = useCallback((mockUserData) => {
    sessionStorage.setItem('xpense_demo_user', JSON.stringify(mockUserData));
    setUser(mockUserData);
  }, []);

  return { user, loading, error, logout, refetch: fetchUser, setMockUser };
}
