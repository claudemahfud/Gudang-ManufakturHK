import { useEffect, useRef } from 'react';

// ============================================================
// HOOK: useBarcodeScanner
// Mendeteksi input dari physical barcode scanner (USB / Bluetooth HID)
// yang mengetikkan karakter secara sangat cepat (< 50ms per key)
// dan diakhiri dengan tombol 'Enter'.
// ============================================================

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minLength = 3,
  maxIntervalMs = 50,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length >= minLength) {
          e.preventDefault();
          onScan(barcode);
        }
        return;
      }

      // Scanner mengetik karakter dengan jeda sangat cepat (< maxIntervalMs)
      if (timeDiff > maxIntervalMs) {
        // Jika jeda terlalu lama, ini ketikan manual manusia, reset buffer
        bufferRef.current = '';
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, minLength, maxIntervalMs, enabled]);
}
