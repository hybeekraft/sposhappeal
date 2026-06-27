/* =================================================================
   S'POSH APPEAL — app.js
   Services · Experts · Testimonials · Booking Wizard · LocalStorage
   ================================================================= */

/* ─── XSS ESCAPE HELPER ──────────────────────────────────────
   All user-submitted strings (names, addresses, notes, IDs)
   must go through esc() before being placed inside innerHTML.
   This prevents script injection via crafted booking data.
   ────────────────────────────────────────────────────────────── */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── BACKEND API CONFIG ─────────────────────────────────────
   If a backend is deployed, set window.SPOSH_API_URL (e.g. in
   index.html before app.js loads) to its base URL, for example:
     window.SPOSH_API_URL = 'https://your-backend.up.railway.app/api';
   If unset, unreachable, or any call fails, the site silently
   falls back to the built-in data and localStorage below — nothing
   breaks either way.
   ────────────────────────────────────────────────────────────── */
const API_BASE = (typeof window !== 'undefined' && window.SPOSH_API_URL) ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api');
const API_TIMEOUT_MS = 4000;

async function apiFetch(path, options = {}) {
  if (!API_BASE) throw new Error('API not configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch { }
      const err = new Error(body?.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}


/* ─── DATA: Services ─────────────────────────────────────── */
let SERVICES = [
  { id: 's1', category: 'men', name: "Men's Grooming", price: 2500, duration: '45 min', icon: 'fa-solid fa-user-tie', description: 'Precision cuts, fades, and styles tailored for men. Beard sculpting, trimming, and hot towel finishes.' },
  { id: 's2', category: 'hair_making', name: 'Hair Making', price: 5000, duration: '90 min', icon: 'fa-solid fa-magic', description: 'Natural Hair Styling, Braids, Weaves, Twists, Wash and Set. Hair Treatments and Retouching.' },
  { id: 's3', category: 'wigs', name: 'Wig Install & Sales', price: 7000, duration: '90 min', icon: 'fa-solid fa-crown', description: 'Wig Revamping & Restyling, frontal or closure custom installations, custom wig making, and premium wig sales.' },
  { id: 's4', category: 'nails', name: 'Nails', price: 3000, duration: '60 min', icon: 'fa-solid fa-hand-sparkles', description: 'Deep exfoliating hand & foot nail care, cuticle cleaning, massage, custom nail art and gel polish.' },
  { id: 's5', category: 'lash', name: 'Lash & Brow', price: 8000, duration: '60 min', icon: 'fa-solid fa-eye', description: 'Natural individual lash extensions and volume lash sets for a perfect defined look.' },
  { id: 's6', category: 'makeup', name: 'Makeup Studio', price: 8000, duration: '60 min', icon: 'fa-solid fa-wand-magic-sparkles', description: 'Flawless glam cosmetics beats, everyday natural makeup, and luxury bridal makeup sets.' },
  { id: 's7', category: 'care', name: 'Personal Care', price: 10000, duration: '75 min', icon: 'fa-solid fa-spa', description: 'Luxury facial & mask treatments, steam facials, deep pore extraction, and skincare sessions.' }
];

const SERVICE_GROUPS = [
  {
    id: 'men',
    name: "Men's Grooming",
    options: [
      { id: 'haircut-cut', name: 'Precision Haircut', price: 4000, durationMinutes: 45 },
      { id: 'haircut-fade', name: 'Fade Cut', price: 5000, durationMinutes: 60 },
      { id: 'haircut-beard', name: 'Beard Grooming', price: 5000, durationMinutes: 60 },
      { id: 'haircut-towel', name: 'Hot Towel Finish', price: 3000, durationMinutes: 30 },
    ],
  },
  {
    id: 'hair_making',
    name: 'Hair Making',
    options: [
      { id: 'styling-natural', name: 'Natural Hair Styling', price: 5000, durationMinutes: 90 },
      { id: 'styling-braids', name: 'Braids', price: 12000, durationMinutes: 180 },
      { id: 'styling-weaves', name: 'Weaves', price: 10000, durationMinutes: 120 },
      { id: 'styling-twists', name: 'Twists', price: 8000, durationMinutes: 120 },
      { id: 'styling-wash-set', name: 'Wash and Set', price: 5000, durationMinutes: 60 },
      { id: 'styling-treatment', name: 'Hair Treatment', price: 7000, durationMinutes: 75 },
      { id: 'styling-retouch', name: 'Retouching', price: 6000, durationMinutes: 75 },
      { id: 'locs-starter', name: 'Starter Locs', price: 15000, durationMinutes: 180 },
      { id: 'locs-micro', name: 'SisterLocks / Micro Locs Installation', price: 25000, durationMinutes: 240 },
      { id: 'locs-maintenance', name: 'Maintenance and Retouch', price: 10000, durationMinutes: 120 },
      { id: 'locs-styling', name: 'Loc Styling', price: 8000, durationMinutes: 90 },
      { id: 'locs-coloring', name: 'Loc Coloring', price: 12000, durationMinutes: 120 },
      { id: 'locs-treatment', name: 'Loc Treatment', price: 9000, durationMinutes: 90 },
    ],
  },
  {
    id: 'wigs',
    name: 'Wig Install & Sales',
    options: [
      { id: 'wig-revamp', name: 'Wig Revamping', price: 8000, durationMinutes: 90 },
      { id: 'wig-restyle', name: 'Wig Restyling', price: 7000, durationMinutes: 75 },
      { id: 'wig-frontal', name: 'Frontal Installation', price: 12000, durationMinutes: 120 },
      { id: 'wig-closure', name: 'Closure Installation', price: 10000, durationMinutes: 90 },
      { id: 'wig-custom', name: 'Custom Wig Making', price: 18000, durationMinutes: 180 },
      { id: 'wig-sale-closure', name: 'Premium Closure Wig (Purchase)', price: 85000, durationMinutes: 30 },
      { id: 'wig-sale-frontal', name: 'Premium Frontal Wig (Purchase)', price: 110000, durationMinutes: 30 },
    ],
  },
  {
    id: 'nails',
    name: 'Nails',
    options: [
      { id: 'nails-pedicure', name: 'Pedicure', price: 7000, durationMinutes: 60 },
      { id: 'nails-manicure', name: 'Manicure', price: 6000, durationMinutes: 45 },
      { id: 'nails-pedi-mani', name: 'Pedicure and Manicure', price: 10000, durationMinutes: 75 },
      { id: 'nails-gel', name: 'Luxury Gel Polish', price: 5000, durationMinutes: 45 },
      { id: 'nails-cuticle', name: 'Cuticle Cleaning', price: 3000, durationMinutes: 30 },
      { id: 'makeup-nail-art', name: 'Custom Nail Art', price: 7000, durationMinutes: 75 },
    ],
  },
  {
    id: 'lash',
    name: 'Lash & Brow',
    options: [
      { id: 'makeup-lash', name: 'Natural Individual Lash Extensions', price: 10000, durationMinutes: 90 },
      { id: 'lash-volume', name: 'Volume Lash Extensions', price: 15000, durationMinutes: 105 },
      { id: 'lash-brow-tint', name: 'Brow Tint & Shaping', price: 5000, durationMinutes: 45 },
    ],
  },
  {
    id: 'makeup',
    name: 'Makeup Studio',
    options: [
      { id: 'makeup-natural', name: 'Everyday Natural Makeup', price: 8000, durationMinutes: 60 },
      { id: 'makeup-glam', name: 'Flawless Glam Makeup', price: 12000, durationMinutes: 90 },
      { id: 'makeup-bridal', name: 'Bridal Glam', price: 25000, durationMinutes: 150 },
    ],
  },
  {
    id: 'care',
    name: 'Personal Care',
    options: [
      { id: 'care-mask', name: 'Facial & Mask Treatment', price: 10000, durationMinutes: 75 },
      { id: 'care-steam', name: 'Steam Facial', price: 8000, durationMinutes: 60 },
      { id: 'care-pore', name: 'Deep Pore Extraction', price: 12000, durationMinutes: 90 },
      { id: 'care-session', name: 'Skincare Session', price: 15000, durationMinutes: 90 },
    ],
  },
];

/* ─── DATA: Experts ──────────────────────────────────────── */
let EXPERTS = [
  {
    id: 'any',
    name: 'Any Available Expert',
    role: 'First Available Professional',
    img: null,
  },
  {
    id: 'temi',
    name: 'Temi',
    role: 'Lead Stylist & Wig Expert',
    img: null,
    bio: '7+ years crafting iconic hair and wig transformations.',
    ig: '#',
  },
  {
    id: 'adaeze',
    name: 'Adaeze',
    role: 'Nail Tech & Pedicure Specialist',
    img: null,
    bio: '5 years of nail artistry and luxury pedicure treatments.',
    ig: '#',
  },
  {
    id: 'chisom',
    name: 'Chisom',
    role: 'Makeup Artist & Lash Technician',
    img: null,
    bio: '6 years of glam makeup and lash transformations.',
    ig: '#',
  },
  {
    id: 'kunle',
    name: 'Kunle',
    role: "Men's Hair & Grooming Specialist",
    img: 'assets/stylist_kunle.jpg',
    bio: '8 years of expert men\'s cuts, fades, and grooming.',
    ig: '#',
  },
];

/* ─── DATA: Testimonials ─────────────────────────────────── */
const TESTIMONIALS = [
  {
    quote: "S'posh APPEAL completely transformed my hair. Temi installed my wig so perfectly — I've never felt more confident walking into a room. This salon is unmatched!",
    name: 'Funke Adeola',
    label: 'Loyal Client · 2 Years',
  },
  {
    quote: "Adaeze did my nails for my wedding and they were absolutely perfect. The nail art detail was beyond what I imagined. Every guest was complimenting them!",
    name: 'Ifeoma Chukwu',
    label: 'Bridal Client',
  },
  {
    quote: "I booked the home service and Chisom showed up ready to transform me. The makeup was flawless for my event — I looked like a whole celebrity. Will always book again.",
    name: 'Sola Babatunde',
    label: 'Home Service Client',
  },
  {
    quote: "My lash extensions lasted 4 weeks! The attention to detail at S'posh APPEAL is extraordinary. Highly professional, warm staff, and a stunning space.",
    name: 'Blessing Nwosu',
    label: 'Loyal Client · 18 Months',
  },
];

/* ─── STATE ──────────────────────────────────────────────── */
let state = {
  step: 1,
  services: [],
  selectedOptions: [],
  expert: null,
  date: null,
  time: null,
  serviceCategory: '',
  serviceOption: '',
  name: '', email: '', phone: '',
  serviceType: 'salon',
  notes: '',
};

let calYear, calMonth, testimonialIdx = 0, testimonialTimer;
let BUSY_SLOTS = [];
let MY_BOOKINGS_CACHE = [];

async function tryLoadBusySlots() {
  if (!API_BASE) return;
  try {
    const res = await apiFetch('/bookings/busy');
    if (res && Array.isArray(res.busySlots)) {
      BUSY_SLOTS = res.busySlots;
    }
  } catch (err) {
    console.warn('[Busy Slots] Failed to load busy slots from API:', err.message);
  }
}

/* ─── BACKEND: Try to load live catalog (non-blocking, safe) ── */
async function tryLoadCatalog() {
  if (!API_BASE) return; // no backend configured — keep built-in data

  try {
    const [servicesRes, expertsRes, busySlotsRes] = await Promise.all([
      apiFetch('/services').catch(() => null),
      apiFetch('/services/experts').catch(() => null),
      apiFetch('/bookings/busy').catch(() => null),
    ]);

    if (busySlotsRes && Array.isArray(busySlotsRes.busySlots)) {
      BUSY_SLOTS = busySlotsRes.busySlots;
    }

    if (servicesRes && Array.isArray(servicesRes.services) && servicesRes.services.length) {
      SERVICES = servicesRes.services.map(s => ({
        id: s.id,
        category: s.category,
        name: s.name,
        price: s.price,
        duration: s.duration ?? (s.duration_mins ? `${s.duration_mins} min` : ''),
        description: s.description,
        icon: s.icon,
      }));
    }

    if (servicesRes && Array.isArray(servicesRes.groups) && servicesRes.groups.length) {
      SERVICE_GROUPS.splice(0, SERVICE_GROUPS.length, ...servicesRes.groups);
    }

    if (expertsRes && Array.isArray(expertsRes.experts) && expertsRes.experts.length) {
      const anyExpert = {
        id: 'any',
        name: 'Any Available Expert',
        role: 'First Available Professional',
        img: null,
      };
      EXPERTS = [
        anyExpert,
        ...expertsRes.experts.map(e => ({
          id: e.id,
          name: e.name,
          role: e.role,
          img: e.img || e.image || null,
          bio: e.bio,
          ig: e.ig || '#',
          specialties: e.specialties,
        }))
      ];
    }

    // Re-render with live data
    renderServicesGrid();
    renderExpertsGrid();
    populateExpertDropdown();
  } catch (err) {
    // Backend unavailable or errored — keep using built-in data silently.
    console.warn('[Catalog] Using built-in data (API unavailable):', err.message);
  }
}

/* ─── INIT ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  renderServicesGrid();
  renderExpertsGrid();
  renderTestimonials();
  renderBookingsList();
  initScrollHeader();
  initMobileNav();
  initGallerySlideshow();

  // Attempt to load live catalog from backend (falls back silently)
  tryLoadCatalog();

  // Health check: warn if backend DB is disconnected or server is offline
  if (API_BASE) {
    fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(data => {
        if (data && data.database === 'disconnected') {
          showDbWarningBanner();
        }
      })
      .catch(() => {
        showDbWarningBanner(); // Show warning if backend is unreachable
      });
  }

  // Check if page load has redirect query params for payment confirmation
  checkRedirectPayment();

  // Modal backdrop click to close
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  // Back to Top Button scroll toggle & click handler
  const btt = document.getElementById('btn-back-to-top');
  if (btt) {
    window.addEventListener('scroll', () => {
      btt.classList.toggle('visible', window.scrollY > 300);
    });
    btt.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

/* ─── SCROLL HEADER ──────────────────────────────────────── */
function initScrollHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const links = document.querySelectorAll('.nav-links a');
  const secs = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
    let cur = '';
    secs.forEach(s => { if (window.scrollY >= s.offsetTop - 120) cur = s.id; });
    links.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === `#${cur}`);
    });
  });
}

