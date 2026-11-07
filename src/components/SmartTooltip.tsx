import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

interface SmartTooltipProps {
  content: string;
  placement?: TooltipPlacement;
  children: React.ReactElement;
}

/**
 * Komponen wrapper reusable untuk menambahkan atribut data-tooltip
 * ke elemen interaktif tanpa membungkusnya dengan div tambahan yang dapat menggeser layout.
 */
export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  content,
  placement = 'auto',
  children,
}) => {
  if (!content) return children;
  return React.cloneElement(children as React.ReactElement<any>, {
    'data-tooltip': content,
    'data-tooltip-placement': placement,
  });
};

interface ActiveTooltipState {
  text: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom';
  targetElement: HTMLElement;
}

/**
 * Global Smart Tooltip Portal Manager:
 * - Otomatis mendeteksi seluruh elemen dengan atribut `data-tooltip` di seluruh aplikasi.
 * - Muncul setelah hover ~250ms atau saat menerima fokus keyboard.
 * - Hilang seketika saat kursor meninggalkan elemen, fokus berpindah, atau tombol Escape ditekan.
 * - Dirender melalui React Portal ke `document.body` dengan `position: fixed` sehingga tidak pernah
 *   terpotong batas panel/scroll dan tidak pernah menggeser layout.
 * - Menyesuaikan posisi secara otomatis terhadap ruang layar (flip atas/bawah & clamp kiri/kanan).
 * - Mendukung perangkat layar sentuh.
 */
export const GlobalTooltipManager: React.FC = () => {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltipState | null>(
    null
  );
  const hoverTimerRef = useRef<number | null>(null);
  const touchDismissTimerRef = useRef<number | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const tooltipElRef = useRef<HTMLDivElement | null>(null);

  const clearTimers = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (touchDismissTimerRef.current !== null) {
      window.clearTimeout(touchDismissTimerRef.current);
      touchDismissTimerRef.current = null;
    }
  };

  const hideTooltip = () => {
    clearTimers();
    currentTargetRef.current = null;
    setActiveTooltip(null);
  };

  const computePosition = (el: HTMLElement, text: string) => {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const preferred =
      (el.getAttribute('data-tooltip-placement') as TooltipPlacement) || 'auto';

    const estimatedWidth = Math.min(300, Math.max(160, text.length * 6.2));
    const estimatedHeight = text.length > 55 ? 58 : 38;
    const gap = 10;

    let placement: 'top' | 'bottom' = 'top';
    if (preferred === 'bottom') {
      placement = 'bottom';
    } else if (preferred === 'top') {
      placement = rect.top < estimatedHeight + gap + 8 ? 'bottom' : 'top';
    } else {
      placement = rect.top >= estimatedHeight + gap + 12 ? 'top' : 'bottom';
    }

    if (placement === 'bottom' && rect.bottom + estimatedHeight + gap > vh - 8) {
      if (rect.top > vh - rect.bottom) {
        placement = 'top';
      }
    }

    const centerX = rect.left + rect.width / 2;
    const minCenterX = estimatedWidth / 2 + 12;
    const maxCenterX = vw - estimatedWidth / 2 - 12;
    const clampedX = Math.max(minCenterX, Math.min(maxCenterX, centerX));

    const y =
      placement === 'top'
        ? Math.max(8, rect.top - gap)
        : Math.min(vh - 8, rect.bottom + gap);

    setActiveTooltip({
      text,
      x: clampedX,
      y,
      placement,
      targetElement: el,
    });
  };

  useEffect(() => {
    const findTooltipTarget = (node: EventTarget | null): HTMLElement | null => {
      if (!(node instanceof HTMLElement)) return null;
      return node.closest<HTMLElement>('[data-tooltip]');
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = findTooltipTarget(e.target);
      if (!target) {
        if (currentTargetRef.current) {
          hideTooltip();
        }
        return;
      }

      const text = target.getAttribute('data-tooltip')?.trim();
      if (!text) {
        hideTooltip();
        return;
      }

      if (currentTargetRef.current === target) return;

      clearTimers();
      currentTargetRef.current = target;

      hoverTimerRef.current = window.setTimeout(() => {
        if (currentTargetRef.current === target && document.body.contains(target)) {
          computePosition(target, text);
        }
      }, 250);
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!currentTargetRef.current) return;
      const related = e.relatedTarget as Node | null;
      if (related && currentTargetRef.current.contains(related)) {
        return;
      }
      hideTooltip();
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = findTooltipTarget(e.target);
      if (!target) return;
      const text = target.getAttribute('data-tooltip')?.trim();
      if (!text) return;

      clearTimers();
      currentTargetRef.current = target;
      hoverTimerRef.current = window.setTimeout(() => {
        if (currentTargetRef.current === target && document.body.contains(target)) {
          computePosition(target, text);
        }
      }, 150);
    };

    const handleFocusOut = () => {
      hideTooltip();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideTooltip();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const target = findTooltipTarget(e.target);
      if (!target) {
        hideTooltip();
        return;
      }
      const text = target.getAttribute('data-tooltip')?.trim();
      if (!text) return;

      clearTimers();
      currentTargetRef.current = target;
      computePosition(target, text);
      touchDismissTimerRef.current = window.setTimeout(() => {
        hideTooltip();
      }, 2200);
    };

    const handleScrollOrResize = () => {
      if (currentTargetRef.current) {
        if (!document.body.contains(currentTargetRef.current)) {
          hideTooltip();
          return;
        }
        const text = currentTargetRef.current.getAttribute('data-tooltip')?.trim();
        if (text && activeTooltip) {
          computePosition(currentTargetRef.current, text);
        }
      }
    };

    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      clearTimers();
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeTooltip]);

  if (!activeTooltip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={tooltipElRef}
      role="tooltip"
      data-testid="global-smart-tooltip"
      style={{
        position: 'fixed',
        left: `${activeTooltip.x}px`,
        top: `${activeTooltip.y}px`,
        transform:
          activeTooltip.placement === 'top'
            ? 'translate(-50%, -100%)'
            : 'translate(-50%, 0%)',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      className="max-w-[300px] px-3 py-2 rounded-lg bg-slate-900/98 border border-amber-500/40 text-slate-100 text-xs leading-snug shadow-xl shadow-black/70 backdrop-blur-sm transition-opacity duration-150"
    >
      <div className="font-sans font-normal text-slate-100">
        {activeTooltip.text}
      </div>
    </div>,
    document.body
  );
};
