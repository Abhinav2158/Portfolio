(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Intro ---------- */
  const intro = $('#intro'), clock = $('#intro-clock');
  const sessionSafe = fn => { try { return fn(); } catch (e) { return null; } };
  // Play the intro once per visit, not every time someone returns from a detail page
  const seen = sessionSafe(() => sessionStorage.getItem('introSeen'));
  const DURATION = reduce || seen ? 0 : 2100;
  const t0 = performance.now();
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    intro.classList.add('done');
    document.body.classList.remove('loading');
    sessionSafe(() => sessionStorage.setItem('introSeen', '1'));
    setTimeout(() => intro.remove(), 1000);
    startHero();
  };
  const tick = now => {
    const p = Math.min((now - t0) / DURATION, 1), mins = Math.round(p * 24 * 60);
    clock.textContent = String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    p < 1 && !finished ? requestAnimationFrame(tick) : finish();
  };
  if (intro) {
    DURATION ? requestAnimationFrame(tick) : finish();
    intro.addEventListener('click', finish);
    setTimeout(finish, 4000); // safety net (e.g. background tab)
  }

  /* ---------- Count-up numbers ---------- */
  const count = el => {
    const end = +el.dataset.count, dec = +(el.dataset.dec || 0), sep = el.dataset.sep;
    const fmt = v => sep ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec);
    if (reduce) { el.textContent = fmt(end); return; }
    const s = performance.now(), dur = 1500;
    const step = n => {
      const p = Math.min((n - s) / dur, 1);
      el.textContent = fmt(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- Hero: sun travelling along the diurnal curve ---------- */
  function startHero() {
    $$('.hero [data-count]').forEach(el => setTimeout(() => count(el), 500));
    // Type out the code window line by line
    let delay = 0.5;
    $$('#code .ln').forEach(ln => {
      if (reduce) { ln.classList.add('show'); return; }
      const n = Math.max(ln.textContent.length, 1), t = Math.min(n * 0.022, 0.7);
      ln.style.setProperty('--n', n);
      ln.style.setProperty('--t', t + 's');
      ln.style.setProperty('--dl', delay + 's');
      ln.classList.add('go');
      delay += t + 0.06;
    });
    const curve = $('#curve'), sun = $('#sun');
    if (!curve || !sun) return;
    const len = curve.getTotalLength();
    const place = f => { const p = curve.getPointAtLength(len * f); sun.setAttribute('cx', p.x); sun.setAttribute('cy', p.y); };
    place(0.62);
    setTimeout(() => sun.classList.add('on'), reduce ? 0 : 2600);
    if (reduce) return;
    const start = performance.now() + 2600, period = 9000;
    const loop = now => {
      if (now > start) place(((now - start) % period) / period);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- Scroll reveal (staggered within each parent) ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(count);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.setProperty('--d', Math.min(sibs.indexOf(el) * 0.09, 0.45) + 's');
    io.observe(el);
  });

  /* ---------- Scroll progress + active nav link ---------- */
  const bar = $('#progress'), links = $$('.nav nav a');
  const sections = links.map(a => { const h = a.getAttribute('href'); return h.startsWith('#') ? $(h) : null; });
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    let cur = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
    links.forEach((a, i) => a.classList.toggle('active', i === cur));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Cursor glow on cards ---------- */
  $$('.card').forEach(c => c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', e.clientX - r.left + 'px');
    c.style.setProperty('--my', e.clientY - r.top + 'px');
  }));

  /* ---------- Background: drifting neural network with signal pulses ---------- */
  const cv = $('#bg');
  if (cv) {
    const ctx = cv.getContext('2d'), LINK = 150, COLORS = ['15,118,110', '232,89,12'], NIGHT = ['79,214,190', '108,176,255'];
    let W, H, nodes = [], pulses = [], mouse = null, raf = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(24, Math.min(80, Math.round(W * H / 17000)));
      nodes = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
        r: 1.6 + Math.random() * 2, c: i % 4 === 0 ? 1 : 0
      }));
      pulses = [];
    };
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      const links = [], dark = document.documentElement.dataset.theme === 'dark';
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            links.push([a, b]);
            ctx.strokeStyle = `rgba(${dark ? '150,180,220' : '20,60,52'},${(dark ? .2 : .16) * (1 - d / LINK)})`;
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (mouse) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 190) {
            ctx.strokeStyle = `rgba(${dark ? '108,176,255' : '232,89,12'},${.4 * (1 - d / 190)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${(dark ? NIGHT : COLORS)[a.c]},${dark ? .7 : .5})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      }
      // signals travelling between connected nodes
      if (links.length && pulses.length < 14 && Math.random() < .12) {
        const [a, b] = links[Math.floor(Math.random() * links.length)];
        pulses.push({ a, b, t: 0 });
      }
      pulses = pulses.filter(p => (p.t += .022) < 1);
      for (const p of pulses) {
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        ctx.fillStyle = dark ? 'rgba(108,176,255,.95)' : 'rgba(232,89,12,.85)';
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.283); ctx.fill();
        ctx.fillStyle = dark ? 'rgba(108,176,255,.2)' : 'rgba(232,89,12,.16)';
        ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.283); ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    resize(); frame();
    addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); frame(); });
    addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse = null; });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
    });
  }

  /* ---------- Night theme switch: day is the default on every new visit; the choice only lasts for the current visit ---------- */
  const sw = $('#theme'), root = document.documentElement;
  if (sw) {
    const sync = () => sw.setAttribute('aria-checked', root.dataset.theme === 'dark');
    sync();
    sw.addEventListener('click', () => {
      const dark = root.dataset.theme !== 'dark';
      if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
      try { sessionStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
      sync();
    });
  }

  $('#yr').textContent = new Date().getFullYear();
})();
