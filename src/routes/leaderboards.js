import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// US states for validation
const US_STATES = new Set([
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia', 'DC'
]);

// Helper to extract state from destination name
// Handles formats like: "Raleigh, North Carolina", "New York, NY, USA", "Austin, Texas"
const extractState = (destinationName) => {
  if (!destinationName) return null;
  const parts = destinationName.split(',').map(p => p.trim());
  
  // Check each part for a state name
  for (const part of parts) {
    if (US_STATES.has(part)) {
      // Normalize DC
      if (part === 'DC') return 'District of Columbia';
      return part;
    }
  }
  
  return null;
};

// Get all leaderboards (public endpoint)
router.get('/', async (req, res) => {
  try {
    // Fetch all users with their stats in parallel
    const [allUsers, allTrips, allReviews] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          shareableId: true,
        }
      }),
      prisma.plannedTrip.findMany({
        select: {
          userId: true,
          destinationName: true,
        }
      }),
      prisma.tripReview.findMany({
        include: {
          trip: {
            select: {
              userId: true,
              isPublic: true,
            }
          }
        }
      })
    ]);

    // Create user lookup map
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // === MOST TRIPS LEADERBOARD ===
    const tripCountByUser = new Map();
    for (const trip of allTrips) {
      tripCountByUser.set(trip.userId, (tripCountByUser.get(trip.userId) || 0) + 1);
    }

    const mostTrips = Array.from(tripCountByUser.entries())
      .map(([userId, count]) => {
        const user = userMap.get(userId);
        if (!user) return null;
        return {
          userId,
          name: user.name || 'Anonymous Traveler',
          shareableId: user.shareableId,
          value: count,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    // === MOST STATES LEADERBOARD ===
    const statesByUser = new Map();
    for (const trip of allTrips) {
      const state = extractState(trip.destinationName);
      if (!state) continue;
      
      if (!statesByUser.has(trip.userId)) {
        statesByUser.set(trip.userId, new Set());
      }
      statesByUser.get(trip.userId).add(state);
    }

    const mostStates = Array.from(statesByUser.entries())
      .map(([userId, states]) => {
        const user = userMap.get(userId);
        if (!user) return null;
        return {
          userId,
          name: user.name || 'Anonymous Traveler',
          shareableId: user.shareableId,
          value: states.size,
          states: Array.from(states).slice(0, 5), // Top 5 states for display
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    // === BEST REVIEWED LEADERBOARD ===
    // Calculate average rating for each user's public trips
    const reviewStatsByUser = new Map();
    
    for (const review of allReviews) {
      // Only count reviews for public trips
      if (!review.trip?.isPublic) continue;
      
      const tripOwnerId = review.trip.userId;
      if (!reviewStatsByUser.has(tripOwnerId)) {
        reviewStatsByUser.set(tripOwnerId, { totalRating: 0, count: 0 });
      }
      
      const stats = reviewStatsByUser.get(tripOwnerId);
      stats.totalRating += review.overallRating;
      stats.count += 1;
    }

    const bestReviewed = Array.from(reviewStatsByUser.entries())
      .filter(([_, stats]) => stats.count >= 1) // Minimum 1 review
      .map(([userId, stats]) => {
        const user = userMap.get(userId);
        if (!user) return null;
        return {
          userId,
          name: user.name || 'Anonymous Traveler',
          shareableId: user.shareableId,
          value: Math.round((stats.totalRating / stats.count) * 10) / 10, // 1 decimal place
          reviewCount: stats.count,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by rating first, then by review count as tiebreaker
        if (b.value !== a.value) return b.value - a.value;
        return b.reviewCount - a.reviewCount;
      })
      .slice(0, 10)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    res.json({
      mostTrips,
      mostStates,
      bestReviewed,
    });
  } catch (error) {
    console.error('Get leaderboards error:', error);
    res.status(500).json({ error: 'Failed to get leaderboards' });
  }
});

export default router;
