const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

document.querySelectorAll('#navLinks a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks?.classList.remove('open');
  });
});

const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}
