import { useRef, useState, useLayoutEffect } from 'react';

/**
 * Scales its children down to fit the available width — but only on mobile
 * (viewport <= `breakpoint`). On desktop it renders children untouched, so
 * desktop layout is never affected.
 *
 * The children are laid out at a fixed `docWidth` (so the invoice keeps its
 * real proportions) and then CSS-scaled to fill the container. The wrapper's
 * height is set to the scaled height, so there is no empty space below and no
 * horizontal scrolling — the whole document simply fits the screen width.
 */
export default function ScaleToFit({ docWidth = 600, breakpoint = 640, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [dims, setDims] = useState({ active: false, scale: 1, height: 'auto' });

  useLayoutEffect(() => {
    const measure = () => {
      const active = window.matchMedia(`(max-width:${breakpoint}px)`).matches;
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      if (!active) {
        setDims((p) => (!p.active && p.scale === 1 ? p : { active: false, scale: 1, height: 'auto' }));
        return;
      }
      const avail = outer.clientWidth;
      const scale = Math.min(1, avail / docWidth);
      const height = inner.offsetHeight * scale;
      setDims((p) => (p.active && p.scale === scale && p.height === height ? p : { active: true, scale, height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [docWidth, breakpoint]);

  const outerStyle = dims.active
    ? { width: '100%', height: dims.height, overflow: 'hidden' }
    : { width: '100%' };
  const innerStyle = dims.active
    ? { width: docWidth, transform: `scale(${dims.scale})`, transformOrigin: 'top left' }
    : undefined;

  return (
    <div ref={outerRef} style={outerStyle}>
      <div ref={innerRef} style={innerStyle}>{children}</div>
    </div>
  );
}
