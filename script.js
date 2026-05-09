const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');

if (menuButton && menu) {
  menuButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 960) {
        menu.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

document.querySelectorAll('[data-faq-question]').forEach((button) => {
  button.addEventListener('click', () => {
    const item = button.closest('[data-faq-item]');
    if (!item) return;
    const answer = item.querySelector('[data-faq-answer]');
    if (!answer) return;

    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    answer.hidden = expanded;
    item.classList.toggle('is-open', !expanded);
  });
});

const connectForm = document.getElementById('connectForm');
const connectStatus = document.getElementById('connectStatus');
const connectSubmitButton = document.getElementById('connectSubmitButton');

if (connectForm && connectStatus && connectSubmitButton) {
  const defaultButtonLabel = connectSubmitButton.textContent;
  let isSubmitting = false;

  connectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!connectForm.checkValidity()) {
      connectForm.reportValidity();
      return;
    }

    isSubmitting = true;
    connectSubmitButton.disabled = true;
    connectSubmitButton.textContent = 'Sending...';
    connectStatus.textContent = '';

    try {
      const formData = new FormData(connectForm);
      const isOptedIn = formData.get('updates_opt_in') === 'on';
      formData.set(
        'updates_opt_in',
        isOptedIn
          ? 'Yes - subscribed to Upward Knoxville updates.'
          : 'No - did not subscribe to Upward Knoxville updates.'
      );

      const response = await fetch('https://formsubmit.co/ajax/connect@upwardknoxville.org', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== 'true') {
        throw new Error('Form submission failed.');
      }

      connectStatus.textContent = 'Thank you for reaching out. Your message has been received.';
      connectForm.reset();
    } catch (error) {
      connectStatus.textContent = 'Something went wrong while sending your message. Please try again later.';
    } finally {
      isSubmitting = false;
      connectSubmitButton.disabled = false;
      connectSubmitButton.textContent = defaultButtonLabel;
    }
  });
}
