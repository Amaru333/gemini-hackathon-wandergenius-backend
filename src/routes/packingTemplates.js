import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user's packing templates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const templates = await prisma.packingTemplate.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        items: true,
        createdAt: true
      }
    });

    res.json(templates);
  } catch (error) {
    console.error('Get packing templates error:', error);
    res.status(500).json({ error: 'Failed to get packing templates' });
  }
});

// Save a packing list as template
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, items } = req.body;

    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Name and items array are required' });
    }

    // Reset completed status for template items
    const templateItems = items.map((item, index) => ({
      id: index + 1,
      task: item.task,
      category: item.category,
      completed: false
    }));

    const template = await prisma.packingTemplate.create({
      data: {
        userId: req.userId,
        name,
        items: templateItems
      }
    });

    res.status(201).json({
      id: template.id,
      name: template.name,
      items: template.items,
      createdAt: template.createdAt
    });
  } catch (error) {
    console.error('Create packing template error:', error);
    res.status(500).json({ error: 'Failed to create packing template' });
  }
});

// Delete a packing template
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const template = await prisma.packingTemplate.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await prisma.packingTemplate.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete packing template error:', error);
    res.status(500).json({ error: 'Failed to delete packing template' });
  }
});

// Apply a template to a trip
router.post('/:id/apply/:tripId', authenticateToken, async (req, res) => {
  try {
    // Verify template ownership
    const template = await prisma.packingTemplate.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Verify trip ownership
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: req.params.tripId,
        userId: req.userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Apply template items to trip (reset completed status)
    const newChecklist = template.items.map((item, index) => ({
      ...item,
      id: index + 1,
      completed: false
    }));

    const updatedTrip = await prisma.plannedTrip.update({
      where: { id: req.params.tripId },
      data: { checklist: newChecklist }
    });

    res.json({ 
      message: 'Template applied successfully',
      checklist: updatedTrip.checklist 
    });
  } catch (error) {
    console.error('Apply packing template error:', error);
    res.status(500).json({ error: 'Failed to apply packing template' });
  }
});

export default router;
