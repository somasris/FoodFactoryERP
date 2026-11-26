import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { AuthoritativeLabelSnapshot, LabelLayoutConfig } from './label.types';

const MM_TO_PT = 72 / 25.4;

export interface LabelPdfRenderInput {
  labelNumber: string;
  generationType: string;
  widthMm: number;
  heightMm: number;
  includeQr: boolean;
  includeBarcode: boolean;
  copies: number;
  layoutConfig: LabelLayoutConfig;
  snapshot: AuthoritativeLabelSnapshot;
  qrBaseUrl: string;
}

export class BatchLabelPdfService {
  static async renderLabelPdf(input: LabelPdfRenderInput): Promise<Buffer> {
    const widthPt = Math.max(70, Math.round(input.widthMm * MM_TO_PT * 100) / 100);
    const heightPt = Math.max(56, Math.round(input.heightMm * MM_TO_PT * 100) / 100);
    const isCompact = input.widthMm < 70 || input.heightMm < 45;
    const pad = isCompact ? 6 : 10;

    let qrBuffer: Buffer | null = null;
    if (input.includeQr && input.snapshot.tracePath) {
      const traceUrl = `${input.qrBaseUrl}${input.snapshot.tracePath}`;
      qrBuffer = await QRCode.toBuffer(traceUrl, {
        type: 'png',
        margin: 1,
        width: isCompact ? 96 : 160,
        color: { dark: '#111111', light: '#FFFFFF' },
      });
    }

    const doc = new PDFDocument({
      size: [widthPt, heightPt],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
      info: {
        Title: `Batch Label ${input.snapshot.batchNumber}`,
        Author: input.snapshot.companyName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    for (let copy = 1; copy <= input.copies; copy += 1) {
      doc.addPage({ size: [widthPt, heightPt], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

      // Crisp outer border
      doc
        .lineWidth(0.75)
        .strokeColor('#1B2A1E')
        .rect(2, 2, widthPt - 4, heightPt - 4)
        .stroke();

      const qrSize = qrBuffer ? (isCompact ? Math.min(36, heightPt - 14) : Math.min(62, heightPt * 0.38)) : 0;
      const contentWidth = qrBuffer ? widthPt - pad * 2 - qrSize - 6 : widthPt - pad * 2;
      let y = pad;

      // Header: Company + Factory
      if (input.layoutConfig.showCompanyName) {
        doc
          .font('Helvetica-Bold')
          .fontSize(isCompact ? 6.5 : 9)
          .fillColor('#17452C')
          .text(input.snapshot.companyName, pad, y, { width: contentWidth, lineBreak: false, ellipsis: true });
        y += isCompact ? 8 : 11;
      }

      if (!isCompact && input.layoutConfig.showCompanyAddress && input.snapshot.companyAddress) {
        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor('#3D4E40')
          .text(input.snapshot.companyAddress, pad, y, { width: contentWidth, lineBreak: false, ellipsis: true });
        y += 8;
      }

      // Product Name & SKU
      if (input.layoutConfig.showProductName) {
        doc
          .font('Helvetica-Bold')
          .fontSize(isCompact ? 8 : 11)
          .fillColor('#000000')
          .text(input.snapshot.productName, pad, y, { width: contentWidth, lineBreak: false, ellipsis: true });
        y += isCompact ? 10 : 14;
      }

      if (input.layoutConfig.showSku) {
        doc
          .font('Helvetica')
          .fontSize(isCompact ? 6 : 7.5)
          .fillColor('#24352A')
          .text(`SKU: ${input.snapshot.sku}`, pad, y, { width: contentWidth, lineBreak: false, ellipsis: true });
        y += isCompact ? 8 : 10;
      }

      // Authoritative Batch, Mfg Date, Expiry Date, Net Qty
      const lineStep = isCompact ? 7.5 : 9.5;
      const detailSize = isCompact ? 6 : 7.5;

      if (input.layoutConfig.showBatchNumber) {
        doc
          .font('Helvetica-Bold')
          .fontSize(detailSize)
          .fillColor('#000000')
          .text(`BATCH: ${input.snapshot.batchNumber}`, pad, y, { width: contentWidth, lineBreak: false });
        y += lineStep;
      }

      if (input.layoutConfig.showManufacturingDate || input.layoutConfig.showExpiryDate) {
        const mfg = input.layoutConfig.showManufacturingDate ? `MFG: ${input.snapshot.manufacturingDate}` : '';
        const exp = input.layoutConfig.showExpiryDate ? `EXP: ${input.snapshot.expiryDate}` : '';
        const dateLine = [mfg, exp].filter(Boolean).join('  |  ');
        doc
          .font('Helvetica')
          .fontSize(detailSize)
          .fillColor('#111111')
          .text(dateLine, pad, y, { width: contentWidth, lineBreak: false, ellipsis: true });
        y += lineStep;
      }

      if (input.layoutConfig.showNetQuantity) {
        doc
          .font('Helvetica-Bold')
          .fontSize(detailSize)
          .fillColor('#111111')
          .text(
            `NET QTY: ${input.snapshot.netQuantity} ${input.snapshot.uomSymbol}`,
            pad,
            y,
            { width: contentWidth, lineBreak: false },
          );
        y += lineStep;
      }

      if (input.layoutConfig.showQualityStatus) {
        const statusText =
          input.snapshot.labelMode === 'RELEASED'
            ? `QC: ${input.snapshot.qualityDecision} (RELEASED)`
            : `QC STATUS: ${input.snapshot.qualityDecision}`;
        doc
          .font('Helvetica-Bold')
          .fontSize(isCompact ? 5.5 : 7)
          .fillColor(input.snapshot.labelMode === 'RELEASED' ? '#17452C' : '#9A3412')
          .text(statusText, pad, y, { width: contentWidth, lineBreak: false });
        y += isCompact ? 7 : 9;
      }

      // QR Code on right
      if (qrBuffer && qrSize > 0) {
        const qrX = widthPt - pad - qrSize;
        const qrY = pad;
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      }

      // Allergen & Storage instructions at bottom (for standard/large)
      if (!isCompact && input.layoutConfig.showAllergenDeclaration) {
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#7F1D1D')
          .text(input.snapshot.allergenSummary.declarationText, pad, y + 2, {
            width: widthPt - pad * 2,
            height: 22,
            ellipsis: true,
          });
        y += 22;
      }

      if (!isCompact && input.layoutConfig.showStorageInstructions && input.snapshot.storageInstructions) {
        doc
          .font('Helvetica')
          .fontSize(6)
          .fillColor('#3D4E40')
          .text(`Storage: ${input.snapshot.storageInstructions}`, pad, y, {
            width: widthPt - pad * 2,
            lineBreak: false,
            ellipsis: true,
          });
      }

      // Footer: Label # & Barcode value + Copy index
      const footerY = heightPt - (isCompact ? 9 : 12);
      const footerParts = [
        input.labelNumber,
        input.includeBarcode && input.snapshot.barcodeValue ? input.snapshot.barcodeValue : null,
        input.copies > 1 ? `Copy ${copy}/${input.copies}` : null,
      ].filter(Boolean);

      doc
        .font('Helvetica')
        .fontSize(isCompact ? 5 : 6)
        .fillColor('#4B5563')
        .text(footerParts.join('  •  '), pad, footerY, {
          width: widthPt - pad * 2,
          lineBreak: false,
          ellipsis: true,
        });
    }

    doc.end();
    return done;
  }
}
