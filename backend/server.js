require('dotenv').config();

const cors = require('cors');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const app = express();

const authRoutes = require('./routes/auth');
const donationRoutes = require('./routes/donations');

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 5000);

// Validate required environment variables
if (!process.env.MONGODB_URI) {
    console.error(
        'Missing MONGODB_URI. Add your MongoDB connection string to backend/.env.'
    );
    process.exit(1);
}

if (
    isProduction &&
    (!process.env.SESSION_SECRET ||
        process.env.SESSION_SECRET.length < 32)
) {
    console.error(
        'Production requires SESSION_SECRET to be at least 32 characters.'
    );
    process.exit(1);
}

// CORS configuration for VS Code Live Server.
// Use the same hostname in the browser and API URL (localhost OR 127.0.0.1)
// so the session cookie remains same-site across ports 5500 and 5000.
const allowedOrigins = new Set([
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:5001',
    'http://127.0.0.1:5001'
]);

app.use(cors({
    origin(origin, callback) {
        // Requests without Origin (e.g. health checks/curl) are allowed.
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Trust proxy configuration
if (isProduction) {
    app.set('trust proxy', 1);
}

// Security middleware
app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

// Parse incoming requests
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Rate limiting
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false
    })
);

// Session management
app.use(
    session({
        name: 'annasetu.sid',
        secret:
            process.env.SESSION_SECRET ||
            'DEV_ONLY_CHANGE_THIS_SESSION_SECRET_TO_A_LONG_RANDOM_VALUE',
        resave: false,
        saveUninitialized: false,
        rolling: true,

        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
            collectionName: 'sessions',
            ttl: 10 * 24 * 60 * 60,
            touchAfter: 24 * 3600
        }),

        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 10 * 24 * 60 * 60 * 1000
        }
    })
);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        service: 'AnnaSetu',
        database:
            mongoose.connection.readyState === 1
                ? 'connected'
                : 'disconnected'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);

// Serve frontend files when requested from the backend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Frontend fallback
app.get('*', (req, res) => {
    res.sendFile(
        path.join(__dirname, '..', 'frontend', 'index.html')
    );
});

// Central error handler
app.use((err, req, res, next) => {
    console.error(err);

    res.status(err.status || 500).json({
        message:
            err.status && err.status < 500
                ? err.message
                : 'Server error. Please try again.'
    });
});

// Connect to MongoDB and start server
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        app.listen(port, () => {
            console.log(
                `AnnaSetu is running at http://localhost:${port}`
            );
        });
    })
    .catch((error) => {
        console.error(
            'MongoDB connection failed:',
            error.message
        );
        process.exit(1);
    });