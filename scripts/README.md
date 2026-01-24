# Database Seeding Script

This script populates the database with sample data for testing and development.

## What it creates:

- **4 sample users** with profiles (interests, hobbies, travel styles)
- **12-28 planned trips** (3-7 per user) with itineraries and checklists
- **Reviews** for public trips (1-3 reviews per trip)
- **Badges** based on user activity (trips, reviews, destinations)
- **Budgets and expenses** for some trips
- **Packing templates** for each user
- **Trip photos** for a few trips

## Usage:

```bash
# From the backend directory
npm run seed
```

## Test Accounts:

All accounts use password: `password123`

- alice@example.com (Alice Johnson)
- bob@example.com (Bob Smith)
- charlie@example.com (Charlie Brown)
- diana@example.com (Diana Prince)

## Note:

The script will **clear all existing data** before seeding. If you want to keep existing data, comment out the deletion section in the script.
