import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const MODEL_NAME = 'gemini-2.5-flash';

// Generate itinerary for a destination
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { destination, days, startLocation, tripId, photoUrl, lat, lng } = req.body;

    if (!destination || !days || !startLocation) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get user profile for personalization
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(400).json({ error: 'Please complete your profile first' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `Create a detailed ${days}-day travel itinerary for visiting ${destination}.

User Profile:
- Travel Style: ${profile.travelStyle}
- Interests: ${profile.interests.join(', ')}
- Hobbies: ${profile.hobbies.join(', ')}
- Constraints: ${profile.constraints || 'None'}

Starting Location: ${startLocation}
Trip Duration: ${days} days

Please respond with ONLY valid JSON in this exact format:
{
  "itinerary": [
    {
      "day": 1,
      "title": "Arrival & Exploration",
      "activities": [
        { "time": "09:00", "activity": "Arrive and check in", "description": "...", "location": "..." },
        { "time": "12:00", "activity": "Lunch at local spot", "description": "...", "location": "..." },
        { "time": "14:00", "activity": "Visit main attraction", "description": "...", "location": "..." },
        { "time": "18:00", "activity": "Evening walk", "description": "...", "location": "..." },
        { "time": "20:00", "activity": "Dinner", "description": "...", "location": "..." }
      ],
      "tips": "..."
    }
  ],
  "checklist": [
    { "id": 1, "task": "Light jacket or layers", "category": "clothing", "completed": false },
    { "id": 2, "task": "Comfortable walking shoes", "category": "clothing", "completed": false },
    { "id": 3, "task": "Weather-appropriate outfits (${days} days)", "category": "clothing", "completed": false },
    { "id": 4, "task": "Sunglasses and hat", "category": "clothing", "completed": false },
    { "id": 5, "task": "Toothbrush and toothpaste", "category": "toiletries", "completed": false },
    { "id": 6, "task": "Sunscreen", "category": "toiletries", "completed": false },
    { "id": 7, "task": "Personal medications", "category": "toiletries", "completed": false },
    { "id": 8, "task": "Travel-size toiletry kit", "category": "toiletries", "completed": false },
    { "id": 9, "task": "Passport/ID", "category": "documents", "completed": false },
    { "id": 10, "task": "Travel insurance documents", "category": "documents", "completed": false },
    { "id": 11, "task": "Flight/transport tickets", "category": "documents", "completed": false },
    { "id": 12, "task": "Hotel reservation confirmations", "category": "documents", "completed": false },
    { "id": 13, "task": "Phone charger and power bank", "category": "gear", "completed": false },
    { "id": 14, "task": "Camera or phone for photos", "category": "gear", "completed": false },
    { "id": 15, "task": "Day backpack", "category": "gear", "completed": false }
  ]
}

IMPORTANT PACKING LIST GUIDELINES:
1. Generate 15-25 packing items based on the destination's typical weather and the planned activities
2. Categories MUST be one of: "clothing", "toiletries", "documents", "gear"
3. For CLOTHING: Consider the destination's climate (cold/warm/tropical), include appropriate layers, footwear for activities
4. For TOILETRIES: Include sunscreen for sunny destinations, mosquito repellent for tropical areas, altitude sickness medicine for high elevations
5. For DOCUMENTS: Include visa requirements if applicable, local currency reminders
6. For GEAR: Include activity-specific items (hiking poles, snorkel gear, camera, etc.) based on the itinerary activities
7. Make items specific to ${destination} - e.g., "Warm waterproof jacket" for Iceland, "Light breathable clothes" for Thailand

Make the itinerary specific to ${destination}, considering the user's interests and travel style.`;

    const config = {
      responseMimeType: 'application/json',
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: config,
    });

    let result;
    try {
      const text = response.text || '';
      // Clean up potential markdown code blocks
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse itinerary response:', parseError);
      return res.status(500).json({ error: 'Failed to generate valid itinerary format' });
    }

    // Save the planned trip to database
    const plannedTrip = await prisma.plannedTrip.create({
      data: {
        userId: req.userId,
        tripId: tripId || null,
        destinationName: destination,
        destinationLat: lat || null,
        destinationLng: lng || null,
        photoUrl: photoUrl || null,
        days: parseInt(days),
        startLocation,
        itinerary: result.itinerary || [],
        checklist: result.checklist || []
      }
    });

    res.status(201).json({
      id: plannedTrip.id,
      destination,
      days,
      itinerary: result.itinerary,
      checklist: result.checklist
    });
  } catch (error) {
    console.error('Generate itinerary error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate itinerary' });
  }
});

// Get all saved trips for user
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const trips = await prisma.plannedTrip.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        destinationName: true,
        photoUrl: true,
        days: true,
        startLocation: true,
        createdAt: true
      }
    });

    res.json(trips);
  } catch (error) {
    console.error('Get saved trips error:', error);
    res.status(500).json({ error: 'Failed to get saved trips' });
  }
});

