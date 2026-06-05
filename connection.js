// connection.js - MongoDB connection singleton
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME   = process.env.DB_NAME   || 'dsu_event_hub';

const client = new MongoClient(MONGO_URI);

let db = null;

async function connect() {
  if (db) return db;
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`Connected to MongoDB → database: "${DB_NAME}"`);

  // Helpful indexes (safe to call repeatedly — MongoDB ignores duplicates)
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ usnNumber: 1 }, { unique: true });
  await db.collection('admins').createIndex({ adminId: 1 }, { unique: true });
  await db.collection('events').createIndex({ name: 1 });
  await db.collection('registrations').createIndex({ userEmail: 1, eventName: 1 });

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
}

async function close() {
  await client.close();
  db = null;
}

module.exports = { connect, getDb, close };
