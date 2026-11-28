'use client';

import React, { useRef, useState } from 'react';

interface SwipeDismissProps {
  onDismiss: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pembungkus toast mengambang agar bisa di-slide/swipe ke kiri, kanan, atau atas
 * pada layar sentuh (smartphone) maupun mouse drag untuk langsung menutup toast.
 */
export default function SwipeDismiss({ onDismiss, children, className = '' }: SwipeDismissProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const onStart = (x: number, y: number) => {
    if (dismissing) return;
    startRef.current = { x, y };
    setDragging(true);
  };

  const onMove = (x: number, y: number) => {
    if (!startRef.current || dismissing) return;
    const dx = x - startRef.current.x;
    const dy = y - startRef.current.y;
    // Hanya izinkan geser kiri/kanan atau geser ke atas (tidak ke bawah)
    setOffset({ x: dx, y: dy < 0 ? dy : 0 });
  };

  const onEnd = () => {
    if (!startRef.current || dismissing) return;
    startRef.current = null;
    setDragging(false);

    // Ambang batas geser: 55px horizontal atau 36px ke atas
    if (Math.abs(offset.x) > 55 || offset.y < -36) {
      setDismissing(true);
      const exitX = Math.abs(offset.x) > 55 ? (offset.x > 0 ? 320 : -320) : offset.x;
      const exitY = offset.y < -36 ? -120 : offset.y;
      setOffset({ x: exitX, y: exitY });
      setTimeout(onDismiss, 150);
    } else {
      setOffset({ x: 0, y: 0 });
    }
  };

  const progress = Math.min(1, Math.max(Math.abs(offset.x) / 140, Math.abs(offset.y) / 80));

  return (
    <div
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) onStart(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) onMove(t.clientX, t.clientY);
      }}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && (e.target as HTMLElement).closest('button')) return;
        if (e.pointerType !== 'touch') onStart(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'touch') onMove(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'touch') onEnd();
      }}
      onPointerCancel={onEnd}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        opacity: dismissing ? 0 : Math.max(0.25, 1 - progress * 0.75),
        transition: dragging ? 'none' : 'transform 180ms ease-out, opacity 180ms ease-out',
        touchAction: 'none',
      }}
      className={`select-none ${className}`}
    >
      {children}
    </div>
  );
}
