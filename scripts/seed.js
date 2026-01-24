import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Sample data
const sampleUsers = [
  {
    email: 'alice@example.com',
    password: 'password123',
    name: 'Alice Johnson',
    profile: {
      interests: ['Nature', 'History', 'Food', 'Culture'],
      hobbies: ['Hiking', 'Photography', 'Museums'],
      travelStyle: 'budget',
      constraints: 'Vegetarian-friendly'
    }
  },
  {
    email: 'bob@example.com',
    password: 'password123',
    name: 'Bob Smith',
    profile: {
      interests: ['Adventure', 'Nightlife', 'Art'],
      hobbies: ['Road trips', 'Cycling', 'Surfing'],
      travelStyle: 'backpacking',
      constraints: null
    }
  },
  {
    email: 'charlie@example.com',
    password: 'password123',
    name: 'Charlie Brown',
    profile: {
      interests: ['Relaxation', 'Beaches', 'Shopping'],
      hobbies: ['Meditation', 'Beaches'],
      travelStyle: 'luxury',
      constraints: 'Wheelchair access'
    }
  },
  {
    email: 'diana@example.com',
    password: 'password123',
    name: 'Diana Prince',
    profile: {
      interests: ['Culture', 'Art', 'History'],
      hobbies: ['Museums', 'Photography'],
      travelStyle: 'mid-range',
      constraints: null
    }
  }
];

const destinations = [
  { name: 'Asheville, North Carolina', lat: 35.5951, lng: -82.5515 },
  { name: 'Charleston, South Carolina', lat: 32.7765, lng: -79.9311 },
  { name: 'Savannah, Georgia', lat: 32.0809, lng: -81.0912 },
  { name: 'Nashville, Tennessee', lat: 36.1627, lng: -86.7816 },
  { name: 'New Orleans, Louisiana', lat: 29.9511, lng: -90.0715 },
  { name: 'Austin, Texas', lat: 30.2672, lng: -97.7431 },
  { name: 'Key West, Florida', lat: 24.5551, lng: -81.7821 },
  { name: 'Sedona, Arizona', lat: 34.8697, lng: -111.7610 },
  { name: 'Portland, Oregon', lat: 45.5152, lng: -122.6784 },
  { name: 'San Francisco, California', lat: 37.7749, lng: -122.4194 }
];