// Get single saved trip with full details (owner or collaborator)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // First check if user is owner
    let trip = await prisma.plannedTrip.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      },
      include: {
        collaborators: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    let userRole = 'owner';

    // If not owner, check if user is a collaborator
    if (!trip) {
      trip = await prisma.plannedTrip.findFirst({
        where: {
          id: req.params.id,
          collaborators: {
            some: {
              userId: req.userId,
              status: 'accepted'
            }
          }
        },
        include: {
          collaborators: {
            include: {
              user: { select: { id: true, name: true, email: true } }
            }
          },
          user: { select: { id: true, name: true, email: true } }
        }
      });
      
      if (trip) {
        const collaborator = trip.collaborators.find(c => c.userId === req.userId);
        userRole = collaborator?.role || 'viewer';
      }
    }

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json({
      ...trip,
      userRole,
      isOwner: trip.userId === req.userId
    });
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ error: 'Failed to get trip' });
  }
});

// Update checklist item
router.patch('/:id/checklist', authenticateToken, async (req, res) => {
  try {
    const { itemId, completed } = req.body;

    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Update the checklist item
    const checklist = trip.checklist.map(item => 
      item.id === itemId ? { ...item, completed } : item
    );

    const updatedTrip = await prisma.plannedTrip.update({
      where: { id: req.params.id },
      data: { checklist }
    });

    res.json({ checklist: updatedTrip.checklist });
  } catch (error) {
    console.error('Update checklist error:', error);
    res.status(500).json({ error: 'Failed to update checklist' });
  }
});

// Delete saved trip
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    await prisma.plannedTrip.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Toggle trip visibility
router.patch('/:id/share', authenticateToken, async (req, res) => {
  try {
    const { isPublic } = req.body;
    
    // Verify ownership
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const updateData = { isPublic };

    // Generate shareId if it doesn't exist and we're enabling sharing
    if (isPublic && !trip.shareId) {
      updateData.shareId = randomUUID();
    }

    const updatedTrip = await prisma.plannedTrip.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({ 
      isPublic: updatedTrip.isPublic, 
      shareId: updatedTrip.shareId 
    });
  } catch (error) {
    console.error('Update share status error:', error);
    res.status(500).json({ error: 'Failed to update share status' });
  }
});

// Get public trip (no auth required)
router.get('/shared/:shareId', async (req, res) => {
  try {
    const trip = await prisma.plannedTrip.findUnique({
      where: { shareId: req.params.shareId },
      include: {
        budget: {
          select: {
            totalBudget: true,
            expenses: {
              select: { amount: true } // Only show total spent, not details
            }
          }
        }
      }
    });

    if (!trip || !trip.isPublic) {
      return res.status(404).json({ error: 'Trip not found or not public' });
    }

    // Return filtered data for public view (exclude user ID etc)
    const publicData = {
      destinationName: trip.destinationName,
      days: trip.days,
      startLocation: trip.startLocation,
      itinerary: trip.itinerary,
      photoUrl: trip.photoUrl,
      // Minimal budget info if available
      budgetStats: trip.budget ? {
        total: trip.budget.totalBudget,
        spent: trip.budget.expenses.reduce((sum, e) => sum + e.amount, 0)
      } : null
    };

    res.json(publicData);
  } catch (error) {
    console.error('Get shared trip error:', error);
    res.status(500).json({ error: 'Failed to get shared trip' });
  }
});

// Import/clone a public trip to user's account
router.post('/import/:shareId', authenticateToken, async (req, res) => {
  try {
    // Find the public trip by shareId
    const sourceTrip = await prisma.plannedTrip.findUnique({
      where: { shareId: req.params.shareId }
    });

    if (!sourceTrip || !sourceTrip.isPublic) {
      return res.status(404).json({ error: 'Trip not found or not publicly shared' });
    }

    // Reset checklist items to uncompleted
    const resetChecklist = (sourceTrip.checklist || []).map(item => ({
      ...item,
      completed: false
    }));

    // Clone the trip for the current user
    const newTrip = await prisma.plannedTrip.create({
      data: {
        userId: req.userId,
        destinationName: sourceTrip.destinationName,
        destinationLat: sourceTrip.destinationLat,
        destinationLng: sourceTrip.destinationLng,
        photoUrl: sourceTrip.photoUrl,
        days: sourceTrip.days,
        startLocation: sourceTrip.startLocation,
        itinerary: sourceTrip.itinerary,
        checklist: resetChecklist,
        // New trip starts as private, user can share later if they want
        isPublic: false,
        shareId: randomUUID()
      }
    });

    res.status(201).json({
      tripId: newTrip.id,
      message: 'Trip imported successfully! You can now customize it and invite your friends.'
    });
  } catch (error) {
    console.error('Import trip error:', error);
    res.status(500).json({ error: 'Failed to import trip' });
  }
});

export default router;
