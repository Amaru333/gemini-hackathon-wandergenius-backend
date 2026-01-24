import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get recommended public trips (top-rated)
router.get('/recommended', async (req, res) => {
  try {
    const { limit = 6, lat, lng } = req.query;

    // Get public trips that have reviews
    const publicTripsWithReviews = await prisma.plannedTrip.findMany({
      where: {
        isPublic: true,
        reviews: {
          some: {} // Has at least one review
        }
      },
      select: {
        id: true,
        destinationName: true,
        destinationLat: true,
        destinationLng: true,
        photoUrl: true,
        days: true,
        shareId: true,
        reviews: {
          select: {
            overallRating: true,
            budgetRating: true,
            locationRating: true,
            activitiesRating: true
          }
        }
      }
    });

    // Calculate average ratings for each trip
    const tripsWithRatings = publicTripsWithReviews.map(trip => {
      const reviews = trip.reviews;
      const avgOverall = reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length;
      const avgBudget = reviews.reduce((sum, r) => sum + r.budgetRating, 0) / reviews.length;
      const avgLocation = reviews.reduce((sum, r) => sum + r.locationRating, 0) / reviews.length;
      const avgActivities = reviews.reduce((sum, r) => sum + r.activitiesRating, 0) / reviews.length;

      // Calculate distance if user coordinates provided
      let distance = null;
      if (lat && lng && trip.destinationLat && trip.destinationLng) {
        const R = 3959; // Earth's radius in miles
        const dLat = (trip.destinationLat - parseFloat(lat)) * Math.PI / 180;
        const dLng = (trip.destinationLng - parseFloat(lng)) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(parseFloat(lat) * Math.PI / 180) * Math.cos(trip.destinationLat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance = Math.round(R * c);
      }

      return {
        id: trip.id,
        destinationName: trip.destinationName,
        photoUrl: trip.photoUrl,
        days: trip.days,
        shareId: trip.shareId,
        distance,
        reviewCount: reviews.length,
        averageRating: {
          overall: avgOverall,
          budget: avgBudget,
          location: avgLocation,
          activities: avgActivities
        }
      };
    });

    // Sort by overall rating (highest first)
    tripsWithRatings.sort((a, b) => b.averageRating.overall - a.averageRating.overall);

    // Return top N trips
    res.json(tripsWithRatings.slice(0, parseInt(limit)));
  } catch (error) {
    console.error('Get recommended trips error:', error);
    res.status(500).json({ error: 'Failed to get recommended trips' });
  }
});

// Create or update a review
router.post('/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { budgetRating, locationRating, activitiesRating, overallRating, comment } = req.body;

    // Validate ratings (1-5)
    const ratings = [budgetRating, locationRating, activitiesRating, overallRating];
    for (const rating of ratings) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'All ratings must be between 1 and 5' });
      }
    }

    // Verify trip exists and user has access
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        OR: [
          { userId: req.userId },
          { collaborators: { some: { userId: req.userId, status: 'accepted' } } }
        ]
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }

    // Upsert review (create or update)
    const review = await prisma.tripReview.upsert({
      where: {
        tripId_userId: {
          tripId,
          userId: req.userId
        }
      },
      update: {
        budgetRating,
        locationRating,
        activitiesRating,
        overallRating,
        comment
      },
      create: {
        tripId,
        userId: req.userId,
        budgetRating,
        locationRating,
        activitiesRating,
        overallRating,
        comment
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json(review);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Get all reviews for a trip (public endpoint)
router.get('/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;

    // Check if trip exists and is either public or belongs to user
    const trip = await prisma.plannedTrip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const reviews = await prisma.tripReview.findMany({
      where: { tripId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate average ratings
    const averages = reviews.length > 0 ? {
      budgetRating: reviews.reduce((sum, r) => sum + r.budgetRating, 0) / reviews.length,
      locationRating: reviews.reduce((sum, r) => sum + r.locationRating, 0) / reviews.length,
      activitiesRating: reviews.reduce((sum, r) => sum + r.activitiesRating, 0) / reviews.length,
      overallRating: reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length,
    } : null;

    res.json({
      reviews,
      averages,
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// Get current user's review for a trip
router.get('/:tripId/user', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;

    const review = await prisma.tripReview.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: req.userId
        }
      }
    });

    res.json(review);
  } catch (error) {
    console.error('Get user review error:', error);
    res.status(500).json({ error: 'Failed to get user review' });
  }
});

// Delete user's review
router.delete('/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;

    await prisma.tripReview.delete({
      where: {
        tripId_userId: {
          tripId,
          userId: req.userId
        }
      }
    });

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;
