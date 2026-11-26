import React from 'react';

interface BarcodeGraphicProps {
  value: string;
  format?: 'CODE128' | 'QR' | string;
}

/**
 * Deterministic SVG barcode/QR renderer requiring zero paid external services.
 */
export const BarcodeGraphic: React.FC<BarcodeGraphicProps> = ({ value, format = 'CODE128' }) => {
  if (format === 'QR') {
    const size = 9;
    const cells: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isCorner =
          (x < 3 && y < 3) || (x >= size - 3 && y < 3) || (x < 3 && y >= size - 3);
        const charCode = value.charCodeAt((x * 7 + y * 13) % Math.max(1, value.length)) || 65;
        if (isCorner || (charCode + x * 3 + y * 5) % 2 === 0) {
          cells.push({ x, y });
        }
      }
    }
    return (
      <div className="inline-flex flex-col items-center rounded border border-[#E1E7DD] bg-white p-2">
        <svg width="64" height="64" viewBox="0 0 9 9" aria-label={`QR code for ${value}`}>
          {cells.map(c => (
            <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="0.9" height="0.9" fill="#17452C" />
          ))}
        </svg>
        <span className="mt-1 font-mono text-[10px] font-semibold text-[#24352A]">{value}</span>
      </div>
    );
  }

  // Deterministic 1D barcode bars
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 2;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const w1 = (code % 2) + 1;
    const gap = ((code >> 2) % 2) + 1;
    const w2 = ((code >> 4) % 2) + 1;
    bars.push({ x: cursor, w: w1 });
    cursor += w1 + gap;
    bars.push({ x: cursor, w: w2 });
    cursor += w2 + 1.5;
  }

  return (
    <div className="inline-flex flex-col items-center rounded border border-[#E1E7DD] bg-white px-2.5 py-1.5">
      <svg
        width={Math.max(110, cursor + 4)}
        height="32"
        viewBox={`0 0 ${Math.max(110, cursor + 4)} 32`}
        aria-label={`Barcode for ${value}`}
      >
        {bars.map((b, idx) => (
          <rect key={idx} x={b.x} y={2} width={b.w} height={28} fill="#17452C" />
        ))}
      </svg>
      <span className="mt-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#24352A]">
        {value}
      </span>
    </div>
  );
};
