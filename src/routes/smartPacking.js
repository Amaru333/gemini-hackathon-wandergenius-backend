import express from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const MODEL_NAME = 'gemini-2.5-flash';

// Get weather forecast for a destination
async function getWeatherForecast(lat, lng) {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey || !lat || !lng) return null;

  try {
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`;
    const response = await fetch(forecastUrl);
    const data = await response.json();

    if (!data.list) return null;

    // Extract daily weather summaries
    const dailyForecast = [];
    const processedDates = new Set();

    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0]);

      if (!processedDates.has(date) && (hour === 12 || hour === 15)) {
        processedDates.add(date);
        dailyForecast.push({
          date,
          temp: Math.round(item.main.temp),
          tempMin: Math.round(item.main.temp_min),
          tempMax: Math.round(item.main.temp_max),
          condition: item.weather[0].main,
          description: item.weather[0].description,
          humidity: item.main.humidity,
          windSpeed: Math.round(item.wind.speed * 3.6)
        });
      }

      if (dailyForecast.length >= 7) break;
    }

    return dailyForecast;
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
}

// Extract activities from itinerary
function extractActivities(itinerary) {
  if (!itinerary || !Array.isArray(itinerary)) return [];

  const activities = new Set();
  const activityKeywords = {
    hiking: ['hike', 'hiking', 'trail', 'trek', 'trekking', 'mountain', 'walk', 'walking tour'],
    beach: ['beach', 'swimming', 'snorkel', 'snorkeling', 'ocean', 'surf', 'surfing', 'coastal'],
    water: ['kayak', 'boat', 'cruise', 'rafting', 'diving', 'scuba', 'water park', 'waterfall'],
    cultural: ['museum', 'temple', 'church', 'cathedral', 'historic', 'heritage', 'tour', 'gallery'],
    dining: ['restaurant', 'dinner', 'lunch', 'breakfast', 'food tour', 'cooking class', 'market'],
    adventure: ['zipline', 'bungee', 'skydiving', 'climbing', 'adventure', 'safari', 'wildlife'],
    nightlife: ['bar', 'club', 'nightlife', 'pub', 'rooftop', 'entertainment'],
    shopping: ['shopping', 'mall', 'market', 'bazaar', 'souvenir'],
    relaxation: ['spa', 'massage', 'resort', 'pool', 'relax', 'yoga'],
    photography: ['photo', 'viewpoint', 'scenic', 'sunrise', 'sunset', 'panorama'],
    winter: ['ski', 'skiing', 'snowboard', 'ice skating', 'snow', 'sledding']
  };

  for (const day of itinerary) {
    if (day.activities && Array.isArray(day.activities)) {
      for (const activity of day.activities) {
        const text = `${activity.activity || ''} ${activity.description || ''} ${activity.location || ''}`.toLowerCase();
        
        for (const [category, keywords] of Object.entries(activityKeywords)) {
          if (keywords.some(keyword => text.includes(keyword))) {
            activities.add(category);
          }
        }
      }
    }
  }

  return Array.from(activities);
}

// AI Smart Packing Advisor endpoint
router.post('/optimize', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.body;

    if (!tripId) {
      return res.status(400).json({ error: 'Trip ID is required' });
    }

    // Get trip details
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
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get user profile for personalization
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.userId }
    });

    // Get weather forecast if coordinates available
    let weatherForecast = null;
    if (trip.destinationLat && trip.destinationLng) {
      weatherForecast = await getWeatherForecast(trip.destinationLat, trip.destinationLng);
    }

    // Extract planned activities from itinerary
    const activities = extractActivities(trip.itinerary);

    // Prepare weather context for AI
    const weatherContext = weatherForecast && weatherForecast.length > 0
      ? `
        WEATHER FORECAST:
        ${weatherForecast.slice(0, trip.days).map((day, i) => 
          `Day ${i + 1}: ${day.temp}°C (${day.tempMin}°C - ${day.tempMax}°C), ${day.condition} (${day.description}), Humidity: ${day.humidity}%, Wind: ${day.windSpeed} km/h`
        ).join('\n')}
        
        Weather Summary:
        - Average Temperature: ${Math.round(weatherForecast.reduce((sum, d) => sum + d.temp, 0) / weatherForecast.length)}°C
        - Conditions: ${[...new Set(weatherForecast.map(d => d.condition))].join(', ')}
        - Rain Expected: ${weatherForecast.some(d => ['Rain', 'Drizzle', 'Thunderstorm'].includes(d.condition)) ? 'Yes' : 'No'}
      `
      : 'Weather forecast unavailable - suggest items for typical conditions at this destination.';

    // Generate AI packing suggestions
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `
      You are an expert travel packing advisor with extensive knowledge of destinations worldwide.
      Your role is to generate highly personalized, practical packing lists based on:
      1. Real weather forecasts for the travel dates
      2. Planned activities and itinerary
      3. Trip duration and destination characteristics
      4. User's travel style and any constraints
      
      BE SPECIFIC AND PRACTICAL - avoid generic suggestions. Every item should have a reason based on the trip context.
    `;

    const prompt = `
      Generate a smart packing list for this trip:
      
      TRIP DETAILS:
      - Destination: ${trip.destinationName}
      - Duration: ${trip.days} days
      - Starting from: ${trip.startLocation}
      
      ${weatherContext}
      
      PLANNED ACTIVITIES: ${activities.length > 0 ? activities.join(', ') : 'General sightseeing and exploration'}
      
      USER PROFILE:
      - Travel Style: ${profile?.travelStyle || 'Not specified'}
      - Interests: ${profile?.interests?.join(', ') || 'General travel'}
      - Constraints: ${profile?.constraints || 'None'}
      
      CURRENT PACKING LIST (for reference, avoid duplicates):
      ${trip.checklist?.map(item => `- ${item.task}`).join('\n') || 'No existing items'}
      
      Generate a comprehensive, weather-aware packing list. Respond with ONLY valid JSON in this exact format:
      {
        "items": [
          {
            "task": "Item name",
            "category": "clothing|toiletries|documents|gear",
            "reason": "Why this item is needed",
            "priority": "essential|recommended|optional",
            "weatherRelated": true/false
          }
        ],
        "tips": [
          "Practical packing tip 1",
          "Practical packing tip 2"
        ],
        "warnings": [
          "Important reminder or warning"
        ],
        "weatherSummary": "Brief weather summary and how it affects packing"
      }
      
      IMPORTANT RULES:
      1. Generate 20-30 items total across all categories
      2. At least 5 items should be weather-specific based on the forecast
      3. Include activity-specific gear for ${activities.join(', ') || 'general exploration'}
      4. Mark "essential" items that should not be forgotten
      5. Include 2-3 "don't forget" warnings for commonly forgotten items
      6. Provide 3-5 practical tips specific to this destination and weather
      7. Categories MUST be one of: "clothing", "toiletries", "documents", "gear"
      8. Avoid items that are already in the current packing list
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    let result;
    try {
      const text = response.text || '';
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return res.status(500).json({ error: 'Failed to generate packing suggestions' });
    }

    // Process and format the response
    const formattedItems = (result.items || []).map((item, index) => ({
      id: 1000 + index, // Start from 1000 to avoid conflicts with existing items
      task: item.task,
      category: item.category,
      completed: false,
      reason: item.reason,
      priority: item.priority || 'recommended',
      weatherRelated: item.weatherRelated || false,
      isAiSuggested: true
    }));

    res.json({
      suggestions: {
        items: formattedItems,
        tips: result.tips || [],
        warnings: result.warnings || [],
        weatherSummary: result.weatherSummary || null
      },
      tripInfo: {
        destination: trip.destinationName,
        days: trip.days,
        activities: activities
      },
      weather: weatherForecast ? {
        available: true,
        forecast: weatherForecast.slice(0, trip.days)
      } : {
        available: false
      }
    });
  } catch (error) {
    console.error('Smart packing error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate smart packing list' });
  }
});

