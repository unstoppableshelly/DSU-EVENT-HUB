// scr.js - Front-end logic, fully wired to the /api backend (MongoDB).

// ---------- small helper ----------
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// =============================================================
//                        SIGNUP
// =============================================================
async function handleSignup(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('registrationForm');
  const fullName  = form.querySelector('.full-name').value.trim();
  const usnNumber = form.querySelector('.usn').value.trim();
  const email     = form.querySelector('.email').value.trim();
  const password  = form.querySelector('.password').value;

  if (!fullName || !usnNumber || !email || !password) {
    alert('Please fill in all fields.');
    return;
  }
  try {
    await api('/api/signup', 'POST', { fullName, usnNumber, email, password });
    alert('Signup successful! Please log in.');
    window.location.href = 'login.html';
  } catch (err) {
    alert('Signup failed: ' + err.message);
  }
}

// =============================================================
//                        STUDENT LOGIN
// =============================================================
async function handleLogin(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('loginForm');
  const usnNumber = form.querySelector('.usn').value.trim();
  const email     = form.querySelector('.email').value.trim();
  const password  = form.querySelector('.password').value;

  if ((!usnNumber && !email) || !password) {
    alert('Please provide USN or email, plus your password.');
    return;
  }
  try {
    const data = await api('/api/login', 'POST', { usnNumber, email, password });
    alert(`Welcome back, ${data.user.fullName}!`);
    window.location.href = 'events.html';
  } catch (err) {
    alert('Login failed: ' + err.message);
  }
}

// =============================================================
//                         ADMIN LOGIN
// =============================================================
async function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('adminLoginForm');
  const adminId  = form.querySelector('.admin-id').value.trim();
  const password = form.querySelector('.password').value;

  if (!adminId || !password) {
    alert('Please provide admin ID and password.');
    return;
  }
  try {
    await api('/api/admin/login', 'POST', { adminId, password });
    window.location.href = 'admin.html';
  } catch (err) {
    alert('Admin login failed: ' + err.message);
  }
}

// =============================================================
//                     EVENT REGISTRATION
// =============================================================
async function handleEventRegister(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('eventRegForm');
  const eventName  = form.querySelector('.event-select').value;
  const department = form.querySelector('.department').value.trim();

  if (!eventName || !department) {
    alert('Please select an event and enter your department.');
    return;
  }
  try {
    await api('/api/register-event', 'POST', { eventName, department });
    alert('Registration submitted! Check "My Registrations" to see approval status.');
    window.location.href = 'my-registrations.html';
  } catch (err) {
    if (err.message.includes('Login required')) {
      alert('Please log in first to register for events.');
      window.location.href = 'login.html';
    } else {
      alert('Registration failed: ' + err.message);
    }
  }
}

