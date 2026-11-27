import PDFDocument from 'pdfkit';
import {
  ExportColumn,
  ExportDocumentOptions,
  ExportResult,
  ExportSummaryMetric,
} from './export.types';
import {
  buildExportFilename,
  EXPORT_BRAND_COLORS,
  formatDateIso,
  formatDateTimeReadable,
  isNumericColumnType,
} from './export-theme';

function formatPdfNumber(value: unknown, decimals = 2, prefix = '', suffix = ''): string {
  if (value === null || value === undefined || value === '') return '—';
  const raw =
    typeof value === 'object' && value !== null && 'toString' in value
      ? String((value as { toString: () => string }).toString()).trim()
      : String(value).trim();
  if (!raw) return '—';
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}${suffix}`;
}

function formatPdfCellValue(value: unknown, col: ExportColumn): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (col.type) {
    case 'currency':
      return formatPdfNumber(value, col.decimals ?? 2, 'INR ');
    case 'number':
      return formatPdfNumber(value, col.decimals ?? 2);
    case 'integer':
      return formatPdfNumber(value, col.decimals ?? 0);
    case 'percent':
      return formatPdfNumber(value, col.decimals ?? 2, '', '%');
    case 'date': {
      const iso = formatDateIso(value);
      return iso || '—';
    }
    case 'datetime': {
      const dt = formatDateTimeReadable(value);
      return dt || '—';
    }
    case 'boolean':
      return value === true || value === 'true'
        ? 'Yes'
        : value === false || value === 'false'
          ? 'No'
          : String(value);
    default:
      return value instanceof Date ? formatDateIso(value) : String(value);
  }
}

function formatMetricValue(m: ExportSummaryMetric): string {
  if (m.type === 'currency') return formatPdfNumber(m.value, m.decimals ?? 2, 'INR ');
  if (m.type === 'percent') return formatPdfNumber(m.value, m.decimals ?? 2, '', '%');
  if (m.type === 'integer') return formatPdfNumber(m.value, 0);
  if (m.type === 'number') return formatPdfNumber(m.value, m.decimals ?? 2);
  return String(m.value ?? '—');
}

function getColumnAlign(col: ExportColumn): 'left' | 'center' | 'right' {
  if (col.align) return col.align;
  if (isNumericColumnType(col.type)) return 'right';
  if (col.type === 'date' || col.type === 'datetime' || col.type === 'boolean') return 'center';
  return 'left';
}

function computeColumnWidths(
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  totalWidth: number,
): number[] {
  const sampleRows = rows.slice(0, 40);
  const weights = columns.map(col => {
    if (col.widthWeight) return col.widthWeight;
    const headerLen = col.label.length;
    let maxSampleLen = headerLen;
    for (const r of sampleRows) {
      const len = formatPdfCellValue(r[col.key], col).length;
      if (len > maxSampleLen) maxSampleLen = len;
    }
    const capped = Math.min(34, Math.max(7, maxSampleLen));
    return isNumericColumnType(col.type) ? Math.max(9, Math.min(18, capped)) : capped;
  });

  const weightSum = weights.reduce((acc, w) => acc + w, 0) || 1;
  const minColWidth = Math.min(44, totalWidth / Math.max(columns.length, 1));
  const rawWidths = weights.map(w => Math.max(minColWidth, (w / weightSum) * totalWidth));
  const rawSum = rawWidths.reduce((acc, w) => acc + w, 0);

  // Normalize strictly to totalWidth so table never overflows page boundaries
  return rawWidths.map(w => (w / rawSum) * totalWidth);
}

/**
 * Generates a professionally formatted A4 PDF report using PDFKit.
 */
export async function generatePdfExport(
  options: ExportDocumentOptions,
): Promise<ExportResult> {
  const generatedAt = options.generatedAt ?? new Date();
  const layout: 'portrait' | 'landscape' =
    options.orientation && options.orientation !== 'auto'
      ? options.orientation
      : options.columns.length <= 6
        ? 'portrait'
        : 'landscape';

  const margin = 32;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout,
      margin,
      bufferPages: true,
      info: {
        Title: options.title,
        Author: options.company?.name || 'FoodFactoryERP',
        Subject: `${options.module} — ${options.title}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - margin * 2;
    const footerReservedHeight = 28;
    const pageBottomY = pageHeight - margin - footerReservedHeight;

    const colWidths = computeColumnWidths(options.columns, options.rows, contentWidth);
    const fontSize = options.columns.length > 12 ? 6.5 : options.columns.length > 8 ? 7 : 7.8;
    const headerFontSize = fontSize + 0.5;
    const cellPadX = 4;
    const cellPadY = 4;

    let y = margin;

    // --- 1. First Page Header ---
    const drawFirstPageHeader = () => {
      const headerTop = y;
      let textLeft = margin;

      if (options.company?.logoPath) {
        try {
          doc.image(options.company.logoPath, margin, headerTop, { width: 32, height: 32 });
          textLeft = margin + 40;
        } catch {
          // Ignore invalid image files gracefully
        }
      }

      if (options.company?.name) {
        doc
          .font('Helvetica-Bold')
          .fontSize(10.5)
          .fillColor(EXPORT_BRAND_COLORS.darkGreen)
          .text(options.company.name, textLeft, headerTop, {
            width: contentWidth - (textLeft - margin) - 160,
          });
        const compSubParts: string[] = [];
        if (options.company.gstin) compSubParts.push(`GSTIN: ${options.company.gstin}`);
        if (options.company.address) compSubParts.push(options.company.address);
        if (compSubParts.length > 0) {
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(EXPORT_BRAND_COLORS.secondaryText)
            .text(compSubParts.join('  |  '), textLeft, doc.y + 1, {
              width: contentWidth - (textLeft - margin) - 160,
            });
        }
      }

      // Module badge on top-right
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(EXPORT_BRAND_COLORS.secondaryGreen)
        .text(options.module.toUpperCase(), margin, headerTop, {
          width: contentWidth,
          align: 'right',
        });

      y = Math.max(doc.y + 8, headerTop + (options.company?.logoPath ? 36 : 20));

      // Accent rule
      doc
        .moveTo(margin, y)
        .lineTo(margin + contentWidth, y)
        .lineWidth(1.5)
        .strokeColor(EXPORT_BRAND_COLORS.primaryGreen)
        .stroke();

      y += 8;

      // Report Title & Subtitle
      doc
        .font('Helvetica-Bold')
        .fontSize(14.5)
        .fillColor(EXPORT_BRAND_COLORS.deepForest)
        .text(options.title, margin, y, { width: contentWidth });
      y = doc.y + 2;

      if (options.subtitle) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(EXPORT_BRAND_COLORS.secondaryText)
          .text(options.subtitle, margin, y, { width: contentWidth });
        y = doc.y + 4;
      }

      // Metadata Box
      const metaItems: string[] = [
        `Generated: ${formatDateTimeReadable(generatedAt)}`,
        `Total Records: ${options.rows.length}`,
      ];
      if (options.reportingPeriod) metaItems.push(`Period: ${options.reportingPeriod}`);
      if (options.warehouseOrFactory) metaItems.push(`Facility: ${options.warehouseOrFactory}`);
      if (options.appliedFilters && options.appliedFilters.length > 0) {
        metaItems.push(
          `Filters: ${options.appliedFilters.map(f => `${f.label}=${f.value}`).join(', ')}`,
        );
      }

      const metaText = metaItems.join('   •   ');
      doc.font('Helvetica').fontSize(7.5);
      const metaTextHeight = doc.heightOfString(metaText, { width: contentWidth - 14 });
      const metaBoxHeight = metaTextHeight + 10;

      doc
        .rect(margin, y, contentWidth, metaBoxHeight)
        .fillAndStroke(EXPORT_BRAND_COLORS.lightBg, EXPORT_BRAND_COLORS.border);
      doc
        .fillColor(EXPORT_BRAND_COLORS.mainText)
        .text(metaText, margin + 7, y + 5, { width: contentWidth - 14 });

      y += metaBoxHeight + 10;
    };

    // --- 2. Compact Running Header on Pages 2..N ---
    const drawContinuationHeader = () => {
      y = margin;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(EXPORT_BRAND_COLORS.darkGreen)
        .text(options.title, margin, y, { width: contentWidth * 0.65 });
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(EXPORT_BRAND_COLORS.secondaryText)
        .text(
          `${options.company?.name || 'FoodFactoryERP'} • ${formatDateIso(generatedAt)}`,
          margin,
          y + 1,
          { width: contentWidth, align: 'right' },
        );
      y += 15;
      doc
        .moveTo(margin, y)
        .lineTo(margin + contentWidth, y)
        .lineWidth(0.75)
        .strokeColor(EXPORT_BRAND_COLORS.border)
        .stroke();
      y += 6;
    };

    // --- 3. Summary KPI Cards ---
    const drawSummaryCards = (metrics: ExportSummaryMetric[]) => {
      const maxPerRow = Math.min(4, metrics.length);
      const gap = 8;
      const cardWidth = (contentWidth - gap * (maxPerRow - 1)) / maxPerRow;
      const cardHeight = 36;

      for (let i = 0; i < metrics.length; i += maxPerRow) {
        const chunk = metrics.slice(i, i + maxPerRow);
        if (y + cardHeight > pageBottomY) {
          doc.addPage();
          drawContinuationHeader();
        }
        chunk.forEach((m, idx) => {
          const cx = margin + idx * (cardWidth + gap);
          doc
            .rect(cx, y, cardWidth, cardHeight)
            .fillAndStroke(EXPORT_BRAND_COLORS.subtleGreen, EXPORT_BRAND_COLORS.border);
          // Left accent bar
          doc
            .rect(cx, y, 3, cardHeight)
            .fill(EXPORT_BRAND_COLORS.primaryGreen);
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor(EXPORT_BRAND_COLORS.secondaryText)
            .text(m.label, cx + 8, y + 6, {
              width: cardWidth - 12,
              lineBreak: false,
              ellipsis: true,
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(EXPORT_BRAND_COLORS.deepForest)
            .text(formatMetricValue(m), cx + 8, y + 18, {
              width: cardWidth - 12,
              lineBreak: false,
              ellipsis: true,
            });
        });
        y += cardHeight + 8;
      }
      y += 2;
    };

    // --- 4. Table Header Row ---
    const drawTableHeader = () => {
      doc.font('Helvetica-Bold').fontSize(headerFontSize);
      const headerHeight = Math.max(
        20,
        ...options.columns.map(
          (col, i) =>
            doc.heightOfString(col.label, { width: Math.max(12, colWidths[i] - cellPadX * 2) }) +
            cellPadY * 2,
        ),
      );

      if (y + headerHeight > pageBottomY) {
        doc.addPage();
        drawContinuationHeader();
      }

      doc.rect(margin, y, contentWidth, headerHeight).fill(EXPORT_BRAND_COLORS.primaryGreen);

      let x = margin;
      options.columns.forEach((col, i) => {
        const w = colWidths[i];
        doc
          .font('Helvetica-Bold')
          .fontSize(headerFontSize)
          .fillColor(EXPORT_BRAND_COLORS.white)
          .text(col.label, x + cellPadX, y + cellPadY, {
            width: Math.max(8, w - cellPadX * 2),
            align: getColumnAlign(col),
          });
        x += w;
      });

      y += headerHeight;
    };

    // --- Render Document ---
    drawFirstPageHeader();

    if (options.summaryMetrics && options.summaryMetrics.length > 0) {
      drawSummaryCards(options.summaryMetrics);
    }

    if (options.rows.length === 0) {
      drawTableHeader();
      const emptyHeight = 36;
      doc
        .rect(margin, y, contentWidth, emptyHeight)
        .fillAndStroke(EXPORT_BRAND_COLORS.lightBg, EXPORT_BRAND_COLORS.border);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(EXPORT_BRAND_COLORS.secondaryText)
        .text('No records found for the selected reporting criteria.', margin, y + 12, {
          width: contentWidth,
          align: 'center',
        });
      y += emptyHeight;
    } else {
      drawTableHeader();

      options.rows.forEach((row, rowIdx) => {
        const cellTexts = options.columns.map(col => formatPdfCellValue(row[col.key], col));

        doc.font('Helvetica').fontSize(fontSize);
        const rowHeight = Math.max(
          16,
          ...options.columns.map((_, i) => {
            const w = Math.max(8, colWidths[i] - cellPadX * 2);
            return doc.heightOfString(cellTexts[i], { width: w }) + cellPadY * 2;
          }),
        );

        if (y + rowHeight > pageBottomY) {
          doc.addPage();
          drawContinuationHeader();
          drawTableHeader();
        }

        const bg =
          rowIdx % 2 === 1 ? EXPORT_BRAND_COLORS.lightBg : EXPORT_BRAND_COLORS.white;
        doc.rect(margin, y, contentWidth, rowHeight).fill(bg);

        let x = margin;
        options.columns.forEach((col, i) => {
          const w = colWidths[i];
          doc
            .font('Helvetica')
            .fontSize(fontSize)
            .fillColor(EXPORT_BRAND_COLORS.mainText)
            .text(cellTexts[i], x + cellPadX, y + cellPadY, {
              width: Math.max(8, w - cellPadX * 2),
              align: getColumnAlign(col),
            });
          x += w;
        });

        // Subtle horizontal row separator
        doc
          .moveTo(margin, y + rowHeight)
          .lineTo(margin + contentWidth, y + rowHeight)
          .lineWidth(0.5)
          .strokeColor(EXPORT_BRAND_COLORS.border)
          .stroke();

        y += rowHeight;
      });

      // Totals Row
      const hasTotals = options.columns.some(c => c.includeInTotal);
      if (hasTotals) {
        const totalTexts = options.columns.map((col, idx) => {
          if (idx === 0) return 'Total';
          if (!col.includeInTotal) return '';
          let sum = 0;
          for (const r of options.rows) {
            const n = Number(r[col.key]);
            if (Number.isFinite(n)) sum += n;
          }
          return formatPdfCellValue(sum, col);
        });

        const totalHeight = 20;
        if (y + totalHeight > pageBottomY) {
          doc.addPage();
          drawContinuationHeader();
          drawTableHeader();
        }

        doc
          .rect(margin, y, contentWidth, totalHeight)
          .fillAndStroke(EXPORT_BRAND_COLORS.subtleGreen, EXPORT_BRAND_COLORS.border);

        let x = margin;
        options.columns.forEach((col, i) => {
          const w = colWidths[i];
          doc
            .font('Helvetica-Bold')
            .fontSize(fontSize)
            .fillColor(EXPORT_BRAND_COLORS.darkGreen)
            .text(totalTexts[i], x + cellPadX, y + 5, {
              width: Math.max(8, w - cellPadX * 2),
              align: i === 0 ? 'left' : getColumnAlign(col),
            });
          x += w;
        });
        y += totalHeight;
      }
    }

    // --- 5. Stamp Footers & Page Numbers on All Pages ---
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + totalPages; i += 1) {
      doc.switchToPage(i);
      const footerY = pageHeight - margin - 14;
      doc
        .moveTo(margin, footerY - 4)
        .lineTo(margin + contentWidth, footerY - 4)
        .lineWidth(0.5)
        .strokeColor(EXPORT_BRAND_COLORS.border)
        .stroke();

      const leftFooter =
        options.footerNote ||
        `FoodFactoryERP  •  ${options.module}  •  ${options.title}`;
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(EXPORT_BRAND_COLORS.secondaryText)
        .text(leftFooter, margin, footerY, {
          width: contentWidth * 0.75,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(EXPORT_BRAND_COLORS.secondaryText)
        .text(`Page ${i - range.start + 1} of ${totalPages}`, margin, footerY, {
          width: contentWidth,
          align: 'right',
        });
    }

    doc.end();
  });

  return {
    buffer,
    contentType: 'application/pdf',
    filename: buildExportFilename(options.filenamePrefix, 'pdf', generatedAt),
  };
}
