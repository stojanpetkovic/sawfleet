// Progressive enhancement: scroll reveals, count-up numbers, header shadow and
// the mobile call-to-action bar. Everything works without it.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Scroll reveal --------------------------------------------------------
const revealSelectors = [
  'main .card',
  'main .card-static',
  'main h2',
  'main .topper',
  'main .prose-sf',
  'main figure',
  'main [data-reveal-group] > *',
  'main details',
];
const nodes = new Set<HTMLElement>();
document.querySelectorAll<HTMLElement>(revealSelectors.join(',')).forEach((el) => {
  if (el.closest('[data-no-reveal]')) return;
  // Hero content animates by itself; above-the-fold blocks should not wait for scroll.
  if (el.closest('[data-hero]')) return;
  nodes.add(el);
});
document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => nodes.add(el));

// Stagger siblings that share a parent (card grids, lists).
const byParent = new Map<Element, HTMLElement[]>();
nodes.forEach((el) => {
  const p = el.parentElement;
  if (!p) return;
  byParent.set(p, [...(byParent.get(p) ?? []), el]);
});
byParent.forEach((children) => {
  children.forEach((el, i) => {
    if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    el.style.setProperty('--reveal-delay', `${Math.min(i, 5) * 90}ms`);
  });
});
nodes.forEach((el) => {
  if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
});

if (reduce || !('IntersectionObserver' in window)) {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

// ---- Count-up numbers -----------------------------------------------------
document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  if (reduce) {
    el.textContent = String(target);
    return;
  }
  el.textContent = '0';
  const run = () => {
    const start = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  new IntersectionObserver((entries, obs) => {
    if (entries[0].isIntersecting) {
      run();
      obs.disconnect();
    }
  }, { threshold: 0.4 }).observe(el);
});

// ---- Header shadow after scrolling ---------------------------------------
const header = document.querySelector<HTMLElement>('header');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();


// ---- Outbound and listing clicks go to Google Analytics ------------------
// Phone, text and email clicks are also counted by the lead collector.
document.addEventListener(
  'click',
  (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-track]');
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (el && typeof gtag === 'function') gtag('event', el.dataset.track, { page_path: location.pathname, event_category: 'directory' });
  },
  true,
);
