'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, Zap, RefreshCw, AlertCircle } from 'lucide-react';

// ============================================================
// COMPONENT: CameraBarcodeScanner
// Pemindai Barcode & QR Code menggunakan kamera HP / Tablet
// Menggunakan browser-native BarcodeDetector API (Zero-dependency)
// ============================================================

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export default function CameraBarcodeScanner({
  isOpen,
  onClose,
  onScan,
  title = 'Pindai Barcode / QR Code',
}: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Audio Beep
  const playBeep = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext fallback
    }

    // Haptic feedback (getar 100ms)
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(100);
      } catch {}
    }
  }, []);

  // Mulai stream kamera
  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasPermission(true);

      // Cek apakah kamera memiliki senter / torch
      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities && track.getCapabilities()) as any;
      setHasTorch(Boolean(capabilities?.torch));
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Harap izinkan akses kamera pada browser Anda.'
          : 'Kamera tidak dapat diakses atau sedang digunakan oleh aplikasi lain.'
      );
    }
  }, [facingMode]);

  // Hentikan stream kamera
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchEnabled(false);
  }, []);

  // Toggle Senter (Torch)
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchEnabled(nextState);
      } catch (err) {
        console.error('Torch error:', err);
      }
    }
  };

  // Toggle Kamera Depan / Belakang
  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Deteksi loop barcode via BarcodeDetector API
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    let isScanning = true;
    let detector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: [
            'qr_code',
            'ean_13',
            'ean_8',
            'code_128',
            'code_39',
            'upc_a',
            'upc_e',
            'itf',
          ],
        });
      } catch (e) {
        console.warn('BarcodeDetector format error:', e);
      }
    }

    const scanFrame = async () => {
      if (!isScanning) return;

      if (detector && videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              playBeep();
              onScan(rawValue);
              onClose();
              return;
            }
          }
        } catch {
          // Frame skip
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, onScan, onClose, playBeep]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      playBeep();
      onScan(manualInput.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup pemindai"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Video Frame */}
        <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Aiming Reticle (Target Box) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-64 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Animated Laser Scan Line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-[scanner_2s_ease-in-out_infinite]" />
            </div>
          </div>

          {/* Error / Fallback State */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
              <p className="text-xs text-slate-300 leading-relaxed mb-4 max-w-xs">{errorMessage}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
              >
                Coba Akses Lagi
              </button>
            </div>
          )}

          {/* Floating Controls (Torch & Camera Switch) */}
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 z-10">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                type="button"
                className={`p-3 rounded-full backdrop-blur-md border transition ${
                  torchEnabled
                    ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/30'
                    : 'bg-black/40 text-white border-white/20 hover:bg-black/60'
                }`}
                title="Senter / Flash"
              >
                <Zap className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={switchCamera}
              type="button"
              className="p-3 rounded-full bg-black/40 text-white border border-white/20 hover:bg-black/60 backdrop-blur-md transition"
              title="Ganti Kamera Depan / Belakang"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Footer / Manual Input Barcode Fallback */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 mb-2 text-center">
            Arahkan kamera ke barcode kemasan atau masukkan kode manual:
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Contoh: 899123456789..."
              className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
            >
              Cari
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
