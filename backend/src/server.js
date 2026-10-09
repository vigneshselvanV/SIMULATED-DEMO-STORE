import app from './app.js';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/initDb.js';
import { keyManager } from './agents/llm/keyManager.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Ensure database tables exist before listening
initializeDatabase();

// Validate agent configurations at startup
keyManager.validateStartupEnv();

const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` ShopSphere Backend API running successfully!`);
  console.log(` Port: ${PORT}`);
  console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Health: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server process terminated.');
  });
});

export { app };
export default app;
