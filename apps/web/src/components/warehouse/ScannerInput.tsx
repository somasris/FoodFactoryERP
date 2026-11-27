import React, { useState, useRef } from 'react';
import { Camera, QrCode, Search } from 'lucide-react';

interface ScannerInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onScanSubmit?: (val: string) => void;
  placeholder?: string;
}

/**
 * Supports keyboard-wedge barcode scanners (Enter to submit), manual entry,
 * and browser camera scanning via BarcodeDetector API when supported.
 */
export const ScannerInput: React.FC<ScannerInputProps> = ({
  label,
  value,
  onChange,
  onScanSubmit,
  placeholder = 'Scan barcode / QR or type code...',
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser. Use keyboard scanner or manual entry.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);

      const Detector = (window as unknown as { BarcodeDetector?: new () => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (Detector) {
        const detector = new Detector();
        const interval = setInterval(async () => {
          if (!videoRef.current) {
            clearInterval(interval);
            return;
          }
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0 && results[0].rawValue) {
              onChange(results[0].rawValue);
              onScanSubmit?.(results[0].rawValue);
              clearInterval(interval);
              stopCamera();
            }
          } catch {
            // Keep scanning
          }
        }, 400);
      } else {
        setCameraError('Camera opened; live auto-decode requires BarcodeDetector support. Manual entry remains available.');
      }
    } catch {
      setCameraError('Unable to access camera. Check permissions or use manual entry.');
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[#24352A]">{label}</label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <QrCode className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#8A958C]" />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && value.trim()) {
                if (e.nativeEvent.isComposing || e.keyCode === 229) {
                  return;
                }
                e.preventDefault();
                onScanSubmit?.(value.trim());
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-md border border-[#E1E7DD] bg-white py-1.5 pl-8 pr-3 font-mono text-xs text-[#24352A] focus:border-[#245C3A] focus:outline-none"
          />
        </div>
        {onScanSubmit && (
          <button
            type="button"
            onClick={() => value.trim() && onScanSubmit(value.trim())}
            className="inline-flex items-center gap-1 rounded-md bg-[#245C3A] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#17452C]"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Resolve</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => (cameraActive ? stopCamera() : startCamera())}
          aria-label="Toggle camera scanner"
          className="inline-flex items-center gap-1 rounded-md border border-[#E1E7DD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#245C3A] hover:bg-[#EAF1E8]"
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{cameraActive ? 'Stop' : 'Camera'}</span>
        </button>
      </div>

      {cameraActive && (
        <div className="rounded-md border border-[#E1E7DD] bg-black/90 p-2">
          <video ref={videoRef} className="mx-auto max-h-40 rounded" muted playsInline />
        </div>
      )}
      {cameraError && <p className="text-[11px] text-amber-700">{cameraError}</p>}
    </div>
  );
};
