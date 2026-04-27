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
