import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: Check if user has access to trip (owner or accepted collaborator)
async function canAccessTrip(userId, tripId) {
  const trip = await prisma.plannedTrip.findFirst({
    where: { id: tripId },
    include: { collaborators: true }
  });
  
  if (!trip) return { access: false, trip: null, role: null };
  
  // Owner has full access
  if (trip.userId === userId) {
    return { access: true, trip, role: 'owner' };
  }
  
  // Check if accepted collaborator
  const collaborator = trip.collaborators.find(
    c => c.userId === userId && c.status === 'accepted'
  );
  
  if (collaborator) {
    return { access: true, trip, role: collaborator.role };
  }
  
  return { access: false, trip: null, role: null };
}

// Helper: Check if user is trip owner
async function isOwner(userId, tripId) {
  const trip = await prisma.plannedTrip.findFirst({
    where: { id: tripId, userId }
  });
  return !!trip;
}

// Invite collaborator by email
router.post('/:tripId/invite', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { email, role = 'editor' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be editor or viewer' });
    }

    // Verify ownership
    const isOwnerResult = await isOwner(req.userId, tripId);
    if (!isOwnerResult) {
      return res.status(403).json({ error: 'Only trip owner can invite collaborators' });
    }

    // Check if already invited
    const existing = await prisma.tripCollaborator.findFirst({
      where: { tripId, email }
    });

    if (existing) {
      return res.status(400).json({ error: 'User already invited' });
    }

    // Check if inviting themselves
    const owner = await prisma.user.findUnique({ where: { id: req.userId } });
    if (owner.email === email) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    // Create invitation
    const collaborator = await prisma.tripCollaborator.create({
      data: {
        tripId,
        email,
        role
      }
    });

    res.status(201).json({
      id: collaborator.id,
      email: collaborator.email,
      role: collaborator.role,
      status: collaborator.status,
      inviteToken: collaborator.inviteToken,
      inviteLink: `http://localhost:3000/invite/${collaborator.inviteToken}`
    });
  } catch (error) {
    console.error('Invite collaborator error:', error);
    res.status(500).json({ error: 'Failed to invite collaborator' });
  }
});

// Get all collaborators for a trip
router.get('/:tripId/collaborators', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    
    const { access, trip } = await canAccessTrip(req.userId, tripId);
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const collaborators = await prisma.tripCollaborator.findMany({
      where: { tripId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get owner info
    const owner = await prisma.user.findUnique({
      where: { id: trip.userId },
      select: { id: true, name: true, email: true }
    });

    res.json({
      owner,
      collaborators: collaborators.map(c => ({
        id: c.id,
        email: c.email,
        role: c.role,
        status: c.status,
        inviteToken: trip.userId === req.userId ? c.inviteToken : undefined,
        user: c.user
      }))
    });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ error: 'Failed to get collaborators' });
  }
});

