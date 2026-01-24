import express from 'express';

const router = express.Router();

// Get weather data for a location by coordinates
router.get('/', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenWeatherMap API key not configured' });
    }

    // Fetch current weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`;
    const currentResponse = await fetch(currentUrl);
    const currentData = await currentResponse.json();

    if (currentData.cod !== 200) {
      console.error('Weather API error:', currentData.message);
      return res.status(500).json({ error: currentData.message || 'Failed to fetch weather' });
    }

    // Fetch 5-day forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`;
    const forecastResponse = await fetch(forecastUrl);
    const forecastData = await forecastResponse.json();

    // Process forecast to get daily summaries (one per day at noon)
    const dailyForecast = [];
    const processedDates = new Set();
    
    if (forecastData.list) {
      for (const item of forecastData.list) {
        const date = item.dt_txt.split(' ')[0];
        const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0]);
        
        // Pick the noon reading for each day, or closest available
        if (!processedDates.has(date) && (hour === 12 || hour === 15)) {
          processedDates.add(date);
          dailyForecast.push({
            date: date,
            dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            temp: Math.round(item.main.temp),
            tempMin: Math.round(item.main.temp_min),
            tempMax: Math.round(item.main.temp_max),
            condition: item.weather[0].main,
            description: item.weather[0].description,
            icon: item.weather[0].icon
          });
        }
        
        if (dailyForecast.length >= 5) break;
      }
    }

    res.json({
      current: {
        temp: Math.round(currentData.main.temp),
        feelsLike: Math.round(currentData.main.feels_like),
        tempMin: Math.round(currentData.main.temp_min),
        tempMax: Math.round(currentData.main.temp_max),
        humidity: currentData.main.humidity,
        windSpeed: Math.round(currentData.wind.speed * 3.6), // Convert m/s to km/h
        condition: currentData.weather[0].main,
        description: currentData.weather[0].description,
        icon: currentData.weather[0].icon
      },
      location: currentData.name,
      forecast: dailyForecast
    });
  } catch (error) {
    console.error('Weather fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

export default router;
