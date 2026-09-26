// Orders route - simple in-memory CRUD, no external dependency.
// This gives UpgradeGuard a "MEDIUM risk" usage location: it uses
// Express routing/middleware patterns but no axios calls.

const express = require('express');
const router = express.Router();

let orders = [
  { id: 1, item: 'Keyboard', qty: 2 },
  { id: 2, item: 'Monitor', qty: 1 },
];

router.get('/', (req, res) => {
  res.json(orders);
});

router.get('/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

router.post('/', (req, res) => {
  const { item, qty } = req.body;
  if (!item || !qty) {
    return res.status(400).json({ error: 'item and qty are required' });
  }
  const newOrder = { id: orders.length + 1, item, qty };
  orders.push(newOrder);
  res.status(201).json(newOrder);
});

// Legacy wildcard route using Express 4's bare "*" pattern.
// This is a REAL, documented Express 5 breaking change: Express 5's
// path-to-regexp (v8) no longer accepts a bare "*" -- it must be named,
// e.g. "/legacy/*splat". Under Express 4 this route works fine; under
// Express 5 it throws at route-registration time, crashing the app.
// This is what makes the express 4->5 rehearsal scenario a REAL,
// verified regression rather than an assumed one.
router.get('/legacy/*', (req, res) => {
  res.json({ wildcardPath: req.params[0] });
});

module.exports = router;
