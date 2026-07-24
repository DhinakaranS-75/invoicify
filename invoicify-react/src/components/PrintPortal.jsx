import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders its children into a #print-root node that sits directly under
 * <body>, as a sibling of the React #root.
 *
 * Why not the usual `body * { visibility: hidden }` trick? Hidden elements
 * still occupy layout space, so the whole app pushed the invoice down and
 * the printer spat out blank pages first. Keeping the printable copy
 * outside the app tree means print can simply hide #root, and the invoice
 * is then the only thing on the page.
 *
 * #print-root is display:none on screen, display:block in @media print.
 */
export default function PrintPortal({ children }) {
  const [host, setHost] = useState(null);

  useEffect(() => {
    let el = document.getElementById('print-root');
    let created = false;
    if (!el) {
      el = document.createElement('div');
      el.id = 'print-root';
      document.body.appendChild(el);
      created = true;
    }
    setHost(el);
    return () => {
      // Only clean up the node we made, and only once it's empty.
      if (created && el && !el.childNodes.length && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  if (!host) return null;
  return createPortal(children, host);
}