/* ─── MOBILE NAV ─────────────────────────────────────────── */
function initMobileNav() {
  const btn = document.getElementById('btn-menu-toggle');
  const menu = document.getElementById('main-nav');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    btn.classList.toggle('open');
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    }
  });
  document.querySelectorAll('.nav-links a').forEach(l => {
    l.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.classList.remove('open');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = 'fa-solid fa-bars';
      }
    });
  });
}

/* ─── RENDER: Services Grid ──────────────────────────────── */
const CATEGORY_CARDS = [
  {
    id: 'hair_making',
    icon: 'fa-solid fa-scissors',
    title: 'Hair Making',
    description: 'Expert braids, weaves, twists, natural hair styling, wash and set, and revitalizing treatments.',
    from: 5000,
  },
  {
    id: 'wigs',
    icon: 'fa-solid fa-crown',
    title: 'Wig Install & Sales',
    description: 'Professional lace frontal/closure installations, custom wig making, revamping, restyling, and premium wig sales.',
    from: 7000,
  },
  {
    id: 'nails',
    icon: 'fa-solid fa-hand-sparkles',
    title: 'Nails',
    description: 'Acrylic & gel nail fixing, luxury pedicure & manicure, custom hand-drawn nail art and chrome finishes.',
    from: 3000,
  },
  {
    id: 'lash',
    icon: 'fa-solid fa-eye',
    title: 'Lash & Brow',
    description: 'Natural individual lash extensions and mega-volume lash fans for a dramatic red-carpet look.',
    from: 8000,
  },
  {
    id: 'makeup',
    icon: 'fa-solid fa-wand-magic-sparkles',
    title: 'Makeup Studio',
    description: 'Full glam event makeup for weddings, photoshoots and birthdays, plus soft natural everyday looks.',
    from: 8000,
  },
  {
    id: 'care',
    icon: 'fa-solid fa-spa',
    title: 'Personal Care',
    description: 'Luxury facial & mask treatments, steam facials, deep pore extraction, and skincare sessions.',
    from: 10000,
  },
  {
    id: 'men',
    icon: 'fa-solid fa-user-tie',
    title: "Men's Grooming",
    description: "Precision haircuts, fades & line-ups, beard trim & shape, and full grooming packages for men.",
    from: 2500,
  },
];

function renderServicesGrid() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  grid.innerHTML = CATEGORY_CARDS.map(c => `
    <div class="swp-card">
      <div class="swp-icon"><i class="${c.icon}"></i></div>
      <h3 class="swp-title">${c.title.toUpperCase()}</h3>
      <p class="swp-desc">${c.description}</p>
      <div class="swp-from">FROM ₦${c.from.toLocaleString()}</div>
    </div>
  `).join('');
}

function filterServices() { renderServicesGrid(); }


/* ─── RENDER: Experts Grid ───────────────────────────────── */
// Palette of distinct avatar background colours — one per stylist slot
const AVATAR_COLORS = ['#C2185B', '#7B1FA2', '#00838F', '#E64A19', '#388E3C', '#1565C0', '#F57F17', '#4527A0'];

function avatarFallback(el, name, idx) {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const bg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  el.outerHTML = `<div class="expert-avatar-initials" style="background:${bg};">${initials}</div>`;
}

function renderExpertsGrid() {
  const grid = document.getElementById('experts-grid');
  if (!grid) return;
  grid.innerHTML = EXPERTS.filter(e => e.id !== 'any').map((e, idx) => `
    <div class="expert-card" id="ec-${e.id}">
      <div class="expert-img">
        <img src="${e.img}" alt="${e.name}" loading="lazy"
             onerror="avatarFallback(this, '${esc(e.name)}', ${idx})">
        <div class="expert-social-overlay">
          <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>
          <a href="${e.ig || '#'}" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
          <a href="#" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>
        </div>
      </div>
      <div class="expert-info">
        <h3>${esc(e.name)}</h3>
        <p>${esc(e.role)}</p>
      </div>
    </div>
  `).join('');
}

/* ─── RENDER: Testimonials ───────────────────────────────── */
function renderTestimonials() {
  const track = document.getElementById('testimonial-track');
  const dots = document.getElementById('carousel-dots');
  if (!track || !dots) return;

  track.innerHTML = TESTIMONIALS.map((t, i) => `
    <div class="testimonial-slide" id="tslide-${i}">
      <div class="quote-mark">"</div>
      <blockquote>${t.quote}</blockquote>
      <div class="reviewer-name">${t.name}</div>
      <div class="reviewer-tag">${t.label}</div>
    </div>
  `).join('');

  dots.innerHTML = TESTIMONIALS.map((_, i) => `
    <div class="dot ${i === 0 ? 'active' : ''}" id="dot-${i}" onclick="goSlide(${i})"></div>
  `).join('');

  startSlideTimer();
}

function goSlide(idx) {
  testimonialIdx = idx;
  document.getElementById('testimonial-track').style.transform = `translateX(-${idx * 100}%)`;
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  clearInterval(testimonialTimer);
  startSlideTimer();
}
function startSlideTimer() {
  testimonialTimer = setInterval(() => {
    goSlide((testimonialIdx + 1) % TESTIMONIALS.length);
  }, 5000);
}

/* ─── GALLERY: Slideshow ─────────────────────────────────── */
const GALLERY_ITEMS = [
  { img: 'assets/gallery_lash_heart.jpg', title: 'Lash Extension Close-Up', tag: 'Lash & Brow' },
  { img: 'assets/gallery_manicure_new.jpg', title: 'Burgundy Swirl Nail Art', tag: 'Nail Art' },
  { img: 'assets/gallery_makeup_bridal.jpg', title: 'Bridal Gele Glam', tag: 'Makeup' },
  { img: 'assets/gallery_chrome_nails.jpg', title: 'Rose Gold Chrome Tips', tag: 'Nail Art' },
  { img: 'assets/gallery_braids_boho.jpg', title: 'Boho Knotless Braids', tag: 'Hair Making' },
  { img: 'assets/gallery_makeup_glitter.jpg', title: 'Glitter Cut Crease', tag: 'Makeup' },
  { img: 'assets/gallery_facial.jpg', title: 'Glow Facial Treatment', tag: 'Spa & Wellness' },
  { img: 'assets/gallery_cornrows_men.jpg', title: 'Spiral Cornrow Design', tag: "Men's Grooming" },
  { img: 'assets/gallery_cornrows_artistic.jpg', title: 'Artistic Cornrow Pattern', tag: "Men's Grooming" },
  { img: 'assets/gallery_lemon_pedicure.jpg', title: 'Citrus Foot Detox Spa', tag: 'Pedicure' },
  { img: 'assets/gallery_wig_new.jpg', title: 'Burgundy Lace Front Wig', tag: 'Wigs' },
  { img: 'assets/gallery_massage.jpg', title: 'Hot Oil Body Massage', tag: 'Spa & Wellness' },
  { img: 'assets/gallery_makeup_rose.jpg', title: 'Rose Glitter Eye Look', tag: 'Makeup' },
  { img: 'assets/gallery_french_white.jpg', title: 'Classic French Manicure', tag: 'Manicure' },
  { img: 'assets/gallery_lash_closeup.jpg', title: 'Volume Lash Extensions', tag: 'Lash & Brow' },
  { img: 'assets/gallery_french_black.jpg', title: 'Modern Heart French Tips', tag: 'Nail Art' },
  { img: 'assets/gallery_pedicure_pink.jpg', title: 'Luxury Pedicure Detailing', tag: 'Pedicure' },
  { img: 'assets/gallery_spa_footbath.jpg', title: 'Rose Petal Foot Spa', tag: 'Pedicure' },
  { img: 'assets/gallery_braids.jpg', title: 'Braids & Protective Styles', tag: 'Hair Making' },
  { img: 'assets/gallery_pedicure_towel.jpg', title: 'Fresh Pedicure Finish', tag: 'Pedicure' },
  { img: 'assets/gallery_haircut.jpg', title: 'Precision Haircut', tag: "Men's Grooming" },
];

