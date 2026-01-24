import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Badge definitions
const BADGES = {
  first_trip: { name: 'First Steps', description: 'Complete your first trip', icon: 'Seedling' },
  jet_setter: { name: 'Jet Setter', description: 'Complete 5 trips', icon: 'Plane' },
  world_traveler: { name: 'World Traveler', description: 'Complete 10 trips', icon: 'Globe' },
  critic: { name: 'Critic', description: 'Write your first review', icon: 'Star' },
  top_reviewer: { name: 'Top Reviewer', description: 'Write 5 reviews', icon: 'Award' },
  team_player: { name: 'Team Player', description: 'Collaborate on a trip', icon: 'Users' },
  influencer: { name: 'Influencer', description: 'Have your trip imported 5 times', icon: 'Share2' },
  explorer: { name: 'Explorer', description: 'Visit 3 different regions', icon: 'Map' },
};

// Check and award badges for a user
router.get('/check', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const newBadges = [];

    // Get user stats
    const tripCount = await prisma.plannedTrip.count({ where: { userId } });
    const reviewCount = await prisma.tripReview.count({ where: { userId } });
    const collaborationCount = await prisma.tripCollaborator.count({ 
      where: { userId, status: 'accepted' } 
    });
    
    // Count unique destinations (as regions proxy)
    const trips = await prisma.plannedTrip.findMany({
      where: { userId },
      select: { destinationName: true }
    });
    const uniqueDestinations = new Set(trips.map(t => t.destinationName.split(',')[0].trim())).size;

    // Get existing badges
    const existingBadges = await prisma.userBadge.findMany({
      where: { userId },
      select: { badgeType: true }
    });
    const earnedTypes = new Set(existingBadges.map(b => b.badgeType));

    // Check each badge
    const badgesToAward = [];

    if (tripCount >= 1 && !earnedTypes.has('first_trip')) {
      badgesToAward.push('first_trip');
    }
    if (tripCount >= 5 && !earnedTypes.has('jet_setter')) {
      badgesToAward.push('jet_setter');
    }
    if (tripCount >= 10 && !earnedTypes.has('world_traveler')) {
      badgesToAward.push('world_traveler');
    }
    if (reviewCount >= 1 && !earnedTypes.has('critic')) {
      badgesToAward.push('critic');
    }
    if (reviewCount >= 5 && !earnedTypes.has('top_reviewer')) {
      badgesToAward.push('top_reviewer');
    }
    if (collaborationCount >= 1 && !earnedTypes.has('team_player')) {
      badgesToAward.push('team_player');
    }
    if (uniqueDestinations >= 3 && !earnedTypes.has('explorer')) {
      badgesToAward.push('explorer');
    }

    // Award new badges
    for (const badgeType of badgesToAward) {
      const badge = await prisma.userBadge.create({
        data: { userId, badgeType }
      });
      newBadges.push({
        ...badge,
        ...BADGES[badgeType]
      });
    }

    res.json({
      newBadges,
      message: newBadges.length > 0 ? `You earned ${newBadges.length} new badge(s)!` : 'No new badges'
    });
  } catch (error) {
    console.error('Check badges error:', error);
    res.status(500).json({ error: 'Failed to check badges' });
  }
});

// Get user's badges
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const badges = await prisma.userBadge.findMany({
      where: { userId: req.userId },
      orderBy: { earnedAt: 'desc' }
    });

    const badgesWithDetails = badges.map(b => ({
      ...b,
      ...BADGES[b.badgeType]
    }));

    res.json(badgesWithDetails);
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Failed to get badges' });
  }
});

// Get user's travel stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const [tripCount, reviewCount, user, collaborations] = await Promise.all([
      prisma.plannedTrip.count({ where: { userId } }),
      prisma.tripReview.count({ where: { userId } }),
      prisma.user.findUnique({ 
        where: { id: userId },
        select: { name: true, shareableId: true, createdAt: true }
      }),
      prisma.tripCollaborator.count({ where: { userId, status: 'accepted' } })
    ]);

    // Generate shareableId if user doesn't have one
    let shareableId = user?.shareableId;
    if (!shareableId) {
      const crypto = await import('crypto');
      shareableId = crypto.randomUUID();
      await prisma.user.update({
        where: { id: userId },
        data: { shareableId }
      });
    }

    // Get unique destinations
    const trips = await prisma.plannedTrip.findMany({
      where: { userId },
      select: { destinationName: true }
    });
    const destinations = [...new Set(trips.map(t => t.destinationName))];

    // Get badge count
    const badgeCount = await prisma.userBadge.count({ where: { userId } });

    res.json({
      name: user?.name || 'Traveler',
      shareableId,
      memberSince: user?.createdAt,
      stats: {
        tripsCompleted: tripCount,
        reviewsWritten: reviewCount,
        collaborations,
        badgesEarned: badgeCount,
        destinationsVisited: destinations.length,
        destinations: destinations.slice(0, 10) // Top 10
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get public profile (no auth required)
router.get('/profile/:shareableId', async (req, res) => {
  try {
    const { shareableId } = req.params;

    const user = await prisma.user.findUnique({
      where: { shareableId },
      select: {
        name: true,
        createdAt: true,
        badges: {
          orderBy: { earnedAt: 'desc' }
        },
        plannedTrips: {
          where: { isPublic: true },
          select: { destinationName: true, days: true, photoUrl: true, shareId: true },
          take: 6
        },
        reviews: {
          select: { id: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get unique destinations
    const destinations = [...new Set(user.plannedTrips.map(t => t.destinationName))];

    const badgesWithDetails = user.badges.map(b => ({
      ...b,
      ...BADGES[b.badgeType]
    }));

    res.json({
      name: user.name || 'Traveler',
      memberSince: user.createdAt,
      badges: badgesWithDetails,
      stats: {
        tripsCompleted: user.plannedTrips.length,
        reviewsWritten: user.reviews.length,
        badgesEarned: user.badges.length,
        destinationsVisited: destinations.length
      },
      publicTrips: user.plannedTrips
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get all available badges (for display)
router.get('/all', async (req, res) => {
  res.json(Object.entries(BADGES).map(([type, details]) => ({
    type,
    ...details
  })));
});

export default router;
