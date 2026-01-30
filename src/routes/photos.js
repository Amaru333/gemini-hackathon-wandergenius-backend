import express from 'express';

const router = express.Router();

// Helper to get the base URL from the request (works in both dev and production)
const getBaseUrl = (req) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
};

// Proxy endpoint to serve Google Places photos (bypasses CORS)
router.get('/proxy', async (req, res) => {
  try {
    const { photoRef, maxWidth = 1200 } = req.query;
    
    if (!photoRef) {
      return res.status(400).json({ error: 'photoRef is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoRef}&key=${apiKey}`;
    
    // Fetch the image from Google
    const imageResponse = await fetch(googleUrl);
    
    if (!imageResponse.ok) {
      return res.status(imageResponse.status).json({ error: 'Failed to fetch image from Google' });
    }

    // Get the content type and forward it
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Stream the image data to the response
    const arrayBuffer = await imageResponse.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Photo proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy photo' });
  }
});

// Get photo URL for a place using Google Places API
router.get('/place', async (req, res) => {
  try {
    const { placeId, maxWidth = 1200 } = req.query;
    
    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    // First, get place details to get photo reference
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos,name&key=${apiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.length) {
      return res.json({ photoUrl: null, error: 'No photos found' });
    }

    // Get the first photo reference
    const photoReference = detailsData.result.photos[0].photo_reference;
    
    // Return proxied URL instead of direct Google URL
    const baseUrl = getBaseUrl(req);
    const photoUrl = `${baseUrl}/api/photos/proxy?photoRef=${encodeURIComponent(photoReference)}&maxWidth=${maxWidth}`;

    res.json({
      photoUrl,
      name: detailsData.result.name
    });
  } catch (error) {
    console.error('Photo fetch error:', error);
    res.status(500).json({ error: 'Failed to get photo' });
  }
});

// Search for a place and get its photo
router.get('/search', async (req, res) => {
  try {
    const { query, maxWidth = 1200 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    // Helper function to search for a place
    const searchPlace = async (searchQuery) => {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id,name,photos,formatted_address&key=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      return searchResponse.json();
    };

    // Try different search strategies
    let searchData = await searchPlace(query);
    
    // If first search fails, try with just the main location name (before comma)
    if (searchData.status !== 'OK' || !searchData.candidates?.length) {
      const mainLocation = query.split(',')[0].trim();
      if (mainLocation !== query) {
        searchData = await searchPlace(mainLocation);
      }
    }
    
    // If still no results, try adding "tourist destination" for better matching
    if (searchData.status !== 'OK' || !searchData.candidates?.length) {
      const mainLocation = query.split(',')[0].trim();
      searchData = await searchPlace(`${mainLocation} tourist destination`);
    }

    if (searchData.status !== 'OK' || !searchData.candidates?.length) {
      return res.json({ photoUrl: null, error: 'Place not found' });
    }

    const place = searchData.candidates[0];
    
    if (!place.photos?.length) {
      return res.json({ 
        photoUrl: null, 
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address
      });
    }

    const photoReference = place.photos[0].photo_reference;
    // Return proxied URL instead of direct Google URL
    const baseUrl = getBaseUrl(req);
    const photoUrl = `${baseUrl}/api/photos/proxy?photoRef=${encodeURIComponent(photoReference)}&maxWidth=${maxWidth}`;

    res.json({
      photoUrl,
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address
    });
  } catch (error) {
    console.error('Photo search error:', error);
    res.status(500).json({ error: 'Failed to search for photo' });
  }
});

export default router;
