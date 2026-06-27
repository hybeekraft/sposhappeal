/* =================================================================
   S'POSH APPEAL — staff.js
   Staff & Admin Portal logic: Login, Catalog edit, Booking manager
   ================================================================= */

const API_BASE = window.SPOSH_API_URL || '/api';
const API_TIMEOUT_MS = 6000;

// ─── INACTIVITY AUTO-LOGOUT ────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 90 * 1000;  // 90 seconds
const INACTIVITY_WARNING_MS = INACTIVITY_TIMEOUT_MS - (15 * 1000);  // Show warning 15 seconds before logout
let _inactivityTimer = null;
let _warningTimer = null;
let _warningOverlay = null;
let _lastActivityTime = Date.now();
const ACTIVITY_THROTTLE_MS = 5000; // Only reset timer at most once every 5 seconds

function resetInactivityTimer() {
  // Clear existing timers
  if (_inactivityTimer) clearTimeout(_inactivityTimer);
  if (_warningTimer) clearTimeout(_warningTimer);
  dismissInactivityWarning();

  // Only track if user is logged in
  if (!sessionStorage.getItem('sposh_admin_passcode')) return;

  // Set warning timer (fires 2 min before logout)
  _warningTimer = setTimeout(() => {
    showInactivityWarning();
  }, INACTIVITY_WARNING_MS);

  // Set logout timer
  _inactivityTimer = setTimeout(() => {
    performInactivityLogout();
  }, INACTIVITY_TIMEOUT_MS);
}


async function checkDatabaseStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (res.ok) {
      const data = await res.json();
      const banner = document.getElementById('db-mock-banner');
      const revWarning = document.getElementById('revenue-mock-warning');
      if (data.db === 'mock') {
        if (banner) banner.style.display = 'block';
        if (revWarning) revWarning.style.display = 'block';
      } else {
        if (banner) banner.style.display = 'none';
        if (revWarning) revWarning.style.display = 'none';
      }
    }
  } catch (err) {
    // Suppress console.error in production, but let's do a quiet fallback
  }
}

function showInactivityWarning() {
  if (_warningOverlay) return; // Already showing

  _warningOverlay = document.createElement('div');
  _warningOverlay.id = 'inactivity-warning';
  _warningOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(6, 4, 10, 0.85); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999; font-family: 'DM Sans', sans-serif;
    animation: fadeIn 0.3s ease;
  `;

  const timeLeft = Math.ceil((INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) / 1000);

  _warningOverlay.innerHTML = `
    <div style="background: #160D22; border: 1px solid rgba(224, 68, 122, 0.3); border-radius: 16px;
      padding: 32px; max-width: 400px; width: calc(100% - 32px); text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 20px rgba(224, 68, 122, 0.15);">
      <div style="font-size: 3rem; color: #E0447A; margin-bottom: 16px;">
        <i class="fa-solid fa-clock-rotate-left"></i>
      </div>
      <h3 style="font-size: 1.3rem; font-weight: 700; color: #FAF0F5; margin-bottom: 8px;
        font-family: 'Cormorant Garamond', serif;">Session Expiring Soon</h3>
      <p style="font-size: 0.85rem; color: #B090A8; line-height: 1.5; margin-bottom: 24px;">
        You've been inactive for a while. You'll be logged out in <strong style="color: #FF8FAB;" id="countdown-seconds">${timeLeft}</strong> seconds for security.
      </p>
      <button id="inactivity-keep-alive-btn" style="background: linear-gradient(135deg, #E0447A, #FF8FAB);
        border: none; color: #fff; padding: 14px 28px; border-radius: 8px; font-weight: 600;
        cursor: pointer; font-size: 0.9rem; width: 100%; transition: all 0.25s ease;">
        <i class="fa-solid fa-hand"></i> &nbsp; I'm Still Here
      </button>
    </div>
  `;

  document.body.appendChild(_warningOverlay);

  // Bind event programmatically
  const btn = _warningOverlay.querySelector('#inactivity-keep-alive-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      _lastActivityTime = Date.now();
      resetInactivityTimer();
    });
  }

  // Countdown timer
  let remaining = timeLeft;
  const countdownEl = _warningOverlay.querySelector('#countdown-seconds');
  const countdownInterval = setInterval(() => {
    remaining--;
    if (countdownEl) countdownEl.textContent = remaining;
    if (remaining <= 0) clearInterval(countdownInterval);
  }, 1000);
  _warningOverlay._countdownInterval = countdownInterval;
}

function dismissInactivityWarning() {
  if (_warningOverlay) {
    if (_warningOverlay._countdownInterval) clearInterval(_warningOverlay._countdownInterval);
    _warningOverlay.remove();
    _warningOverlay = null;
  }
}

function performInactivityLogout() {
  dismissInactivityWarning();
  
  // Clear all session data
  sessionStorage.removeItem('sposh_admin_passcode');
  sessionStorage.removeItem('sposh_role');
  sessionStorage.removeItem('sposh_selected_role');
  sessionStorage.removeItem('sposh_permissions');
  sessionStorage.removeItem('sposh_staff_id');
  sessionStorage.removeItem('sposh_staff_name');

  // Set inactivity logged out flag and reload
  sessionStorage.setItem('sposh_logged_out_inactivity', 'true');
  window.location.reload();
}

function handleUserActivity(event) {
  // If the warning overlay is visible, ignore passive events (mousemove, scroll, touchstart).
  // Only allow explicit clicks on the keep-alive button or active keystrokes to extend the session.
  if (_warningOverlay) {
    if (event.type !== 'click' && event.type !== 'keydown') {
      return;
    }
  }

  const now = Date.now();
  if (now - _lastActivityTime > ACTIVITY_THROTTLE_MS || _warningOverlay) {
    _lastActivityTime = now;
    resetInactivityTimer();
  }
}

// Track user activity using capturing phase to capture actions even if stopPropagation() is called
['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
  document.addEventListener(evt, handleUserActivity, { capture: true, passive: true });
});

// Handle inactivity auto-logout when page visibility changes (minimized or tab switched)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && sessionStorage.getItem('sposh_admin_passcode')) {
    const elapsed = Date.now() - _lastActivityTime;
    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      performInactivityLogout();
    } else {
      resetInactivityTimer();
    }
  }
});


let bookingsCache = [];
let filteredRevenueCache = [];
let catalogCache = null;
let currentTab = 'bookings';
let activeRescheduleId = null;

// Helpers: Fetch wrapper with timeout & passcode auth headers
async function adminFetch(path, options = {}) {
  const passcode = sessionStorage.getItem('sposh_admin_passcode') || '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': passcode,
        'x-selected-role': sessionStorage.getItem('sposh_selected_role') || '',
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch { }
      const err = new Error(body?.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Apply visual role permissions
function applyRolePermissions(role, permissions) {
  const headerBadge = document.getElementById('header-role-badge');
  const pricingTabBtn = document.getElementById('tab-pricing-btn');
  const staffTabBtn = document.getElementById('tab-staff-btn');

  if (!permissions) {
    try {
      permissions = JSON.parse(sessionStorage.getItem('sposh_permissions') || '{}');
    } catch (e) {
      permissions = {};
    }
  }

  if (role === 'admin') {
    if (headerBadge) headerBadge.textContent = 'Admin';
    if (pricingTabBtn) pricingTabBtn.style.display = 'inline-flex';
    if (staffTabBtn) staffTabBtn.style.display = 'inline-flex';
    const revTabBtn = document.getElementById('tab-revenue-btn');
    if (revTabBtn) revTabBtn.style.display = 'inline-flex';
  } else {
    // Staff members: bookings tab only — no pricing, no staff management
    if (headerBadge) headerBadge.textContent = 'Staff';
    if (pricingTabBtn) pricingTabBtn.style.display = 'none';
    if (staffTabBtn) staffTabBtn.style.display = 'none';
    if (currentTab === 'pricing' || currentTab === 'staff') {
      switchTab('bookings');
    }
  }
}

// ─── LOGIN / AUTH ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check for inactivity logout toast
  if (sessionStorage.getItem('sposh_logged_out_inactivity') === 'true') {
    sessionStorage.removeItem('sposh_logged_out_inactivity');
    const msg = document.createElement('div');
    msg.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: linear-gradient(135deg, #E0447A, #FF8FAB); color: #fff;
      padding: 14px 24px; border-radius: 10px; font-size: 0.85rem; font-weight: 600;
      z-index: 100000; box-shadow: 0 4px 20px rgba(224, 68, 122, 0.4);
      font-family: 'DM Sans', sans-serif; animation: fadeIn 0.3s ease;
    `;
    msg.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> &nbsp; Logged out due to inactivity';
    document.body.appendChild(msg);
    setTimeout(() => {
      msg.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => msg.remove(), 300);
    }, 5000);
  }

  

  // Attach login button click handler (type="button" so no native form submit)
  const loginBtn = document.getElementById('btn-login');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
    
  }

  // Also catch form submit as fallback (Enter key)
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleLogin(e);
      return false;
    });
  }

  const savedPass = sessionStorage.getItem('sposh_admin_passcode');
  if (savedPass) {
    checkPasscodeAndLoad(savedPass);
  } else {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('admin-portal').style.display = 'none';
  }
});

