# WanderGenius AI - Backend API

A robust Node.js/Express REST API powering the WanderGenius AI travel planning platform. Features AI-powered destination recommendations, real-time weather data, collaborative trip planning, and comprehensive travel management capabilities.

## Features

### AI & Intelligence
- **Google Gemini Integration**: AI-powered destination recommendations with Google Maps grounding
- **Personalized Suggestions**: Trip recommendations based on user review history and preferences
- **AI Chat Assistant**: Context-aware travel tips and advice

### Authentication & Users
- **JWT Authentication**: Secure token-based authentication
- **User Profiles**: Customizable travel preferences (interests, hobbies, travel style)
- **Public Profiles**: Shareable profile pages with stats and badges

### Trip Management
- **Trip Generation**: AI-generated destination recommendations
- **Itinerary Builder**: Day-by-day activity planning with AI assistance
- **Trip Sharing**: Public/private trip visibility controls
- **Photo Albums**: Trip photo storage with separate privacy controls

### Collaboration
- **Team Invitations**: Invite collaborators via email with role-based access
- **Activity Voting**: Collaborative decision-making on activities
- **Real-time Sync**: Shared editing of itineraries and checklists

### Social Features
- **Reviews & Ratings**: Multi-dimensional trip reviews (budget, location, activities, overall)
- **Leaderboards**: Community rankings by trips, states visited, and ratings
- **Achievement Badges**: Gamification with milestone rewards

### Tools & Utilities
- **Budget Tracker**: Expense management with cost splitting
- **Packing Templates**: Reusable packing lists
- **Weather API**: Real-time weather and forecasts via OpenWeatherMap
- **Geocoding**: Location search and coordinates

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime Environment |
| Express 4 | Web Framework |
| Prisma 5 | ORM & Database Toolkit |
| PostgreSQL | Database |
| JWT | Authentication |
| bcryptjs | Password Hashing |
| Google Gemini | AI/ML |
| OpenWeatherMap | Weather Data |
| Google Places | Photo & Location Data |

## Project Structure

```
backend/
├── src/
│   ├── index.js                # Express app entry point
│   │
│   ├── lib/
│   │   └── prisma.js           # Prisma client instance
│   │
│   ├── middleware/
│   │   └── auth.js             # JWT authentication middleware
│   │
│   └── routes/
│       ├── auth.js             # Authentication (register, login, me)
│       ├── badges.js           # User badges & stats
│       ├── budget.js           # Budget & expense tracking
│       ├── chat.js             # AI chat assistant
│       ├── collaboration.js    # Trip collaboration & invites
│       ├── geocode.js          # Location geocoding
│       ├── itinerary.js        # Itinerary CRUD operations
│       ├── leaderboards.js     # Community leaderboards
│       ├── packingTemplates.js # Packing list templates
│       ├── photoJournal.js     # Trip photo management
│       ├── photos.js           # Google Places photos
│       ├── profile.js          # User profile management
│       ├── reviews.js          # Trip reviews & ratings
│       ├── trips.js            # Trip generation & management
│       └── weather.js          # Weather data
│
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
│
├── scripts/
│   ├── seed.js                 # Database seeding script
│   └── README.md               # Seeding documentation
│
└── package.json                # Dependencies & scripts
```

## Database Schema

### Core Models

```
User                    UserProfile             Trip
├── id                  ├── id                  ├── id
├── email (unique)      ├── userId              ├── userId
├── passwordHash        ├── interests[]         ├── startLocation
├── name                ├── hobbies[]           ├── radiusOrTime
├── shareableId         ├── travelStyle         ├── days
├── createdAt           └── constraints         ├── travelMode
└── updatedAt                                   ├── recommendations (JSON)
                                                └── groundingChunks (JSON)

PlannedTrip             TripBudget              Expense
├── id                  ├── id                  ├── id
├── userId              ├── tripId              ├── budgetId
├── destinationName     ├── totalBudget         ├── amount
├── destinationLat/Lng  ├── currency            ├── category
├── photoUrl            └── participants[]      ├── description
├── days                                        ├── paidById
├── itinerary (JSON)                            └── splitWithIds[]
├── checklist (JSON)
├── isPublic
├── isPhotoAlbumPublic
└── shareId
```

### Social Models

```
TripReview              TripCollaborator        ActivityVote
├── id                  ├── id                  ├── id
├── tripId              ├── tripId              ├── tripId
├── userId              ├── userId              ├── day
├── budgetRating        ├── email               ├── activityIndex
├── locationRating      ├── role                ├── userId
├── activitiesRating    ├── inviteToken         └── vote
├── overallRating       └── status
└── comment

UserBadge               PackingTemplate         TripPhoto
├── id                  ├── id                  ├── id
├── userId              ├── userId              ├── tripId
├── badgeType           ├── name                ├── day
└── earnedAt            └── items (JSON)        ├── imageUrl
                                                ├── caption
                                                └── location
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn
- Google Gemini API key
- OpenWeatherMap API key
- Google Places API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   
   Create a `.env` file:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/wandergenius?schema=public"
   
   # Authentication
   JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
   
   # AI
   GEMINI_API_KEY="your-google-gemini-api-key"
   
   # Weather
   OPENWEATHER_API_KEY="your-openweathermap-api-key"
   
   # Google Places
   GOOGLE_PLACES_API_KEY="your-google-places-api-key"
   
   # Server
   PORT=5001
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

5. **Seed the database (optional)**
   ```bash
   npm run seed
   ```
   
   This creates sample users, trips, reviews, and badges for testing.

6. **Start the server**
   ```bash
   # Development (with auto-reload)
   npm run dev
   
   # Production
   npm start
   ```
   
   Server runs at `http://localhost:5001`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with auto-reload |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run seed` | Seed database with sample data |

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| GET | `/api/auth/me` | Get current user | Yes |

### Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/profile` | Get user profile | Yes |
| PUT | `/api/profile` | Update profile | Yes |

### Trips

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/trips/generate` | Generate AI recommendations | Yes |
| GET | `/api/trips` | List user's trips | Yes |
| GET | `/api/trips/:id` | Get trip details | Yes |
| DELETE | `/api/trips/:id` | Delete trip | Yes |
| GET | `/api/trips/suggestions` | Get personalized suggestions | Yes |

### Itinerary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/itinerary/generate` | Generate itinerary | Yes |
| GET | `/api/itinerary/saved` | List saved trips | Yes |
| GET | `/api/itinerary/:id` | Get itinerary | Yes |
| DELETE | `/api/itinerary/:id` | Delete itinerary | Yes |
| PATCH | `/api/itinerary/:id/checklist` | Update checklist | Yes |
| PATCH | `/api/itinerary/:id/share` | Toggle sharing | Yes |
| GET | `/api/itinerary/shared/:shareId` | Get public trip | No |
| POST | `/api/itinerary/import/:shareId` | Import shared trip | Yes |

### Reviews

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/reviews/recommended` | Get top-rated public trips | No |
| POST | `/api/reviews/:tripId` | Create/update review | Yes |
| GET | `/api/reviews/:tripId` | Get trip reviews | No |
| GET | `/api/reviews/:tripId/user` | Get user's review | Yes |
| DELETE | `/api/reviews/:tripId` | Delete review | Yes |

### Collaboration

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/collaboration/:tripId/invite` | Send invite | Yes |
| GET | `/api/collaboration/:tripId/collaborators` | List collaborators | Yes |
| DELETE | `/api/collaboration/:tripId/collaborator/:id` | Remove collaborator | Yes |
| GET | `/api/collaboration/invite/:token` | Get invite details | No |
| POST | `/api/collaboration/invite/:token/accept` | Accept invite | Yes |
| POST | `/api/collaboration/invite/:token/decline` | Decline invite | Yes |
| POST | `/api/collaboration/:tripId/vote` | Vote on activity | Yes |
| GET | `/api/collaboration/:tripId/votes` | Get votes | Yes |
| PATCH | `/api/collaboration/:tripId/itinerary` | Edit activity | Yes |

### Budget

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/budget/:tripId` | Get trip budget | Yes |
| POST | `/api/budget/:tripId/setup` | Setup budget | Yes |
| POST | `/api/budget/:tripId/expense` | Add expense | Yes |
| DELETE | `/api/budget/:tripId/expense/:id` | Delete expense | Yes |

### Badges & Stats

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/badges/check` | Check & award badges | Yes |
| GET | `/api/badges/my` | Get user's badges | Yes |
| GET | `/api/badges/stats` | Get travel stats | Yes |
| GET | `/api/badges/profile/:shareableId` | Get public profile | No |
| GET | `/api/badges/all` | List all badges | No |

### Leaderboards

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/leaderboards` | Get all leaderboards | No |

### Packing Templates

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/packing-templates` | List templates | Yes |
| POST | `/api/packing-templates` | Create template | Yes |
| DELETE | `/api/packing-templates/:id` | Delete template | Yes |
| POST | `/api/packing-templates/:id/apply/:tripId` | Apply to trip | Yes |

### Photo Journal

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/photo-journal/:tripId` | Get trip photos | Yes |
| POST | `/api/photo-journal/:tripId` | Add photo | Yes |
| PATCH | `/api/photo-journal/:tripId/photo/:photoId` | Update photo | Yes |
| DELETE | `/api/photo-journal/:tripId/photo/:photoId` | Delete photo | Yes |
| PATCH | `/api/photo-journal/:tripId/reorder` | Reorder photos | Yes |
| GET | `/api/photo-journal/:tripId/stats` | Get photo stats | Yes |
| PATCH | `/api/photo-journal/:tripId/share` | Toggle album sharing | Yes |
| GET | `/api/photo-journal/album/:shareId` | Get public album | No |

### Weather

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/weather?lat=X&lng=Y` | Get weather data | Yes |

### Chat

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/chat` | Send chat message | Yes |
| GET | `/api/chat/tips?topic=X` | Get travel tips | Yes |

### Photos (Google Places)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/photos/search?query=X` | Search place photos | Yes |

### Geocoding

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/geocode?q=X` | Geocode location | Yes |

### Health Check

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Server health status | No |

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Token Format
```
Authorization: Bearer <jwt_token>
```

### Token Payload
```json
{
  "userId": "uuid",
  "iat": 1234567890,
  "exp": 1234567890
}
```

Tokens expire after 7 days.

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

## Database Seeding

The seed script creates sample data for development/testing:

### What It Creates
- 4 sample users with profiles
- 12-28 planned trips with itineraries
- Reviews for public trips
- Badges based on user activity
- Budgets and expenses
- Packing templates
- Trip photos

### Test Accounts
All accounts use password: `password123`

| Email | Name |
|-------|------|
| alice@example.com | Alice Johnson |
| bob@example.com | Bob Smith |
| charlie@example.com | Charlie Brown |
| diana@example.com | Diana Prince |

### Running the Seed

```bash
npm run seed
```

**Warning**: This clears all existing data before seeding.

## CORS Configuration

The API allows requests from:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

To add more origins, update `src/index.js`:

```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'http://your-domain.com'],
  credentials: true
}));
```

## Rate Limiting

Currently no rate limiting is implemented. For production, consider adding:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.