// =============================================================
//                    MY REGISTRATIONS (student)
// =============================================================
async function loadMyRegistrations() {
  const list = document.getElementById('my-regs-list');
  if (!list) return;
  try {
    const regs = await api('/api/my-registrations');
    if (!regs.length) {
      list.innerHTML = `<div style="text-align:center;padding:3rem;color:#666;">
        <p style="font-size:1.1rem;margin-bottom:1rem;">You haven't registered for any events yet.</p>
        <a href="events.html" class="btn-primary" style="text-decoration:none;padding:10px 20px;">Browse Events</a>
      </div>`;
      return;
    }
    list.innerHTML = regs.map(r => {
      const d = new Date(r.registeredAt).toLocaleDateString('en-US',
        { year: 'numeric', month: 'short', day: 'numeric' });
      const statusColors = {
        pending:  { bg: '#fff3cd', fg: '#856404', label: 'Pending Review' },
        approved: { bg: '#d4edda', fg: '#155724', label: '✓ Approved' },
        rejected: { bg: '#f8d7da', fg: '#721c24', label: '✗ Rejected' }
      };
      const s = statusColors[r.status] || statusColors.pending;
      return `
        <div class="reg-card">
          <div class="reg-card-left">
            <h3>${r.eventName}</h3>
            <p class="reg-meta">Department: ${r.department}</p>
            <p class="reg-meta">Registered on: ${d}</p>
          </div>
          <div class="reg-card-right">
            <span class="status-badge" style="background:${s.bg};color:${s.fg};">${s.label}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    if (err.message.includes('Login required')) {
      window.location.href = 'login.html';
    } else {
      list.innerHTML = `<p style="color:#c00;padding:2rem;text-align:center;">${err.message}</p>`;
    }
  }
}

async function userLogout() {
  try { await api('/api/logout', 'POST'); } catch (_) {}
  window.location.href = 'index.html';
}

// =============================================================
//                    DYNAMIC NAVBAR (show auth state)
// =============================================================
async function updateNavbarAuthState() {
  try {
    const data = await api('/api/me');
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    if (data.user) {
      // Hide "Student Login" and "Sign Up", show "My Registrations" and "Logout"
      navLinks.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href === 'login.html' || href === 'signup.html') a.style.display = 'none';
      });
      // Inject "My Registrations" link if missing
      if (!navLinks.querySelector('a[href="my-registrations.html"]')) {
        const myRegs = document.createElement('a');
        myRegs.href = 'my-registrations.html';
        myRegs.textContent = 'My Registrations';
        if (window.location.pathname.endsWith('my-registrations.html')) {
          myRegs.classList.add('active');
        }
        // Place it right after Events
        const eventsLink = navLinks.querySelector('a[href="events.html"]');
        if (eventsLink) eventsLink.after(myRegs);
        else navLinks.appendChild(myRegs);
      }
      // Inject logout button if missing
      if (!navLinks.querySelector('.nav-logout')) {
        const logout = document.createElement('a');
        logout.className = 'nav-logout';
        logout.textContent = `Logout (${data.user.fullName.split(' ')[0]})`;
        logout.style.cursor = 'pointer';
        logout.onclick = userLogout;
        navLinks.appendChild(logout);
      }
    }
  } catch (_) { /* not logged in — leave navbar as is */ }
}

// =============================================================
//                         CONTACT
// =============================================================
async function handleContact(e) {
  if (e) e.preventDefault();
  const form = document.getElementById('contactForm');
  const name    = form.querySelector('.cf-name').value.trim();
  const email   = form.querySelector('.cf-email').value.trim();
  const subject = form.querySelector('.cf-subject').value;
  const message = form.querySelector('.cf-message').value.trim();

  if (!name || !email || !message) {
    alert('Please fill in name, email and message.');
    return;
  }
  try {
    await api('/api/contact', 'POST', { name, email, subject, message });
    alert('Message sent! We will get back to you soon.');
    form.reset();
  } catch (err) {
    alert('Could not send message: ' + err.message);
  }
}

// =============================================================
//                         FEEDBACK
// =============================================================
let currentRating = 0;

function rate(n) {
  currentRating = n;
  document.querySelectorAll('.star').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
}

async function submitFeedback() {
  const form = document.getElementById('feedbackForm');
  const eventName    = form.querySelector('.fb-event').value;
  const name         = form.querySelector('.fb-name').value.trim();
  const likes        = form.querySelector('.fb-likes').value.trim();
  const improvements = form.querySelector('.fb-improve').value.trim();

  if (!currentRating) {
    alert('Please select a star rating.');
    return;
  }
  try {
    await api('/api/feedback', 'POST', {
      eventName, rating: currentRating, name, likes, improvements
    });
    const success = document.getElementById('fb-success');
    success.style.display = 'block';
    setTimeout(() => (success.style.display = 'none'), 4000);
    form.reset();
    rate(0);
  } catch (err) {
    alert('Could not submit feedback: ' + err.message);
  }
}

// =============================================================
//                       EVENTS LISTING
// =============================================================
async function loadEvents() {
  const list = document.getElementById('events-list');
  if (!list) return;
  try {
    const events = await api('/api/events');
    if (!events.length) {
      list.innerHTML = '<p style="text-align:center;padding:2rem;">No events yet.</p>';
      return;
    }
    list.innerHTML = events.map(ev => {
      const d = new Date(ev.date);
      const dateStr = d.toLocaleDateString('en-US',
        { year: 'numeric', month: 'short', day: 'numeric' });
      return `
        <div class="event-card" data-cat="${ev.category}">
          <div class="event-card-top">
            <div class="tag">${ev.category}</div>
            <h3>${ev.name}</h3>
          </div>
          <div class="event-card-body">
            <div class="event-info">📅 ${dateStr}</div>
            <div class="event-info">📍 ${ev.venue || 'TBA'}</div>
            <div class="event-desc">${ev.description || ''}</div>
            <button class="reg-btn" onclick="goToRegister('${ev.name.replace(/'/g, "\\'")}')">Register Now</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<p style="text-align:center;padding:2rem;color:#c00;">
      Could not load events: ${err.message}</p>`;
  }
}

// Load the dropdown list on register.html from the DB, and preselect any ?event= in the URL
async function loadEventDropdown() {
  const select = document.querySelector('#eventRegForm .event-select');
  if (!select) return;
  try {
    const events = await api('/api/events');
    const urlEvent = new URLSearchParams(window.location.search).get('event');
    select.innerHTML =
      '<option value="" disabled selected>-- Choose an Event --</option>' +
      events.map(ev =>
        `<option value="${ev.name}" ${urlEvent === ev.name ? 'selected' : ''}>${ev.name}</option>`
      ).join('');
  } catch (err) {
    console.warn('Could not fetch events for dropdown:', err.message);
  }
}

// =============================================================
//                       EVENT FILTER (client-side)
// =============================================================
function filterEvt(btn, cat) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#events-list .event-card').forEach(card => {
    card.style.display = (cat === 'All' || card.dataset.cat === cat) ? 'flex' : 'none';
  });
}

function goToRegister(eventName) {
  window.location.href = `register.html?event=${encodeURIComponent(eventName)}`;
}

// =============================================================
//                         ADMIN PANEL
// =============================================================
async function loadAdminDashboard() {
  const tbody = document.getElementById('admin-table-body');
  if (!tbody) return;
  try {
    const data = await api('/api/admin/dashboard');
    const pendingEl = document.getElementById('pending-count');
    const activeEl  = document.getElementById('active-count');
    const regsEl    = document.getElementById('regs-count');
    if (pendingEl) pendingEl.textContent = data.pending.length;
    if (activeEl)  activeEl.textContent  = data.activeCount;
    if (regsEl)    regsEl.textContent    = data.totalRegs;

    if (!data.pending.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:#666;">
        No pending event requests.</td></tr>`;
    } else {
      tbody.innerHTML = data.pending.map(ev => {
        const d = new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        return `
          <tr data-id="${ev._id}" style="border-bottom:1px solid #eee;">
            <td style="padding:12px;font-weight:500;">${ev.name}</td>
            <td>${ev.organizer}</td>
            <td>${d}</td>
            <td><span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:4px;">Pending</span></td>
            <td>
              <button class="btn-primary" style="padding:4px 10px;font-size:11px;"
                onclick="adminAction('${ev._id}','approved')">Approve</button>
              <button style="padding:4px 10px;font-size:11px;background:#fee;color:#c00;
                border:1px solid #fcc;border-radius:4px;margin-left:4px;"
                onclick="adminAction('${ev._id}','rejected')">Reject</button>
            </td>
          </tr>`;
      }).join('');
    }

    // Pending student registrations table
    const regsTbody = document.getElementById('admin-regs-body');
    if (regsTbody) {
      if (!data.pendingRegs || !data.pendingRegs.length) {
        regsTbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:#666;">
          No pending student registrations.</td></tr>`;
      } else {
        regsTbody.innerHTML = data.pendingRegs.map(r => {
          const d = new Date(r.registeredAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
          return `
            <tr data-id="${r._id}" style="border-bottom:1px solid #eee;">
              <td style="padding:12px;font-weight:500;">${r.fullName}</td>
              <td>${r.usnNumber}</td>
              <td>${r.eventName}</td>
              <td>${d}</td>
              <td>
                <button class="btn-primary" style="padding:4px 10px;font-size:11px;"
                  onclick="adminRegAction('${r._id}','approved')">Approve</button>
                <button style="padding:4px 10px;font-size:11px;background:#fee;color:#c00;
                  border:1px solid #fcc;border-radius:4px;margin-left:4px;"
                  onclick="adminRegAction('${r._id}','rejected')">Reject</button>
              </td>
            </tr>`;
        }).join('');
      }
    }
  } catch (err) {
    if (err.message.includes('Admin login required')) {
      window.location.href = 'admin-login.html';
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="color:#c00;padding:1rem;">
        ${err.message}</td></tr>`;
    }
  }
}

async function adminAction(id, status) {
  try {
    await api(`/api/admin/events/${id}`, 'PATCH', { status });
    loadAdminDashboard();
  } catch (err) {
    alert('Action failed: ' + err.message);
  }
}

async function adminRegAction(id, status) {
  try {
    await api(`/api/admin/registrations/${id}`, 'PATCH', { status });
    loadAdminDashboard();
  } catch (err) {
    alert('Action failed: ' + err.message);
  }
}

async function adminLogout() {
  try { await api('/api/logout', 'POST'); } catch (_) {}
  window.location.href = 'admin-login.html';
}

// =============================================================
//                    CALENDAR (client-side + events from DB)
// =============================================================
let currentDisplayDate = new Date();
let calendarEvents = {}; // keyed by YYYY-MM-DD

async function loadCalendarEvents() {
  try {
    const events = await api('/api/events');
    calendarEvents = {};
    events.forEach(ev => {
      const d = new Date(ev.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      calendarEvents[key] = { name: ev.name, type: (ev.category || '').toLowerCase() };
    });
  } catch (err) {
    console.warn('Could not load calendar events:', err.message);
  }
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  const monthYearLabel = document.getElementById('cal-month-year');
  const monthDisplay   = document.getElementById('month-display');
  grid.innerHTML = '';

  const year  = currentDisplayDate.getFullYear();
  const month = currentDisplayDate.getMonth();
  const monthName = currentDisplayDate.toLocaleString('default', { month: 'long' });
  if (monthYearLabel) monthYearLabel.innerText = `${monthName} ${year}`;
  if (monthDisplay)   monthDisplay.innerText   = `${monthName} Calendar`;

  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => {
    const d = document.createElement('div');
    d.className = 'cal-day-name';
    d.innerText = day;
    grid.appendChild(d);
  });

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const c = document.createElement('div'); c.className = 'cal-cell empty'; grid.appendChild(c);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      cell.classList.add('today');
    }
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let html = `<div class="day-num">${day}</div>`;
    if (calendarEvents[key]) {
      cell.classList.add('has-event');
      const ev = calendarEvents[key];
      html += `<div class="event-badge ${ev.type}" title="${ev.name}">${ev.name}</div>`;
    }
    cell.innerHTML = html;
    grid.appendChild(cell);
  }
}

async function changeMonth(offset) {
  currentDisplayDate.setMonth(currentDisplayDate.getMonth() + offset);
  renderCalendar();
}

// =============================================================
//                           INIT
// =============================================================
window.addEventListener('load', async () => {
  // Always update navbar based on login state (skip on admin pages)
  const isAdminPage = window.location.pathname.includes('admin');
  if (!isAdminPage) await updateNavbarAuthState();

  // Events listing page
  if (document.getElementById('events-list') && !document.querySelector('#events-list .event-card')) {
    loadEvents();
  }
  // Register page
  if (document.getElementById('eventRegForm')) loadEventDropdown();
  // My Registrations page
  if (document.getElementById('my-regs-list')) loadMyRegistrations();
  // Admin dashboard
  if (document.getElementById('admin-table-body')) loadAdminDashboard();
  // Calendar
  if (document.getElementById('calendar-grid')) {
    await loadCalendarEvents();
    renderCalendar();
  }
});
