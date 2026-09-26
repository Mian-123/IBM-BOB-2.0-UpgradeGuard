// Main server entry point.
// Deliberately uses body-parser as a standalone package (rather than
// Express's built-in express.json()) so UpgradeGuard's scanner has a
// realistic "deprecated package" scenario to flag.

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const usersRouter = require('./routes/users');
const ordersRouter = require('./routes/orders');
const { authMiddleware, errorHandler } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Protected routes - exercise the auth middleware
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/orders', authMiddleware, ordersRouter);

// Error handler must be registered last
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