async function handleLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (event && event.stopPropagation) event.stopPropagation();
  
  const input = document.getElementById('admin-passcode');
  const passcode = input.value.trim();
  const errEl = document.getElementById('login-error-msg');
  const btn = document.getElementById('btn-login');
  const card = document.querySelector('.login-card');

  const selectedRole = document.getElementById('login-role').value;
  if (!selectedRole) {
    errEl.textContent = 'Please select a personnel role.';
    return;
  }
  if (!passcode) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
  errEl.textContent = '';

  try {
    // Save passcode + selected role before request
    const selectedRole = document.getElementById('login-role').value;
    sessionStorage.setItem('sposh_admin_passcode', passcode);
    sessionStorage.setItem('sposh_selected_role', selectedRole);
    const checkRes = await adminFetch('/staff/bookings');
    
    // Auth success: Load portal
    bookingsCache = checkRes.bookings || [];
    const role = checkRes.role || 'staff';
    const permissions = checkRes.permissions || {};
    sessionStorage.setItem('sposh_role', role);
    sessionStorage.setItem('sposh_permissions', JSON.stringify(permissions));
    applyRolePermissions(role, permissions);

    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-portal').style.display = 'block';
    
    loadDashboard();
    resetInactivityTimer();
    checkDatabaseStatus(); // Start inactivity auto-logout timer
  } catch (err) {
    // Auth failed: Reset & notify
    sessionStorage.removeItem('sposh_admin_passcode');
    sessionStorage.removeItem('sposh_role');
    sessionStorage.removeItem('sposh_selected_role');
    sessionStorage.removeItem('sposh_permissions');
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 400);
    if (err.status === 401) {
      errEl.textContent = err.message || 'Incorrect passcode. Access Denied.';
    } else if (err.status === 429) {
      errEl.textContent = 'Too many attempts. Please wait a few minutes and try again.';
    } else if (err.status === 503) {
      errEl.textContent = 'Server not configured. Contact admin.';
    } else if (err.name === 'AbortError') {
      errEl.textContent = 'Connection timed out. Check your internet.';
    } else {
      errEl.textContent = err.message || 'Server connection failed. Try again.';
    }
    input.value = '';
    input.focus();
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Log In &nbsp;<i class="fa-solid fa-right-to-bracket"></i>';
  }
}

async function checkPasscodeAndLoad(passcode) {
  try {
    const checkRes = await adminFetch('/staff/bookings');
    bookingsCache = checkRes.bookings || [];
    const role = checkRes.role || 'staff';
    const permissions = checkRes.permissions || {};
    sessionStorage.setItem('sposh_role', role);
    sessionStorage.setItem('sposh_permissions', JSON.stringify(permissions));
    applyRolePermissions(role, permissions);

    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-portal').style.display = 'block';
    loadDashboard();
    resetInactivityTimer(); // Start timer if session is restored
    checkDatabaseStatus();
  } catch (err) {
    // Token is stale or invalid: Clear and prompt login
    sessionStorage.removeItem('sposh_admin_passcode');
    sessionStorage.removeItem('sposh_role');
    sessionStorage.removeItem('sposh_selected_role');
    sessionStorage.removeItem('sposh_permissions');
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('admin-portal').style.display = 'none';
  }
}

function handleLogout() {
  sessionStorage.removeItem('sposh_admin_passcode');
  sessionStorage.removeItem('sposh_role');
  sessionStorage.removeItem('sposh_selected_role');
  sessionStorage.removeItem('sposh_permissions');
  window.location.reload();
}

// ─── DASHBOARD NAVIGATION ───────────────────────────────────
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));

  if (tabName === 'bookings') {
    document.getElementById('tab-bookings-btn').classList.add('active');
    document.getElementById('panel-bookings').classList.add('active');
    renderBookingsList();
  } else if (tabName === 'pricing') {
    document.getElementById('tab-pricing-btn').classList.add('active');
    document.getElementById('panel-pricing').classList.add('active');
    loadCatalogPricing();
  } else if (tabName === 'staff') {
    document.getElementById('tab-staff-btn').classList.add('active');
    document.getElementById('panel-staff').classList.add('active');
    loadStaffList();
  } else if (tabName === 'revenue') {
    document.getElementById('tab-revenue-btn').classList.add('active');
    document.getElementById('panel-revenue').classList.add('active');
    loadRevenue();
  }
}

function loadDashboard() {
  switchTab('bookings');
}

