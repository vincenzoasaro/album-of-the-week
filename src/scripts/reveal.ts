import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// One orchestrated moment on load (the record slides out of its sleeve),
// then each chapter's headline rises line by line as it scrolls into view.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduce) {
  gsap.registerPlugin(ScrollTrigger);

  const record = document.querySelector('[data-turntable="hero"] .tt-record');
  const arm = document.querySelector('[data-turntable="hero"] .tt-arm');
  if (record) {
    gsap.from(record, { xPercent: -42, rotation: -120, duration: 1.6, ease: 'power3.out', delay: 0.15, clearProps: 'transform' });
  }
  if (arm) gsap.from(arm, { opacity: 0, y: -12, duration: 0.8, delay: 1.1, ease: 'power2.out', clearProps: 'all' });

  for (const chapter of document.querySelectorAll<HTMLElement>('[data-chapter]')) {
    const lines = chapter.querySelectorAll('.chapter-title .line > span');
    const rest = chapter.querySelectorAll('[data-reveal]');
    const tl = gsap.timeline({ scrollTrigger: { trigger: chapter, start: 'top 78%', once: true } });
    if (lines.length) tl.from(lines, { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.09 });
    if (rest.length) tl.from(rest, { opacity: 0, y: 20, duration: 0.6, ease: 'power2.out', stagger: 0.05, clearProps: 'all' }, lines.length ? '-=0.45' : 0);
  }
}
