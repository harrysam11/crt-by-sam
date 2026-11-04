import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PopoutWindowProps {
  title: string;
  width?: number;
  height?: number;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Renders children into a standalone popup window using React Portal and document cloning.
 * Maintains styles and live reactivity with the parent window.
 */
export default function PopoutWindow({
  title,
  width = 500,
  height = 650,
  isOpen,
  onClose,
  children,
}: PopoutWindowProps) {
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  const externalWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (externalWindowRef.current) {
        externalWindowRef.current.close();
        externalWindowRef.current = null;
      }
      setContainerEl(null);
      return;
    }

    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const win = window.open(
      '',
      '',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
    );

    if (!win) {
      alert('Pop-out blocked. Please allow popups for this site.');
      onClose();
      return;
    }

    externalWindowRef.current = win;
    win.document.title = `${title} • CRT Terminal`;

    // Copy style sheets and link tags from main document
    Array.from(document.styleSheets).forEach((styleSheet) => {
      try {
        if (styleSheet.cssRules) {
          const newStyleEl = win.document.createElement('style');
          Array.from(styleSheet.cssRules).forEach((rule) => {
            newStyleEl.appendChild(win.document.createTextNode(rule.cssText));
          });
          win.document.head.appendChild(newStyleEl);
        } else if (styleSheet.href) {
          const newLinkEl = win.document.createElement('link');
          newLinkEl.rel = 'stylesheet';
          newLinkEl.href = styleSheet.href;
          win.document.head.appendChild(newLinkEl);
        }
      } catch {
        // Cross-origin sheet access
      }
    });

    // Match theme background
    win.document.body.className = 'bg-[#0b0e14] text-slate-200 antialiased overflow-hidden m-0 p-0 h-full';

    const rootDiv = win.document.createElement('div');
    rootDiv.id = 'popout-root';
    rootDiv.className = 'h-full flex flex-col';
    win.document.body.appendChild(rootDiv);

    setContainerEl(rootDiv);

    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed);
        onClose();
      }
    }, 500);

    return () => {
      clearInterval(checkClosed);
      if (win && !win.closed) {
        win.close();
      }
    };
  }, [isOpen, title, width, height, onClose]);

  if (!isOpen || !containerEl) return null;

  return createPortal(children, containerEl);
}