async function loadRevenue() {
  const loader = document.getElementById('revenue-loader');
  if (loader) loader.style.display = 'flex';

  try {
    // Fetch latest bookings
    const res = await adminFetch('/staff/bookings');
    bookingsCache = res.bookings || [];

    // Populate staff filter list
    const staffSelect = document.getElementById('revenue-filter-staff');
    if (staffSelect) {
      const currentVal = staffSelect.value;
      staffSelect.innerHTML = '<option value="all">All Staff</option>';
      const expertsMap = {};
      bookingsCache.forEach(b => {
        if (b.expert && b.expertName) {
          expertsMap[b.expert] = b.expertName;
        }
      });
      Object.keys(expertsMap).forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = expertsMap[id];
        staffSelect.appendChild(opt);
      });
      if (currentVal && staffSelect.querySelector(`option[value="${currentVal}"]`)) {
        staffSelect.value = currentVal;
      }
    }

    renderRevenue();
  } catch (err) {
    adminToast('Failed to load revenue data: ' + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function renderRevenue() {
  const grid = document.getElementById('revenue-grid');
  const monthCard = document.getElementById('revenue-month-card');
  const monthRows = document.getElementById('revenue-month-rows');

  if (grid) grid.innerHTML = '';
  if (monthCard) monthCard.style.display = 'none';

  const timeframe = document.getElementById('revenue-filter-timeframe')?.value || 'month';
  const serviceType = document.getElementById('revenue-filter-type')?.value || 'all';
  const expertId = document.getElementById('revenue-filter-staff')?.value || 'all';

  // Toggle custom date range inputs visibility
  const customRangeContainer = document.getElementById('revenue-custom-range');
  if (customRangeContainer) {
    if (timeframe === 'custom') {
      customRangeContainer.style.display = 'flex';
    } else {
      customRangeContainer.style.display = 'none';
    }
  }

  // Helper date logic
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  endOfYesterday.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Custom date bounds
  let customStart = null;
  let customEnd = null;
  if (timeframe === 'custom') {
    const startVal = document.getElementById('revenue-filter-start-date')?.value;
    const endVal = document.getElementById('revenue-filter-end-date')?.value;
    if (startVal) {
      customStart = new Date(startVal);
      customStart.setHours(0, 0, 0, 0);
    }
    if (endVal) {
      customEnd = new Date(endVal);
      customEnd.setHours(23, 59, 59, 999);
    }
  }

  // Filter bookings (exclude cancelled ones)
  filteredRevenueCache = bookingsCache.filter(b => {
    if (b.status === 'cancelled') return false;

    // Timeframe filter
    const bDate = new Date(b.createdAt || b.dateISO);
    if (timeframe === 'today' && bDate < startOfToday) return false;
    if (timeframe === 'yesterday' && (bDate < startOfYesterday || bDate > endOfYesterday)) return false;
    if (timeframe === 'month' && bDate < startOfMonth) return false;
    if (timeframe === 'custom') {
      if (customStart && bDate < customStart) return false;
      if (customEnd && bDate > customEnd) return false;
    }

    // Service Type filter
    if (serviceType !== 'all' && b.serviceType !== serviceType) return false;

    // Expert filter
    if (expertId !== 'all' && b.expert !== expertId) return false;

    return true;
  });

  if (filteredRevenueCache.length === 0) {
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-chart-line"></i>
          <h4>No Revenue Found</h4>
          <p>No customer appointments or deposit payments matching the current filters were found.</p>
        </div>`;
    }
    return;
  }

  // Calculate stats
  const totalBookings = filteredRevenueCache.length;
  const totalDeposits = filteredRevenueCache.reduce((acc, b) => acc + (Number(b.depositDue) || 0), 0);

  const completedBookings = filteredRevenueCache.filter(b => b.status === 'completed');
  const totalRevenue = completedBookings.reduce((acc, b) => acc + (Number(b.total) || 0), 0);

  const confirmedBookingsCount = filteredRevenueCache.filter(b => b.status === 'confirmed').length;
  const pendingBookingsCount = filteredRevenueCache.filter(b => b.status === 'pending').length;

  if (grid) {
    grid.innerHTML = `
      <div style="background: var(--admin-card); border: 1px solid rgba(224, 68, 122, 0.15); border-radius: 12px; padding: 20px;">
        <div style="color: #a59f95; font-size: 0.85rem; margin-bottom: 8px;">Total Bookings</div>
        <div style="color: #fff; font-size: 1.5rem; font-weight: 700;">${totalBookings}</div>
        <div style="color: #e0447a; font-size: 0.75rem; margin-top: 4px;">For selected filters</div>
      </div>
      <div style="background: var(--admin-card); border: 1px solid rgba(224, 68, 122, 0.15); border-radius: 12px; padding: 20px;">
        <div style="color: #a59f95; font-size: 0.85rem; margin-bottom: 8px;">Deposits Collected</div>
        <div style="color: #fff; font-size: 1.5rem; font-weight: 700;">₦${totalDeposits.toLocaleString()}</div>
        <div style="color: #e0447a; font-size: 0.75rem; margin-top: 4px;">Down payments received</div>
      </div>
      <div style="background: var(--admin-card); border: 1px solid rgba(224, 68, 122, 0.15); border-radius: 12px; padding: 20px;">
        <div style="color: #a59f95; font-size: 0.85rem; margin-bottom: 8px;">Total Completed Revenue</div>
        <div style="color: #fff; font-size: 1.5rem; font-weight: 700;">₦${totalRevenue.toLocaleString()}</div>
        <div style="color: #e0447a; font-size: 0.75rem; margin-top: 4px;">From completed sessions</div>
      </div>
    `;
  }

  if (monthCard && monthRows) {
    monthCard.style.display = 'block';

    const headerTitle = monthCard.querySelector('h4');
    if (headerTitle) {
      let label = 'This Month';
      if (timeframe === 'all') label = 'All-Time';
      else if (timeframe === 'today') label = 'Today';
      else if (timeframe === 'yesterday') label = 'Yesterday';
      else if (timeframe === 'custom') {
        const startVal = document.getElementById('revenue-filter-start-date')?.value;
        const endVal = document.getElementById('revenue-filter-end-date')?.value;
        if (startVal && endVal) {
          label = `Custom (${startVal} to ${endVal})`;
        } else if (startVal) {
          label = `Custom (From ${startVal})`;
        } else if (endVal) {
          label = `Custom (To ${endVal})`;
        } else {
          label = 'Custom Range';
        }
      }
      headerTitle.innerHTML = `<i class="fa-regular fa-calendar" style="color:#e0447a;"></i> ${label}'s Breakdown`;
    }

    monthRows.innerHTML = `
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px;">
        <span style="color:#a59f95;">Completed Appointments</span>
        <span style="color:#fff;font-weight:700;">${completedBookings.length}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px;">
        <span style="color:#a59f95;">Completed Service Revenue</span>
        <span style="color:#e0447a;font-weight:700;">₦${totalRevenue.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px;">
        <span style="color:#a59f95;">Confirmed Bookings (Pending Attendance)</span>
        <span style="color:#fff;font-weight:700;">${confirmedBookingsCount}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding-bottom:8px;">
        <span style="color:#a59f95;">Pending Bookings (Unconfirmed Deposits)</span>
        <span style="color:#fff;font-weight:700;">${pendingBookingsCount}</span>
      </div>
    `;
  }
}


// ─── MANAGE BOOKINGS TAB ────────────────────────────────────
async function loadBookings() {
  const loader = document.getElementById('bookings-loader');
  if (loader) loader.style.display = 'flex';

  try {
    const res = await adminFetch('/staff/bookings');
    bookingsCache = res.bookings || [];
    renderBookingsList();
  } catch (err) {
    adminToast('Failed to load appointments: ' + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function renderBookingsList() {
  const grid = document.getElementById('bookings-grid-list');
  if (!grid) return;

  const searchQuery = document.getElementById('booking-search')?.value.toLowerCase().trim() || '';
  const statusFilter = document.getElementById('booking-status-filter')?.value || 'all';

  const filtered = bookingsCache.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;

    if (searchQuery) {
      const matchEmail = (b.clientEmail || '').toLowerCase().includes(searchQuery);
      const matchName = (b.clientName || '').toLowerCase().includes(searchQuery);
      const matchRef = (b.reference_id || '').toLowerCase().includes(searchQuery);
      return matchEmail || matchName || matchRef;
    }
    return true;
  });

  if (filteredRevenueCache.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-calendar"></i>
        <h4>No Bookings Found</h4>
        <p>${searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters or search terms.' : 'No customer appointments recorded in the database.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(b => {
    const isPast = new Date(b.dateISO) < new Date();
    const serviceNames = (b.services || []).map(s => s.name).join(', ');
    
    const addressBlock = b.serviceType === 'home' && b.address
      ? `<div class="admin-booking-info-block" style="width: 100%; margin-top: 8px;">
           <span class="admin-label">Home Address</span>
           <span class="admin-val">${b.address}</span>
         </div>`
      : '';

    let actionButtons = '';
    if (b.status === 'completed') {
      actionButtons = `<span style="font-size:0.72rem;color:#22a86b;text-transform:uppercase;letter-spacing:1px;text-align:center;padding:8px 0;display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-circle-check"></i> Service Completed</span>`;
    } else if (b.status !== 'cancelled' && !isPast) {
      let permissions = {};
      try {
        permissions = JSON.parse(sessionStorage.getItem('sposh_permissions') || '{}');
      } catch (e) {}

      const role = sessionStorage.getItem('sposh_role');
      const isAdminUser = role === 'admin';
      const canResched = isAdminUser || permissions.canRescheduleBookings;
      const canCancel = isAdminUser || permissions.canCancelBookings;
      const canComplete = isAdminUser || permissions.canConfirmComplete !== false;

      if (canComplete && (b.status === 'confirmed' || b.status === 'rescheduled')) {
        const totalAmt = b.total || 0;
        const depositAmt = b.depositDue || 0;
        actionButtons += `
          <button class="btn-confirm-complete" id="btn-adm-done-${b.reference_id}"
            onclick="openConfirmCompleteModal('${b.reference_id}', '${b.reference_id}', '${(b.clientName||'').replace(/'/g,"\'")}', ${totalAmt}, ${depositAmt})">
            <i class="fa-solid fa-circle-check"></i> Confirm Complete
          </button>`;
      }
      if (canResched) {
        actionButtons += `
          <button class="btn-admin-resched" id="btn-adm-res-${b.reference_id}" onclick="openRescheduleModal('${b.reference_id}')">
            <i class="fa-solid fa-clock-rotate-left"></i> Reschedule
          </button>`;
      }
      if (canCancel) {
        actionButtons += `
          <button class="btn-admin-cancel" id="btn-adm-can-${b.reference_id}" onclick="adminCancelBooking('${b.reference_id}', '${b.clientEmail}')">
            <i class="fa-solid fa-calendar-xmark"></i> Cancel
          </button>`;
      }

      if (!canResched && !canCancel && !canComplete) {
        actionButtons = `<span style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;text-align:center;padding:8px 0;">View Only</span>`;
      }
    } else {
      actionButtons = `<span style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;text-align:center;padding:8px 0;">Locked</span>`;
    }

    return `
      <div class="admin-booking-row" id="abr-${b.reference_id}">
        <div class="admin-booking-details">
          
          <div class="admin-booking-info-block">
            <span class="admin-label">Ref ID</span>
            <span class="admin-val ref">${b.reference_id}</span>
          </div>

          <div class="admin-booking-info-block">
            <span class="admin-label">Client Details</span>
            <span class="admin-val" style="font-weight: 700;">${b.clientName}</span>
            <div style="font-size:0.75rem;color:var(--text-dim);">${b.clientEmail} &bull; ${b.clientPhone}</div>
          </div>

          <div class="admin-booking-info-block">
            <span class="admin-label">Date & Time</span>
            <span class="admin-val" style="font-size:0.85rem;">${b.dateDisplay}</span>
            <div style="font-size:0.75rem;color:var(--text-dim);">${b.time}</div>
          </div>

          <div class="admin-booking-info-block services-list">
            <span class="admin-label">Services</span>
            <span class="admin-val" style="font-size:0.82rem;">${serviceNames}</span>
            <div style="font-size:0.75rem;color:var(--primary-rose);">${b.serviceType === 'home' ? 'Home Service (+₦5,000)' : 'In-Studio'}</div>
          </div>

          <div class="admin-booking-info-block">
            <span class="admin-label">Pricing</span>
            <span class="admin-val" style="color:var(--primary-rose); font-weight:700;">Total: ₦${(b.total || 0).toLocaleString()}</span>
            <div style="font-size:0.75rem;color:var(--text-dim);">Deposit: ₦${(b.depositDue || 0).toLocaleString()}</div>
          </div>

          <div class="admin-booking-info-block">
            <span class="admin-label">Status</span>
            <span class="admin-val status-badge ${b.status}">${b.status}</span>
            <div style="font-size:0.72rem;color:var(--text-dim);text-transform:capitalize;margin-top:2px;">Payment: ${b.paymentStatus}</div>
          </div>

          ${addressBlock}

        </div>
        <div class="admin-booking-actions">
          ${actionButtons}
        </div>
      </div>`;
  }).join('');
}

function filterBookings() {
  renderBookingsList();
}

async function adminCancelBooking(id, email) {
  const confirmMsg = `Are you sure you want to cancel appointment ${id} for client ${email}? This action is irreversible.`;
  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById(`btn-adm-can-${id}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling...'; }

  try {
    await adminFetch(`/bookings/cancel/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ email })
    });
    adminToast(`Booking ${id} cancelled successfully!`);
    loadBookings();
  } catch (err) {
    adminToast('Failed to cancel booking: ' + err.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-calendar-xmark"></i> Cancel'; }
  }
}

// ─── RESCHEDULE MODAL CONTROLS ──────────────────────────────
function openRescheduleModal(id) {
  activeRescheduleId = id;
  const booking = bookingsCache.find(b => b.reference_id === id);
  if (!booking) return;

  document.getElementById('resched-ref-label').textContent = id;
  const currentIsoDate = booking.dateISO ? booking.dateISO.split('T')[0] : '';
  document.getElementById('resched-date').value = currentIsoDate;
  document.getElementById('resched-time').value = booking.startTime || '';

  document.getElementById('reschedule-modal').style.display = 'flex';
}

function closeRescheduleModal() {
  document.getElementById('reschedule-modal').style.display = 'none';
  activeRescheduleId = null;
}

// ─── CONFIRM COMPLETE MODAL CONTROLS ────────────────────────────
let _completeBookingId = null;

function openConfirmCompleteModal(bookingId, refId, clientName, total, deposit) {
  _completeBookingId = bookingId;
  const balance = total - deposit;
  document.getElementById('complete-ref-label').textContent = refId;
  document.getElementById('complete-client-label').textContent = clientName;
  document.getElementById('complete-balance-amount').textContent = '\u20a6' + balance.toLocaleString();
  document.getElementById('complete-balance-breakdown').textContent =
    'Total: \u20a6' + total.toLocaleString() + ' \u00b7 Deposit paid: \u20a6' + deposit.toLocaleString();
  document.getElementById('complete-notes').value = '';
  document.getElementById('complete-payment-method').value = 'cash';
  document.getElementById('confirm-complete-modal').style.display = 'flex';
}

function closeConfirmCompleteModal() {
  document.getElementById('confirm-complete-modal').style.display = 'none';
  _completeBookingId = null;
}

async function submitConfirmComplete() {
  if (!_completeBookingId) return;
  const btn = document.getElementById('btn-submit-complete');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
  try {
    await adminFetch('/bookings/' + _completeBookingId + '/complete', {
      method: 'PATCH',
      body: JSON.stringify({
        paymentMethod: document.getElementById('complete-payment-method').value,
        completionNotes: document.getElementById('complete-notes').value.trim(),
      }),
    });
    closeConfirmCompleteModal();
    adminToast('Booking marked complete! Balance collected.');
    checkDbMode();
    await loadBookings();
  } catch (err) {
    adminToast('Failed to mark complete: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark Complete & Collect Balance';
  }
}

async function submitReschedule(event) {
  event.preventDefault();
  if (!activeRescheduleId) return;

  const dateVal = document.getElementById('resched-date').value;
  const timeVal = document.getElementById('resched-time').value;
  const booking = bookingsCache.find(b => b.reference_id === activeRescheduleId);
  
  if (!booking || !dateVal || !timeVal) return;

  const btn = document.getElementById('btn-submit-resched');

  // Parse duration
  let durationMinutes = 60;
  if (booking.services && booking.services.length > 0) {
    durationMinutes = booking.services.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  } else {
    const parenMatch = booking.time.match(/\(([^)]+)\)/);
    const dotMatch = booking.time.match(/·\s*(\d+)\s*min/);
    if (parenMatch) {
      const durStr = parenMatch[1];
      if (durStr.includes('hr')) {
        const hrs = parseFloat(durStr.replace('hr', '').trim());
        if (!isNaN(hrs)) durationMinutes = Math.round(hrs * 60);
      } else if (durStr.includes('min')) {
        const mins = parseInt(durStr.replace('min', '').trim(), 10);
        if (!isNaN(mins)) durationMinutes = mins;
      }
    } else if (dotMatch) {
      const mins = parseInt(dotMatch[1], 10);
      if (!isNaN(mins)) durationMinutes = mins;
    }
  }

  const C_start = slotToMinutes(timeVal);
  const C_duration = durationMinutes;

  const overlapBooking = bookingsCache.find(b => {
    if (b.reference_id === activeRescheduleId) return false;
    if (b.status === 'cancelled') return false;

    const bDateStr = new Date(b.dateISO).toDateString();
    const targetDateStr = new Date(dateVal).toDateString();
    if (bDateStr !== targetDateStr) return false;

    const E_start = slotToMinutes(b.startTime);
    let E_duration = 60;
    if (b.services && b.services.length > 0) {
      E_duration = b.services.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    } else {
      const parenMatch = b.time.match(/\(([^)]+)\)/);
      const dotMatch = b.time.match(/·\s*(\d+)\s*min/);
      if (parenMatch) {
        const durStr = parenMatch[1];
        if (durStr.includes('hr')) {
          const hrs = parseFloat(durStr.replace('hr', '').trim());
          if (!isNaN(hrs)) E_duration = Math.round(hrs * 60);
        } else if (durStr.includes('min')) {
          const mins = parseInt(durStr.replace('min', '').trim(), 10);
          if (!isNaN(mins)) E_duration = mins;
        }
      } else if (dotMatch) {
        const mins = parseInt(dotMatch[1], 10);
        if (!isNaN(mins)) E_duration = mins;
      }
    }

    if (C_start < E_start + E_duration && E_start < C_start + C_duration) {
      return true;
    }
    return false;
  });

  if (overlapBooking) {
    adminToast(`Time slot conflicts with booking ${overlapBooking.reference_id} (${overlapBooking.clientName} - ${overlapBooking.time}).`);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    await adminFetch(`/bookings/reschedule/${activeRescheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        email: booking.clientEmail,
        appointment_date: dateVal,
        appointment_time: to24Hour(timeVal)
      })
    });

    adminToast(`Booking ${activeRescheduleId} rescheduled successfully!`);
    closeRescheduleModal();
    loadBookings();
  } catch (err) {
    adminToast('Failed to reschedule: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Save Changes';
  }
}

// ─── MANAGE PRICING TAB ─────────────────────────────────────
async function loadCatalogPricing() {
  const loader = document.getElementById('pricing-loader');
  if (loader) loader.style.display = 'flex';

  try {
    const res = await adminFetch('/services');
    catalogCache = res.groups || [];
    renderPricingList();
  } catch (err) {
    adminToast('Failed to load services: ' + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

const CATEGORY_ICONS = {
  hair_making: 'fa-scissors',
  wigs: 'fa-crown',
  nails: 'fa-hand-sparkles',
  lash: 'fa-eye',
  makeup: 'fa-wand-magic-sparkles',
  care: 'fa-spa',
  men: 'fa-user-tie'
};

function renderPricingList() {
  const container = document.getElementById('pricing-categories-list');
  if (!container || !catalogCache) return;

  if (catalogCache.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-tags"></i>
        <h4>Catalog Empty</h4>
        <p>No categories or service options found in the database.</p>
      </div>`;
    return;
  }

  container.innerHTML = catalogCache.map(group => {
    const iconClass = CATEGORY_ICONS[group.id] || 'fa-tags';
    
    const optionsHtml = (group.options || []).map(opt => {
      return `
        <div class="admin-option-row" id="opt-row-${opt.id}">
          <div class="admin-option-field">
            <label class="admin-label-small">Service Name</label>
            <input type="text" class="admin-name-input" id="name-input-${opt.id}" value="${opt.name}" placeholder="Service Name" required>
          </div>
          
          <div class="admin-option-field">
            <label class="admin-label-small">Duration</label>
            <div class="admin-duration-input-wrapper">
              <input type="number" class="admin-duration-input" id="duration-input-${opt.id}" value="${opt.durationMinutes}" min="1" placeholder="Mins" required>
              <span class="input-suffix">min</span>
            </div>
          </div>

          <div class="admin-option-field">
            <label class="admin-label-small">Price</label>
            <div class="admin-price-input-wrapper">
              <span class="input-prefix">₦</span>
              <input type="number" class="admin-price-input" id="price-input-${opt.id}" value="${opt.price}" min="0" placeholder="Price" required>
            </div>
          </div>

          <div class="admin-option-field">
            <label class="admin-label-small" style="opacity: 0;">Actions</label>
            <div class="admin-option-actions">
              <button class="btn-save-price" id="btn-save-${opt.id}" onclick="saveServiceOption('${opt.id}')" title="Save Changes">
                <i class="fa-regular fa-floppy-disk"></i> Save
              </button>
              <button class="btn-delete-service" id="btn-delete-${opt.id}" onclick="deleteServiceOption('${opt.id}')" title="Delete Option">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="admin-category-block">
        <div class="admin-category-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fa-solid ${iconClass}"></i>
            <h3>${group.name.toUpperCase()}</h3>
          </div>
          <button class="btn-add-service-trigger" onclick="openAddServiceModal('${group.id}', '${group.name}')">
            <i class="fa-solid fa-plus"></i> Add Service
          </button>
        </div>
        <div class="admin-options-list">
          ${optionsHtml || `<div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 0.88rem;">No services in this category yet. Click Add Service to add one.</div>`}
        </div>
      </div>`;
  }).join('');
}

async function saveServiceOption(optionId) {
  const nameInput = document.getElementById(`name-input-${optionId}`);
  const durationInput = document.getElementById(`duration-input-${optionId}`);
  const priceInput = document.getElementById(`price-input-${optionId}`);
  const btn = document.getElementById(`btn-save-${optionId}`);
  
  if (!nameInput || !durationInput || !priceInput || !btn) return;

  const newName = nameInput.value.trim();
  const newDuration = parseInt(durationInput.value, 10);
  const newPrice = parseInt(priceInput.value, 10);

  if (!newName) {
    adminToast('Please enter a service name.');
    return;
  }
  if (isNaN(newDuration) || newDuration <= 0) {
    adminToast('Please enter a valid duration (minimum 1 minute).');
    return;
  }
  if (isNaN(newPrice) || newPrice < 0) {
    adminToast('Please enter a valid price.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    await adminFetch(`/admin/services/${optionId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: newName,
        durationMinutes: newDuration,
        price: newPrice
      })
    });
    
    const option = findOptionInCache(optionId);
    if (option) {
      option.name = newName;
      option.durationMinutes = newDuration;
      option.price = newPrice;
    }
    
    adminToast('Service updated successfully!');
    btn.innerHTML = '<i class="fa-solid fa-check" style="color: #2ecc71;"></i> Saved';
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save';
    }, 2000);
  } catch (err) {
    adminToast('Failed to save service option: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save';
  }
}

