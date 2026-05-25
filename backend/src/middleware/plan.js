/**
 * Plan gate middleware — only allows pro users through.
 * Returns 403 with upgrade_required if the user is on the free plan
 * or their pro subscription has expired.
 */
function requirePro(req, res, next) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const isPro =
    user.plan === 'pro' &&
    (!user.plan_expires_at || new Date(user.plan_expires_at) > new Date());

  if (!isPro) {
    return res.status(403).json({
      error: 'upgrade_required',
      message: 'This feature is available on the Pro plan.',
      upgrade_url: `${process.env.APP_URL}/upgrade`,
    });
  }

  next();
}

module.exports = { requirePro };
