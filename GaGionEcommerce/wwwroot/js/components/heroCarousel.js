const ROTATION_MS = 6500;

export function initHeroCarousel() {
  const carousel = document.getElementById('heroCarousel');
  if (!carousel) return;

  const track = document.getElementById('heroTrack');
  const slides = Array.from(track.querySelectorAll('.hero-slide'));
  const dots = Array.from(document.querySelectorAll('[data-hero-to]'));
  const prevButton = document.getElementById('heroPrev');
  const nextButton = document.getElementById('heroNext');
  const toggleButton = document.getElementById('heroAutoplayToggle');
  const currentLabel = document.getElementById('heroCurrentSlide');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!track || slides.length < 2) return;

  let currentIndex = Math.max(0, slides.findIndex(slide => slide.classList.contains('is-active')));
  let timer = null;
  let pointerInside = false;
  let focusInside = false;
  let userPaused = reducedMotion.matches;
  let touchStartX = null;

  function syncPlayButton() {
    const actuallyPlaying = Boolean(timer);
    toggleButton.textContent = actuallyPlaying ? 'Ⅱ' : '▶';
    toggleButton.setAttribute('aria-label', actuallyPlaying ? 'Tạm dừng tự chuyển banner' : 'Bật tự chuyển banner');
    toggleButton.title = actuallyPlaying ? 'Tạm dừng tự chuyển banner' : 'Bật tự chuyển banner';
  }

  function stopAutoplay() {
    if (timer) window.clearInterval(timer);
    timer = null;
    carousel.classList.remove('is-playing');
    syncPlayButton();
  }

  function startAutoplay() {
    stopAutoplay();
    if (userPaused || pointerInside || focusInside || document.hidden || reducedMotion.matches) return;
    carousel.classList.add('is-playing');
    timer = window.setInterval(() => showSlide(currentIndex + 1, false), ROTATION_MS);
    syncPlayButton();
  }

  function showSlide(requestedIndex, fromUser = false) {
    currentIndex = (requestedIndex + slides.length) % slides.length;
    track.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;

    slides.forEach((slide, index) => {
      const active = index === currentIndex;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });

    dots.forEach((dot, index) => {
      const active = index === currentIndex;
      dot.classList.toggle('active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });

    if (currentLabel) currentLabel.textContent = String(currentIndex + 1).padStart(2, '0');
    stopAutoplay();
    if (fromUser && userPaused === false && !reducedMotion.matches) startAutoplay();
    else if (!fromUser) startAutoplay();
  }

  prevButton?.addEventListener('click', () => showSlide(currentIndex - 1, true));
  nextButton?.addEventListener('click', () => showSlide(currentIndex + 1, true));
  dots.forEach(dot => dot.addEventListener('click', () => showSlide(Number(dot.dataset.heroTo), true)));

  toggleButton?.addEventListener('click', () => {
    userPaused = !userPaused;
    if (userPaused) {
      stopAutoplay();
    } else {
      // Explicitly pressing Play overrides focus-pause; autoplay resumes once
      // the pointer leaves the carousel if this was a mouse click.
      focusInside = false;
      startAutoplay();
    }
    syncPlayButton();
  });

  carousel.addEventListener('pointerenter', () => { pointerInside = true; stopAutoplay(); });
  carousel.addEventListener('pointerleave', () => { pointerInside = false; startAutoplay(); });
  carousel.addEventListener('focusin', () => { focusInside = true; stopAutoplay(); });
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) {
      focusInside = false;
      startAutoplay();
    }
  });
  document.addEventListener('visibilitychange', () => document.hidden ? stopAutoplay() : startAutoplay());
  reducedMotion.addEventListener?.('change', event => {
    if (event.matches) {
      userPaused = true;
      stopAutoplay();
    }
  });

  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showSlide(currentIndex - 1, true);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showSlide(currentIndex + 1, true);
    }
  });

  carousel.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches?.[0]?.clientX ?? null;
  }, { passive: true });
  carousel.addEventListener('touchend', event => {
    if (touchStartX === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 55) showSlide(currentIndex + (delta < 0 ? 1 : -1), true);
    touchStartX = null;
  }, { passive: true });

  // Make only the active slide reachable by keyboard/screen readers.
  slides.forEach((slide, index) => { slide.inert = index !== currentIndex; });
  startAutoplay();
}
