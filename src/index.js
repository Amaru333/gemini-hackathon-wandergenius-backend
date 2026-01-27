import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import tripRoutes from './routes/trips.js';
import geocodeRoutes from './routes/geocode.js';
import photosRoutes from './routes/photos.js';
import itineraryRoutes from './routes/itinerary.js';
import chatRoutes from './routes/chat.js';
import weatherRoutes from './routes/weather.js';
import budgetRoutes from './routes/budget.js';
import collaborationRoutes from './routes/collaboration.js';
import reviewsRoutes from './routes/reviews.js';
import badgesRoutes from './routes/badges.js';
import packingTemplatesRoutes from './routes/packingTemplates.js';
import photoJournalRoutes from './routes/photoJournal.js';
import leaderboardsRoutes from './routes/leaderboards.js';
import smartPackingRoutes from './routes/smartPacking.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for photo uploads

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/packing-templates', packingTemplatesRoutes);
app.use('/api/photo-journal', photoJournalRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);
app.use('/api/smart-packing', smartPackingRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 WanderGenius API running on http://localhost:${PORT}`);
});
