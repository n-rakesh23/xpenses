export const MOCK_STATS = {
  users: { total: 1284, pro: 312, free: 972, newThisWeek: 47, active24h: 347 },
  expenses: { total: 38420, totalAmount: 9284500, thisMonth: 4210 },
  revenue: { monthly: 62088 },
  traffic: { last5Min: 23 },
  platforms: { telegram: 810, whatsapp: 474 },
  signupTrend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    count: Math.floor(Math.random() * 12) + 2,
  })),
};

const NAMES = ['Rahul Kumar', 'Priya Sharma', 'Ankit Mehta', 'Sana Khan', 'Vikram Nair',
  'Deepa Iyer', 'Rohan Gupta', 'Meera Pillai', 'Arjun Das', 'Neha Singh'];

export const MOCK_USERS = Array.from({ length: 50 }, (_, i) => ({
  id: `user-${i + 1}`,
  name: NAMES[i % NAMES.length],
  phone: `+9198${String(10000000 + i).slice(1)}`,
  platform: i % 3 === 0 ? 'whatsapp' : 'telegram',
  plan: i % 4 === 0 ? 'pro' : 'free',
  plan_expires_at: i % 4 === 0 ? new Date(Date.now() + 20 * 86400000).toISOString() : null,
  created_at: new Date(Date.now() - i * 3 * 86400000).toISOString(),
  expense_count: Math.floor(Math.random() * 120) + 1,
  total_spent: Math.floor(Math.random() * 45000) + 500,
  last_active: new Date(Date.now() - Math.random() * 5 * 86400000).toISOString(),
}));

const CATEGORIES = ['food', 'transport', 'shopping', 'entertainment', 'health', 'other'];
export const MOCK_EXPENSES = Array.from({ length: 80 }, (_, i) => ({
  id: `exp-${i + 1}`,
  user_name: NAMES[i % NAMES.length],
  user_platform: i % 3 === 0 ? 'whatsapp' : 'telegram',
  amount: Math.floor(Math.random() * 2000) + 50,
  category: CATEGORIES[i % CATEGORIES.length],
  description: ['Coffee', 'Uber ride', 'Amazon', 'Netflix', 'Medicine', 'Lunch'][i % 6],
  created_at: new Date(Date.now() - i * 2 * 3600000).toISOString(),
}));

export const isDemoMode = () => !localStorage.getItem('xpense_admin_token');
