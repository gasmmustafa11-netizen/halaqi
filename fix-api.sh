#!/bin/bash

cat > ./src/server/app.ts << 'APPFILE'
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await db.loginUser(email, password);
    res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await db.registerUser(email, password, firstName, lastName, role || 'customer');
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/salons', async (req, res) => {
  try {
    const salons = await db.getAllSalonsFromNeon();
    res.json(salons);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch salons' });
  }
});

app.get('/api/salons/:id/posts', async (req, res) => {
  try {
    const posts = await db.getPostsBySalonFromNeon(req.params.id);
    res.json(posts || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.get('/api/users/:userId/posts', async (req, res) => {
  try {
    const posts = await db.getUserPostsFromNeon(req.params.userId);
    res.json(posts || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { userId, salonId, content, images } = req.body;
    if (!userId || !content) return res.status(400).json({ error: 'User ID and content required' });
    const result = await db.createPost(userId, salonId, content, images || []);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.put('/api/admin/salons/:id/lift-sanction', async (req, res) => {
  try {
    const result = await db.liftSanctionFromSalon(req.params.id);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to lift sanction' });
  }
});

const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

export default app;
APPFILE

echo "✅ تم تحديث app.ts بنجاح!"
echo "🚀 شغّل: npm run dev"
