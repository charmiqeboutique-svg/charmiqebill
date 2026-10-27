import { useEffect, useRef, useState, useCallback } from 'react';
import { playScanSuccessTone, playScanErrorTone } from '../lib/audioFeedback.ts';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => Promise<void> | void;
  minBarcodeLength?: number;
  maxKeystrokeIntervalMs?: number;
  debounceMs?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minBarcodeLength = 3,
  maxKeystrokeIntervalMs = 50, // Scanners type keystrokes in < 40ms intervals
  debounceMs = 500,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const [scannerReady, setScannerReady] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [scanStatus, setScanStatus] = useState<{
    type: 'idle' | 'success' | 'error' | 'scanning';
    message: string;
  }>({
    type: 'idle',
    message: 'USB keyboard scanner ready — scan detected',
  });

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const lastCompletedScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const processBarcode = useCallback(
    async (rawCode: string, source: 'wedge' | 'input' = 'wedge') => {
      const code = rawCode.trim();
      if (!code || code.length < minBarcodeLength) return;

      const now = Date.now();
      // Debounce duplicate identical scans within debounceMs
      if (
        lastCompletedScanRef.current.code === code &&
        now - lastCompletedScanRef.current.time < debounceMs
      ) {
        return;
      }

      lastCompletedScanRef.current = { code, time: now };
      setLastScannedCode(code);
      setLastScanTime(now);
      setScanStatus({
        type: 'scanning',
        message: `Processing barcode: ${code}...`,
      });

      try {
        await onScan(code);
        playScanSuccessTone();
        setScanStatus({
          type: 'success',
          message: `Scanned & added: ${code} (${source === 'wedge' ? 'WiredPower WPXD100' : 'Manual'})`,
        });
      } catch (err: any) {
        playScanErrorTone();
        setScanStatus({
          type: 'error',
          message: err?.message || `Barcode ${code} not found`,
        });
      } finally {
        // Return to ready status after 3.5 seconds
        setTimeout(() => {
          setScanStatus((prev) =>
            prev.type !== 'scanning'
              ? { type: 'idle', message: 'USB keyboard scanner ready — scan detected' }
              : prev
          );
        }, 3500);
      }
    },
    [onScan, minBarcodeLength, debounceMs]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // If user is focused on an unrelated input (e.g. customer name, customer phone, search bar)
      // and NOT specifically on the barcode field, let normal typing occur unless it's superhuman scanner speed!
      const isBarcodeSpecificInput =
        target && target.getAttribute('data-barcode-input') === 'true';

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter or Tab suffix signals end of barcode
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.length >= minBarcodeLength) {
          e.preventDefault();
          const codeToProcess = bufferRef.current;
          bufferRef.current = '';
          processBarcode(codeToProcess, 'wedge');
          return;
        }
        // If in barcode specific input and Enter is pressed
        if (isBarcodeSpecificInput && (target as HTMLInputElement).value) {
          e.preventDefault();
          const manualCode = (target as HTMLInputElement).value;
          (target as HTMLInputElement).value = '';
          processBarcode(manualCode, 'input');
          return;
        }
      }

      // Check if keystroke is standard printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // If typing in another normal text input and keystroke interval is normal human speed (> 60ms)
        if (isInput && !isBarcodeSpecificInput && elapsed > maxKeystrokeIntervalMs) {
          bufferRef.current = '';
          return;
        }

        // If interval between chars is very fast or it's within scanner buffer
        if (elapsed > 200 && bufferRef.current.length > 0) {
          // Reset buffer if delay too long
          bufferRef.current = '';
        }

        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, minBarcodeLength, maxKeystrokeIntervalMs, processBarcode]);

  return {
    scannerReady,
    lastScannedCode,
    lastScanTime,
    scanStatus,
    processBarcode,
  };
}
