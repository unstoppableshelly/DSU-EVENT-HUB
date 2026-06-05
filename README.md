# DSU Event Hub

**Node.js**, **Express**, and **MongoDB**. Every page is wired to the database —
signup, login, event listing, event registration, admin dashboard,
contact form, and feedback.


## Prerequisites

* **Node.js** ≥ 18
* **MongoDB** running locally on `mongodb://localhost:27017`
  (or update `MONGO_URI` in `.env` to point at MongoDB Atlas / a remote instance)

---

## Setup (first time)

```bash
# 1. Install dependencies
npm install

# 2. Seed the default admin + sample events
npm run seed

# 3. Start the server
npm start
#4 You need the nodemailer package to send emails from your Node.js server. Run this in your VS Code terminal:
npm install nodemailer
```

Then open **http://localhost:3000** in your browser.

---

## Default credentials

* **Admin login** (at `/admin-login.html`)
  * Admin ID: `admin`
  * Password: `admin123`

Change these in `.env` before seeding in production.

---

## What's connected to MongoDB

| Page | Collection(s) |
|---|---|
| `signup.html` → `POST /api/signup` | `users` (passwords hashed with bcrypt) |
| `login.html` → `POST /api/login` | `users` |
| `admin-login.html` → `POST /api/admin/login` | `admins` |
| `events.html` → `GET /api/events` | `events` |
| `calendar.html` → `GET /api/events` | `events` |
| `register.html` → `POST /api/register-event` | `registrations` (dropdown populated from `events`) |
| `contact.html` → `POST /api/contact` | `contact_messages` |
| `feedback.html` → `POST /api/feedback` | `feedback` |
| `admin.html` → `GET /api/admin/dashboard`, `PATCH /api/admin/events/:id` | `events`, `registrations` |

---

## Project structure

```
prj-mongo/
├── .env                 # MongoDB URI, port, admin creds
├── package.json
├── server.js            # Express server + all API routes
├── connection.js        # MongoDB connection singleton
├── seed.js              # Creates default admin + sample events
├── scr.js               # Front-end logic (fetch → /api/*)
├── style.css            # Shared styles
├── index.html
├── events.html
├── login.html
├── signup.html
├── admin.html
├── admin-login.html
├── register.html
├── contact.html
├── feedback.html
└── calendar.html
```

---

## API endpoints (quick reference)

```
POST   /api/signup              { fullName, usnNumber, email, password }
POST   /api/login               { usnNumber?, email?, password }
POST   /api/admin/login         { adminId, password }
POST   /api/logout
GET    /api/me
GET    /api/events
POST   /api/events              { name, category, organizer, date, venue, description }
POST   /api/register-event      { fullName, usnNumber, eventName, department }
POST   /api/contact             { name, email, subject, message }
POST   /api/feedback            { eventName, rating, name?, likes?, improvements? }
GET    /api/admin/dashboard     (admin only)
PATCH  /api/admin/events/:id    { status: "approved" | "rejected" }  (admin only)
```

---

## Troubleshooting

**"MongoDB connection failed"** — make sure MongoDB is actually running.
On Linux/Mac: `sudo systemctl start mongod` or `brew services start mongodb-community`.
On Windows: start the MongoDB service from Services, or run `mongod` manually.

**"Admin login required"** redirect loop on `admin.html` — run `npm run seed` first,
then log in at `/admin-login.html`.

**Port 3000 already in use** — change `PORT` in `.env`.