let gsIdx = 0, gsTimer = null, gsPerView = 3;

function initGallerySlideshow() {
  const track = document.getElementById('gs-track');
  const dots = document.getElementById('gs-dots');
  if (!track) return;

  track.innerHTML = GALLERY_ITEMS.map((item, i) => `
    <div class="gs-slide" id="gs-slide-${i}">
      <div class="gs-slide-img-wrap">
        <img src="${item.img}" alt="${item.title}" loading="lazy">
        <div class="gs-slide-overlay">
          <span class="gs-slide-tag">${item.tag}</span>
          <h4 class="gs-slide-title">${item.title}</h4>
        </div>
      </div>
    </div>
  `).join('');

  updateGsPerView();
  const totalDots = Math.max(1, GALLERY_ITEMS.length - gsPerView + 1);
  dots.innerHTML = Array.from({ length: totalDots }, (_, i) => `
    <button class="gs-dot ${i === 0 ? 'active' : ''}" onclick="gsGoTo(${i})" aria-label="Go to slide ${i + 1}"></button>
  `).join('');

  gsUpdateTrack();
  startGsTimer();

  window.addEventListener('resize', () => {
    updateGsPerView();
    gsUpdateTrack();
  });
}

function updateGsPerView() {
  const w = window.innerWidth;
  gsPerView = w <= 600 ? 1 : w <= 960 ? 2 : 3;
}

function gsUpdateTrack() {
  const track = document.getElementById('gs-track');
  if (!track) return;
  const slideWidthPct = 100 / gsPerView;
  track.style.transform = `translateX(-${gsIdx * slideWidthPct}%)`;

  // Centered/Active slide based on screen layout:
  // If 3 slides are visible, make the middle one active. Otherwise, make the first visible slide active.
  const activeIdx = gsPerView === 3 ? (gsIdx + 1) : gsIdx;

  document.querySelectorAll('.gs-slide').forEach((s, idx) => {
    s.style.flex = `0 0 ${slideWidthPct}%`;
    s.classList.toggle('active', idx === activeIdx);
  });

  document.querySelectorAll('.gs-dot').forEach((d, i) => d.classList.toggle('active', i === gsIdx));
}

function gsGoTo(idx) {
  const maxIdx = Math.max(0, GALLERY_ITEMS.length - gsPerView);
  gsIdx = Math.max(0, Math.min(idx, maxIdx));
  gsUpdateTrack();
  clearInterval(gsTimer);
  startGsTimer();
}

function gsNav(dir) {
  const maxIdx = Math.max(0, GALLERY_ITEMS.length - gsPerView);
  gsIdx += dir;
  if (gsIdx < 0) gsIdx = maxIdx;
  if (gsIdx > maxIdx) gsIdx = 0;
  gsUpdateTrack();
  clearInterval(gsTimer);
  startGsTimer();
}

function startGsTimer() {
  gsTimer = setInterval(() => gsNav(1), 4000);
}

function getAppointmentDateTime(dateISO, timeStr) {
  const d = new Date(dateISO);
  if (!timeStr) return d;
  const startPart = timeStr.split(' - ')[0].trim();
  let h = 0, m = 0;
  if (startPart.includes('AM') || startPart.includes('PM')) {
    const [time, period] = startPart.split(' ');
    [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
  } else {
    [h, m] = startPart.split(':').map(Number);
  }
  d.setHours(h, m, 0, 0);
  return d;
}

/* ─── RENDER: My Bookings ────────────────────────────────── */
function renderBookingsList(overrideList = null, hasSearched = false) {
  const list = document.getElementById('bookings-list');
  if (!list) return;

  if (!hasSearched && !overrideList) {
    list.innerHTML = '';
    return;
  }

  const saved = overrideList || getBookings();
  MY_BOOKINGS_CACHE = saved;

  if (!saved.length) {
    list.innerHTML = `
      <div class="empty-bookings">
        <i class="fa-regular fa-calendar-xmark"></i>
        <h4>No Appointments Yet</h4>
        <p>Schedule your first S'posh APPEAL experience — salon or home service.</p>
        <a href="booking.html" class="btn btn-primary">Book Now</a>
      </div>`;
    return;
  }

  list.innerHTML = saved.map(b => {
    const past = new Date(b.dateISO) < new Date();
    const isRemote = b.source === 'remote';

    // Check if the appointment is less than 24 hours away
    const apptTime = getAppointmentDateTime(b.dateISO, b.time);
    const now = new Date();
    const hoursDiff = (apptTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const canCancel = hoursDiff >= 24;

    return `
      <div class="booking-ticket ${past ? 'past' : ''}" id="bt-${b.id}">
        <div class="ticket-details">
          <div class="ticket-item">
            <span class="ticket-label">Ref ID</span>
            <span class="ticket-value ref">${esc(b.id)}</span>
          </div>
          <div class="ticket-item">
            <span class="ticket-label">Date & Time</span>
            <span class="ticket-value">${esc(b.dateDisplay)} · ${esc(b.time)}</span>
          </div>
          <div class="ticket-item">
            <span class="ticket-label">Services</span>
            <span class="ticket-value">${esc(b.serviceNames)}</span>
          </div>
          <div class="ticket-item">
            <span class="ticket-label">Expert</span>
            <span class="ticket-value">${esc(b.expertName)}</span>
          </div>
          <div class="ticket-item">
            <span class="ticket-label">Client</span>
            <span class="ticket-value">${esc(b.clientName)}</span>
          </div>
          ${b.serviceType === 'home' && b.address ? `
          <div class="ticket-item">
            <span class="ticket-label">Address</span>
            <span class="ticket-value">${esc(b.address)}</span>
          </div>` : ''}
          <div class="ticket-item">
            <span class="ticket-label">Total</span>
            <span class="ticket-value" style="color:var(--primary-rose);">₦${(b.total || 0).toLocaleString()}</span>
          </div>
          ${b.status ? `
          <div class="ticket-item">
            <span class="ticket-label">Status</span>
            <span class="ticket-value" style="text-transform:capitalize;">${esc(b.status)}${b.paymentStatus === 'unpaid' ? ' · Payment Pending' : ''}</span>
          </div>` : ''}
        </div>
        <div class="ticket-actions">
          ${b.status === 'cancelled'
        ? `<span style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;">Cancelled</span>`
        : !past
          ? `${canCancel
            ? `<button class="btn-reschedule" id="br-${b.id}" onclick="rescheduleBooking('${b.id}', ${isRemote})">Reschedule</button>`
            : `<button class="btn-reschedule" id="br-${b.id}" onclick="toast('Appointments cannot be rescheduled within 24 hours of the scheduled time.')" style="opacity: 0.5; cursor: not-allowed;" title="Rescheduling locked within 24 hours">Reschedule</button>`
          }
                 ${canCancel
            ? `<button class="btn-cancel" id="bc-${b.id}" onclick="cancelBooking('${b.id}', ${isRemote})">Cancel</button>`
            : `<button class="btn-cancel" id="bc-${b.id}" onclick="toast('Appointments cannot be cancelled within 24 hours of the scheduled time.')" style="opacity: 0.5; cursor: not-allowed;" title="Cancellation locked within 24 hours">Cancel</button>`
          }`
          : `<span style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;">Completed</span>`
      }
        </div>
      </div>`;
  }).join('');
}

/* ─── BOOKINGS LOOKUP (My Bookings email search) ───────────── */
async function lookupMyBookings() {
  const input = document.getElementById('bookings-lookup-email');
  const email = input?.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (input) {
      input.classList.add('field-invalid');
      setTimeout(() => input.classList.remove('field-invalid'), 600);
    }
    toast('Please enter a valid email address.');
    return;
  }

  const btn = document.getElementById('btn-bookings-lookup');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching…';

  // Always include local bookings matching this email
  const local = getBookings()
    .filter(b => (b.clientEmail || '').toLowerCase() === email)
    .map(b => ({ ...b, source: 'local' }));

  let remote = [];
  if (API_BASE) {
    try {
      const result = await apiFetch(`/bookings/my?email=${encodeURIComponent(email)}`);
      remote = (result?.bookings || []).map(b => ({
        id: b.reference_id,
        dateISO: b.dateISO,
        dateDisplay: b.dateDisplay,
        time: b.time,
        serviceNames: (b.services || []).map(s => s.name).join(', '),
        expertName: b.expertName,
        clientName: b.clientName,
        clientEmail: email,
        total: b.total,
        status: b.status,
        paymentStatus: b.paymentStatus,
        source: 'remote',
      }));
    } catch (err) {
      console.warn('[Bookings] Remote lookup failed:', err.message);
    }
  }

  btn.disabled = false;
  btn.innerHTML = originalHTML;

  const combined = [...remote, ...local];
  if (!combined.length) {
    toast('No bookings found for that email.');
  }
  renderBookingsList(combined, true);
}

/* ─── LOCAL STORAGE ──────────────────────────────────────── */
let _memBookings = [];
function getBookings() {
  try { return JSON.parse(localStorage.getItem('sposh_bookings') || '[]'); }
  catch { return _memBookings; }
}
function saveBooking(b) {
  const all = getBookings();
  all.unshift(b);
  _memBookings = all;
  try { localStorage.setItem('sposh_bookings', JSON.stringify(all)); } catch { }
}
function cancelBooking(id, isRemote = false) {
  const booking = MY_BOOKINGS_CACHE.find(b => b.id === id) || getBookings().find(b => b.id === id);
  if (booking) {
    const apptTime = getAppointmentDateTime(booking.dateISO || booking.date, booking.time);
    const now = new Date();
    const hoursDiff = (apptTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 24) {
      toast('Appointments cannot be cancelled within 24 hours of the scheduled time.');
      return;
    }
  }

  const el = document.getElementById(`bt-${id}`);
  if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all 0.4s ease'; }

  if (isRemote && API_BASE) {
    const email = document.getElementById('bookings-lookup-email')?.value.trim().toLowerCase();
    apiFetch(`/bookings/cancel/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    }).then(() => {
      setTimeout(() => lookupMyBookings(), 420);
      tryLoadBusySlots();
    }).catch(err => {
      console.warn('[Booking] Remote cancel failed:', err.message);
      toast('Could not cancel booking. Please try again.');
      if (el) { el.style.opacity = '1'; el.style.transform = 'none'; }
    });
    return;
  }

  setTimeout(() => {
    const filtered = getBookings().filter(b => b.id !== id);
    _memBookings = filtered;
    try { localStorage.setItem('sposh_bookings', JSON.stringify(filtered)); } catch { }

    const emailInput = document.getElementById('bookings-lookup-email');
    const email = emailInput?.value.trim().toLowerCase();
    if (email) {
      const local = filtered.filter(b => (b.clientEmail || '').toLowerCase() === email);
      renderBookingsList(local, true);
    } else {
      renderBookingsList(null, false);
    }
    tryLoadBusySlots();
  }, 420);
}

