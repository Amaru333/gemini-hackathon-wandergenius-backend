import express from 'express';
import { GoogleGenAI } from '@google/genai';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const MODEL_NAME = 'gemini-2.5-flash';

// Send a chat message and get AI response
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user profile for personalization
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.userId }
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `
      You are WanderGenius AI, a friendly and knowledgeable travel companion assistant.
      
      YOUR ROLE:
      - Answer travel-related questions helpfully and concisely
      - Provide practical tips, recommendations, and insights
      - Be conversational and engaging
      - Keep responses focused and under 200 words unless more detail is needed
      
      USER PROFILE:
      ${profile ? `
      - Interests: ${profile.interests?.join(', ') || 'Not specified'}
      - Hobbies: ${profile.hobbies?.join(', ') || 'Not specified'}
      - Travel Style: ${profile.travelStyle || 'Not specified'}
      - Constraints: ${profile.constraints || 'None'}
      ` : 'No profile available'}
      
      ${context?.destination ? `CURRENT DESTINATION: ${context.destination}` : ''}
      ${context?.tripDays ? `TRIP LENGTH: ${context.tripDays} days` : ''}
      
      GUIDELINES:
      1. Be helpful and specific with recommendations
      2. Consider the user's profile when giving advice
      3. For packing questions, consider weather and activities
      4. For timing questions, mention seasonal factors
      5. For budget questions, give ranges (budget/mid-range/luxury)
      6. Use emoji sparingly for friendliness ✈️
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: message,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const reply = response.text || "I'm sorry, I couldn't generate a response. Please try again.";

    res.json({
      reply,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to get response' });
  }
});

// Get travel tips for a specific topic
router.get('/tips', authenticateToken, async (req, res) => {
  try {
    const { topic, destination } = req.query;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `Give 3-5 quick, practical travel tips about "${topic}"${destination ? ` for ${destination}` : ''}. 
    Format as a JSON array of strings. Keep each tip under 50 words.
    Example: ["Tip 1", "Tip 2", "Tip 3"]`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    let tips = [];
    try {
      const text = response.text || '[]';
      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tips = JSON.parse(jsonMatch[0]);
      }
    } catch {
      tips = [response.text || 'No tips available'];
    }

    res.json({ tips, topic, destination });
  } catch (error) {
    console.error('Tips error:', error);
    res.status(500).json({ error: 'Failed to get tips' });
  }
});

export default router;
