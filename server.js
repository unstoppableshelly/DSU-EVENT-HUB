// server.js - Express API + static file server for DSU Event Hub
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const nodemailer = require('nodemailer');
const { connect, getDb } = require('./connection');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-college-email@gmail.com', // Your actual Gmail
    pass: 'your-app-password'            // Your 16-character Google App Password
  }
});

// Serve all the HTML/CSS/JS files from this folder
app.use(express.static(__dirname));

// ---------- Auth guards ----------
function requireUser(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Login required' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: 'Admin login required' });
  next();
}

// =================================================================
//                         STUDENT SIGNUP
// =================================================================
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, usnNumber, email, password } = req.body;
    // --- Start of New Email Validation Logic ---
// Matches format: SCA[2 digits]CA[4 digits]@gmail.com
const collegeEmailPattern = /^SCA\d{2}CA\d{4}@gmail\.com$/i;

if (!collegeEmailPattern.test(email)) {
    return res.status(400).json({ 
        error: "Access Denied: Please use your official DSU Student ID email (e.g., SCA25CA0134@gmail.com)." 
    });
}
// --- End of New Email Validation Logic ---
    if (!fullName || !usnNumber || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = getDb();
    const users = db.collection('users');

    const existing = await users.findOne({ $or: [{ email }, { usnNumber }] });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email or USN already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await users.insertOne({
      fullName,
      usnNumber,
      email,
      password: hashed,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userId: result.insertedId
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// =================================================================
//                         STUDENT LOGIN
// =================================================================
app.post('/api/login', async (req, res) => {
  try {
    const { usnNumber, email, password } = req.body;
    if (!password || (!usnNumber && !email)) {
      return res.status(400).json({ error: 'USN or email, plus password, are required' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne(
      usnNumber ? { usnNumber } : { email }
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.user = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      usnNumber: user.usnNumber
    };
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// =================================================================
//                         ADMIN LOGIN
// =================================================================
app.post('/api/admin/login', async (req, res) => {
  try {
    const { adminId, password } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ error: 'Admin ID and password are required' });
    }

    const db = getDb();
    const admin = await db.collection('admins').findOne({ adminId });
    if (!admin) return res.status(401).json({ error: 'Invalid admin credentials' });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: 'Invalid admin credentials' });

    req.session.admin = { id: admin._id, adminId: admin.adminId };
    res.json({ success: true });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Server error during admin login' });
  }
});

// Shared logout for both user & admin
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// =================================================================
//                             EVENTS
// =================================================================
// Public list (for events.html, index.html, register.html dropdown)
app.get('/api/events', async (req, res) => {
  try {
    const db = getDb();
    const events = await db.collection('events')
      .find({ status: { $ne: 'rejected' } })
      .sort({ date: 1 })
      .toArray();
    res.json(events);
  } catch (err) {
    console.error('Fetch events error:', err);
    res.status(500).json({ error: 'Could not fetch events' });
  }
});

// Admin creates a new event request (stored as pending)
app.post('/api/events', async (req, res) => {
  try {
    const { name, category, organizer, date, venue, description } = req.body;
    if (!name || !organizer || !date) {
      return res.status(400).json({ error: 'name, organizer and date are required' });
    }
    const db = getDb();
    const result = await db.collection('events').insertOne({
      name,
      category: category || 'Technical',
      organizer,
      date: new Date(date),
      venue: venue || '',
      description: description || '',
      status: 'pending',
      createdAt: new Date()
    });
    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Could not create event' });
  }
});

// =================================================================
//                      EVENT REGISTRATION
// =================================================================
app.post('/api/register-event', requireUser, async (req, res) => {
  try {
    const { eventName, department } = req.body;
    const { fullName, usnNumber, email } = req.session.user;

    if (!eventName || !department) {
      return res.status(400).json({ error: 'Event and department are required' });
    }

    const db = getDb();
    // Prevent duplicate registrations for the same event + USN
    const dup = await db.collection('registrations').findOne({ usnNumber, eventName });
    if (dup) return res.status(409).json({ error: 'You are already registered for this event' });

    const result = await db.collection('registrations').insertOne({
      fullName,
      usnNumber,
      email,
      eventName,
      department,
      userEmail: email,
      status: 'pending',
      registeredAt: new Date()
    });
    res.status(201).json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error('Event registration error:', err);
    res.status(500).json({ error: 'Could not register for event' });
  }
});

// Student views only their own registrations (by email)
app.get('/api/my-registrations', requireUser, async (req, res) => {
  try {
    const db = getDb();
    const regs = await db.collection('registrations')
      .find({ userEmail: req.session.user.email })
      .sort({ registeredAt: -1 })
      .toArray();
    res.json(regs);
  } catch (err) {
    console.error('My registrations error:', err);
    res.status(500).json({ error: 'Could not fetch registrations' });
  }
});

// =================================================================
//                           CONTACT
// =================================================================
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }
    const db = getDb();
    await db.collection('contact_messages').insertOne({
      name, email, subject: subject || 'General', message, createdAt: new Date()
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Could not send message' });
  }
});

// =================================================================
//                           FEEDBACK
// =================================================================
app.post('/api/feedback', async (req, res) => {
  try {
    const { eventName, rating, name, likes, improvements } = req.body;
    if (!eventName || !rating) {
      return res.status(400).json({ error: 'Event name and rating are required' });
    }
    const db = getDb();
    await db.collection('feedback').insertOne({
      eventName,
      rating: Number(rating),
      name: name || 'Anonymous',
      likes: likes || '',
      improvements: improvements || '',
      createdAt: new Date()
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Could not submit feedback' });
  }
});

// =================================================================
//                         ADMIN DASHBOARD
// =================================================================
// Pending event requests + pending registrations + stats
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const [pending, pendingRegs, activeCount, totalRegs] = await Promise.all([
      db.collection('events').find({ status: 'pending' }).sort({ createdAt: -1 }).toArray(),
      db.collection('registrations').find({ status: 'pending' }).sort({ registeredAt: -1 }).toArray(),
      db.collection('events').countDocuments({ status: 'approved' }),
      db.collection('registrations').countDocuments({})
    ]);
    res.json({ pending, pendingRegs, activeCount, totalRegs });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Could not load dashboard' });
  }
});

// Approve or reject a student's event registration
app.patch('/api/admin/registrations/:id', requireAdmin, async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    }
    const db = getDb();
    const result = await db.collection('registrations').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, actionedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Registration not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Admin registration action error:', err);
    res.status(500).json({ error: 'Could not update registration' });
  }
});

// Approve or reject an event request
app.patch('/api/admin/events/:id', requireAdmin, async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const { status } = req.body; // "approved" or "rejected"
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    }
    const db = getDb();
    const result = await db.collection('events').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, actionedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Admin action error:', err);
    res.status(500).json({ error: 'Could not update event' });
  }
});

// =================================================================
//                    SESSION INFO (for navbars)
// =================================================================
app.get('/api/me', (req, res) => {
  res.json({
    user:  req.session.user  || null,
    admin: req.session.admin || null
  });
});

// ---------- Start server ----------
connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DSU Event Hub running → http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error(' MongoDB connection failed:', err.message);
    process.exit(1);
  });
