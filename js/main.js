/* AMAYA Bien-être — scripts du site (GSAP + ScrollTrigger + Lenis, aucun service externe) */
(function () {
  'use strict';

  var root = document.documentElement;
  var q = function (s, c) { return (c || document).querySelector(s); };
  var qa = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var PHONE = '+33624364589';
  var lenis = null;

  /* ---------------------------------------------------------
     Verrouillage du défilement (modales, menu)
  --------------------------------------------------------- */
  function lockScroll() { if (lenis) lenis.stop(); }
  function unlockScroll() { if (lenis) lenis.start(); }

  /* ---------------------------------------------------------
     Découpage de texte (mots / lettres) en gardant <em> et <br>
  --------------------------------------------------------- */
  function split(el, opts) {
    opts = opts || {};
    var chars = !!opts.chars;
    var mask = opts.mask !== false;
    var inner = [];
    var heading = /^H[1-6]$/.test(el.tagName);
    if (heading) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());

    function span(cls, txt) { var s = document.createElement('span'); s.className = cls; s.textContent = txt; return s; }

    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = mask ? 'w' : 'sw';
            if (heading) w.setAttribute('aria-hidden', 'true');
            if (chars) {
              Array.prototype.forEach.call(p, function (ch) { var c = span('c', ch); w.appendChild(c); inner.push(c); });
            } else if (mask) {
              var wi = span('wi', p); w.appendChild(wi); inner.push(wi);
            } else {
              w.textContent = p; inner.push(w);
            }
            frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    }
    walk(el);
    return inner;
  }

  /* =========================================================
     FONCTIONS INDÉPENDANTES DE GSAP
  ========================================================= */

  /* Vidéos : source adaptée à l'écran, lecture seulement quand visible */
  function initVideos() {
    var saver = navigator.connection && navigator.connection.saveData;
    qa('video[data-src-hd]').forEach(function (v) {
      if (reduce || saver) return; // image de secours seulement
      var lazy = v.getAttribute('preload') === 'none';
      var started = false;
      function load() {
        if (started) return; started = true;
        v.src = window.innerWidth >= 900 ? v.dataset.srcHd : v.dataset.srcSd;
        v.addEventListener('playing', function () { v.classList.add('is-playing'); }, { once: true });
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      }
      if (!lazy) load();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { load(); if (v.paused && started) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
            else if (started) v.pause();
          });
        }, { rootMargin: lazy ? '500px 0px' : '0px' }).observe(v);
      } else { load(); }
    });
  }

  /* Boîtes de dialogue : réservation Resalib + mentions légales */
  function openDialog(d) {
    if (!d || d.open) return;
    if (d.id === 'booking') {
      var frame = q('#bookingFrame'), loading = q('#bookingLoading');
      if (frame && !frame.getAttribute('src')) {
        var hide = function () { if (loading) loading.classList.add('is-hidden'); };
        // l'agenda Resalib se dessine quelques secondes après l'événement load
        frame.addEventListener('load', function () { setTimeout(hide, 2600); }, { once: true });
        setTimeout(hide, 12000);
        frame.setAttribute('src', frame.dataset.src);
      }
    }
    setMenu(false);
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    root.classList.add('modal-open');
    lockScroll();
  }
  function initDialogs() {
    qa('[data-open-booking]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openDialog(q('#booking')); });
    });
    var legalBtn = q('#openLegal');
    if (legalBtn) legalBtn.addEventListener('click', function () { openDialog(q('#legal')); });
    qa('dialog.modal').forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
      qa('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
      d.addEventListener('close', function () { root.classList.remove('modal-open'); unlockScroll(); });
    });
  }

  /* Menu mobile */
  var menuOpen = false;
  function setMenu(v) {
    var burger = q('#burger'), menu = q('#menu');
    if (!burger || !menu || menuOpen === v) return;
    menuOpen = v;
    burger.setAttribute('aria-expanded', String(v));
    burger.setAttribute('aria-label', v ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', String(!v));
    menu.classList.toggle('is-open', v);
    root.classList.toggle('menu-open', v);
    var hdr = q('#siteHeader'); if (hdr && v) hdr.classList.remove('is-hidden');
    if (v) lockScroll(); else unlockScroll();
  }
  function initMenu() {
    var burger = q('#burger');
    if (burger) burger.addEventListener('click', function () { setMenu(!menuOpen); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* Liens d'ancre (Lenis si dispo, sinon défilement natif) */
  function initAnchors() {
    qa('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id.length < 2) return;
        var t = q(id);
        if (!t) return;
        e.preventDefault();
        var wasOpen = menuOpen;
        setMenu(false);
        var go = function () {
          if (lenis) lenis.scrollTo(id === '#top' ? 0 : t, { duration: 1.7, easing: function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); } });
          else t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        };
        if (wasOpen) setTimeout(go, 120); else go();
        try { history.replaceState(null, '', id); } catch (err) {}
      });
    });
  }

  /* FAQ : accordéon */
  function initFaq() {
    qa('.qa').forEach(function (item) {
      var btn = q('button', item);
      btn.addEventListener('click', function () {
        var open = !item.classList.contains('is-open');
        qa('.qa.is-open').forEach(function (o) { if (o !== item) { o.classList.remove('is-open'); q('button', o).setAttribute('aria-expanded', 'false'); } });
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        if (hasGsap) setTimeout(function () { ScrollTrigger.refresh(); }, 800);
      });
    });
  }

  /* SMS pré-rempli (aucun back-end) */
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .5s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 600); }, 5200);
  }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return false; });
    return Promise.resolve(false);
  }
  function sendSms(body) {
    if (coarse) { window.location.href = 'sms:' + PHONE + '?&body=' + encodeURIComponent(body); return; }
    copyText(body).then(function (ok) {
      toast(ok ? 'Message copié : envoyez-le par SMS au 06 24 36 45 89.' : 'Écrivez à Gaëlle par SMS au 06 24 36 45 89.');
    });
  }
  function initSms() {
    var form = q('#smsForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var sel = q('#smsSoin'), opt = sel.options[sel.selectedIndex];
        var verb = opt.getAttribute('data-q') || 'réserver';
        var name = q('#smsName').value.trim();
        var body = 'Bonjour Gaëlle, je souhaiterais ' + verb + ' ' + opt.textContent + '. ' +
          (verb === 'réserver' ? 'Quelles sont vos prochaines disponibilités ? ' : '') +
          'Merci' + (name ? ', ' + name : '') + ' !';
        var hint = q('#smsHint');
        hint.textContent = '';
        if (coarse) { hint.textContent = 'Votre messagerie va s’ouvrir avec le message prêt à envoyer.'; sendSms(body); return; }
        hint.appendChild(document.createTextNode('Sur ordinateur, copiez ce message et envoyez-le par SMS au 06 24 36 45 89 :'));
        var quote = document.createElement('q'); quote.textContent = body; hint.appendChild(quote);
        var copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copier le message';
        copy.addEventListener('click', function () { copyText(body).then(function (ok) { copy.textContent = ok ? 'Message copié ✓' : 'Sélectionnez le texte pour le copier'; }); });
        hint.appendChild(copy);
      });
    }
    qa('[data-sms]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); sendSms(a.getAttribute('data-sms')); });
    });
  }

  /* Horaires : jour courant + statut ouvert / fermé (heure de Paris) */
  function initHours() {
    var sched = { 0: [], 1: [[17, 20]], 2: [[17, 20]], 3: [[14, 20]], 4: [[17, 20]], 5: [[17, 20]], 6: [[9, 12]] };
    var names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var day, hour, min;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      parts.forEach(function (p) {
        if (p.type === 'weekday') day = map[p.value];
        if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
        if (p.type === 'minute') min = parseInt(p.value, 10);
      });
    } catch (e) { return; }
    if (day == null) return;
    var li = q('.hours li[data-d="' + day + '"]'); if (li) li.classList.add('is-today');
    var badge = q('#openBadge'); if (!badge) return;
    var now = hour + min / 60, open = null;
    sched[day].forEach(function (s) { if (now >= s[0] && now < s[1]) open = s; });
    if (open) { badge.textContent = 'Ouvert · jusqu’à ' + open[1] + 'h'; badge.classList.add('is-open'); return; }
    var next = null;
    for (var i = 0; i < 8 && !next; i++) {
      var d = (day + i) % 7;
      sched[d].forEach(function (s) { if (!next && (i > 0 || s[0] > now)) next = { d: d, h: s[0], i: i }; });
    }
    badge.classList.add('is-closed');
    if (next) badge.textContent = 'Fermé · rouvre ' + (next.i === 0 ? 'aujourd’hui' : next.i === 1 ? 'demain' : names[next.d]) + ' à ' + next.h + 'h';
    else badge.textContent = 'Fermé';
  }

  /* Carrousel d'avis : glisser, flèches, points, défilement auto doux */
  function initReviews() {
    var rail = q('#rail'); if (!rail) return;
    var cards = qa('.review', rail), dots = q('#dots'), prev = q('#prev'), next = q('#next');
    var pad = function () { return parseFloat(getComputedStyle(rail).paddingLeft) || 0; };
    var cur = 0;
    function go(i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      rail.scrollTo({ left: cards[i].offsetLeft - pad(), behavior: reduce ? 'auto' : 'smooth' });
    }
    cards.forEach(function (c, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.setAttribute('aria-label', 'Aller à l’avis ' + (i + 1));
      b.addEventListener('click', function () { go(i); });
      dots.appendChild(b);
    });
    function sync() {
      var x = rail.scrollLeft + pad(), best = 0, bd = Infinity;
      cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft - x); if (d < bd) { bd = d; best = i; } });
      cur = best;
      qa('button', dots).forEach(function (b, i) { b.classList.toggle('is-on', i === best); });
    }
    rail.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });

    // glisser à la souris
    var down = false, sx = 0, sl = 0, moved = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) rail.classList.add('is-drag');
      rail.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      rail.classList.remove('is-drag'); sync(); go(cur);
    });

    // défilement automatique (mis en pause au survol / focus / hors écran)
    if (!reduce && 'IntersectionObserver' in window) {
      var visible = false, hover = false, timer = null;
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: .35 }).observe(rail);
      rail.addEventListener('mouseenter', function () { hover = true; });
      rail.addEventListener('mouseleave', function () { hover = false; });
      rail.addEventListener('focusin', function () { hover = true; });
      rail.addEventListener('focusout', function () { hover = false; });
      timer = setInterval(function () {
        if (!visible || hover || down || root.classList.contains('modal-open')) return;
        go(cur >= cards.length - 1 ? 0 : cur + 1);
      }, 6500);
    }
  }

  initVideos();
  initDialogs();
  initMenu();
  initAnchors();
  initFaq();
  initSms();
  initHours();
  initReviews();

  /* =========================================================
     ANIMATIONS (GSAP + ScrollTrigger + Lenis)
  ========================================================= */
  if (!hasGsap) {
    root.classList.remove('js'); root.classList.add('no-js');
    var l0 = q('#loader'); if (l0) l0.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  var hdr = q('#siteHeader');

  /* Smooth scroll global */
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // débloqué à la fin du loader
    window.lenis = lenis;
  }

  /* État initial de l'intro (caché derrière le loader) */
  var heroChars = split(q('#heroTitle'), { chars: true, mask: true });
  if (!reduce) {
    gsap.set(heroChars, { yPercent: 120, rotate: 5 });
    gsap.set(['.hero__kicker', '.hero__lead', '.hero__cta > *', '.hero__rating', '.seal', '.scroll-hint'], { opacity: 0 });
    gsap.set('.hero__video', { scale: 1.22 });
    gsap.set(hdr, { yPercent: -100, opacity: 0 });
  }

  var introTls = [];
  function heroIntro() {
    if (reduce) return;
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    introTls.push(tl);
    tl.to('.hero__video', { scale: 1, duration: 2.6, ease: 'power3.out' }, 0)
      .to('.hero__kicker', { opacity: 1, y: 0, duration: 1 }, .15)
      .to(heroChars, { yPercent: 0, rotate: 0, duration: 1.5, stagger: { each: .028 } }, .1)
      .fromTo('.hero__lead', { y: 34 }, { y: 0, opacity: 1, duration: 1.2 }, .65)
      .fromTo('.hero__cta > *', { y: 34 }, { y: 0, opacity: 1, duration: 1.1, stagger: .1 }, .8)
      .fromTo('.hero__rating, .seal', { scale: .6 }, { scale: 1, opacity: 1, duration: 1.2, stagger: .15, ease: 'back.out(1.5)' }, .95)
      .to(hdr, { yPercent: 0, opacity: 1, duration: 1.1 }, .7)
      .to('.scroll-hint', { opacity: .85, duration: 1.2 }, 1.3);
  }

  /* Loader : goutte -> ondes -> mot -> rideau d'huile qui monte */
  function runLoader() {
    var L = q('#loader');
    function finish() { if (L) L.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); }
    if (!L) { heroIntro(); finish(); return; }
    if (reduce) {
      gsap.to(L, { opacity: 0, duration: .5, onComplete: finish });
      return;
    }
    gsap.set('.loader__word span', { yPercent: 115 });
    gsap.set('.loader__sub', { opacity: 0, y: 12 });
    gsap.set('.loader__drop', { y: '-48vh', opacity: 1 });
    var ready = new Promise(function (res) {
      if (document.readyState === 'complete') res(); else window.addEventListener('load', res, { once: true });
    });
    var tl = gsap.timeline();
    introTls.push(tl);
    // filet de sécurité : si l'animation est bloquée (onglet en arrière-plan, erreur), on affiche le site quand même
    setTimeout(function () {
      if (!document.getElementById('loader') || document.visibilityState === 'hidden') return;
      introTls.forEach(function (t) { t.kill(); });
      gsap.set(heroChars, { yPercent: 0, rotate: 0 });
      gsap.set(['.hero__kicker', '.hero__lead', '.hero__cta > *', '.hero__rating', '.seal', '.scroll-hint'], { opacity: 1, y: 0, scale: 1 });
      gsap.set('.hero__video', { scale: 1 });
      gsap.set(hdr, { yPercent: 0, opacity: 1 });
      finish();
    }, 9000);
    tl.to('.loader__drop', { y: 0, duration: .85, ease: 'power2.in' })
      .to('.loader__drop', { scale: 0, opacity: 0, duration: .22, ease: 'power2.in' }, '>-0.04')
      .fromTo('.loader__rings .r', { scale: .15, opacity: .95 }, { scale: function (i) { return 4.4 + i * 2.4; }, opacity: 0, duration: 1.7, stagger: .2, ease: 'power2.out' }, '<0.05')
      .to('.loader__word span', { yPercent: 0, duration: 1, stagger: .08, ease: 'expo.out' }, '-=1.45')
      .to('.loader__sub', { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, '-=.7')
      .to({}, { duration: .35 });
    tl.eventCallback('onComplete', function () {
      Promise.race([ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(function () {
        var drop = window.innerHeight * 1.28;
        var exitTl = gsap.timeline({ onComplete: finish });
        introTls.push(exitTl);
        exitTl
          .to('.loader__scene', { opacity: 0, y: -40, duration: .55, ease: 'power2.in' })
          .to('.loader__panel', { y: -drop, duration: 1.35, ease: 'expo.inOut' }, '<.15')
          .add(heroIntro, '<.55');
      });
    });
  }
  runLoader();

  /* Barre de progression de lecture */
  gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: .25 } });

  /* En-tête : se cache en descendant, réapparaît en remontant */
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      var y = self.scroll();
      hdr.classList.toggle('is-solid', y > 60);
      if (menuOpen) return;
      if (self.direction === 1 && y > 520) hdr.classList.add('is-hidden');
      else if (self.direction === -1) hdr.classList.remove('is-hidden');
      var mb = q('#mbar'); if (mb) mb.classList.toggle('is-on', y > window.innerHeight * .7);
    }
  });

  /* Parallax multicouche du hero */
  if (!reduce) {
    var hp = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    hp.to('.hero__media', { yPercent: 16, scale: 1.1, ease: 'none' }, 0)
      .to('[data-hero-mid]', { yPercent: -22, rotate: 24, ease: 'none' }, 0)
      .to('[data-hero-front]', { yPercent: -12, opacity: .15, ease: 'none' }, 0)
      .to('.seal', { yPercent: -60, ease: 'none' }, 0)
      .to('.seal > svg:first-child', { rotation: 300, ease: 'none' }, 0)
      .to('.hero__rating', { yPercent: -30, opacity: 0, ease: 'none' }, 0);
  }

  /* Titres : révélation mot par mot (masque qui monte) */
  qa('[data-split]').forEach(function (el) {
    var words = split(el, { mask: true });
    if (reduce) return;
    gsap.set(words, { yPercent: 118 });
    ScrollTrigger.create({ trigger: el, start: 'top 86%', once: true, onEnter: function () { gsap.to(words, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: .055 }); } });
  });

  /* Paragraphe « scrub » : les mots s'allument au scroll */
  qa('[data-scrub-words]').forEach(function (el) {
    var words = split(el, { mask: false });
    if (reduce) return;
    gsap.set(words, { opacity: .14 });
    gsap.to(words, { opacity: 1, ease: 'none', stagger: .12, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true } });
  });

  /* Apparitions douces */
  if (!reduce) {
    var fades = qa('[data-fade]');
    gsap.set(fades, { y: 38, opacity: 0 });
    ScrollTrigger.batch(fades, { start: 'top 90%', once: true, onEnter: function (b) { gsap.to(b, { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: .12 }); } });
    qa('[data-float]').forEach(function (el, i) {
      gsap.from(el, { scale: .55, opacity: 0, duration: 1.1, ease: 'back.out(1.6)', delay: i * .1, scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
      gsap.to(el, { y: i % 2 ? -12 : 12, duration: 2.6 + i * .5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });
  }

  /* Révélations d'images par masque (arche / cercle / blob) + zoom Ken Burns */
  qa('[data-reveal]').forEach(function (el) {
    var type = el.dataset.reveal, img = q('img', el);
    if (reduce) return;
    var round = type === 'circle' || type === 'blob';
    var from = round ? 'circle(0% at 50% 50%)' : 'inset(100% 0% 0% 0%)';
    var to = round ? 'circle(78% at 50% 50%)' : 'inset(0% 0% 0% 0%)';
    var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 84%', once: true } });
    tl.fromTo(el, { clipPath: from }, { clipPath: to, duration: 1.7, ease: 'expo.inOut' }, 0);
    if (img) tl.fromTo(img, { scale: 1.4 }, { scale: 1, duration: 2.2, ease: 'power3.out' }, 0);
  });

  /* Images qui bougent à l'intérieur de leur cadre */
  if (!reduce) {
    qa('[data-parallax-img]').forEach(function (img) {
      var frame = img.parentElement;
      gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* Marquee : vitesse et sens réagissent au défilement */
  function initMarquee() {
    if (reduce) return;
    var boost = 0, target = 0, sgn = 1;
    var rows = qa('[data-marquee] .marquee__row').map(function (row) {
      var track = q('.marquee__track', row), group = q('.marquee__group', row);
      var need = Math.ceil(window.innerWidth / Math.max(group.offsetWidth, 1)) + 1;
      for (var i = 0; i < need; i++) { var c = group.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); }
      return { track: track, group: group, dir: parseFloat(row.dataset.dir) || -1, x: 0 };
    });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) {
      target = Math.min(Math.abs(self.getVelocity()) * .32, 1100);
      if (self.direction) sgn = self.direction;
    } });
    gsap.ticker.add(function () {
      var dt = gsap.ticker.deltaRatio() / 60;
      boost += (target - boost) * .08; target *= .9;
      rows.forEach(function (r) {
        var w = r.group.offsetWidth; if (!w) return;
        r.x += r.dir * sgn * (70 + boost) * dt;
        r.x = ((r.x % w) - w) % w; // reste dans [-w, 0)
        gsap.set(r.track, { x: r.x });
      });
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initMarquee); else initMarquee();

  /* Chiffres animés (compteurs) */
  qa('[data-count]').forEach(function (el) {
    var target = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10), o = { v: 0 };
    var fmt = function (v) { return v.toFixed(dec).replace('.', ','); };
    if (reduce) { el.textContent = fmt(target); return; }
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () {
      gsap.to(o, { v: target, duration: 2.4, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); } });
    } });
  });

  /* Avis : entrée en cascade */
  if (!reduce) {
    var rv = qa('.review');
    gsap.set(rv, { y: 60, opacity: 0 });
    ScrollTrigger.batch(rv, { start: 'top 94%', once: true, onEnter: function (b) { gsap.to(b, { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: .09 }); } });
  }

  /* Pied de page : grand nom qui se lève */
  if (!reduce) {
    gsap.from('[data-footer-big] span', { yPercent: 105, duration: 1.6, stagger: .09, ease: 'expo.out', scrollTrigger: { trigger: '[data-footer-big]', start: 'top 96%', once: true } });
  }

  /* Sections pinnées / horizontales (desktop uniquement), version simple sur mobile */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 960px) and (prefers-reduced-motion: no-preference)', function () {
    /* — Séance : storytelling pinné en 4 étapes — */
    var pin = q('[data-story]');
    if (pin) {
      var steps = qa('[data-step]', pin), shots = qa('[data-shot]', pin), n = steps.length;
      var cur = q('.story__cur', pin);
      gsap.set(steps, { opacity: 0, yPercent: 10 });
      gsap.set(steps[0], { opacity: 1, yPercent: 0 });
      gsap.set(shots, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(shots[0], { clipPath: 'inset(0% 0% 0% 0%)' });
      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: pin, start: 'top top', end: '+=' + ((n - 1) * 100 + 40) + '%', pin: true, scrub: .7, anticipatePin: 1,
          onUpdate: function () { var i = Math.min(n - 1, Math.round(tl.time())); cur.textContent = '0' + (i + 1); }
        }
      });
      tl.fromTo(q('.story__bar i', pin), { scaleY: 0 }, { scaleY: 1, duration: n - 1 }, 0);
      shots.forEach(function (s, i) {
        var im = q('img', s);
        tl.fromTo(im, { scale: 1.22 }, { scale: 1.02, duration: 1.6 }, Math.max(0, i - .45));
      });
      for (var i = 1; i < n; i++) {
        tl.to(steps[i - 1], { opacity: 0, yPercent: -12, duration: .32, ease: 'power2.in' }, i - .4)
          .fromTo(steps[i], { opacity: 0, yPercent: 12 }, { opacity: 1, yPercent: 0, duration: .36, ease: 'power2.out' }, i - .14)
          .fromTo(shots[i], { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .55, ease: 'power2.inOut' }, i - .42);
      }
      tl.to({}, { duration: .4 }, n - 1);
    }

    /* — Soins : défilement horizontal piloté par le scroll vertical — */
    var sp = q('[data-soins]'), track = q('[data-soins-track]');
    if (sp && track) {
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      gsap.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: sp, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: .7, anticipatePin: 1, invalidateOnRefresh: true } });
      gsap.to('.soins__progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sp, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true, invalidateOnRefresh: true } });
    }
  });

  /* Cartes : inclinaison 3D + reflet lumineux qui suit la souris */
  if (fine && !reduce) {
    qa('[data-tilt]').forEach(function (el) {
      var glare = document.createElement('span'); glare.className = 'glare'; glare.setAttribute('aria-hidden', 'true'); el.appendChild(glare);
      var base = el.classList.contains('polaroid') ? -4 : 0;
      gsap.set(el, { transformPerspective: 900, rotation: base });
      var rx = gsap.quickTo(el, 'rotationX', { duration: .6, ease: 'power3.out' });
      var ry = gsap.quickTo(el, 'rotationY', { duration: .6, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - .5) * 11); rx(-(py - .5) * 11);
        gsap.to(glare, { x: (px - .5) * r.width, y: (py - .5) * r.height, opacity: 1, duration: .4, overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', function () { rx(0); ry(0); gsap.to(glare, { opacity: 0, duration: .6 }); });
    });
  }

  /* Boutons magnétiques */
  if (fine && !reduce) {
    qa('[data-magnetic]').forEach(function (el) {
      var xt = gsap.quickTo(el, 'x', { duration: .7, ease: 'elastic.out(1,.45)' });
      var yt = gsap.quickTo(el, 'y', { duration: .7, ease: 'elastic.out(1,.45)' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xt((e.clientX - (r.left + r.width / 2)) * .3); yt((e.clientY - (r.top + r.height / 2)) * .4);
      });
      el.addEventListener('pointerleave', function () { xt(0); yt(0); });
    });
  }

  /* Curseur : point + anneau qui grossit sur les éléments cliquables */
  if (fine && !reduce) {
    root.classList.add('has-cursor');
    var dot = q('.cursor__dot'), ring = q('.cursor__ring');
    var dx = gsap.quickTo(dot, 'x', { duration: .08, ease: 'none' }), dy = gsap.quickTo(dot, 'y', { duration: .08, ease: 'none' });
    var rx2 = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3.out' }), ry2 = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3.out' });
    var curEl = q('.cursor');
    window.addEventListener('pointermove', function (e) {
      if (!curEl.classList.contains('is-live')) { gsap.set([dot, ring], { x: e.clientX, y: e.clientY }); curEl.classList.add('is-live'); }
      dx(e.clientX); dy(e.clientY); rx2(e.clientX); ry2(e.clientY);
    }, { passive: true });
    document.addEventListener('pointerover', function (e) { ring.classList.toggle('is-hot', !!(e.target.closest && e.target.closest('a, button, label, select, input, [data-tilt], #rail'))); });
  }

  /* Recalcul des positions une fois polices et images chargées */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
