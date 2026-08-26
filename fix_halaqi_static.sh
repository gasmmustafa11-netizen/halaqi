#!/bin/bash

# صلح مشكلة Static Files في src/server/app.ts
cat > src/server/app.ts << 'APPFILE'
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/auth/login', (req, res) => {});
app.post('/api/auth/register', (req, res) => {});
app.get('/api/salons', (req, res) => {});
app.get('/api/salons/:id/posts', (req, res) => {});
app.get('/api/users/:userId/posts', (req, res) => {});
app.post('/api/posts', (req, res) => {});
app.put('/api/admin/salons/:id/lift-sanction', (req, res) => {});

const distPath = path.resolve(__dirname, '../../dist');

// دائماً قدّم الملفات الثابتة من dist
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

export default app;
APPFILE

echo "✅ تم إصلاح src/server/app.ts بنجاح!"
