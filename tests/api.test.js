// Thin test suite so UpgradeGuard's rehearsal has a real before/after
// pass count to report.

const request = require('supertest');
process.env.API_TOKEN = 'demo-secret-token';
const app = require('../src/server');

const AUTH_HEADER = { Authorization: 'Bearer demo-secret-token' };

describe('Health check', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth middleware', () => {
  it('rejects requests with no auth header', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toBe(401);
  });

  it('rejects requests with wrong token', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', 'Bearer wrong-token');
    expect(res.statusCode).toBe(403);
  });
});

describe('Orders routes', () => {
  it('GET /api/orders returns a list', async () => {
    const res = await request(app).get('/api/orders').set(AUTH_HEADER);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/orders/:id returns one order', async () => {
    const res = await request(app).get('/api/orders/1').set(AUTH_HEADER);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('POST /api/orders creates a new order', async () => {
    const res = await request(app).post('/api/orders').set(AUTH_HEADER).send({ item: 'Mouse', qty: 3 });
    expect(res.statusCode).toBe(201);
    expect(res.body.item).toBe('Mouse');
  });

  it('POST /api/orders rejects missing fields', async () => {
    const res = await request(app).post('/api/orders').set(AUTH_HEADER).send({ item: 'Mouse' });
    expect(res.statusCode).toBe(400);
  });

  // This exercises the Express 4 legacy wildcard route in orders.js.
  // It is expected to PASS on Express 4 and FAIL (or crash the app
  // entirely) on Express 5 -- that's the deliberate, real breaking-change
  // scenario for the UpgradeGuard rehearsal demo.
  it('GET /api/orders/legacy/:wildcard resolves the old-style wildcard route', async () => {
    const res = await request(app).get('/api/orders/legacy/foo/bar').set(AUTH_HEADER);
    expect(res.statusCode).toBe(200);
    expect(res.body.wildcardPath).toBe('foo/bar');
  });
});

describe('Users routes (axios usage)', () => {
  it('GET /api/users returns a list', async () => {
    const res = await request(app).get('/api/users').set(AUTH_HEADER);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  }, 10000);

  it('GET /api/users/:id returns one user', async () => {
    const res = await request(app).get('/api/users/1').set(AUTH_HEADER);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
  }, 10000);
});
