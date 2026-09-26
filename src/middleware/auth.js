// Simple bearer-token auth middleware.
// This is one of the "HIGH risk" usage locations UpgradeGuard should flag
// when Express changes middleware/error-handling behavior.

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  if (token !== process.env.API_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  next();
}

function errorHandler(err, req, res, next) {
  console.error('Error caught by middleware:', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
}

module.exports = { authMiddleware, errorHandler };