async function deleteServiceOption(optionId) {
  const option = findOptionInCache(optionId);
  const serviceName = option ? option.name : optionId;
  
  const confirmMsg = `Are you sure you want to delete "${serviceName}"? This option will no longer be available for future bookings.`;
  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById(`btn-delete-${optionId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  }

  try {
    await adminFetch(`/admin/services/${optionId}`, {
      method: 'DELETE'
    });
    
    adminToast(`Service "${serviceName}" deleted successfully!`);
    loadCatalogPricing();
  } catch (err) {
    adminToast('Failed to delete service: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    }
  }
}

// ─── ADD SERVICE MODAL CONTROLS ─────────────────────────────
function openAddServiceModal(categoryId, categoryName) {
  document.getElementById('add-service-category-id').value = categoryId;
  document.getElementById('add-service-category-label').textContent = categoryName;
  document.getElementById('add-service-name').value = '';
  document.getElementById('add-service-duration').value = '';
  document.getElementById('add-service-price').value = '';
  
  document.getElementById('add-service-modal').style.display = 'flex';
}

function closeAddServiceModal() {
  document.getElementById('add-service-modal').style.display = 'none';
}

async function submitAddService(event) {
  event.preventDefault();
  
  const categoryId = document.getElementById('add-service-category-id').value;
  const name = document.getElementById('add-service-name').value.trim();
  const durationMinutes = parseInt(document.getElementById('add-service-duration').value, 10);
  const price = parseInt(document.getElementById('add-service-price').value, 10);
  
  if (!categoryId || !name || isNaN(durationMinutes) || isNaN(price)) {
    adminToast('Please fill out all fields correctly.');
    return;
  }

  const btn = document.getElementById('btn-submit-add-service');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

  try {
    await adminFetch('/admin/services', {
      method: 'POST',
      body: JSON.stringify({
        categoryId,
        name,
        durationMinutes,
        price
      })
    });

    adminToast(`Service "${name}" added successfully!`);
    closeAddServiceModal();
    loadCatalogPricing();
  } catch (err) {
    adminToast('Failed to add service: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Add Service';
  }
}

function findOptionInCache(optionId) {
  if (!catalogCache) return null;
  for (const group of catalogCache) {
    const opt = (group.options || []).find(o => o.id === optionId);
    if (opt) return opt;
  }
  return null;
}

// ─── UTILS ──────────────────────────────────────────────────
function to24Hour(time12h) {
  if (!time12h) return null;
  const [time, period] = time12h.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function adminToast(msg) {
  document.getElementById('sp-admin-toast')?.remove();
  const el = document.createElement('div');
  el.id = 'sp-admin-toast';
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '32px', right: '32px',
    background: '#160D22', color: '#FF8FAB',
    border: '1px solid rgba(255, 143, 171, 0.3)',
    padding: '14px 28px', borderRadius: '10px', zIndex: '10000',
    fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: '600',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    opacity: '0', transform: 'translateY(20px)',
    transition: 'all 0.3s ease',
  });
  document.body.appendChild(el);
  el.offsetHeight; // Force reflow
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(15px)';
    setTimeout(() => el.remove(), 350);
  }, 4000);
}

// ─── MANAGE STAFF TAB ───────────────────────────────────────
let staffCache = [];

async function loadStaffList() {
  const loader = document.getElementById('staff-loader');
  if (loader) loader.style.display = 'flex';

  try {
    const res = await adminFetch('/admin/staff');
    staffCache = res.staff || [];
    renderStaffList();
  } catch (err) {
    adminToast('Failed to load staff list: ' + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function renderStaffList() {
  const container = document.getElementById('staff-members-list');
  if (!container) return;

  if (staffCache.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-users-gear"></i>
        <h4>No Staff Found</h4>
        <p>Click "Add Staff" to register your first team member.</p>
      </div>`;
    return;
  }

  container.innerHTML = staffCache.map(s => {
    const avatarHtml = s.img 
      ? `<img src="${s.img}" alt="${s.name}" id="staff-avatar-img-${s.id}">` 
      : `<i class="fa-solid fa-user" style="font-size: 1.5rem; color: var(--primary-rose);" id="staff-avatar-icon-${s.id}"></i>`;
      
    const p = s.permissions || {};

    return `
      <div class="admin-staff-card" id="staff-card-${s.id}">
        <div class="admin-staff-header">
          <div class="admin-staff-avatar" style="position: relative; cursor: pointer;" onclick="document.getElementById('staff-photo-input-${s.id}').click()" title="Click to change photo">
            ${avatarHtml}
            <div style="position: absolute; bottom: -4px; right: -4px; background: var(--primary-rose); border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"><i class="fa-solid fa-camera"></i></div>
            <input type="file" id="staff-photo-input-${s.id}" accept="image/*" style="display:none" onchange="handleStaffPhotoChange('${s.id}', event)">
          </div>
          <div class="admin-staff-meta">
            <h3>${s.name}</h3>
            <p>${s.role}</p>
          </div>
        </div>

        <div class="admin-staff-details">
          <div class="form-field">
            <label class="admin-label-small">Name</label>
            <input type="text" class="admin-name-input" id="staff-name-${s.id}" value="${s.name}" required>
          </div>

          <div class="form-field">
            <label class="admin-label-small">Role / Title</label>
            <input type="text" class="admin-name-input" id="staff-role-${s.id}" value="${s.role}" required>
          </div>

          <div class="form-field-row" style="display: flex; gap: 12px;">
            <div class="form-field" style="flex: 1;">
              <label class="admin-label-small" style="display:flex;align-items:center;gap:5px;"><i class="fa-brands fa-instagram" style="color:#e0447a;font-size:0.75rem;"></i> Instagram</label>
              <input type="text" class="admin-name-input" id="staff-ig-${s.id}" value="${s.ig && s.ig !== '#' ? s.ig : ''}" placeholder="sposhappeal" style="font-size: 0.8rem;">
            </div>
            <div class="form-field" style="flex: 1;">
              <label class="admin-label-small">Passcode</label>
              <input type="password" class="admin-name-input" id="staff-passcode-${s.id}" value="" placeholder="Leave blank to keep" style="font-size: 0.8rem;" autocomplete="new-password">
            </div>
          </div>

           <div class="form-field-row" style="display: flex; gap: 12px;">
             <div class="form-field" style="flex: 1;">
               <label class="admin-label-small" style="display:flex;align-items:center;gap:5px;"><i class="fa-brands fa-facebook" style="color:#1877f2;font-size:0.75rem;"></i> Facebook</label>
               <input type="text" class="admin-name-input" id="staff-fb-${s.id}" value="${s.fb || ''}" placeholder="sposhappeal" style="font-size: 0.8rem;">
             </div>
             <div class="form-field" style="flex: 1;">
               <label class="admin-label-small" style="display:flex;align-items:center;gap:5px;"><i class="fa-brands fa-tiktok" style="font-size:0.75rem;"></i> TikTok</label>
               <input type="text" class="admin-name-input" id="staff-tiktok-${s.id}" value="${s.tiktok || ''}" placeholder="sposhappeal" style="font-size: 0.8rem;">
             </div>
           </div>

          <div class="admin-staff-permissions">
            <h4>Access Permissions</h4>
            <div class="staff-perm-list">
              <label class="staff-perm-item">
                <input type="checkbox" id="staff-perm-view-${s.id}" ${p.canViewBookings ? 'checked' : ''}> View Bookings
              </label>
              <label class="staff-perm-item">
                <input type="checkbox" id="staff-perm-cancel-${s.id}" ${p.canCancelBookings ? 'checked' : ''}> Cancel Bookings
              </label>
              <label class="staff-perm-item">
                <input type="checkbox" id="staff-perm-resched-${s.id}" ${p.canRescheduleBookings ? 'checked' : ''}> Reschedule
              </label>
              <label class="staff-perm-item">
                <input type="checkbox" id="staff-perm-catalog-${s.id}" ${p.canEditCatalog ? 'checked' : ''}> Edit Catalog
              </label>
              <label class="staff-perm-item">
                <input type="checkbox" id="staff-perm-confirm-${s.id}" ${p.canConfirmComplete !== false ? 'checked' : ''}> Confirm Complete
              </label>
            </div>
          </div>
        </div>

        <div class="admin-staff-actions">
          <button class="btn-staff-save" id="btn-save-staff-${s.id}" onclick="saveStaffMember('${s.id}')">
            <i class="fa-regular fa-floppy-disk"></i> Save
          </button>
          <button class="btn-staff-delete" id="btn-delete-staff-${s.id}" onclick="deleteStaffMember('${s.id}')">
            <i class="fa-regular fa-trash-can"></i> Delete
          </button>
        </div>
      </div>`;
  }).join('');
}

