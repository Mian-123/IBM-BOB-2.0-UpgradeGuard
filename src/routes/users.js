// Users route - calls an external API using axios.
// This file is a deliberate "usage location" for the axios dependency,
// so UpgradeGuard's Usage Analyst has something real to find.

const express = require('express');
const axios = require('axios');
const router = express.Router();

// GET /api/users - fetch a list of users from an external demo API
router.get('/', async (req, res, next) => {
  try {
    const response = await axios.get('https://jsonplaceholder.typicode.com/users');
    const users = response.data.map(u => ({ id: u.id, name: u.name, email: u.email }));
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id - fetch a single user
router.get('/:id', async (req, res, next) => {
  try {
    const response = await axios.get(`https://jsonplaceholder.typicode.com/users/${req.params.id}`);
    res.json(response.data);
  } catch (err) {
    next(err);
  }
});

// POST /api/users - simulate creating a user
router.post('/', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const response = await axios.post('https://jsonplaceholder.typicode.com/users', { name, email });
    res.status(201).json(response.data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
