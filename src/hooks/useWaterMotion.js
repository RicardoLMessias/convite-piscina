import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { waterMotion } from '../config/motion.js';

export function useWaterMotion() {
  const scopeRef = useRef(null);

  useEffect(() => {
    const media = gsap.matchMedia();

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        const buttons = gsap.utils.toArray(
          '.section-controls .page-button',
          scopeRef.current,
        );
        gsap.killTweensOf(buttons);
        gsap.set(buttons, { clearProps: 'transform' });

        const pages = gsap.utils.toArray('.page', scopeRef.current);
        const visiblePages = new Map();
        let activeDecorations = [];
        let activeTweens = [];
        let activePage = null;
        let isScrolling = false;
        let scrollTimer;

        const resetActivePage = () => {
          activeTweens.forEach((tween) => tween.kill());
          gsap.set(activeDecorations, { clearProps: 'transform' });
          activeTweens = [];
          activeDecorations = [];
        };

        const animatePage = (page) => {
          if (!page) return;

          if (page === activePage) {
            activeTweens.forEach((tween) => tween.resume());
            return;
          }

          resetActivePage();
          activePage = page;

          activeDecorations = gsap.utils.toArray(
            '.pool-decorations .pool-decoration',
            page,
          );

          activeDecorations.forEach((element, index) => {
            activeTweens.push(gsap.to(element, {
              y: `+=${waterMotion.decorations.distance}`,
              duration:
                waterMotion.decorations.duration +
                (index % 4) * waterMotion.decorations.durationVariation,
              delay: index * waterMotion.decorations.stagger,
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true,
            }));
          });
        };

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(({ target, intersectionRatio }) => {
              visiblePages.set(target, intersectionRatio);
            });

            const mostVisiblePage = [...visiblePages.entries()]
              .filter(([, ratio]) => ratio >= 0.6)
              .sort((a, b) => b[1] - a[1])[0]?.[0];

            if (mostVisiblePage && !isScrolling) animatePage(mostVisiblePage);
          },
          { threshold: [0, 0.6, 0.8, 1] },
        );

        pages.forEach((page) => observer.observe(page));

        const handleScroll = () => {
          isScrolling = true;
          window.clearTimeout(scrollTimer);
          activeTweens.forEach((tween) => tween.pause());

          scrollTimer = window.setTimeout(() => {
            isScrolling = false;
            const mostVisiblePage = [...visiblePages.entries()]
              .filter(([, ratio]) => ratio >= 0.6)
              .sort((a, b) => b[1] - a[1])[0]?.[0];

            animatePage(mostVisiblePage);
          }, 180);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
          window.clearTimeout(scrollTimer);
          window.removeEventListener('scroll', handleScroll);
          observer.disconnect();
          resetActivePage();
        };
      }, scopeRef);

      return () => context.revert();
    });

    return () => media.revert();
  }, []);

  return scopeRef;
}