// Remove collaborator
router.delete('/:tripId/collaborator/:collaboratorId', authenticateToken, async (req, res) => {
  try {
    const { tripId, collaboratorId } = req.params;

    // Verify ownership
    const isOwnerResult = await isOwner(req.userId, tripId);
    if (!isOwnerResult) {
      return res.status(403).json({ error: 'Only trip owner can remove collaborators' });
    }

    await prisma.tripCollaborator.delete({
      where: { id: collaboratorId }
    });

    res.json({ message: 'Collaborator removed' });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// Get invite details (no auth required)
router.get('/invite/:token', async (req, res) => {
  try {
    const collaborator = await prisma.tripCollaborator.findUnique({
      where: { inviteToken: req.params.token },
      include: {
        trip: {
          select: {
            id: true,
            destinationName: true,
            days: true,
            photoUrl: true,
            startLocation: true,
            user: {
              select: { name: true, email: true }
            }
          }
        }
      }
    });

    if (!collaborator) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    res.json({
      email: collaborator.email,
      role: collaborator.role,
      status: collaborator.status,
      trip: {
        id: collaborator.trip.id,
        destinationName: collaborator.trip.destinationName,
        days: collaborator.trip.days,
        photoUrl: collaborator.trip.photoUrl,
        startLocation: collaborator.trip.startLocation,
        ownerName: collaborator.trip.user.name || collaborator.trip.user.email
      }
    });
  } catch (error) {
    console.error('Get invite error:', error);
    res.status(500).json({ error: 'Failed to get invite details' });
  }
});

// Accept invite
router.post('/invite/:token/accept', authenticateToken, async (req, res) => {
  try {
    const collaborator = await prisma.tripCollaborator.findUnique({
      where: { inviteToken: req.params.token }
    });

    if (!collaborator) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (collaborator.status !== 'pending') {
      return res.status(400).json({ error: 'Invite already processed' });
    }

    // Verify email matches (optional - could be flexible)
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user.email !== collaborator.email) {
      // Allow accepting with different email for flexibility
      console.log(`User ${user.email} accepting invite for ${collaborator.email}`);
    }

    const updated = await prisma.tripCollaborator.update({
      where: { id: collaborator.id },
      data: {
        status: 'accepted',
        userId: req.userId
      }
    });

    res.json({
      message: 'Invite accepted',
      tripId: updated.tripId,
      role: updated.role
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// Decline invite
router.post('/invite/:token/decline', authenticateToken, async (req, res) => {
  try {
    const collaborator = await prisma.tripCollaborator.findUnique({
      where: { inviteToken: req.params.token }
    });

    if (!collaborator) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    await prisma.tripCollaborator.update({
      where: { id: collaborator.id },
      data: { status: 'declined' }
    });

    res.json({ message: 'Invite declined' });
  } catch (error) {
    console.error('Decline invite error:', error);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

// Vote on activity
router.post('/:tripId/vote', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { day, activityIndex, vote } = req.body;

    if (day === undefined || activityIndex === undefined || !vote) {
      return res.status(400).json({ error: 'day, activityIndex, and vote are required' });
    }

    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be "up" or "down"' });
    }

    const { access } = await canAccessTrip(req.userId, tripId);
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Upsert vote
    const existingVote = await prisma.activityVote.findUnique({
      where: {
        tripId_day_activityIndex_userId: {
          tripId,
          day,
          activityIndex,
          userId: req.userId
        }
      }
    });

    let result;
    if (existingVote) {
      if (existingVote.vote === vote) {
        // Remove vote if same
        await prisma.activityVote.delete({ where: { id: existingVote.id } });
        result = { action: 'removed' };
      } else {
        // Update vote
        result = await prisma.activityVote.update({
          where: { id: existingVote.id },
          data: { vote }
        });
        result = { action: 'updated', vote: result.vote };
      }
    } else {
      // Create new vote
      result = await prisma.activityVote.create({
        data: { tripId, day, activityIndex, userId: req.userId, vote }
      });
      result = { action: 'created', vote: result.vote };
    }

    res.json(result);
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Get votes for trip
router.get('/:tripId/votes', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;

    const { access } = await canAccessTrip(req.userId, tripId);
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const votes = await prisma.activityVote.findMany({
      where: { tripId },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    // Group votes by day and activity
    const voteTallies = {};
    votes.forEach(v => {
      const key = `${v.day}-${v.activityIndex}`;
      if (!voteTallies[key]) {
        voteTallies[key] = { up: 0, down: 0, voters: [] };
      }
      if (v.vote === 'up') voteTallies[key].up++;
      else voteTallies[key].down++;
      voteTallies[key].voters.push({
        userId: v.userId,
        name: v.user.name,
        vote: v.vote
      });
    });

    // Get current user's votes
    const userVotes = votes
      .filter(v => v.userId === req.userId)
      .reduce((acc, v) => {
        acc[`${v.day}-${v.activityIndex}`] = v.vote;
        return acc;
      }, {});

    res.json({ tallies: voteTallies, userVotes });
  } catch (error) {
    console.error('Get votes error:', error);
    res.status(500).json({ error: 'Failed to get votes' });
  }
});

// Edit itinerary activity (collaborative)
router.patch('/:tripId/itinerary', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { day, activityIndex, updates } = req.body;

    const { access, trip, role } = await canAccessTrip(req.userId, tripId);
    if (!access) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot edit itinerary' });
    }

    const itinerary = [...trip.itinerary];
    const dayPlan = itinerary.find(d => d.day === day);
    
    if (!dayPlan || !dayPlan.activities[activityIndex]) {
      return res.status(400).json({ error: 'Invalid day or activity index' });
    }

    // Apply updates
    dayPlan.activities[activityIndex] = {
      ...dayPlan.activities[activityIndex],
      ...updates
    };

    const updated = await prisma.plannedTrip.update({
      where: { id: tripId },
      data: { itinerary }
    });

    res.json({ itinerary: updated.itinerary });
  } catch (error) {
    console.error('Edit itinerary error:', error);
    res.status(500).json({ error: 'Failed to edit itinerary' });
  }
});

export default router;
