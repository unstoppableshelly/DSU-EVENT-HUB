// seed.js - Populate the database with a default admin + sample events.
// Run once: node seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connect, getDb, close } = require('./connection');

async function seed() {
  await connect();
  const db = getDb();

  // --- Default admin ---
  const adminId  = process.env.ADMIN_ID || 'admin';
  const adminPwd = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await db.collection('admins').findOne({ adminId });
  if (!existing) {
    const hash = await bcrypt.hash(adminPwd, 10);
    await db.collection('admins').insertOne({
      adminId, password: hash, createdAt: new Date()
    });
    console.log(`✅ Default admin created — ID: "${adminId}", password: "${adminPwd}"`);
  } else {
    console.log(`ℹ️  Admin "${adminId}" already exists, skipping.`);
  }

  // --- Sample events ---
  const count = await db.collection('events').countDocuments({});
  if (count === 0) {
    await db.collection('events').insertMany([
      { name: 'DSU Hackathon 2026', category: 'Technical', organizer: 'CS Department',
        date: new Date('2026-04-15'), venue: 'Block A Hall',
        description: 'Join the ultimate 24-hour coding marathon open to all BCA & BTech students.',
        status: 'approved', createdAt: new Date() },
      { name: 'Utsav Spring Fest', category: 'Cultural', organizer: 'Cultural Committee',
        date: new Date('2026-04-22'), venue: 'Main Auditorium',
        description: 'The biggest annual cultural festival featuring dance, music, and drama.',
        status: 'approved', createdAt: new Date() },
      { name: 'Inter-Dept Cricket', category: 'Sports', organizer: 'Sports Council',
        date: new Date('2026-04-28'), venue: 'DSU Main Ground',
        description: 'Fierce T10 inter-department cricket tournament.',
        status: 'approved', createdAt: new Date() },
      { name: 'AI & ML Bootcamp', category: 'Workshop', organizer: 'CS Department',
        date: new Date('2026-05-03'), venue: 'CS Lab 2',
        description: 'Hands-on workshop focused on building ML models from scratch in Python.',
        status: 'approved', createdAt: new Date() },
      { name: 'Robo-Sumo 2026', category: 'Technical', organizer: 'Robotics Club',
        date: new Date('2026-05-05'), venue: 'Main Auditorium',
        description: 'Robot combat competition.', status: 'pending', createdAt: new Date() },
      { name: 'Jazz Night', category: 'Cultural', organizer: 'Music Society',
        date: new Date('2026-05-12'), venue: 'Open Air Theater',
        description: 'An evening of live jazz music.', status: 'pending', createdAt: new Date() }
    ]);
    console.log('✅ Inserted 6 sample events (4 approved, 2 pending).');
  } else {
    console.log(`ℹ️  ${count} events already exist, skipping seed.`);
  }

  await close();
  console.log('🎉 Seeding complete.');
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
