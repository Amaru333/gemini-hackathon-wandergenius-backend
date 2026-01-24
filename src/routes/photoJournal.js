import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all photos for a trip (organized by day)
router.get('/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId;

    // Check if user has access to this trip
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        OR: [
          { userId },
          { collaborators: { some: { userId, status: 'accepted' } } }
        ]
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }

    const photos = await prisma.tripPhoto.findMany({
      where: { tripId },
      orderBy: [
        { day: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Organize photos by day
    const photosByDay = {};
    for (let i = 1; i <= trip.days; i++) {
      photosByDay[i] = [];
    }
    
    photos.forEach(photo => {
      if (photosByDay[photo.day]) {
        photosByDay[photo.day].push(photo);
      }
    });

    res.json({
      tripId,
      destinationName: trip.destinationName,
      days: trip.days,
      totalPhotos: photos.length,
      photosByDay
    });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

// Get public trip album (no auth required)
router.get('/album/:shareId', optionalAuth, async (req, res) => {
  try {
    const { shareId } = req.params;

    const trip = await prisma.plannedTrip.findFirst({
      where: {
        shareId,
        isPublic: true,
        isPhotoAlbumPublic: true  // Photo album must be explicitly enabled
      },
      include: {
        user: {
          select: { id: true, name: true }
        },
        photos: {
          orderBy: [
            { day: 'asc' },
            { sortOrder: 'asc' },
            { createdAt: 'asc' }
          ]
        }
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip album not found or not public' });
    }

    // Organize photos by day
    const photosByDay = {};
    for (let i = 1; i <= trip.days; i++) {
      photosByDay[i] = [];
    }
    
    trip.photos.forEach(photo => {
      if (photosByDay[photo.day]) {
        photosByDay[photo.day].push({
          id: photo.id,
          imageUrl: photo.imageUrl,
          thumbnailUrl: photo.thumbnailUrl,
          caption: photo.caption,
          location: photo.location,
          takenAt: photo.takenAt
        });
      }
    });

    res.json({
      tripId: trip.id,
      shareId: trip.shareId,
      destinationName: trip.destinationName,
      startLocation: trip.startLocation,
      days: trip.days,
      photoUrl: trip.photoUrl,
      owner: { name: trip.user.name },
      itinerary: trip.itinerary,
      totalPhotos: trip.photos.length,
      photosByDay
    });
  } catch (error) {
    console.error('Get public album error:', error);
    res.status(500).json({ error: 'Failed to get album' });
  }
});

// Add a photo to a trip day
router.post('/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId;
    const { day, imageUrl, thumbnailUrl, caption, location, latitude, longitude, takenAt } = req.body;

    if (!day || !imageUrl) {
      return res.status(400).json({ error: 'Day and imageUrl are required' });
    }

    // Check if user has access to this trip (owner or collaborator with editor role)
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        OR: [
          { userId },
          { collaborators: { some: { userId, status: 'accepted', role: { in: ['owner', 'editor'] } } } }
        ]
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }

    if (day < 1 || day > trip.days) {
      return res.status(400).json({ error: `Day must be between 1 and ${trip.days}` });
    }

    // Get the next sort order for this day
    const maxOrder = await prisma.tripPhoto.aggregate({
      where: { tripId, day },
      _max: { sortOrder: true }
    });

    const photo = await prisma.tripPhoto.create({
      data: {
        tripId,
        day,
        imageUrl,
        thumbnailUrl,
        caption,
        location,
        latitude,
        longitude,
        takenAt: takenAt ? new Date(takenAt) : null,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1
      }
    });

    res.status(201).json(photo);
  } catch (error) {
    console.error('Add photo error:', error);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

// Update a photo (caption, location, etc.)
router.patch('/:tripId/photo/:photoId', authenticateToken, async (req, res) => {
  try {
    const { tripId, photoId } = req.params;
    const userId = req.userId;
    const { caption, location, day, sortOrder } = req.body;

    // Check access
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        OR: [
          { userId },
          { collaborators: { some: { userId, status: 'accepted', role: { in: ['owner', 'editor'] } } } }
        ]
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }

    // Verify photo belongs to this trip
    const existingPhoto = await prisma.tripPhoto.findFirst({
      where: { id: photoId, tripId }
    });

    if (!existingPhoto) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const updateData = {};
    if (caption !== undefined) updateData.caption = caption;
    if (location !== undefined) updateData.location = location;
    if (day !== undefined && day >= 1 && day <= trip.days) updateData.day = day;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const photo = await prisma.tripPhoto.update({
      where: { id: photoId },
      data: updateData
    });

    res.json(photo);
  } catch (error) {
    console.error('Update photo error:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// Delete a photo
router.delete('/:tripId/photo/:photoId', authenticateToken, async (req, res) => {
  try {
    const { tripId, photoId } = req.params;
    const userId = req.userId;

    // Check access
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        OR: [
          { userId },
          { collaborators: { some: { userId, status: 'accepted', role: { in: ['owner', 'editor'] } } } }
        ]
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }

    // Verify photo belongs to this trip
    const existingPhoto = await prisma.tripPhoto.findFirst({
      where: { id: photoId, tripId }
    });

    if (!existingPhoto) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    await prisma.tripPhoto.delete({
      where: { id: photoId }
    });

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Reorder photos within a day
router.patch('/:tripId/reorder', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId;
    const { day, photoIds } = req.body; // photoIds in desired order

    if (!day || !Array.isArray(photoIds)) {
      return res.status(400).json({ error: 'Day and photoIds array are required' });
    }

    // Check access
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        OR: [
          { userId },
          { collaborators: { some: { userId, status: 'accepted', role: { in: ['owner', 'editor'] } } } }
        ]
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }

    // Update sort order for each photo
    await Promise.all(
      photoIds.map((photoId, index) =>
        prisma.tripPhoto.updateMany({
          where: { id: photoId, tripId, day },
          data: { sortOrder: index + 1 }
        })
      )
    );

    res.json({ message: 'Photos reordered successfully' });
  } catch (error) {
    console.error('Reorder photos error:', error);
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

// Get trip photo stats
router.get('/:tripId/stats', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId;

    // Check access
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        OR: [
          { userId },
          { collaborators: { some: { userId, status: 'accepted' } } }
        ]
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or access denied' });
    }

    const stats = await prisma.tripPhoto.groupBy({
      by: ['day'],
      where: { tripId },
      _count: { id: true }
    });

    const photoCountByDay = {};
    for (let i = 1; i <= trip.days; i++) {
      const dayStat = stats.find(s => s.day === i);
      photoCountByDay[i] = dayStat?._count.id || 0;
    }

    const totalPhotos = stats.reduce((acc, s) => acc + s._count.id, 0);
    const locations = await prisma.tripPhoto.findMany({
      where: { tripId, location: { not: null } },
      select: { location: true },
      distinct: ['location']
    });

    res.json({
      totalPhotos,
      photoCountByDay,
      uniqueLocations: locations.map(l => l.location)
    });
  } catch (error) {
    console.error('Get photo stats error:', error);
    res.status(500).json({ error: 'Failed to get photo stats' });
  }
});

// Toggle photo album public visibility
router.patch('/:tripId/share', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.userId;
    const { isPhotoAlbumPublic } = req.body;

    if (typeof isPhotoAlbumPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPhotoAlbumPublic must be a boolean' });
    }

    // Only trip owner can toggle this
    const trip = await prisma.plannedTrip.findFirst({
      where: {
        id: tripId,
        userId
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or you are not the owner' });
    }

    const updatedTrip = await prisma.plannedTrip.update({
      where: { id: tripId },
      data: { isPhotoAlbumPublic },
      select: {
        id: true,
        isPhotoAlbumPublic: true,
        isPublic: true,
        shareId: true
      }
    });

    res.json(updatedTrip);
  } catch (error) {
    console.error('Toggle photo album share error:', error);
    res.status(500).json({ error: 'Failed to toggle photo album sharing' });
  }
});

export default router;
