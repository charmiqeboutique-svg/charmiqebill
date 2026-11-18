
import React, { useState } from 'react';
import { X, Printer, Tag, Download } from 'lucide-react';
import { Product } from '../../types/pos.ts';
import { generateBarcodeSvg } from '../../lib/barcodeGenerator.ts';
import qz from 'qz-tray';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [labelCount, setLabelCount] = useState<number>(4);
  const [isDownloadingPrn, setIsDownloadingPrn] = useState(false);
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [printStatus, setPrintStatus] = useState('');
  const [prnError, setPrnError] = useState('');

  if (!isOpen || !product) return null;

  const barcodeSvg = generateBarcodeSvg(product.barcode, {
    height: 52,
    moduleWidth: 1.8,
    showText: false,
  });

  // NEWPRN.prn label style: NAME- PRICE
  const rawName = (product.name || '')
    .replace(/₹/g, '')
    .replace(/\s*-\s*$/, '')
    .trim();

  const labelText = rawName.includes(String(product.sellingPrice))
    ? rawName
    : `${rawName}- ${product.sellingPrice}`;

  const displayLabel = labelText.toUpperCase();

  // Direct printing
  const handlePrint = async () => {
    setIsPrintingDirect(true);
    setPrintStatus('');
    setPrnError('');

    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    try {
      // LOCAL: Existing Windows PowerShell printing
      if (isLocalhost) {
        const response = await fetch('/api/barcodes/print-prn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: product.barcode,
            productName: displayLabel,
            quantity: labelCount,
            mode: 'print',
          }),
        });

        const body = (await response.json().catch(() => null)) as {
          success?: boolean;
          printer?: string;
          labels?: number;
          error?: string;
        } | null;

        if (!response.ok || !body?.success) {
          throw new Error(
            body?.error ||
              `Local printing failed (HTTP ${response.status}).`
          );
        }

        setPrintStatus(
          `${body.labels ?? labelCount * 2} labels printed on ${body.printer ?? 'printer'}.`
        );

        return;
      }

      // LIVE: Generate PRN data from Vercel.
      // Do NOT send mode: 'print' to Vercel.
      const response = await fetch('/api/barcodes/print-prn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: product.barcode,
          productName: displayLabel,
          quantity: labelCount,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || `Could not generate PRN labels (HTTP ${response.status}).`
        );
      }

      const prnData = await response.text();

      if (!prnData.trim()) {
        throw new Error('The server returned an empty PRN file.');
      }

      // Connect to QZ Tray running on this Windows PC
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }

      // Find the installed TVSE printer
      const printerName = 'TVSE LP45 BPLE';
      const printer = await qz.printers.find(printerName);

      if (!printer) {
        throw new Error(
          `Printer "${printerName}" was not found. Check the Windows printer name.`
        );
      }

      const config = qz.configs.create(printer);

      // Send existing PRN commands without changing label design
      await qz.print(config, [
        {
          type: 'raw',
          format: 'command',
          flavor: 'plain',
          data: prnData,
        },
      ]);

      setPrintStatus(
        `${labelCount * 2} labels sent to ${printerName}.`
      );
    } catch (error) {
      setPrnError(
        error instanceof Error
          ? error.message
          : 'Could not print barcode labels.'
      );
    } finally {
      setIsPrintingDirect(false);
    }
  };

  // Download PRN file
  const handleDownloadPrn = async () => {
    setIsDownloadingPrn(true);
    setPrnError('');

    try {
      const response = await fetch('/api/barcodes/print-prn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: product.barcode,
          productName: displayLabel,
          quantity: labelCount,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();

        let errorMessage = `Could not download the PRN label (HTTP ${response.status}).`;

        if (errorBody.trim()) {
          try {
            const result = JSON.parse(errorBody) as {
              error?: string;
            };

            errorMessage = result.error || errorMessage;
          } catch {
            errorMessage = errorBody.slice(0, 200);
          }
        }

        throw new Error(errorMessage);
      }

      const prnFile = await response.blob();

      if (!prnFile.size) {
        throw new Error('The server returned an empty PRN label file.');
      }

      const fileUrl = window.URL.createObjectURL(prnFile);
      const link = document.createElement('a');

      link.href = fileUrl;
      link.download = `barcode-${product.barcode.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      )}.prn`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(fileUrl);
      }, 1000);
    } catch (error) {
      setPrnError(
        error instanceof Error
          ? error.message
          : 'Could not download the PRN label.'
      );
    } finally {
      setIsDownloadingPrn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#E8DFD8] overflow-hidden">

        {/* Header */}
        <div className="p-4 px-5 border-b border-[#E8DFD8] flex items-center justify-between bg-[#FAF7F4] no-print">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#4A1525]" />
            <h3 className="font-display font-bold text-base text-slate-900">
              Print Garment Barcode Labels
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">
                Quantity:
              </span>

              <input
                type="number"
                min="1"
                max="24"
                value={labelCount}
                onChange={(e) =>
                  setLabelCount(
                    Math.min(
                      24,
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  )
                }
                className="w-14 px-2 py-1 text-xs border border-[#DDD3C9] rounded-md text-center tabular-nums font-semibold"
              />
            </div>

            <button
              onClick={handlePrint}
              disabled={isPrintingDirect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A1525] hover:bg-[#3B0F1E] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                {isPrintingDirect ? 'Printing...' : 'Print Labels'}
              </span>
            </button>

            <button
              onClick={handleDownloadPrn}
              disabled={isDownloadingPrn}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#4A1525] text-[#4A1525] hover:bg-[#F5EFEB] disabled:opacity-50 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isDownloadingPrn ? 'Preparing...' : 'Download PRN'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {prnError && (
          <p
            role="alert"
            className="px-5 py-2 text-xs text-red-700 bg-red-50 no-print"
          >
            {prnError}
          </p>
        )}

        {/* Print success message */}
        {printStatus && (
          <p
            role="status"
            className="px-5 py-2 text-xs text-emerald-800 bg-emerald-50 no-print"
          >
            {printStatus}
          </p>
        )}

        {/* Labels Sheet Preview */}
        <div className="p-6 bg-[#F5EFEB] max-h-[500px] overflow-y-auto">
          <div
            id="printable-document"
            className="barcode-prn-print grid grid-cols-2 gap-4 max-w-xl mx-auto"
          >
            {Array.from({ length: labelCount * 2 }).map((_, idx) => (
              <div
                key={idx}
                className="barcode-prn-label bg-white border-2 border-dashed border-[#D8CCC0] rounded-xl px-3.5 py-4 text-center shadow-xs flex flex-col items-center"
              >
                {/* Brand */}
                <p className="text-xs font-semibold text-slate-900 mb-2">
                  CHARMIQE
                </p>

                {/* Product name */}
                <p className="barcode-prn-name text-xs font-semibold text-slate-900 mb-1.5 truncate max-w-full">
                  {displayLabel}
                </p>

                {/* Barcode bars */}
                <div
                  className="barcode-prn-bars mb-1"
                  dangerouslySetInnerHTML={{
                    __html: barcodeSvg,
                  }}
                />

                {/* Barcode number */}
                <p className="font-mono text-xs font-semibold tracking-wide text-slate-900 tabular-nums">
                  {product.barcode}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-[11px] font-medium text-slate-500 no-print">
            Two-up roll layout · {labelCount}{' '}
            {labelCount === 1 ? 'copy' : 'copies'} × 2 labels ={' '}
            {labelCount * 2} labels
          </p>
        </div>
      </div>
    </div>
  );
};
