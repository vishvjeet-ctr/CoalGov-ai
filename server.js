require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { getRedisClient } = require('./config/redis');
const helpers = require('./utils/helpers');
const constants = require('./utils/constants');
const aiService = require('./services/ai.service');

// Initialise the Groq AI engine before any route can service a request.
// Without this the platform would silently stay in DEMO MODE even when a
// GROQ_API_KEY is configured.
aiService.initializeAI();

const app = express();
const PORT = process.env.PORT || 3000;
const APP_VERSION = require('./package.json').version;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || null;

// Behind a managed host (Render, Fly, a load balancer) the client protocol and
// host arrive in X-Forwarded-* headers. Trusting the first proxy hop is what
// makes req.protocol correct for canonical URLs and secure session cookies.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      // The views use inline event handlers (onclick="captureLocation()" and
      // friends) for the field UI. Helmet defaults script-src-attr to 'none',
      // which silently disabled every one of those buttons in the browser. This
      // must stay aligned with script-src above.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'coalgov-fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Session store.
//
// The Redis client connects asynchronously, so its readiness cannot be relied
// upon at module-evaluation time. Redis-backed sessions are therefore an
// explicit opt-in (USE_REDIS_SESSION=true) for multi-instance deployments;
// the default single-instance prototype uses the in-memory store.
if (process.env.USE_REDIS_SESSION === 'true' && process.env.REDIS_URL) {
  try {
    const { redisClient } = require('./config/redis');
    const RedisStore = require('connect-redis').default;
    sessionConfig.store = new RedisStore({ client: redisClient });
    console.log('[Session] Using Redis session store');
  } catch (e) {
    console.warn(`[Session] Redis store initialization failed (${e.message}); using MemoryStore`);
  }
} else if (process.env.REDIS_URL) {
  console.warn('[Session] Using MemoryStore. Set USE_REDIS_SESSION=true with a reachable REDIS_URL to share sessions across instances.');
} else {
  console.warn('[Session] No REDIS_URL configured. Using MemoryStore (single instance only).');
}

app.use(session(sessionConfig));

// Template locals - make helpers and constants available in all templates
app.use((req, res, next) => {
  res.locals.helpers = helpers;
  res.locals.constants = constants;
  res.locals.currentUser = req.session ? req.session.user : null;
  res.locals.currentPath = req.path;
  res.locals.appName = process.env.APP_NAME || 'CoalGov AI';
  res.locals.appTagline = 'Smart Governance for Coal Mines';
  res.locals.appVersion = APP_VERSION;
  res.locals.supportEmail = SUPPORT_EMAIL;
  res.locals.demoMode = process.env.DEMO_MODE === 'true';
  res.locals.demoRoles = constants.DEMO_ROLES;

  // Absolute origin used for canonical links, Open Graph images and the
  // sitemap. APP_BASE_URL wins so a custom domain is configured once, in the
  // environment, instead of being hard coded anywhere in a template.
  res.locals.baseUrl = process.env.APP_BASE_URL
    ? String(process.env.APP_BASE_URL).replace(/\/$/, '')
    : `${req.protocol}://${req.get('host')}`;

  // One-shot flash toast.
  //
  // Two producers feed this: the demo role switcher and the `req.session.flash`
  // object that every form handler sets (success/error feedback). The value is
  // copied into locals before being cleared from the session, so it renders on
  // exactly one request and never reappears on a refresh.
  const sessionFlash = (req.session && req.session.flash) ? req.session.flash : null;
  res.locals.flashToast = (req.session && req.session.flashToast) || sessionFlash || null;
  if (req.session && req.session.flashToast) req.session.flashToast = null;
  if (req.session && req.session.flash) req.session.flash = null;

  next();
});

// Routes
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const violationRoutes = require('./routes/violations.routes');
const inspectionRoutes = require('./routes/inspections.routes');
const correctiveRoutes = require('./routes/corrective.routes');
const complianceRoutes = require('./routes/compliance.routes');
const contractorRoutes = require('./routes/contractors.routes');
const reportRoutes = require('./routes/reports.routes');
const notificationRoutes = require('./routes/notifications.routes');
const auditRoutes = require('./routes/audit.routes');
const searchRoutes = require('./routes/search.routes');
const adminRoutes = require('./routes/admin.routes');
const apiRoutes = require('./routes/api.routes');
const demoRoutes = require('./routes/demo.routes');
const profileRoutes = require('./routes/profile.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const incidentRoutes = require('./routes/incidents.routes');
const environmentRoutes = require('./routes/environment.routes');
const productionRoutes = require('./routes/production.routes');
const grievanceRoutes = require('./routes/grievances.routes');
const documentRoutes = require('./routes/documents.routes');
const riskRoutes = require('./routes/risk.routes');
const alertRoutes = require('./routes/alerts.routes');
const assistantRoutes = require('./routes/assistant.routes');
const mapRoutes = require('./routes/map.routes');

// Import middleware
const { authLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler: globalErrorHandler } = require('./middleware/errorHandler');

// Landing page
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('landing/index', { layout: false });
});

// Public pages and crawler files (privacy, terms, robots.txt, sitemap.xml)
app.use('/', require('./routes/site.routes'));

// Mount routes
app.use('/auth', authLimiter, authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/violations', violationRoutes);
app.use('/inspections', inspectionRoutes);
app.use('/corrective-actions', correctiveRoutes);
app.use('/compliance', complianceRoutes);
app.use('/contractors', contractorRoutes);
app.use('/reports', reportRoutes);
app.use('/notifications', notificationRoutes);
app.use('/audit', auditRoutes);
// Same register served under the spec's /audit-logs path.
app.use('/audit-logs', auditRoutes);
app.use('/search', searchRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/mobile', require('./routes/mobile.routes'));
app.use('/demo', demoRoutes);
app.use('/profile', profileRoutes);

// Field operations, environment, reporting and analytics modules.
app.use('/attendance', attendanceRoutes);
app.use('/incidents', incidentRoutes);
app.use('/environment', environmentRoutes);
app.use('/production', productionRoutes);
app.use('/grievances', grievanceRoutes);
app.use('/documents', documentRoutes);
app.use('/ai-risk-analysis', riskRoutes);
app.use('/alerts', alertRoutes);
app.use('/assistant', assistantRoutes);

// GIS. `/gis` is the documented path; `/map` is kept for existing links.
app.use('/gis', mapRoutes);
app.use('/map', mapRoutes);

// Health check
app.get('/health', async (req, res) => {
  const mongoose = require('mongoose');
  const { getRedisClient } = require('./config/redis');
  let redisStatus = 'unavailable';
  try {
    const redisClient = getRedisClient();
    redisStatus = redisClient ? 'connected' : 'unavailable';
  } catch (e) {
    redisStatus = 'unavailable';
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: redisStatus,
    environment: process.env.NODE_ENV || 'development',
    demoMode: process.env.DEMO_MODE === 'true'
  });
});

// Error handling
app.use(notFound);
app.use(globalErrorHandler);

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    
    app.listen(PORT, () => {
      const origin = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
      console.log(`\n========================================`);
      console.log(`  CoalGov AI Server`);
      console.log(`  Port: ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Demo Mode: ${process.env.DEMO_MODE === 'true' ? 'ON' : 'OFF'}`);
      console.log(`  AI Engine: ${aiService.isAIAvailable() ? 'Groq (live)' : 'DEMO MODE (no GROQ_API_KEY)'}`);
      console.log(`  URL: ${origin}`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  process.exit(0);
});

// Only start the server if this file is run directly (useful for testing)
if (require.main === module) {
  startServer();
}
 
module.exports = app;
 