const reviewComments = [
  'Amazing trip! The food scene was incredible and the hiking trails were breathtaking.',
  'Great budget-friendly destination. Loved the historic sites and local culture.',
  'Perfect for photography enthusiasts. The sunsets were absolutely stunning.',
  'The activities were well-planned and the location was perfect for our group.',
  'Beautiful destination but a bit expensive. Worth it for the experience though.',
  'Excellent trip overall. The local cuisine exceeded expectations.',
  'Great for adventure seekers. Lots of outdoor activities and nightlife.',
  'Relaxing and peaceful. Perfect for a weekend getaway.',
  'The museums and art galleries were fantastic. Highly recommend!',
  'Wonderful experience. The people were friendly and the scenery was gorgeous.'
];

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('Clearing existing data...');
  await prisma.tripPhoto.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.tripParticipant.deleteMany();
  await prisma.tripBudget.deleteMany();
  await prisma.activityVote.deleteMany();
  await prisma.tripReview.deleteMany();
  await prisma.tripCollaborator.deleteMany();
  await prisma.packingTemplate.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.plannedTrip.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Existing data cleared\n');

  // Create users
  console.log('Creating users...');
  const createdUsers = [];
  for (const userData of sampleUsers) {
    const passwordHash = await bcrypt.hash(userData.password, 12);
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        name: userData.name,
        shareableId: randomUUID(),
        profile: {
          create: userData.profile
        }
      }
    });
    createdUsers.push(user);
    console.log(`  ✓ Created user: ${user.name} (${user.email})`);
  }
  console.log(`✅ Created ${createdUsers.length} users\n`);

  // Create trips and planned trips
  console.log('Creating trips and planned trips...');
  const createdPlannedTrips = [];
  
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const userTrips = Math.floor(Math.random() * 5) + 3; // 3-7 trips per user
    
    for (let j = 0; j < userTrips; j++) {
      const dest = destinations[Math.floor(Math.random() * destinations.length)];
      const days = Math.floor(Math.random() * 7) + 2; // 2-8 days
      const isPublic = Math.random() > 0.3; // 70% public
      
      // Create Trip
      const trip = await prisma.trip.create({
        data: {
          userId: user.id,
          startLocation: 'Raleigh, North Carolina',
          radiusOrTime: `${Math.floor(Math.random() * 500) + 200} miles`,
          days,
          travelMode: ['car', 'train', 'flight', 'mixed'][Math.floor(Math.random() * 4)],
          recommendations: JSON.stringify({
            text: `## ${dest.name}\n- **Why it fits:** Perfect destination for travel enthusiasts\n- **Travel Info:** ~${Math.floor(Math.random() * 6) + 2} hours drive\n- **Suggested Duration:** ${days} days\n- **Budget Estimate:** $${Math.floor(Math.random() * 100) + 50}-${Math.floor(Math.random() * 150) + 100}/day\n- **Key Highlights:** Great food, scenic views, cultural sites`
          }),
          groundingChunks: []
        }
      });

      // Create PlannedTrip
      const itinerary = [];
      for (let d = 1; d <= days; d++) {
        itinerary.push({
          day: d,
          activities: [
            { time: '9:00 AM', activity: 'Breakfast at local cafe', description: 'Start the day with local cuisine', location: 'Downtown' },
            { time: '11:00 AM', activity: 'Explore historic district', description: 'Walk through historic sites', location: 'Historic District' },
            { time: '2:00 PM', activity: 'Lunch break', description: 'Try local specialties', location: 'Restaurant Row' },
            { time: '4:00 PM', activity: 'Visit museums', description: 'Cultural exploration', location: 'Museum District' },
            { time: '7:00 PM', activity: 'Dinner and nightlife', description: 'Evening entertainment', location: 'Entertainment District' }
          ]
        });
      }

      const checklist = [
        { id: 1, task: 'Book accommodation', completed: true, category: 'Accommodation' },
        { id: 2, task: 'Pack clothes', completed: false, category: 'Packing' },
        { id: 3, task: 'Reserve restaurant', completed: true, category: 'Food' },
        { id: 4, task: 'Buy travel insurance', completed: false, category: 'Travel' },
        { id: 5, task: 'Download maps', completed: true, category: 'Preparation' }
      ];

      const plannedTrip = await prisma.plannedTrip.create({
        data: {
          userId: user.id,
          tripId: trip.id,
          destinationName: dest.name,
          destinationLat: dest.lat,
          destinationLng: dest.lng,
          photoUrl: `https://picsum.photos/800/600?random=${i * 10 + j}`,
          days,
          startLocation: 'Raleigh, North Carolina',
          itinerary,
          checklist,
          isPublic,
          isPhotoAlbumPublic: isPublic && Math.random() > 0.5,
          shareId: randomUUID()
        }
      });

      createdPlannedTrips.push(plannedTrip);
      
      // Create budget for some trips
      if (Math.random() > 0.4) {
        const budget = await prisma.tripBudget.create({
          data: {
            tripId: plannedTrip.id,
            totalBudget: Math.floor(Math.random() * 2000) + 500,
            currency: 'USD',
            participants: {
              create: [
                { name: user.name || 'Traveler' },
                { name: 'Friend 1' },
                { name: 'Friend 2' }
              ]
            }
          }
        });

        // Create some expenses
        const participants = await prisma.tripParticipant.findMany({
          where: { budgetId: budget.id }
        });

        if (participants.length > 0) {
          const expenseCategories = ['Food', 'Transportation', 'Accommodation', 'Activities', 'Shopping'];
          for (let k = 0; k < 5; k++) {
            const paidBy = participants[Math.floor(Math.random() * participants.length)];
            await prisma.expense.create({
              data: {
                budgetId: budget.id,
                amount: Math.floor(Math.random() * 200) + 20,
                category: expenseCategories[Math.floor(Math.random() * expenseCategories.length)],
                description: `Expense ${k + 1}`,
                paidById: paidBy.id,
                splitWithIds: participants.map(p => p.id)
              }
            });
          }
        }
      }
    }
  }
  console.log(`✅ Created ${createdPlannedTrips.length} planned trips\n`);

  // Create reviews
  console.log('Creating reviews...');
  let reviewCount = 0;
  for (const trip of createdPlannedTrips) {
    if (!trip.isPublic) continue;
    
    // Each public trip gets 1-3 reviews from different users
    const reviewers = createdUsers.filter(u => u.id !== trip.userId);
    const numReviews = Math.floor(Math.random() * 3) + 1;
    const selectedReviewers = reviewers.slice(0, Math.min(numReviews, reviewers.length));
    
    for (const reviewer of selectedReviewers) {
      const ratings = {
        overallRating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        budgetRating: Math.floor(Math.random() * 2) + 3, // 3-5 stars
        locationRating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        activitiesRating: Math.floor(Math.random() * 2) + 4 // 4-5 stars
      };
      
      await prisma.tripReview.create({
        data: {
          tripId: trip.id,
          userId: reviewer.id,
          ...ratings,
          comment: reviewComments[Math.floor(Math.random() * reviewComments.length)]
        }
      });
      reviewCount++;
    }
  }
  console.log(`✅ Created ${reviewCount} reviews\n`);

  // Create badges
  console.log('Creating badges...');
  const badgeTypes = ['first_trip', 'jet_setter', 'world_traveler', 'critic', 'top_reviewer', 'team_player', 'explorer'];
  let badgeCount = 0;
  
  for (const user of createdUsers) {
    const userTrips = createdPlannedTrips.filter(t => t.userId === user.id).length;
    const userReviews = await prisma.tripReview.count({ where: { userId: user.id } });
    
    // Award badges based on activity
    if (userTrips >= 1) {
      await prisma.userBadge.create({
        data: { userId: user.id, badgeType: 'first_trip' }
      });
      badgeCount++;
    }
    if (userTrips >= 5) {
      await prisma.userBadge.create({
        data: { userId: user.id, badgeType: 'jet_setter' }
      });
      badgeCount++;
    }
    if (userTrips >= 10) {
      await prisma.userBadge.create({
        data: { userId: user.id, badgeType: 'world_traveler' }
      });
      badgeCount++;
    }
    if (userReviews >= 1) {
      await prisma.userBadge.create({
        data: { userId: user.id, badgeType: 'critic' }
      });
      badgeCount++;
    }
    if (userReviews >= 5) {
      await prisma.userBadge.create({
        data: { userId: user.id, badgeType: 'top_reviewer' }
      });
      badgeCount++;
    }
    
    // Check for unique destinations (states)
    const userDestinations = await prisma.plannedTrip.findMany({
      where: { userId: user.id },
      select: { destinationName: true }
    });
    const uniqueStates = new Set(
      userDestinations.map(t => {
        const parts = t.destinationName.split(',').map(p => p.trim());
        return parts.length > 1 ? parts[parts.length - 1] : parts[0];
      })
    );
    
    if (uniqueStates.size >= 3) {
      await prisma.userBadge.create({
        data: { userId: user.id, badgeType: 'explorer' }
      });
      badgeCount++;
    }
  }
  console.log(`✅ Created ${badgeCount} badges\n`);

  // Create packing templates
  console.log('Creating packing templates...');
  let templateCount = 0;
  for (const user of createdUsers) {
    const templates = [
      {
        name: 'Beach Vacation',
        items: [
          { id: 1, task: 'Swimsuit', category: 'Clothing', completed: false },
          { id: 2, task: 'Sunscreen', category: 'Essentials', completed: false },
          { id: 3, task: 'Beach towel', category: 'Essentials', completed: false },
          { id: 4, task: 'Sunglasses', category: 'Accessories', completed: false }
        ]
      },
      {
        name: 'City Break',
        items: [
          { id: 1, task: 'Comfortable walking shoes', category: 'Footwear', completed: false },
          { id: 2, task: 'Camera', category: 'Electronics', completed: false },
          { id: 3, task: 'City map', category: 'Essentials', completed: false }
        ]
      }
    ];
    
    for (const template of templates) {
      await prisma.packingTemplate.create({
        data: {
          userId: user.id,
          name: template.name,
          items: template.items
        }
      });
      templateCount++;
    }
  }
  console.log(`✅ Created ${templateCount} packing templates\n`);

  // Create some photos for a few trips
  console.log('Creating trip photos...');
  let photoCount = 0;
  const tripsWithPhotos = createdPlannedTrips.slice(0, 5); // First 5 trips get photos
  
  for (const trip of tripsWithPhotos) {
    for (let day = 1; day <= Math.min(trip.days, 3); day++) {
      for (let photo = 0; photo < 2; photo++) {
        await prisma.tripPhoto.create({
          data: {
            tripId: trip.id,
            day,
            imageUrl: `https://picsum.photos/1200/800?random=${photoCount}`,
            thumbnailUrl: `https://picsum.photos/300/200?random=${photoCount}`,
            caption: `Day ${day} - Photo ${photo + 1}`,
            location: trip.destinationName,
            latitude: trip.destinationLat,
            longitude: trip.destinationLng,
            sortOrder: photo
          }
        });
        photoCount++;
      }
    }
  }
  console.log(`✅ Created ${photoCount} trip photos\n`);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`  - Users: ${createdUsers.length}`);
  console.log(`  - Planned Trips: ${createdPlannedTrips.length}`);
  console.log(`  - Reviews: ${reviewCount}`);
  console.log(`  - Badges: ${badgeCount}`);
  console.log(`  - Packing Templates: ${templateCount}`);
  console.log(`  - Photos: ${photoCount}`);
  console.log('\n🔑 Test accounts (password: password123):');
  createdUsers.forEach(user => {
    console.log(`  - ${user.email} (${user.name})`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