/* ─── RESCHEDULE FLOW ────────────────────────────────────── */
function parseDurationFromTime(timeStr) {
  if (!timeStr) return 60;
  const match = timeStr.match(/\(([^)]+)\)/);
  if (!match) return 60;
  const durationStr = match[1]; // e.g. "1 hr" or "90 min" or "2.5 hr"
  if (durationStr.includes('hr')) {
    const hours = parseFloat(durationStr.replace('hr', '').trim());
    return isNaN(hours) ? 60 : Math.round(hours * 60);
  } else if (durationStr.includes('min')) {
    const mins = parseInt(durationStr.replace('min', '').trim(), 10);
    return isNaN(mins) ? 60 : mins;
  }
  return 60;
}

function rescheduleBooking(id, isRemote) {
  const emailInput = document.getElementById('bookings-lookup-email');
  const email = emailInput ? emailInput.value.trim() : '';
  window.location.href = `booking.html?reschedule=${encodeURIComponent(id)}&remote=${isRemote}&email=${encodeURIComponent(email)}`;
}

async function initRescheduleFlow(id, isRemote, email) {
  let booking = null;
  if (isRemote && API_BASE && email) {
    toast('Loading booking details...');
    try {
      const result = await apiFetch(`/bookings/my?email=${encodeURIComponent(email)}`);
      const remoteBookings = (result?.bookings || []).map(b => ({
        id: b.reference_id,
        dateISO: b.dateISO,
        dateDisplay: b.dateDisplay,
        time: b.time,
        serviceNames: (b.services || []).map(s => s.name).join(', '),
        expertName: b.expertName,
        clientName: b.clientName,
        clientEmail: email,
        total: b.total,
        status: b.status,
        paymentStatus: b.paymentStatus,
        source: 'remote',
      }));
      booking = remoteBookings.find(b => b.id === id);
    } catch (err) {
      console.warn('[Reschedule] Remote load failed:', err.message);
      toast('Failed to load remote booking.');
    }
  } else {
    booking = getBookings().find(b => b.id === id);
  }

  if (!booking) {
    toast('Booking not found.');
    setTimeout(() => { window.location.href = 'index.html'; }, 2000);
    return;
  }

  state = {
    step: 3,
    isRescheduling: true,
    rescheduleBooking: booking,
    rescheduleBookingDuration: parseDurationFromTime(booking.time),
    services: [],
    selectedOptions: [],
    expert: 'any',
    date: null,
    time: null,
    serviceCategory: '',
    serviceOption: '',
    name: booking.clientName,
    email: booking.clientEmail,
    phone: booking.clientPhone,
    serviceType: booking.serviceType || 'salon',
    notes: booking.notes || '',
    address: booking.address || ''
  };

  renderStep(3);
}

async function updateBookingReschedule() {
  const booking = state.rescheduleBooking;
  if (!state.date || !state.time) {
    toast('Please select a date and start time.');
    return;
  }
  if (isSlotOccupied(state.time)) {
    toast('Selected time slot is no longer available. Please choose another time.');
    state.step = 4;
    renderStep(4);
    return;
  }

  const newDateISO = state.date.toISOString();
  const newDateDisplay = state.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const newTimeRange = formatSlotRange(state.time, state.rescheduleBookingDuration || 60);

  showLoadingOverlay('Saving appointment changes...');

  if (booking.source === 'remote' && API_BASE) {
    try {
      await apiFetch(`/bookings/reschedule/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: booking.clientEmail,
          appointment_date: newDateISO.split('T')[0],
          appointment_time: to24Hour(state.time)
        }),
      });
    } catch (err) {
      hideLoadingOverlay();
      console.error('[Reschedule] Remote PATCH failed:', err.message);
      toast('Could not reschedule booking. Please try again.');
      return;
    }
  } else {
    // Add a tiny simulated delay for local reschedule to show loader
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  // Update local storage if present
  const all = getBookings();
  const foundIdx = all.findIndex(b => b.id === booking.id);
  if (foundIdx !== -1) {
    all[foundIdx].dateISO = newDateISO;
    all[foundIdx].dateDisplay = newDateDisplay;
    all[foundIdx].time = newTimeRange;
    all[foundIdx].startTime = state.time;
    try {
      localStorage.setItem('sposh_bookings', JSON.stringify(all));
    } catch (e) {
      console.error('[Reschedule] Local storage write failed:', e);
    }
  }

  hideLoadingOverlay();
  tryLoadBusySlots();
  showRescheduleSuccessPanel(booking.id, newDateDisplay, newTimeRange);
}

function showRescheduleSuccessPanel(refId, dateDisplay, timeDisplay) {
  const stepMobile = document.getElementById('modal-step-mobile');
  if (stepMobile) stepMobile.style.display = 'none';
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));

  const panelSuccess = document.getElementById('panel-success');
  if (panelSuccess) panelSuccess.classList.add('active');

  const footer = document.getElementById('modal-footer');
  if (footer) footer.style.display = 'none';

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`wstep-${i}`);
    if (el) { el.classList.remove('active'); el.classList.add('done'); }
  }

  document.getElementById('modal-step-title').textContent = 'Rescheduled!';
  const ringEl = document.getElementById('success-ring');
  const titleEl = document.getElementById('success-title');
  const msgEl = document.getElementById('success-message');
  const refEl = document.getElementById('success-ref-id');
  const actionsEl = document.getElementById('success-actions');

  if (ringEl) ringEl.innerHTML = '<i class="fa-solid fa-calendar-check"></i>';
  if (titleEl) titleEl.textContent = 'Rescheduled Successfully!';
  if (msgEl) msgEl.innerHTML = `Your appointment has been updated to:<br><strong>${dateDisplay} · ${timeDisplay}</strong>.`;
  if (refEl) { refEl.textContent = refId; refEl.style.display = ''; }
  if (actionsEl) {
    actionsEl.innerHTML = `
      <a class="btn btn-primary" id="btn-success-done" href="index.html#my-bookings">Done</a>`;
  }
}

/* ─── SERVICE TYPE SETTER ────────────────────────────────── */
function setServiceType(type) {
  state.serviceType = type;

  const studioCard = document.getElementById('type-studio');
  const homeCard = document.getElementById('type-home');
  const addressField = document.getElementById('address-field');

  if (studioCard && homeCard) {
    if (type === 'salon') {
      studioCard.classList.add('selected');
      homeCard.classList.remove('selected');
      if (addressField) addressField.style.display = 'none';
    } else {
      studioCard.classList.remove('selected');
      homeCard.classList.add('selected');
      if (addressField) addressField.style.display = 'flex';
    }
  }

  updateFooterTotal();
}

function toggleServiceTypeVisibility() {
  const container = document.getElementById('service-type-section');
  if (!container) return;
  if (state.selectedOptions && state.selectedOptions.length > 0) {
    container.style.display = 'flex';
    setServiceType(state.serviceType || 'salon');
  } else {
    container.style.display = 'none';
    const addressField = document.getElementById('address-field');
    if (addressField) addressField.style.display = 'none';
  }
}

/* ─── TEST PAYMENT SCREEN ────────────────────────────────── */
function showTestPaymentModal(booking) {
  document.getElementById('sposh-test-payment-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sposh-test-payment-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0', width: '100vw', height: '100vh',
    background: 'rgba(6, 4, 10, 0.85)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000',
    fontFamily: 'DM Sans, sans-serif',
    animation: 'fadeIn 0.3s ease'
  });

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    background: '#160D22',
    border: '1px solid rgba(224, 68, 122, 0.25)',
    borderRadius: '16px',
    padding: '24px',
    width: 'calc(100% - 32px)',
    maxWidth: '440px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(224, 68, 122, 0.15)',
    textAlign: 'center',
    color: '#FAF0F5',
    transform: 'scale(0.95)',
    transition: 'transform 0.3s ease',
    position: 'relative'
  });

  modal.innerHTML = `
    <div style="font-size: 2.8rem; color: #E0447A; margin-bottom: 20px;">
      <i class="fa-solid fa-credit-card"></i>
    </div>
    <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 8px; font-family: Cormorant Garamond, serif; color: #FAF0F5;">S'posh Test Payment</h3>
    <p style="font-size: 0.85rem; color: #B090A8; line-height: 1.5; margin-bottom: 24px;">
      This is a simulated payment screen for testing. Real transactions will go through Paystack.
    </p>
    <div style="background: rgba(255, 255, 255, 0.03); border-radius: 10px; padding: 18px; margin-bottom: 28px; border: 1px solid rgba(255, 255, 255, 0.05);">
      <div style="font-size: 0.72rem; text-transform: uppercase; color: #B090A8; letter-spacing: 1px; margin-bottom: 4px;">Deposit Amount</div>
      <div style="font-size: 2.2rem; font-weight: 700; color: #FF8FAB; font-family: DM Sans, sans-serif;">₦${booking.depositDue.toLocaleString()}</div>
      <div style="font-size: 0.75rem; color: #B090A8; margin-top: 6px;">Reference: ${'TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase()}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <button id="btn-confirm-test-pay" style="background: linear-gradient(135deg, #E0447A, #FF8FAB); border: none; color: #fff; padding: 14px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.25s ease; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
        Authorize Test Payment &nbsp;<i class="fa-solid fa-circle-check"></i>
      </button>
      <button id="btn-cancel-test-pay" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #B090A8; padding: 12px; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.25s ease; font-size: 0.85rem;">
        Cancel
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  setTimeout(() => { modal.style.transform = 'scale(1)'; }, 10);

  const confirmBtn = modal.querySelector('#btn-confirm-test-pay');
  const cancelBtn = modal.querySelector('#btn-cancel-test-pay');

  confirmBtn.addEventListener('mouseenter', () => {
    confirmBtn.style.opacity = '0.9';
    confirmBtn.style.boxShadow = '0 0 12px rgba(224, 68, 122, 0.4)';
  });
  confirmBtn.addEventListener('mouseleave', () => {
    confirmBtn.style.opacity = '1';
    confirmBtn.style.boxShadow = 'none';
  });

  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.03)';
    cancelBtn.style.color = '#fff';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = '#B090A8';
  });

  confirmBtn.addEventListener('click', () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Payment...';
    setTimeout(() => {
      overlay.remove();
      showLoadingOverlay('Confirming deposit payment...');
      setTimeout(() => {
        hideLoadingOverlay();
        onPaymentSuccess('TEST_REF_' + Math.random().toString(36).substring(2, 10).toUpperCase(), booking);
      }, 1200);
    }, 1000);
  });

  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    const payBtn = document.getElementById('btn-pay-now');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.innerHTML = 'Pay Deposit &nbsp;<i class="fa-solid fa-credit-card"></i>';
    }
    toast('Payment cancelled. Your slot is not confirmed until the deposit is paid.');
  });
}

