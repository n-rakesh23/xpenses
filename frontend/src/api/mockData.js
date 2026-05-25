export const MOCK_STATS = {
  total: 12480,
  avg: 415,
  topCategory: 'food',
  count: 30,
  streak: 7,
};

export const MOCK_SUMMARY = {
  labels: ['Apr 1', 'Apr 5', 'Apr 10', 'Apr 15', 'Apr 20'],
  data: [1200, 980, 1540, 860, 1320],
};

export const MOCK_CATEGORIES = {
  food: 4200,
  transport: 2800,
  shopping: 2100,
  entertainment: 1500,
  health: 900,
  other: 980,
};

export const MOCK_EXPENSES = [
  { id: '1', amount: 649, category: 'entertainment', description: 'Netflix', platform: 'telegram', created_at: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: '2', amount: 320, category: 'food', description: 'Swiggy biryani', platform: 'telegram', created_at: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: '3', amount: 180, category: 'transport', description: 'Uber office', platform: 'whatsapp', created_at: new Date(Date.now() - 26 * 3600000).toISOString() },
  { id: '4', amount: 1200, category: 'shopping', description: 'Amazon order', platform: 'telegram', created_at: new Date(Date.now() - 50 * 3600000).toISOString() },
  { id: '5', amount: 80, category: 'food', description: 'Coffee', platform: 'telegram', created_at: new Date(Date.now() - 74 * 3600000).toISOString() },
  { id: '6', amount: 450, category: 'health', description: 'Pharmacy', platform: 'telegram', created_at: new Date(Date.now() - 98 * 3600000).toISOString() },
  { id: '7', amount: 200, category: 'transport', description: 'Metro card recharge', platform: 'telegram', created_at: new Date(Date.now() - 120 * 3600000).toISOString() },
  { id: '8', amount: 560, category: 'food', description: 'Dinner restaurant', platform: 'whatsapp', created_at: new Date(Date.now() - 144 * 3600000).toISOString() },
  { id: '9', amount: 999, category: 'entertainment', description: 'Spotify annual', platform: 'telegram', created_at: new Date(Date.now() - 168 * 3600000).toISOString() },
  { id: '10', amount: 750, category: 'shopping', description: 'Myntra shirt', platform: 'telegram', created_at: new Date(Date.now() - 192 * 3600000).toISOString() },
];

export const MOCK_CALENDAR = (() => {
  const data = {};
  const today = new Date();
  for (let d = 1; d <= today.getDate(); d++) {
    if (Math.random() > 0.35) {
      const date = new Date(today.getFullYear(), today.getMonth(), d);
      const key = date.toISOString().split('T')[0];
      data[key] = Math.floor(Math.random() * 1800) + 100;
    }
  }
  return data;
})();

export function isDemoUser() {
  try {
    const u = sessionStorage.getItem('xpense_demo_user');
    return u ? JSON.parse(u)?.isDemo === true : false;
  } catch {
    return false;
  }
}