async function saveStaffMember(staffId) {
  const nameVal = document.getElementById(`staff-name-${staffId}`).value.trim();
  const roleVal = document.getElementById(`staff-role-${staffId}`).value.trim();
  const igVal     = document.getElementById(`staff-ig-${staffId}`).value.trim();
  const fbVal     = document.getElementById(`staff-fb-${staffId}`).value.trim();
  const tiktokVal = document.getElementById(`staff-tiktok-${staffId}`).value.trim();
  const passcodeVal = document.getElementById(`staff-passcode-${staffId}`).value.trim();
  const btn = document.getElementById(`btn-save-staff-${staffId}`);

  const pView    = document.getElementById(`staff-perm-view-${staffId}`).checked;
  const pCancel  = document.getElementById(`staff-perm-cancel-${staffId}`).checked;
  const pResched = document.getElementById(`staff-perm-resched-${staffId}`).checked;
  const pCatalog = document.getElementById(`staff-perm-catalog-${staffId}`).checked;
  const pConfirm = document.getElementById(`staff-perm-confirm-${staffId}`)?.checked ?? true;

  if (!nameVal || !roleVal) {
    adminToast('Name and Role are required.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  // Only include passcode in the payload if admin typed a new one
  const payload = {
    name: nameVal,
    role: roleVal,
    ig: igVal,
    fb: fbVal,
    tiktok: tiktokVal,
    permissions: {
      canViewBookings: pView,
      canCancelBookings: pCancel,
      canRescheduleBookings: pResched,
      canEditCatalog: pCatalog,
      canConfirmComplete: pConfirm
    }
  };
  if (passcodeVal) payload.passcode = passcodeVal;
  // Include photo if admin selected a new one
  if (_staffPhotoEdits[staffId]) {
    payload.img = _staffPhotoEdits[staffId];
  }

  try {
    const response = await adminFetch(`/admin/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    adminToast(`Staff member "${nameVal}" updated successfully!`);
    delete _staffPhotoEdits[staffId]; // Clear photo edit cache
    btn.innerHTML = '<i class="fa-solid fa-check" style="color: #2ecc71;"></i> Saved';
    
    // Refresh staff cache locally
    const cachedIdx = staffCache.findIndex(s => s.id === staffId);
    if (cachedIdx !== -1 && response.staff) {
      staffCache[cachedIdx] = response.staff;
    }
    
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save';
    }, 2000);
  } catch (err) {
    adminToast('Failed to save staff updates: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save';
  }
}

async function deleteStaffMember(staffId) {
  const staff = staffCache.find(s => s.id === staffId);
  const name = staff ? staff.name : staffId;

  if (!confirm(`Are you sure you want to remove "${name}" from S'posh APPEAL staff?`)) {
    return;
  }

  const btn = document.getElementById(`btn-delete-staff-${staffId}`);
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    await adminFetch(`/admin/staff/${staffId}`, {
      method: 'DELETE'
    });

    adminToast(`Staff member "${name}" removed successfully!`);
    loadStaffList();
  } catch (err) {
    adminToast('Failed to delete staff member: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-regular fa-trash-can"></i> Delete';
  }
}

// Modal management
function openAddStaffModal() {
  document.getElementById('add-staff-name').value = '';
  document.getElementById('add-staff-role').value = '';
  document.getElementById('add-staff-bio').value = '';
  document.getElementById('add-staff-ig').value = '';
  document.getElementById('add-staff-passcode').value = '';
  
  document.getElementById('p-view-bookings').checked = true;
  document.getElementById('p-cancel-bookings').checked = false;
  document.getElementById('p-resched-bookings').checked = false;
  document.getElementById('p-edit-catalog').checked = false;
  document.getElementById('p-confirm-complete').checked = true;

  document.getElementById('add-staff-modal').style.display = 'flex';
}

function closeAddStaffModal() {
  document.getElementById('add-staff-modal').style.display = 'none';
}

// ── Staff photo preview & base64 conversion ──
let _staffPhotoBase64 = null;
const _staffPhotoEdits = {};  // Track photo changes per staff ID

function handleStaffPhotoChange(staffId, event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    adminToast('Photo must be under 2MB.', 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    _staffPhotoEdits[staffId] = e.target.result;
    // Update avatar preview immediately
    const avatarDiv = document.querySelector('#staff-card-' + staffId + ' .admin-staff-avatar');
    if (avatarDiv) {
      const existingImg = avatarDiv.querySelector('img');
      const existingIcon = avatarDiv.querySelector('i.fa-user');
      if (existingImg) {
        existingImg.src = e.target.result;
      } else if (existingIcon) {
        existingIcon.style.display = 'none';
        const newImg = document.createElement('img');
        newImg.src = e.target.result;
        newImg.alt = 'Staff photo';
        newImg.id = 'staff-avatar-img-' + staffId;
        avatarDiv.insertBefore(newImg, avatarDiv.firstChild);
      }
    }
    adminToast('Photo selected — click Save to apply.');
  };
  reader.readAsDataURL(file);
}

function previewAddStaffPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate size — max 2MB
  if (file.size > 2 * 1024 * 1024) {
    adminToast('Photo must be under 2MB. Please choose a smaller image.', 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    _staffPhotoBase64 = e.target.result; // data:image/jpeg;base64,...
    const preview = document.getElementById('add-staff-photo-preview');
    const icon    = document.getElementById('add-staff-photo-icon');
    const hint    = document.getElementById('add-staff-photo-hint');
    preview.src = _staffPhotoBase64;
    preview.style.display = 'block';
    icon.style.display = 'none';
    hint.textContent = file.name;
  };
  reader.readAsDataURL(file);
}

async function submitAddStaff(event) {
  event.preventDefault();

  const nameVal = document.getElementById('add-staff-name').value.trim();
  const roleVal = document.getElementById('add-staff-role').value.trim();
  const bioVal = document.getElementById('add-staff-bio').value.trim();
  const igVal     = document.getElementById('add-staff-ig').value.trim();
  const fbVal     = document.getElementById('add-staff-fb').value.trim();
  const tiktokVal = document.getElementById('add-staff-tiktok').value.trim();
  const passcodeVal = document.getElementById('add-staff-passcode').value.trim();

  const pView = document.getElementById('p-view-bookings').checked;
  const pCancel = document.getElementById('p-cancel-bookings').checked;
  const pResched = document.getElementById('p-resched-bookings').checked;
  const pCatalog = document.getElementById('p-edit-catalog').checked;
  const pConfirm = document.getElementById('p-confirm-complete').checked;

  if (!nameVal || !passcodeVal) {
    adminToast('Staff Name and Login Passcode are required.');
    return;
  }

  const btn = document.getElementById('btn-submit-add-staff');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

  try {
    await adminFetch('/admin/staff', {
      method: 'POST',
      body: JSON.stringify({
        name: nameVal,
        role: roleVal,
        bio: bioVal,
        ig: igVal,
    fb: fbVal,
    tiktok: tiktokVal,
        img: _staffPhotoBase64 || null,
        passcode: passcodeVal,
        permissions: {
          canViewBookings: pView,
          canCancelBookings: pCancel,
          canRescheduleBookings: pResched,
          canEditCatalog: pCatalog,
          canConfirmComplete: pConfirm
        }
      })
    });

    adminToast(`Staff member "${nameVal}" added successfully!`);
    _staffPhotoBase64 = null; // Reset for next add
    closeAddStaffModal();
    loadStaffList();
  } catch (err) {
    adminToast('Failed to add staff member: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Add Staff Member';
  }
}

function slotToMinutes(slot) {
  if (!slot) return 0;
  if (slot.includes('AM') || slot.includes('PM')) {
    const [time, period] = slot.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  } else {
    let [h, m] = slot.split(':').map(Number);
    return h * 60 + m;
  }
}


/* 📊 CSV Statement Exporter */
function downloadRevenueStatement() {
  if (!filteredRevenueCache || filteredRevenueCache.length === 0) {
    adminToast('No revenue records available for download.');
    return;
  }

  const headers = [
    'Booking Reference',
    'Client Name',
    'Client Email',
    'Client Phone',
    'Appointment Date',
    'Time Window',
    'Service(s) Booked',
    'Assigned Expert',
    'Service Type',
    'Total Cost (NGN)',
    'Deposit Due (NGN)',
    'Appointment Status',
    'Payment Status'
  ];

  const rows = filteredRevenueCache.map(b => {
    const serviceNames = Array.isArray(b.services)
      ? b.services.map(s => s.name).join(' | ')
      : b.serviceNames || 'N/A';

    return [
      b.reference_id,
      b.clientName,
      b.clientEmail,
      b.clientPhone,
      b.dateDisplay || (b.dateISO ? new Date(b.dateISO).toLocaleDateString('en-GB') : ''),
      b.time,
      serviceNames,
      b.expertName,
      b.serviceType === 'home' ? 'Home Service' : 'In-Studio (Salon)',
      b.total,
      b.depositDue,
      b.status,
      b.paymentStatus
    ].map(val => {
      const strVal = String(val || '').replace(/"/g, '""');
      return strVal.includes(',') || strVal.includes('\n') || strVal.includes('"') ? `"${strVal}"` : strVal;
    });
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const timeframe = document.getElementById('revenue-filter-timeframe')?.value || 'month';
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `Sposh_Revenue_Statement_${timeframe}_${timestamp}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
