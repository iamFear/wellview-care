const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('has-interactions');

const splitAnimatedText = (element: HTMLElement, mode: 'words' | 'chars') => {
  if (element.dataset.animatedText) return;
  element.dataset.animatedText = mode;
  let order = 0;

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? '';
      const parts = mode === 'chars' ? [...value] : value.split(/(\s+)/);
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part || /^\s+$/.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }
        const clip = document.createElement('span');
        const content = document.createElement('span');
        clip.className = mode === 'chars' ? 'text-clip char-clip' : 'text-clip word-clip';
        content.className = mode === 'chars' ? 'animated-char' : 'animated-word';
        content.style.setProperty('--text-order', String(order++));
        content.textContent = part;
        clip.append(content);
        fragment.append(clip);
      });
      node.parentNode?.replaceChild(fragment, node);
      return;
    }
    [...node.childNodes].forEach(visit);
  };

  [...element.childNodes].forEach(visit);
};

document.querySelectorAll<HTMLElement>('.hero h1').forEach((title) => splitAnimatedText(title, 'chars'));
document.querySelectorAll<HTMLElement>(
  '.intro h2, .section-heading-row h2, .treatment-copy h2, .guide-heading h2, .process h2, .about h2, .final-cta h2, .appointment-intro h1, .expect-grid h2, .clinic-picker h2'
).forEach((title) => splitAnimatedText(title, 'words'));

const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  header.append(progress);

  const progressBar = progress.firstElementChild as HTMLElement;
  let ticking = false;
  const updateScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.transform = `scaleX(${ratio})`;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateScroll);
      ticking = true;
    }
  }, { passive: true });
  updateScroll();
}

const revealTargets = document.querySelectorAll<HTMLElement>(
  '.hero h1, .section-label, .intro-grid, .section-heading-row, .service-card, .treatments > *, .guide-heading, .guide-card, .process-grid > *, .about-inner > *, .location-card, .final-cta > *, .appointment-intro > *, .appointment-card, .urgent-strip > *, .expect-grid > *, .clinic-picker-heading > *, .clinic-call-grid article, footer > *'
);

if (!reduceMotion && 'IntersectionObserver' in window) {
  revealTargets.forEach((target, index) => {
    target.classList.add('reveal-item');
    target.style.setProperty('--reveal-order', String(index % 4));
  });
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      (entry.target as HTMLElement).classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -9% 0px', threshold: 0.08 });
  revealTargets.forEach((target) => revealObserver.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add('is-visible'));
}

const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.desktop-nav a[href*="#"]')];
const sections = navLinks
  .map((link) => {
    const id = link.hash.slice(1);
    return id ? { link, section: document.getElementById(id) } : null;
  })
  .filter((item): item is { link: HTMLAnchorElement; section: HTMLElement } => Boolean(item?.section));

if (sections.length && 'IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    sections.forEach(({ link, section }) => {
      const active = section === visible.target;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.15, 0.4] });
  sections.forEach(({ section }) => sectionObserver.observe(section));
}

if (!reduceMotion && finePointer) {
  document.querySelectorAll<HTMLElement>('.hero, .final-cta, .appointment-hero').forEach((surface) => {
    surface.addEventListener('pointermove', (event) => {
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
      surface.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
    }, { passive: true });
  });

  document.querySelectorAll<HTMLElement>('.service-card, .guide-card, .location-card, .clinic-call-grid article').forEach((card) => {
    card.classList.add('interactive-card');
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--card-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--card-y', `${event.clientY - rect.top}px`);
    }, { passive: true });
  });
}

document.querySelectorAll<HTMLDetailsElement>('.mobile-menu').forEach((menu) => {
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => menu.removeAttribute('open')));
});

const planner = document.querySelector<HTMLFormElement>('#visit-planner');
if (planner) {
  const clinic = planner.querySelector<HTMLSelectElement>('#clinic');
  const visitType = planner.querySelector<HTMLSelectElement>('#visit-type');
  const patientInputs = [...planner.querySelectorAll<HTMLInputElement>('input[name="patient"]')];
  const meter = planner.querySelector<HTMLElement>('[data-form-meter]');
  const summary = planner.querySelector<HTMLElement>('[data-form-summary]');
  const button = planner.querySelector<HTMLButtonElement>('.form-button');

  const slugByClinic: Record<string, string> = {
    'Fort Lauderdale': 'Fort-Lauderdale',
    'Fort Pierce': 'Fort-Pierce',
    'Jacksonville': 'Jacksonville',
    'Riviera Beach': 'Riviera-Beach',
  };

  const updatePlanner = () => {
    const patient = patientInputs.find((input) => input.checked)?.value;
    const completed = [clinic?.value, visitType?.value, patient].filter(Boolean).length;
    const percent = Math.round((completed / 3) * 100);
    meter?.style.setProperty('--form-progress', `${percent}%`);
    if (meter) meter.setAttribute('aria-valuenow', String(percent));

    if (summary) {
      summary.textContent = completed === 0
        ? 'Choose your clinic to begin.'
        : completed < 3
          ? `${completed} of 3 choices complete`
          : `${clinic?.value} · ${patient === 'new' ? 'New patient' : 'Returning patient'}`;
    }
    if (button) {
      button.classList.toggle('is-ready', completed === 3);
      button.querySelector('span')?.classList.toggle('button-arrow-ready', completed === 3);
    }
  };

  planner.addEventListener('change', updatePlanner);
  planner.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!planner.reportValidity() || !clinic?.value) return;
    const slug = slugByClinic[clinic.value];
    window.location.assign(`https://wellviewcare.org/${slug}/appointment`);
  });
  updatePlanner();
}