// Apply AI suggestions to trip packing list
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { tripId, items, mode } = req.body;

    if (!tripId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Trip ID and items array are required' });
    }

    // Verify trip ownership
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        userId: req.userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    let newChecklist;

    if (mode === 'replace') {
      // Replace entire checklist with AI suggestions
      newChecklist = items.map((item, index) => ({
        id: index + 1,
        task: item.task,
        category: item.category,
        completed: false
      }));
    } else {
      // Merge with existing checklist (default behavior)
      const existingItems = trip.checklist || [];
      const existingTasks = new Set(existingItems.map(i => i.task.toLowerCase()));
      
      // Filter out duplicates and add new items
      const newItems = items
        .filter(item => !existingTasks.has(item.task.toLowerCase()))
        .map((item, index) => ({
          id: existingItems.length + index + 1,
          task: item.task,
          category: item.category,
          completed: false
        }));

      newChecklist = [...existingItems, ...newItems];
    }

    const updatedTrip = await prisma.plannedTrip.update({
      where: { id: tripId },
      data: { checklist: newChecklist }
    });

    res.json({
      message: mode === 'replace' 
        ? 'Packing list replaced with AI suggestions'
        : 'AI suggestions merged with existing list',
      checklist: updatedTrip.checklist,
      itemsAdded: mode === 'replace' ? newChecklist.length : newChecklist.length - (trip.checklist?.length || 0)
    });
  } catch (error) {
    console.error('Apply packing suggestions error:', error);
    res.status(500).json({ error: 'Failed to apply packing suggestions' });
  }
});

export default router;
