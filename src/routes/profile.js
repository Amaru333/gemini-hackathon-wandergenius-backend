import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile) {
      // Return empty profile structure if not created yet
      return res.json({
        interests: [],
        hobbies: [],
        travelStyle: 'budget',
        constraints: ''
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { interests, hobbies, travelStyle, constraints } = req.body;

    const profile = await prisma.userProfile.upsert({
      where: { userId: req.userId },
      update: {
        interests: interests || [],
        hobbies: hobbies || [],
        travelStyle: travelStyle || 'budget',
        constraints: constraints || null
      },
      create: {
        userId: req.userId,
        interests: interests || [],
        hobbies: hobbies || [],
        travelStyle: travelStyle || 'budget',
        constraints: constraints || null
      }
    });

    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
