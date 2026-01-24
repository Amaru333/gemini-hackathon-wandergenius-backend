import express from 'express';

const router = express.Router();

// Geocode a location name to coordinates using Google Maps Geocoding API
router.get('/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      const { lat, lng } = result.geometry.location;
      
      // Get a short name from the formatted address
      const shortName = result.address_components?.[0]?.long_name || 
                        address.split(',')[0].trim();
      
      res.json({
        name: shortName,
        lat,
        lng,
        formattedAddress: result.formatted_address
      });
    } else if (data.status === 'ZERO_RESULTS') {
      res.status(404).json({ error: 'Location not found' });
    } else {
      console.error('Geocoding error:', data.status, data.error_message);
      res.status(500).json({ error: data.error_message || 'Geocoding failed' });
    }
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Batch geocode multiple addresses
router.post('/geocode/batch', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const results = [];
    
    // Process sequentially to respect rate limits
    for (const address of addresses.slice(0, 10)) { // Max 10 addresses
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
          const result = data.results[0];
          const { lat, lng } = result.geometry.location;
          const shortName = result.address_components?.[0]?.long_name || 
                            address.split(',')[0].trim();
          
          results.push({
            address,
            name: shortName,
            lat,
            lng,
            success: true
          });
        } else {
          results.push({
            address,
            success: false,
            error: data.status
          });
        }
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        results.push({
          address,
          success: false,
          error: 'Request failed'
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Batch geocode error:', error);
    res.status(500).json({ error: 'Failed to batch geocode addresses' });
  }
});

export default router;
