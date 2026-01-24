import express from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const MODEL_NAME = 'gemini-2.5-flash';

// Generate trip recommendations
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { startLocation, radiusOrTime, days, travelMode, customInput, userLocation } = req.body;

    if (!startLocation || !radiusOrTime || !days) {
      return res.status(400).json({ error: 'Missing required trip parameters' });
    }

    // Get user profile
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(400).json({ error: 'Please complete your profile first' });
    }

    // Generate recommendations with Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `
      You are WanderGenius, a premium AI travel strategist.
      
      CORE MISSION:
      Identify 3-5 distinct vacation destinations (Cities, National Parks, Regions, or Scenic Towns) reachable from the starting point.
      
      STRICT CONTENT RULES:
      1. EXCLUDE all local businesses, utility services, and mundane entities. 
      2. NEVER suggest: driving schools, DMV offices, grocery stores, gas stations, repair shops, or medical clinics.
      3. FOCUS ON: Iconic landmarks, geographic regions (e.g., 'The Blue Ridge Mountains'), historic cities (e.g., 'Charleston, SC'), or natural wonders.
      4. PERSONALIZATION: Connect the destination directly to the user's specific hobbies (${profile.hobbies.join(', ')}) and interests (${profile.interests.join(', ')}).
      
      FORMAT REQUIREMENT:
      You must strictly follow this Markdown format. Do not use JSON. Use '##' for the destination name.
      
      Pattern for each destination:
      ## [Destination Name, Region]
      - **Why it fits:** [Personalized explanation]
      - **Travel Info:** [Estimated time/distance and mode]
      - **Suggested Duration:** [Days]
      - **Budget Estimate:** [Daily cost range, e.g. "$80-150/day" with category: Budget/Mid-Range/Luxury]
      - **Key Highlights:** [Bullet points of 3-4 specific activities]
    `;

    const prompt = `
      Find travel destinations for a ${days}-day trip starting from ${startLocation}.
      The user is looking for a ${profile.travelStyle} experience.
      Max travel constraint: ${radiusOrTime}.
      Mode: ${travelMode}.
      
      User Hobbies: ${profile.hobbies.join(', ')}.
      User Interests: ${profile.interests.join(', ')}.
      Additional Constraints: ${profile.constraints || 'None'}.
      ${customInput ? `\nCustom Trip Description: ${customInput}\nPlease prioritize these specific preferences and requirements when suggesting destinations.` : ''}
      
      Please suggest 3-5 high-quality travel spots.
    `;

    const config = {
      systemInstruction: systemInstruction,
      tools: [{ googleMaps: {} }],
    };

    if (userLocation) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: config,
    });

    const text = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Log full grounding metadata for debugging
    console.log('Grounding Metadata:', JSON.stringify(response.candidates?.[0]?.groundingMetadata, null, 2));

    // Filter grounding chunks
    const forbiddenKeywords = [
      'school', 'dmv', 'office', 'license', 'grocery', 'market', 'repair', 'service', 
      'clinic', 'hospital', 'driving', 'instruction', 'department', 'utility', 'bank'
    ];

    const validGroundingChunks = groundingChunks
      .filter(chunk => {
        const title = chunk.maps?.title?.toLowerCase() || "";
        return !forbiddenKeywords.some(keyword => title.includes(keyword));
      })
      .map(chunk => {
        // Extract lat/lng if available in the maps data
        // Google Maps grounding may include coordinates in various formats
        const mapsData = chunk.maps || {};
        return {
          ...chunk,
          maps: {
            ...mapsData,
            // Coordinates may be in the URI as query params or in dedicated fields
            coordinates: mapsData.latLng || mapsData.coordinates || extractCoordsFromUri(mapsData.uri)
          }
        };
      });

    // Helper function to extract coordinates from Google Maps URI if present
    function extractCoordsFromUri(uri) {
      if (!uri) return null;
      // Try to extract from @lat,lng format in Google Maps URLs
      const match = uri.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (match) {
        return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
      }
      // Try to extract from query params like ?q=lat,lng
      const queryMatch = uri.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (queryMatch) {
        return { latitude: parseFloat(queryMatch[1]), longitude: parseFloat(queryMatch[2]) };
      }
      return null;
    }

    // Save trip to database
    const trip = await prisma.trip.create({
      data: {
        userId: req.userId,
        startLocation,
        radiusOrTime,
        days,
        travelMode,
        recommendations: text,
        groundingChunks: validGroundingChunks
      }
    });

    res.status(201).json({
      tripId: trip.id,
      text,
      groundingChunks: validGroundingChunks
    });
  } catch (error) {
    console.error('Generate trip error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate recommendations' });
  }
});

// Get all trips for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        startLocation: true,
        days: true,
        travelMode: true,
        createdAt: true
      }
    });

    res.json(trips);
  } catch (error) {
    console.error('Get trips error:', error);
    res.status(500).json({ error: 'Failed to get trips' });
  }
});

// Get single trip
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json(trip);
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({ error: 'Failed to get trip' });
  }
});

// Delete trip
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    await prisma.trip.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Get personalized trip suggestions based on past reviews
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    // Get user's past reviews with comments
    const reviews = await prisma.tripReview.findMany({
      where: { userId: req.userId },
      include: {
        trip: {
          select: {
            destinationName: true,
            days: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10 // Get last 10 reviews
    });

    // If user has no reviews, return empty suggestions
    if (reviews.length === 0) {
      return res.json({
        suggestions: [],
        message: 'Complete and review trips to get personalized suggestions!'
      });
    }

    // Get user profile for context
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.userId }
    });

    // Analyze reviews to extract preferences
    const reviewAnalysis = reviews.map(r => ({
      destination: r.trip.destinationName,
      overallRating: r.overallRating,
      budgetRating: r.budgetRating,
      locationRating: r.locationRating,
      activitiesRating: r.activitiesRating,
      comment: r.comment || '',
      days: r.trip.days
    }));

    // Use AI to generate personalized suggestions based on review patterns
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `
      You are WanderGenius, a premium AI travel strategist specializing in personalized trip recommendations.
      
      Your task is to analyze a user's past trip reviews and comments to understand their travel preferences,
      then suggest what kind of trip they should take next.
      
      Focus on:
      - What destinations/experiences they rated highly
      - What they mentioned in their comments (likes, dislikes, preferences)
      - Patterns in their ratings (budget, location, activities)
      - Trip duration preferences
      
      Provide 3-5 specific, actionable trip suggestions that align with their past positive experiences.
      Each suggestion should include:
      - Type of trip/experience
      - Why it matches their preferences
      - What aspects they might enjoy based on their review history
    `;

    const prompt = `
      Analyze this user's travel review history and suggest their next trip:
      
      User Profile:
      - Travel Style: ${profile?.travelStyle || 'budget'}
      - Interests: ${profile?.interests.join(', ') || 'Not specified'}
      - Hobbies: ${profile?.hobbies.join(', ') || 'Not specified'}
      
      Past Reviews:
      ${reviewAnalysis.map((r, i) => `
        Review ${i + 1}:
        - Destination: ${r.destination}
        - Overall Rating: ${r.overallRating}/5
        - Budget Rating: ${r.budgetRating}/5
        - Location Rating: ${r.locationRating}/5
        - Activities Rating: ${r.activitiesRating}/5
        - Trip Duration: ${r.days} days
        - Comment: ${r.comment || 'No comment'}
      `).join('\n')}
      
      Based on these reviews, what kind of trip should this user take next? 
      Provide specific, personalized suggestions that match their preferences and past positive experiences.
      
      Format your response as a JSON array of suggestions, each with:
      - title: Short title for the suggestion
      - description: Why this trip matches their preferences
      - highlights: Array of 2-3 key aspects they'd enjoy
      - estimatedDays: Suggested trip duration
      
      Return ONLY valid JSON, no markdown or additional text.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    let suggestions = [];
    try {
      const text = response.text || '';
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: parse the entire response as JSON
        suggestions = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('Failed to parse AI suggestions:', parseError);
      // Fallback suggestions based on review analysis
      const avgRating = reviewAnalysis.reduce((sum, r) => sum + r.overallRating, 0) / reviewAnalysis.length;
      const avgDays = reviewAnalysis.reduce((sum, r) => sum + r.days, 0) / reviewAnalysis.length;
      
      if (avgRating >= 4) {
        suggestions = [{
          title: 'Similar High-Rated Experience',
          description: `Based on your excellent reviews, consider a similar ${Math.round(avgDays)}-day trip to destinations that match your preferences.`,
          highlights: ['Similar quality experiences', 'Matching your travel style', 'Based on your positive feedback'],
          estimatedDays: Math.round(avgDays)
        }];
      } else {
        suggestions = [{
          title: 'Try Something New',
          description: 'Explore a different type of destination to find what truly matches your preferences.',
          highlights: ['New experiences', 'Different travel style', 'Discover your preferences'],
          estimatedDays: Math.round(avgDays)
        }];
      }
    }

    res.json({
      suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [],
      reviewCount: reviews.length
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

export default router;
