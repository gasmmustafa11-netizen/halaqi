import 'dotenv/config';
import app from './src/server/app.js';
import { loadAllFromNeon } from './src/server/db.js';

const PORT = Number(process.env.PORT || 3001);

async function start() {
  try {
    console.log('📦 Loading data from Neon database...');
    await loadAllFromNeon();
    console.log('✅ Database initialized successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
