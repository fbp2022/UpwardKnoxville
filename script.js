const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');

if (menuButton && menu) {
  menuButton.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        menu.classList.add('hidden');
      }
    });
  });
}

const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}
