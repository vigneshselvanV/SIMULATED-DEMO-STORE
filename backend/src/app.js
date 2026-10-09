import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import sessionMiddleware from './config/session.js';
import { attachUser } from './middleware/auth.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import agentguardRoutes from './routes/agentguardRoutes.js';

dotenv.config();

const app = express();

// Trust reverse proxy for secure cookies and rate limiting on Vercel / serverless deployments
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Dynamic CORS configuration supporting Vercel previews, production domains, and local dev
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, same-origin serverless invocations)
      if (!origin) return callback(null, true);

      // Allow configured origin or local addresses
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow any *.vercel.app deployment preview or production domain
      if (origin.endsWith('.vercel.app')) return callback(null, true);

      // Non-production fallback
      if (process.env.NODE_ENV !== 'production') return callback(null, true);

      callback(new Error('Not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-AgentGuard-Signature',
      'X-AgentGuard-Timestamp',
      'X-AgentGuard-Connection-Id'
    ]
  })
);

// Body and cookie parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Server-side session management
app.use(sessionMiddleware);

// Attach authenticated user to request
app.use(attachUser);

// Create unified API router with rate limiter
const apiRouter = express.Router();
apiRouter.use(apiRateLimiter);

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ShopSphere API',
    timestamp: new Date().toISOString()
  });
});

// Mount application API subroutes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/agents', agentRoutes);
apiRouter.use('/agentguard', agentguardRoutes);

// Mount API router on /api (standard) and / (resilient fallback for serverless rewrites)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