/* ─── MODAL OPEN / CLOSE ─────────────────────────────────── */
function openModal() {
  resetState();
  document.getElementById('modal-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Reset success panel to default state
  const ringEl = document.getElementById('success-ring');
  if (ringEl) ringEl.innerHTML = '<i class="fa-solid fa-check"></i>';
  const titleEl = document.getElementById('success-title');
  if (titleEl) titleEl.textContent = "You're All Set! 🎉";
  const msgEl = document.getElementById('success-message');
  if (msgEl) msgEl.textContent = "Your S'posh APPEAL appointment has been booked. We'll reach out to confirm within 30 minutes.";
  const actionsEl = document.getElementById('success-actions');
  if (actionsEl) actionsEl.innerHTML = `<button class="btn btn-primary" id="btn-success-done" onclick="closeModal()">Done</button>`;
  const refEl = document.getElementById('success-ref-id');
  if (refEl) { refEl.textContent = 'SP-000000'; refEl.style.display = ''; }
  window._pendingBooking = null;
  const stepMobile = document.getElementById('modal-step-mobile');
  if (stepMobile) stepMobile.style.display = '';
  renderStep(1);
}
function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
  document.body.style.overflow = '';
  const footer = document.getElementById('modal-footer');
  if (footer) footer.style.display = '';
  renderBookingsList();
}

/* ─── RESET STATE ────────────────────────────────────────── */
function resetState() {
  state = { step: 1, services: [], selectedOptions: [], expert: 'any', date: null, time: null, serviceCategory: '', serviceOption: '', name: '', email: '', phone: '', serviceType: 'salon', notes: '' };
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  ['f-name', 'f-email', 'f-phone', 'f-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['f-service-category', 'f-type'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'f-type') el.value = 'salon';
    else el.value = '';
  });
}

/* ─── WIZARD NAVIGATION ──────────────────────────────────── */
const STEP_TITLES = ['Your Details', 'Choose a Service', 'Choose a Date', 'Choose a Start Time', 'Confirm & Pay Deposit'];

function wizardNav(dir) {
  if (dir === 1) {
    const err = validateStep(state.step);
    if (err === 'INLINE_ERROR_SHOWN') return;
    if (err) { toast(err); return; }
    if (state.step === 1) captureDetails();
    if (state.step === 5) {
      if (state.isRescheduling) {
        updateBookingReschedule();
      } else {
        submitBooking();
      }
      return;
    }
  }
  const next = state.step + dir;
  if (next < 1 || next > 5) return;
  state.step = next;
  renderStep(next);
}

function clearFieldErrors() {
  ['f-name', 'f-phone', 'f-email', 'f-address'].forEach(id => {
    const errEl = document.getElementById(`err-${id}`);
    const inputEl = document.getElementById(id);
    if (errEl) errEl.textContent = '';
    if (inputEl) inputEl.classList.remove('field-invalid');
  });
}

function showFieldError(id, message) {
  const errEl = document.getElementById(`err-${id}`);
  const inputEl = document.getElementById(id);
  if (errEl) errEl.textContent = message;
  if (inputEl) inputEl.classList.add('field-invalid');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s-]{6,}$/;

function validateStep(s) {
  if (s === 1) {
    clearFieldErrors();
    const n = document.getElementById('f-name').value.trim();
    const e = document.getElementById('f-email').value.trim();
    const p = document.getElementById('f-phone').value.trim();
    let hasError = false;

    if (!n) { showFieldError('f-name', 'Please enter your full name.'); hasError = true; }
    if (!p) {
      showFieldError('f-phone', 'Please enter your phone number.'); hasError = true;
    } else if (!PHONE_REGEX.test(p)) {
      showFieldError('f-phone', 'Please enter a valid phone number.'); hasError = true;
    }
    if (!e) {
      showFieldError('f-email', 'Please enter your email address.'); hasError = true;
    } else if (!EMAIL_REGEX.test(e)) {
      showFieldError('f-email', 'Please enter a valid email address (e.g. johndoe@example.com).'); hasError = true;
    }

    if (hasError) return 'INLINE_ERROR_SHOWN'; // errors already shown inline, no toast needed
  }
  if (s === 2) {
    if (!state.selectedOptions || state.selectedOptions.length === 0) {
      const catSelect = document.getElementById('f-service-category');
      if (catSelect) {
        catSelect.classList.add('field-invalid');
        setTimeout(() => catSelect.classList.remove('field-invalid'), 600);
      }
      return 'Please choose at least one service.';
    }
    if (state.serviceType === 'home') {
      const addrEl = document.getElementById('f-address');
      const addr = addrEl ? addrEl.value.trim() : '';
      if (!addr) {
        showFieldError('f-address', 'Please enter your address for the home service.');
        return 'INLINE_ERROR_SHOWN';
      }
      state.address = addr;
    } else {
      state.address = '';
    }
  }
  if (s === 3 && !state.date) return 'Please select a date.';
  if (s === 4) {
    if (!state.time) return 'Please select a start time.';
    if (isSlotOccupied(state.time)) {
      return 'Selected time slot is no longer available. Please choose another time.';
    }
    const now = new Date();
    const isToday = state.date && state.date.toDateString() === now.toDateString();
    if (isToday) {
      const [tp, mer] = state.time.split(' ');
      let [h, m] = tp.split(':').map(Number);
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      const d = new Date(); d.setHours(h, m, 0, 0);
      if (d <= now) {
        return 'Selected time slot is in the past. Please choose another time.';
      }
    }
  }
  return null;
}

function captureDetails() {
  state.name = document.getElementById('f-name').value.trim();
  state.email = document.getElementById('f-email').value.trim();
  state.phone = document.getElementById('f-phone').value.trim();
  const notesEl = document.getElementById('f-notes');
  state.notes = notesEl ? notesEl.value.trim() : '';
  const typeEl = document.getElementById('f-type');
  if (typeEl) {
    state.serviceType = typeEl.value;
  }
}


/* ─── STEP 2: Experts (kept for compatibility) ───────────── */
function renderWizardExperts() {
  const list = document.getElementById('wizard-experts-list');
  if (!list) return;
  list.innerHTML = EXPERTS.map(e => {
    const sel = state.expert === e.id;
    const avatarHtml = e.img
      ? `<img src="${e.img}" alt="${e.name}">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-charcoal);color:var(--primary-rose);font-size:1.8rem;"><i class="fa-solid fa-scissors"></i></div>`;
    return `
      <div class="we-card ${sel ? 'selected' : ''}" id="we-${e.id}" onclick="pickExpert('${e.id}')">
        <div class="we-avatar">${avatarHtml}</div>
        <h5>${e.name}</h5>
        <p>${e.role}</p>
      </div>`;
  }).join('');
}

