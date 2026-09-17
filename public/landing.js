/**
 * Deno GTM — marketing landing page interactions.
 * Vanilla JS translation of the Deno Landing design's component state:
 * mega menu, deep-dive accordion + preview panel, FAQ accordion, scroll reveal.
 */

// ---- Mega menu -------------------------------------------------------

const menuToggle = document.getElementById('menu-toggle');
const megaMenu = document.getElementById('mega-menu');

if (menuToggle && megaMenu) {
  menuToggle.addEventListener('click', () => {
    const open = megaMenu.hidden;
    megaMenu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!megaMenu.hidden && !megaMenu.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target)) {
      megaMenu.hidden = true;
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !megaMenu.hidden) {
      megaMenu.hidden = true;
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.focus();
    }
  });
}

// ---- Deep-dive accordion + preview panel ------------------------------

const deepdivePanels = [
  { label: 'Validation · DAG', title: 'Eight agents, one of them hostile', desc: 'Concurrent intake, market, sizing and risk agents. A Critic that attacks the thesis. A refiner loop bounded at three rounds so it terminates.', rows: [['Critic rounds', '3'], ['Sourced claims', '24'], ['Dropped / unsourced', '6']] },
  { label: 'Verdict · Report', title: 'Build, Pivot or Kill — with the receipts', desc: 'Bottom-up sizing you can audit, the top three arguments on each side, and a clickable source ledger with retrieval timestamps.', rows: [['Verdict', 'BUILD'], ['Confidence', '84%'], ['SOM (yr 1)', '$12M']] },
  { label: 'Ban Risk · Studio', title: 'The number you check before you send', desc: 'Eighteen structural patterns, 2026 density tells and live community rule conflicts, recomputed as you type.', rows: [['Score', '88 / 100'], ['Deductions', '3'], ['Hard violations', '0']] },
  { label: 'Story Bank', title: 'Receipts a model can’t fabricate', desc: 'Scars, metrics, turning points and defended opinions. Every draft pulls one real detail, which is what defeats the portability test.', rows: [['Entries', '14'], ['Metrics on file', '6'], ['Scars', '4']] },
  { label: 'Publishing · Manual', title: 'Copy, deep-link, send', desc: 'No automation anywhere in the loop. Deno prepares the post and the platform link; a human always presses the button.', rows: [['Automated actions', '0'], ['Deep links', 'READY'], ['ToS posture', 'COMPLIANT']] }
];

const accordionItems = Array.from(document.querySelectorAll('#deepdive-accordion .accordion__item'));
const accordionPanelsEl = Array.from(document.querySelectorAll('#deepdive-accordion .accordion__panel'));
const deepdiveLabel = document.getElementById('deepdive-label');
const deepdiveTitle = document.getElementById('deepdive-title');
const deepdiveDesc = document.getElementById('deepdive-desc');
const deepdiveRows = document.getElementById('deepdive-rows');

function setActiveDeepdive(index) {
  accordionItems.forEach((btn, i) => {
    const isActive = i === index;
    btn.setAttribute('aria-expanded', String(isActive));
    accordionPanelsEl[i].hidden = !isActive;
  });
  const p = deepdivePanels[index] || deepdivePanels[0];
  if (deepdiveLabel) deepdiveLabel.textContent = p.label;
  if (deepdiveTitle) deepdiveTitle.textContent = p.title;
  if (deepdiveDesc) deepdiveDesc.textContent = p.desc;
  if (deepdiveRows) {
    deepdiveRows.innerHTML = '';
    p.rows.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.innerHTML = `<span>${k}</span><span>${v}</span>`;
      deepdiveRows.appendChild(row);
    });
  }
}

accordionItems.forEach((btn, i) => {
  btn.addEventListener('click', () => setActiveDeepdive(i));
});

if (accordionItems.length) setActiveDeepdive(0);

// ---- FAQ accordion -----------------------------------------------------

const faqItems = Array.from(document.querySelectorAll('#faq-list .faq__item'));

faqItems.forEach((btn, i) => {
  btn.addEventListener('click', () => {
    const panel = document.querySelector(`#faq-list .faq__panel[data-panel="${i}"]`);
    const sign = btn.querySelector('.faq__sign');
    const willOpen = panel.hidden;

    // Close any other open FAQ item (single-open accordion, matches design).
    faqItems.forEach((otherBtn, j) => {
      if (j === i) return;
      const otherPanel = document.querySelector(`#faq-list .faq__panel[data-panel="${j}"]`);
      const otherSign = otherBtn.querySelector('.faq__sign');
      otherPanel.hidden = true;
      otherBtn.setAttribute('aria-expanded', 'false');
      if (otherSign) otherSign.textContent = '+';
    });

    panel.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
    if (sign) sign.textContent = willOpen ? '−' : '+';
  });
});

// ---- Scroll reveal -------------------------------------------------------

(function scrollReveal() {
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = Array.from(document.querySelectorAll('section')).slice(3);
  if (reduceMotion || !targets.length) return;

  targets.forEach((el) => el.classList.add('reveal'));

  const show = (el) => el.classList.add('is-visible');

  if (!('IntersectionObserver' in window)) {
    targets.forEach(show);
    return;
  }

  let fired = false;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        fired = true;
        show(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  targets.forEach((el) => io.observe(el));

  // Safety net: if IO never fires (e.g. everything already in view), reveal anyway.
  setTimeout(() => { if (!fired) targets.forEach(show); }, 1200);
})();
