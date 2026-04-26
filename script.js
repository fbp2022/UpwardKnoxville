const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}

/* =========================
   FOOTER YEAR
========================= */

const yearElement = document.getElementById('year');

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

/* =========================
   CLOSE MOBILE MENU
========================= */

const mobileLinks = document.querySelectorAll('.nav-links a');

mobileLinks.forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('active');
  });
});

/* =========================
   SIMPLE SCROLL FADE-IN
========================= */

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
      }
    });
  },
  {
    threshold: 0.15
  }
);

const hiddenElements = document.querySelectorAll(
  '.section, .card, .cta-box, .hero-content'
);

hiddenElements.forEach(el => {
  el.classList.add('hidden');
  observer.observe(el);
});