function pickExpert(id) {
  state.expert = id;
  const card = document.getElementById(`we-${id}`);
  if (card) {
    document.querySelectorAll('.we-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
  }
}

function populateExpertDropdown() {
  const select = document.getElementById('f-expert');
  if (!select) return;

  const currentSel = state.expert || 'any';
  select.innerHTML = EXPERTS.map(e => `
    <option value="${e.id}" ${e.id === currentSel ? 'selected' : ''}>
      ${e.name} ${e.role ? `— ${e.role}` : ''}
    </option>
  `).join('');
}

function onExpertChange() {
  const select = document.getElementById('f-expert');
  if (select) {
    state.expert = select.value;
  }
}

/* ─── STEP 3: Calendar ───────────────────────────────────── */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ─── WORKING HOURS (drives calendar & time slot availability) ── */
const WORKING_HOURS = {
  0: { open: '10:00', close: '17:00' }, // Sunday
  1: { open: '09:00', close: '18:00' }, // Monday
  2: { open: '09:00', close: '18:00' }, // Tuesday
  3: { open: '09:00', close: '18:00' }, // Wednesday
  4: { open: '09:00', close: '18:00' }, // Thursday
  5: { open: '09:00', close: '18:00' }, // Friday
  6: { open: '08:00', close: '19:00' }, // Saturday
};

function timeStrToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToLabel(mins) {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/* Generate 30-min slots for a given JS Date based on its weekday's working hours */
function getSlotsForDate(date) {
  const hours = WORKING_HOURS[date.getDay()];
  if (!hours) return [];
  const openMin = timeStrToMinutes(hours.open);
  const closeMin = timeStrToMinutes(hours.close);
  const slots = [];
  for (let m = openMin; m < closeMin; m += 30) {
    slots.push(minutesToLabel(m));
  }
  return slots;
}

function slotToMinutes(slot) {
  if (!slot) return 0;
  const [time, period] = slot.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function isSlotOccupied(slotLabel) {
  if (!state.date) return false;
  const currentDayStr = state.date.toDateString();
  const totalDuration = state.isRescheduling ? (state.rescheduleBookingDuration || 60) : getSelectedServiceDuration();

  const C_start = slotToMinutes(slotLabel);
  const C_duration = totalDuration;

  // Filter busy slots for the current selected day, and exclude the current booking if rescheduling
  const dayBusySlots = BUSY_SLOTS.filter(b => {
    const bDateStr = new Date(b.date).toDateString();
    if (bDateStr !== currentDayStr) return false;

    if (state.isRescheduling && state.rescheduleBooking) {
      const selfId = state.rescheduleBooking.id || state.rescheduleBooking.reference_id;
      if (b.reference_id === selfId) return false;
    }
    return true;
  });

  for (const b of dayBusySlots) {
    const E_start = slotToMinutes(b.startTime);
    const E_duration = b.durationMinutes;

    if (C_start < E_start + E_duration && E_start < C_start + C_duration) {
      return true;
    }
  }

  return false;
}

function isDateFull(dt) {
  const daySlots = getSlotsForDate(dt);
  if (!daySlots.length) return false;

  const currentDayStr = dt.toDateString();
  const totalDuration = state.isRescheduling ? (state.rescheduleBookingDuration || 60) : getSelectedServiceDuration();

  const now = new Date();
  const isToday = dt.toDateString() === now.toDateString();

  const dayBusySlots = BUSY_SLOTS.filter(b => {
    const bDateStr = new Date(b.date).toDateString();
    if (bDateStr !== currentDayStr) return false;
    if (state.isRescheduling && state.rescheduleBooking) {
      const selfId = state.rescheduleBooking.id || state.rescheduleBooking.reference_id;
      if (b.reference_id === selfId) return false;
    }
    return true;
  });

  return daySlots.every(slot => {
    // 1. If checking today, treat slots in the past as occupied/unavailable
    if (isToday) {
      const [tp, mer] = slot.split(' ');
      let [h, m] = tp.split(':').map(Number);
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      const d = new Date(); d.setHours(h, m, 0, 0);
      if (d <= now) return true;
    }

    // 2. Check if occupied by existing booking
    const C_start = slotToMinutes(slot);
    const C_duration = totalDuration;

    for (const b of dayBusySlots) {
      const E_start = slotToMinutes(b.startTime);
      const E_duration = b.durationMinutes;

      if (C_start < E_start + E_duration && E_start < C_start + C_duration) {
        return true;
      }
    }
    return false;
  });
}

function renderCalendar() {
  document.getElementById('cal-month-label').textContent = `${MONTHS[calMonth]} ${calYear}`;
  const grid = document.getElementById('cal-days-grid');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const first = new Date(calYear, calMonth, 1).getDay();
  const total = new Date(calYear, calMonth + 1, 0).getDate();
  const prev = new Date(calYear, calMonth, 0).getDate();

  let html = '';
  for (let i = first - 1; i >= 0; i--) html += `<div class="cal-day ghost">${prev - i}</div>`;

  for (let d = 1; d <= total; d++) {
    const dt = new Date(calYear, calMonth, d);
    const isPast = dt < today;
    const isClosed = !WORKING_HOURS[dt.getDay()];
    const isToday = dt.toDateString() === today.toDateString();
    const isPicked = state.date && dt.toDateString() === state.date.toDateString();
    const isBlocked = isPast || isClosed;
    const isFull = !isBlocked && isDateFull(dt);
    const availCls = isBlocked ? '' : (isFull ? 'full-day' : 'available-day');
    const cls = ['cal-day', isBlocked ? 'off' : '', availCls, isToday ? 'today' : '', isPicked ? 'picked' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" ${!isBlocked && !isFull ? `onclick="pickDate(${calYear},${calMonth},${d})"` : ''}>${d}</div>`;
  }

  const rem = (first + total) % 7;
  if (rem) for (let i = 1; i <= 7 - rem; i++) html += `<div class="cal-day ghost">${i}</div>`;

  grid.innerHTML = html;
  if (state.date) renderSlots();
}

function prevMonth() { if (--calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); }
function nextMonth() { if (++calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); }

function pickDate(y, m, d) {
  state.date = new Date(y, m, d);
  state.date.setHours(12, 0, 0, 0); // Normalize to noon to avoid timezone shift errors
  state.time = null;
  renderCalendar();
  renderSlots();
  document.getElementById('time-box-label').textContent =
    state.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ─── STEP 3: Time Slots ─────────────────────────────────── */
function getSlotEndTime(slotStart12h, durationMinutes) {
  const start24 = to24Hour(slotStart12h);
  if (!start24) return '';
  const [h, m] = start24.split(':').map(Number);
  const startDate = new Date(2000, 0, 1, h, m, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  let endH = endDate.getHours();
  const endM = endDate.getMinutes();
  const endPeriod = endH >= 12 ? 'PM' : 'AM';
  let endH12 = endH % 12;
  if (endH12 === 0) endH12 = 12;
  return `${endH12}:${String(endM).padStart(2, '0')} ${endPeriod}`;
}

function renderSlots() {
  const grid = document.getElementById('time-slots-grid');
  if (!state.date) { grid.innerHTML = ''; return; }

  const daySlots = getSlotsForDate(state.date);
  if (!daySlots.length) {
    grid.innerHTML = '<p class="service-select-hint">S\'posh APPEAL is closed on this day. Please pick another date.</p>';
    return;
  }

  const now = new Date();
  const isToday = state.date.toDateString() === now.toDateString();
  const totalDuration = state.isRescheduling ? (state.rescheduleBookingDuration || 60) : getSelectedServiceDuration();
  const durationLabel = formatDuration(totalDuration);

  // Update time-slots-banner
  const banner = document.getElementById('time-slots-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.innerHTML = `Working hours: 8:00am &ndash; 7:00pm &middot; Slots blocked by total service duration (${durationLabel})`;
  }

  // Check if previously picked time slot is still available with new date/duration
  if (state.time) {
    const isPastSlot = isToday && (() => {
      const [tp, mer] = state.time.split(' ');
      let [h, m] = tp.split(':').map(Number);
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      const d = new Date(); d.setHours(h, m, 0, 0);
      return d <= now;
    })();
    const occupied = isSlotOccupied(state.time);
    if (isPastSlot || occupied) {
      state.time = null;
    }
  }

  grid.innerHTML = daySlots.map(slot => {
    const isPicked = state.time === slot;
    let isPast = false;
    if (isToday) {
      const [tp, mer] = slot.split(' ');
      let [h, m] = tp.split(':').map(Number);
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      const d = new Date(); d.setHours(h, m, 0, 0);
      isPast = d <= now;
    }
    const occupied = isSlotOccupied(slot);
    const isUnavailable = isPast || occupied;
    const cls = ['slot', isUnavailable ? 'taken' : '', isPicked ? 'picked' : ''].filter(Boolean).join(' ');
    return `
      <div class="${cls}" data-slot="${slot}" ${!isUnavailable ? `onclick="pickSlot('${slot}')"` : ''}>
        <span class="slot-time">${slot}</span>
      </div>`;
  }).join('');
}

function pickSlot(slot) {
  state.time = slot;
  document.querySelectorAll('.slot').forEach(el => el.classList.toggle('picked', el.getAttribute('data-slot') === slot));
}

/* ─── SUBMIT & PAYMENT ───────────────────────────────────── */
const BOOKING_FEE = 10000; // Non-refundable home service booking fee (Naira)
const PAYSTACK_PUBLIC_KEY = window.PAYSTACK_PUBLIC_KEY || null;



/* Service dropdown booking flow overrides (multi-select) */
function toggleSpecificServiceVisibility() {
  const selectSection = document.getElementById('specific-service-section');
  const categorySelect = document.getElementById('f-service-category');
  if (!selectSection || !categorySelect) return;

  if (categorySelect.value) {
    selectSection.style.display = 'flex';
  } else {
    selectSection.style.display = 'none';
  }
}

function renderWizardServices() {
  const categorySelect = document.getElementById('f-service-category');
  if (!categorySelect) return;

  categorySelect.innerHTML = '<option value="">Browse a service category</option>' + SERVICE_GROUPS.map(group =>
    `<option value="${group.id}">${group.name}</option>`
  ).join('');
  categorySelect.value = state.serviceCategory || '';
  toggleSpecificServiceVisibility();
  renderServiceOptions();
  renderSelectedServicesList();
  toggleServiceTypeVisibility();
}

function renderServiceOptions() {
  const categorySelect = document.getElementById('f-service-category');
  const preview = document.getElementById('service-option-preview');
  if (!categorySelect) return;

  const group = SERVICE_GROUPS.find(g => g.id === categorySelect.value);

  if (preview) {
    preview.innerHTML = group ? group.options.map(option => {
      const isSelected = state.selectedOptions.some(o => o.id === option.id);
      return `
      <button type="button" class="service-option-card ${isSelected ? 'selected' : ''}" onclick="toggleServiceOption('${group.id}', '${option.id}')">
        <span class="service-card-check"><i class="fa-solid fa-check"></i></span>
        <span class="service-card-title">${option.name}</span>
        <span class="service-card-meta">${formatDuration(option.durationMinutes)}</span>
        <span class="service-card-price">₦${option.price.toLocaleString()}</span>
      </button>
    `;
    }).join('') : '<p class="service-select-hint">Choose a category above to see services you can add.</p>';
  }

  updateFooterTotal();
}

function renderSelectedServicesList() {
  const container = document.getElementById('selected-services-list');
  if (!container) return;

  if (!state.selectedOptions.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const total = state.selectedOptions.reduce((t, o) => t + o.price, 0);
  container.innerHTML = `
    <div class="selected-services-header">
      <span>${state.selectedOptions.length} service${state.selectedOptions.length > 1 ? 's' : ''} selected</span>
      <span class="selected-services-total">₦${total.toLocaleString()}</span>
    </div>
    <div class="selected-services-items">
      ${state.selectedOptions.map(o => `
        <div class="selected-service-pill">
          <span>${o.name}</span>
          <strong>₦${o.price.toLocaleString()}</strong>
          <button type="button" class="selected-service-remove" onclick="removeServiceOption('${o.id}')" aria-label="Remove">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `).join('')}
    </div>`;
}

function onServiceCategoryChange() {
  const categorySelect = document.getElementById('f-service-category');
  state.serviceCategory = categorySelect?.value || '';
  if (!state.serviceCategory) {
    state.selectedOptions = [];
  }
  toggleSpecificServiceVisibility();
  renderServiceOptions();
  renderSelectedServicesList();
  toggleServiceTypeVisibility();
}

function toggleServiceOption(groupId, optionId) {
  const group = SERVICE_GROUPS.find(g => g.id === groupId);
  const option = group?.options.find(o => o.id === optionId);
  if (!option) return;

  const idx = state.selectedOptions.findIndex(o => o.id === optionId);
  if (idx === -1) {
    state.selectedOptions.push({ ...option, groupId, groupName: group.name });
  } else {
    state.selectedOptions.splice(idx, 1);
  }

  renderServiceOptions();
  renderSelectedServicesList();
  toggleServiceTypeVisibility();
  updateFooterTotal();
}

function removeServiceOption(optionId) {
  state.selectedOptions = state.selectedOptions.filter(o => o.id !== optionId);
  renderServiceOptions();
  renderSelectedServicesList();
  toggleServiceTypeVisibility();
  updateFooterTotal();
}

function getSelectedServiceGroup() {
  return SERVICE_GROUPS.find(group => group.id === state.serviceCategory) || null;
}

function getSelectedServiceOption() {
  return state.selectedOptions[0] || null;
}

function getSelectedServiceTotal() {
  return state.selectedOptions.reduce((t, o) => t + o.price, 0);
}

function getSelectedServiceDuration() {
  return state.selectedOptions.reduce((t, o) => t + (o.durationMinutes || 60), 0);
}

function getDeposit(total) {
  return Math.ceil(total * 0.3);
}

function formatSlotRange(slot, durationMinutes = 60) {
  const start = to24Hour(slot);
  if (!start) return slot || '';
  const [hours, minutes] = start.split(':').map(Number);
  const startDate = new Date(2000, 0, 1, hours, minutes, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const end = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
  const hoursLabel = durationMinutes % 60 === 0 ? `${durationMinutes / 60} hr` : `${durationMinutes} min`;
  return `${start} - ${end} (${hoursLabel})`;
}

function formatDuration(durationMinutes = 60) {
  if (durationMinutes % 60 === 0) return `${durationMinutes / 60} hr`;
  if (durationMinutes < 60) return `${durationMinutes} min`;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${hours} hr ${minutes} min`;
}

function renderSummary() {
  const isResched = state.isRescheduling;
  const booking = state.rescheduleBooking;

  const expert = isResched ? { name: booking.expertName } : (EXPERTS.find(e => e.id === state.expert) || EXPERTS[0]);
  const totalDuration = isResched ? state.rescheduleBookingDuration : getSelectedServiceDuration();

  let total, deposit, balance, serviceHtml, serviceTypeLabel;

  if (isResched) {
    total = booking.total;
    deposit = booking.depositDue;
    balance = booking.balanceDue;
    serviceHtml = `<span>${esc(booking.serviceNames)}</span>`;
    serviceTypeLabel = booking.serviceType === 'home' ? 'Home Service' : 'In-Studio';
  } else {
    const base = getSelectedServiceTotal();
    const homeExtra = state.serviceType === 'home' ? 5000 : 0;
    total = base + homeExtra;
    deposit = getDeposit(total);
    balance = Math.max(total - deposit, 0);
    serviceHtml = state.selectedOptions.length
      ? state.selectedOptions.map(o =>
        `<span>${o.name} <strong style="color:var(--primary-rose)">₦${o.price.toLocaleString()}</strong></span>`
      ).join('')
      : '—';
    serviceTypeLabel = state.serviceType === 'home' ? 'Home Service (+₦5,000)' : 'In-Salon Visit';
  }

  const expertEl = document.getElementById('sum-expert');
  if (expertEl) expertEl.textContent = expert?.name || 'Any Available Expert';

  const datetimeEl = document.getElementById('sum-datetime');
  if (datetimeEl) {
    datetimeEl.textContent = state.date
      ? `${state.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${formatSlotRange(state.time, totalDuration)}`
      : '—';
  }

  const typeEl = document.getElementById('sum-type');
  if (typeEl) typeEl.textContent = serviceTypeLabel;

  // Render Address Row
  const addressRow = document.getElementById('sum-address-row');
  const addressVal = document.getElementById('sum-address');
  const currentServiceType = isResched ? booking.serviceType : state.serviceType;
  const currentAddress = isResched ? booking.address : state.address;

  if (addressRow) {
    if (currentServiceType === 'home') {
      addressRow.style.display = 'flex';
      if (addressVal) addressVal.textContent = currentAddress || 'No address specified';
    } else {
      addressRow.style.display = 'none';
    }
  }

  const totalEl = document.getElementById('sum-total');
  if (totalEl) totalEl.textContent = `₦${total.toLocaleString()}`;

  const servicesEl = document.getElementById('sum-services');
  if (servicesEl) servicesEl.innerHTML = serviceHtml;

  const depositEl = document.getElementById('sum-deposit');
  if (depositEl) {
    if (isResched) {
      depositEl.textContent = `Paid (₦${deposit.toLocaleString()})`;
    } else {
      depositEl.textContent = `₦${deposit.toLocaleString()}`;
    }
  }

  const depositLabelEl = document.querySelector('.deposit-total .label');
  if (depositLabelEl) {
    depositLabelEl.textContent = isResched ? 'Deposit Paid' : 'Deposit due now (30%)';
  }

  const balanceEl = document.getElementById('sum-balance');
  if (balanceEl) {
    if (isResched) {
      balanceEl.textContent = `Original deposit of ₦${deposit.toLocaleString()} is applied. Remaining balance of ₦${balance.toLocaleString()} to be settled at the appointment.`;
    } else {
      balanceEl.textContent = `Balance of ₦${balance.toLocaleString()} is paid at the salon. If your style runs longer, extra hours are settled in person.`;
    }
  }
}

function updateFooterTotal() {
  const base = state.isRescheduling ? (state.rescheduleBooking?.total || 0) : getSelectedServiceTotal();
  const homeExtra = (!state.isRescheduling && state.serviceType === 'home') ? 5000 : 0;
  const total = base + homeExtra;
  const priceEl = document.getElementById('modal-footer-price');
  if (priceEl) {
    priceEl.textContent = `₦${total.toLocaleString()}`;
  }
}

function renderStep(n) {
  document.getElementById('modal-step-title').textContent = STEP_TITLES[n - 1];
  const stepMobile = document.getElementById('modal-step-mobile');
  if (stepMobile) stepMobile.textContent = `Step ${n} of 5`;

  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`panel-${n}`);
  if (panel) panel.classList.add('active');

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`wstep-${i}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }

  for (let i = 1; i <= 4; i++) {
    const line = document.getElementById(`wline-${i}`);
    if (!line) continue;
    line.classList.remove('active', 'done');
    if (i < n) line.classList.add('done');
    else if (i === n) line.classList.add('active');
  }

  const back = document.getElementById('btn-wizard-back');
  const next = document.getElementById('btn-wizard-next');
  const hideBack = (n === 1 || (state.isRescheduling && n === 3));
  back.style.display = hideBack ? 'none' : 'inline-flex';
  if (hideBack) {
    back.classList.add('wizard-back-hidden');
  } else {
    back.classList.remove('wizard-back-hidden');
  }
  if (n === 5) {
    next.textContent = state.isRescheduling ? 'Confirm Reschedule' : 'Confirm & Pay Deposit';
  } else {
    next.textContent = 'Continue';
  }

  if (n === 2) {
    renderWizardServices();
    populateExpertDropdown();
    const addrEl = document.getElementById('f-address');
    if (addrEl) {
      addrEl.value = state.address || '';
    }
  }
  if (n === 3) renderCalendar();
  if (n === 4) renderSlots();
  if (n === 5) renderSummary();
  updateFooterTotal();
}

async function submitBooking() {
  if (isSlotOccupied(state.time)) {
    toast('Selected time slot is no longer available. Please choose another time.');
    state.step = 4;
    renderStep(4);
    return;
  }
  const expert = EXPERTS.find(e => e.id === state.expert) || EXPERTS[0];
  const services = state.selectedOptions;
  const base = getSelectedServiceTotal();
  const totalDuration = getSelectedServiceDuration();
  const homeExtra = state.serviceType === 'home' ? 5000 : 0;
  const total = base + homeExtra;
  const depositDue = getDeposit(total);

  window._pendingBooking = {
    expert,
    services,
    total,
    depositDue,
    balanceDue: Math.max(total - depositDue, 0),
    expertName: expert?.name || 'Any Available Expert',
    serviceNames: services.map(s => s.name).join(', '),
    serviceCategory: [...new Set(services.map(s => s.groupName))].join(', '),
    dateISO: state.date.toISOString(),
    dateDisplay: state.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
    time: formatSlotRange(state.time, totalDuration),
    startTime: state.time,
    clientName: state.name,
    clientEmail: state.email,
    clientPhone: state.phone,
    serviceType: state.serviceType,
    address: state.serviceType === 'home' ? (state.address || '') : '',
    notes: state.notes,
  };

  showHomePaymentPanel();
}

function showSuccessPanel() {
  const stepMobile = document.getElementById('modal-step-mobile');
  if (stepMobile) stepMobile.style.display = 'none';
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-success').classList.add('active');
  document.getElementById('modal-footer').style.display = 'none';
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`wstep-${i}`);
    if (el) { el.classList.remove('active'); el.classList.add('done'); }
  }
}

function showHomePaymentPanel() {
  const booking = window._pendingBooking;
  showSuccessPanel();
  document.getElementById('modal-step-title').textContent = 'Pay Deposit';
  const ringEl = document.getElementById('success-ring');
  const titleEl = document.getElementById('success-title');
  const msgEl = document.getElementById('success-message');
  const refEl = document.getElementById('success-ref-id');
  const actionsEl = document.getElementById('success-actions');

  if (ringEl) ringEl.innerHTML = '<i class="fa-solid fa-lock"></i>';
  if (titleEl) titleEl.textContent = 'Deposit Required';
  if (msgEl) msgEl.innerHTML = `Deposit due now: <strong>₦${(booking?.depositDue || 0).toLocaleString()}</strong>. Balance of <strong>₦${(booking?.balanceDue || 0).toLocaleString()}</strong> is paid at the salon.`;
  if (refEl) refEl.style.display = 'none';
  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="btn btn-primary btn-pay-confirm" id="btn-pay-now" onclick="initiatePayment()">
        Pay Deposit &nbsp;<i class="fa-solid fa-credit-card"></i>
      </button>`;
  }
}

async function initiatePayment() {
  const booking = window._pendingBooking;
  if (!booking) { toast('Session expired. Please start your booking again.'); return; }

  const btn = document.getElementById('btn-pay-now');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Opening payment...'; }

  if (API_BASE) {
    try {
      const result = await apiFetch('/bookings/new', {
        method: 'POST',
        body: JSON.stringify({
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          clientPhone: booking.clientPhone,
          services: booking.services,
          expert: booking.expert.id,
          expertName: booking.expertName,
          dateISO: booking.dateISO,
          dateDisplay: booking.dateDisplay,
          time: booking.time,
          startTime: booking.startTime,
          total: booking.total,
          depositDue: booking.depositDue,
          serviceType: booking.serviceType,
          address: booking.address,
          notes: booking.notes
        }),
      });

      // Update pending booking with the backend reference
      if (result?.reference_id) {
        booking.reference_id = result.reference_id;
      }

      if (result?.checkout_url) {
        sessionStorage.setItem('sposh_pending', JSON.stringify(booking));
        if (result.checkout_url === 'mock-checkout') {
          // Trigger local mock checkout
          showTestPaymentModal(booking);
        } else {
          // Redirect to Paystack checkout URL
          window.location.href = result.checkout_url;
        }
        return;
      }
    } catch (err) {
      console.warn('[Payment] Backend booking/payment initialization failed:', err.message);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Pay Deposit &nbsp;<i class="fa-solid fa-credit-card"></i>'; }
      toast('Payment service temporarily unavailable. Please try again in a moment.');
    }
  }

  // Paystack Inline fallback — use redirect mode on mobile for reliability
  if (typeof PaystackPop !== 'undefined' && PAYSTACK_PUBLIC_KEY && !PAYSTACK_PUBLIC_KEY.includes('xxxxxxxxxx')) {
    try {
      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: booking.clientEmail,
        amount: booking.depositDue * 100,
        currency: 'NGN',
        ref: 'SP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        metadata: {
          custom_fields: [
            { display_name: 'Client', variable_name: 'client_name', value: booking.clientName },
            { display_name: 'Phone', variable_name: 'client_phone', value: booking.clientPhone },
            { display_name: 'Services', variable_name: 'service_names', value: booking.serviceNames },
            { display_name: 'Appointment', variable_name: 'appointment', value: `${booking.dateDisplay} at ${booking.time}` },
            { display_name: 'Deposit', variable_name: 'deposit_due', value: `₦${booking.depositDue.toLocaleString()}` },
          ],
        },
        callback: (response) => onPaymentSuccess(response.reference, booking),
        onClose: () => {
          if (btn) { btn.disabled = false; btn.innerHTML = 'Pay Deposit &nbsp;<i class="fa-solid fa-credit-card"></i>'; }
          toast('Payment cancelled. Your slot is not confirmed until the deposit is paid.');
        },
      });
      handler.openIframe();
      return;
    } catch (popupErr) {
      console.warn('[Payment] PaystackPop failed (likely mobile popup block):', popupErr);
      // Fall through to test modal
    }
  }

  // Fallback to test payment popup modal for local environments
  showTestPaymentModal(booking);
}

function onPaymentSuccess(paystackRef, booking) {
  const ref = booking.reference_id || 'SP-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // If this was a mock checkout payment, notify the backend webhook to mark the booking paid & confirmed.
  if (API_BASE && paystackRef && (paystackRef.startsWith('TEST-') || paystackRef.startsWith('TEST_REF_'))) {
    apiFetch('/payments/webhook', {
      method: 'POST',
      body: JSON.stringify({
        event: 'charge.success',
        data: { reference: paystackRef }
      })
    }).catch(err => console.warn('[Payment Webhook] Mock notification failed:', err.message));
  }

  saveBooking({
    id: ref,
    paystackRef,
    dateISO: booking.dateISO,
    dateDisplay: booking.dateDisplay,
    time: booking.time,
    serviceNames: booking.serviceNames,
    expertName: booking.expertName,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    clientPhone: booking.clientPhone,
    serviceType: booking.serviceType,
    address: booking.address || '',
    notes: booking.notes,
    total: booking.total,
    depositDue: booking.depositDue,
    balanceDue: booking.balanceDue,
    status: 'confirmed',
    paidAt: new Date().toISOString(),
  });

  tryLoadBusySlots();
  window._pendingBooking = null;

  document.getElementById('modal-step-title').textContent = 'Booking Confirmed!';
  const ringEl = document.getElementById('success-ring');
  const titleEl = document.getElementById('success-title');
  const msgEl = document.getElementById('success-message');
  const refEl = document.getElementById('success-ref-id');
  const actionsEl = document.getElementById('success-actions');

  if (ringEl) ringEl.innerHTML = '<i class="fa-solid fa-check"></i>';
  if (titleEl) titleEl.textContent = "You're All Set!";
  if (msgEl) msgEl.textContent = "Deposit confirmed. Your S'posh APPEAL appointment is booked. Please keep your booking code for your salon visit.";
  if (refEl) { refEl.textContent = ref; refEl.style.display = ''; }
  if (actionsEl) {
    actionsEl.innerHTML = `
      <a class="btn btn-primary" id="btn-success-done" href="index.html">Done</a>`;
  }
}

async function checkRedirectPayment() {
  if (typeof window === 'undefined') return;
  const urlParams = new URLSearchParams(window.location.search);
  const reference = urlParams.get('reference');
  if (!reference) return;

  // Retrieve pending booking from sessionStorage
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem('sposh_pending'));
  } catch (e) {
    console.error('Failed to parse sposh_pending from sessionStorage', e);
  }

  // Clear query params to clean up the URL
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);

  if (!pending) return;

  showLoadingOverlay('Verifying deposit payment...');

  // Poll/query backend up to 4 times with a 1.5s delay to see if database has been updated by the webhook
  let confirmedBooking = null;
  for (let i = 0; i < 4; i++) {
    try {
      const result = await apiFetch(`/bookings/my?email=${encodeURIComponent(pending.clientEmail)}`);
      // Find the booking matching reference or reference_id
      confirmedBooking = (result?.bookings || []).find(b =>
        b.reference_id === pending.reference_id ||
        b.paystackReference === reference ||
        b.reference_id === reference
      );
      if (confirmedBooking && confirmedBooking.status === 'confirmed' && confirmedBooking.paymentStatus === 'paid') {
        break;
      }
    } catch (err) {
      console.warn('[Redirect check] Lookup failed on attempt', i + 1, err.message);
    }
    // Wait 1.5 seconds before next retry
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  hideLoadingOverlay();

  if (confirmedBooking) {
    // Save to local storage
    saveBooking({
      id: confirmedBooking.reference_id,
      paystackRef: confirmedBooking.paystackReference || reference,
      dateISO: confirmedBooking.dateISO,
      dateDisplay: confirmedBooking.dateDisplay,
      time: confirmedBooking.time,
      serviceNames: (confirmedBooking.services || []).map(s => s.name).join(', '),
      expertName: confirmedBooking.expertName,
      clientName: confirmedBooking.clientName,
      clientEmail: confirmedBooking.clientEmail,
      clientPhone: confirmedBooking.clientPhone,
      serviceType: confirmedBooking.serviceType,
      address: confirmedBooking.address || '',
      notes: confirmedBooking.notes,
      total: confirmedBooking.total,
      depositDue: confirmedBooking.depositDue,
      balanceDue: Math.max(confirmedBooking.total - confirmedBooking.depositDue, 0),
      status: confirmedBooking.status,
      paidAt: confirmedBooking.updatedAt || new Date().toISOString(),
    });

    sessionStorage.removeItem('sposh_pending');

    // Show Success Panel in Wizard
    showSuccessPanel();
    document.getElementById('modal-step-title').textContent = 'Booking Confirmed!';
    const ringEl = document.getElementById('success-ring');
    const titleEl = document.getElementById('success-title');
    const msgEl = document.getElementById('success-message');
    const refEl = document.getElementById('success-ref-id');
    const actionsEl = document.getElementById('success-actions');

    if (ringEl) ringEl.innerHTML = '<i class="fa-solid fa-check"></i>';
    if (titleEl) titleEl.textContent = "You're All Set!";
    if (msgEl) msgEl.textContent = "Deposit confirmed. Your S'posh APPEAL appointment is booked. Please keep your booking code for your salon visit.";
    if (refEl) { refEl.textContent = confirmedBooking.reference_id; refEl.style.display = ''; }
    if (actionsEl) {
      actionsEl.innerHTML = `
        <a class="btn btn-primary" id="btn-success-done" href="index.html">Done</a>`;
    }
  } else {
    // If webhook is delayed or failed, fall back to success display using pending details
    // but warn client confirmation is pending verification.
    toast('Payment received! We are confirming your slot.');

    // Save locally anyway as a fallback
    saveBooking({
      id: pending.reference_id,
      paystackRef: reference,
      dateISO: pending.dateISO,
      dateDisplay: pending.dateDisplay,
      time: pending.time,
      serviceNames: pending.serviceNames,
      expertName: pending.expertName,
      clientName: pending.clientName,
      clientEmail: pending.clientEmail,
      clientPhone: pending.clientPhone,
      serviceType: pending.serviceType,
      address: pending.address || '',
      notes: pending.notes,
      total: pending.total,
      depositDue: pending.depositDue,
      balanceDue: pending.balanceDue,
      status: 'pending', // Mark pending verification
      paidAt: new Date().toISOString(),
    });

    sessionStorage.removeItem('sposh_pending');

    showSuccessPanel();
    document.getElementById('modal-step-title').textContent = 'Booking Received!';
    const ringEl = document.getElementById('success-ring');
    const titleEl = document.getElementById('success-title');
    const msgEl = document.getElementById('success-message');
    const refEl = document.getElementById('success-ref-id');
    const actionsEl = document.getElementById('success-actions');

    if (ringEl) ringEl.innerHTML = '<i class="fa-solid fa-clock"></i>';
    if (titleEl) titleEl.textContent = "Booking Received!";
    if (msgEl) msgEl.textContent = "We received your payment. Your appointment status will be verified shortly.";
    if (refEl) { refEl.textContent = pending.reference_id; refEl.style.display = ''; }
    if (actionsEl) {
      actionsEl.innerHTML = `
        <a class="btn btn-primary" id="btn-success-done" href="index.html">Done</a>`;
    }
  }
  tryLoadBusySlots();
}

/* Convert "10:30 AM" -> "10:30" for backend */
function to24Hour(time12h) {
  if (!time12h) return null;
  const [time, period] = time12h.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* ─── TOAST ──────────────────────────────────────────────── */
function showDbWarningBanner() {
  const banner = document.getElementById('booking-db-warning-banner');
  if (banner) {
    banner.style.display = 'flex';
  }
}

function toast(msg) {
  document.getElementById('sp-toast')?.remove();
  const el = document.createElement('div');
  el.id = 'sp-toast';
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '32px', left: '50%',
    background: 'rgba(22, 13, 34, 0.82)', color: '#FF8FAB',
    border: '1px solid rgba(255, 143, 171, 0.3)',
    padding: '12px 28px', borderRadius: '50px', zIndex: '9999',
    fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: '500',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 143, 171, 0.15)',
    backdropFilter: 'blur(12px)', webkitBackdropFilter: 'blur(12px)',
    opacity: '0', transform: 'translate(-50%, 20px)',
    transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease',
  });
  document.body.appendChild(el);
  el.offsetHeight; // Force reflow
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, 0)';
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 15px)';
    setTimeout(() => el.remove(), 350);
  }, 3500);
}

/* ─── LOADING OVERLAY ────────────────────────────────────── */
function showLoadingOverlay(message = 'Processing payment...') {
  hideLoadingOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'sp-loading-overlay';
  overlay.innerHTML = `
    <div class="sp-loader-content">
      <div class="sp-loader-spinner"></div>
      <p class="sp-loader-text">${message}</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  document.getElementById('sp-loading-overlay')?.remove();
}
