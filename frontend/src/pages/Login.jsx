import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
const DEMO_USERS = [
  { name: 'Rahul', platform: 'telegram', plan: 'free', initials: 'RK', color: '#3b82f6' },
  { name: 'Priya', platform: 'whatsapp', plan: 'pro', initials: 'PS', color: '#a855f7' },
  { name: 'Ankit', platform: 'whatsapp', plan: 'pro', initials: 'AM', color: '#f97316' },
  { name: 'Sana', platform: 'telegram', plan: 'free', initials: 'SK', color: '#ec4899' },
];

function XpenseLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ backgroundColor: '#1D9E75' }}
      >
        <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polyline
            points="22 12 18 12 15 21 9 3 6 12 2 12"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Xpense</h1>
        <p className="text-gray-500 text-sm mt-1">Track expenses via WhatsApp & Telegram</p>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [demoLoading, setDemoLoading] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      await client.post('/auth/magic-link', { phone: phone.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = async (demo) => {
    setDemoLoading(demo.name);
    try {
      await client.post('/auth/demo', { platform: demo.platform, name: demo.name, plan: demo.plan });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Demo login failed. Make sure the backend is running.');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <XpenseLogo />

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Check your phone</h2>
              <p className="text-sm text-gray-500">We've sent a magic link to {phone}. Click it to log in.</p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-green-600 hover:underline"
              >
                Use a different number
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone number or email
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition"
                required
              />
              {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60"
                style={{ backgroundColor: '#1D9E75' }}
              >
                {loading ? 'Sending...' : 'Continue'}
              </button>
            </form>
          )}
        </div>

        {/* Demo users */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">
            Try a demo account
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.name}
                onClick={() => handleDemoClick(demo)}
                disabled={demoLoading === demo.name}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-all text-left group disabled:opacity-60"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: demo.color }}
                >
                  {demo.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-tight">{demo.name}</p>
                  <p className="text-xs text-gray-400 capitalize leading-tight">
                    {demo.platform} · {demo.plan}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
