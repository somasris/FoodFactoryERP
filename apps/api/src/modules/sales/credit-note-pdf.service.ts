import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';

export interface CreditNotePdfLine {
  lineNumber: number;
  itemCodeSnapshot: string;
  descriptionSnapshot: string;
  hsnCodeSnapshot: string;
  uomSymbolSnapshot: string;
  quantity: Prisma.Decimal | string;
  unitPrice: Prisma.Decimal | string;
  taxableValue: Prisma.Decimal | string;
  taxRateSnapshot: Prisma.Decimal | string;
  cgstAmount: Prisma.Decimal | string;
  sgstAmount: Prisma.Decimal | string;
  igstAmount: Prisma.Decimal | string;
  totalAmount: Prisma.Decimal | string;
}

export interface CreditNotePdfData {
  creditNoteNumber: string;
  financialYear: string;
  creditNoteDate: Date;
  status: string;
  reason: string;
  companyLegalName: string;
  companyGstin: string;
  companyStateCode: string;
  companyAddress: string;
  customerLegalName: string;
  customerGstin: string | null;
  customerStateCode: string;
  customerBillingAddress: string;
  placeOfSupply: string;
  isInterState: boolean;
  salesInvoice: { invoiceNumber: string; invoiceDate: Date };
  subtotal: Prisma.Decimal | string;
  discountAmount: Prisma.Decimal | string;
  taxableValue: Prisma.Decimal | string;
  cgstAmount: Prisma.Decimal | string;
  sgstAmount: Prisma.Decimal | string;
  igstAmount: Prisma.Decimal | string;
  taxAmount: Prisma.Decimal | string;
  roundOff: Prisma.Decimal | string;
  grandTotal: Prisma.Decimal | string;
  lines: CreditNotePdfLine[];
}

function fmt(val: Prisma.Decimal | string, dp = 2): string {
  return new Prisma.Decimal(val).toFixed(dp);
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export class CreditNotePdfService {
  static async generateCreditNotePdf(cn: CreditNotePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1b4332').text('GST CREDIT NOTE', { align: 'center' });
      doc.moveDown(0.3);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(`Credit Note #: ${cn.creditNoteNumber}   |   Date: ${fmtDate(cn.creditNoteDate)}   |   Status: ${cn.status}`, {
          align: 'center',
        });
      doc.text(
        `Against Invoice #: ${cn.salesInvoice.invoiceNumber} (${fmtDate(cn.salesInvoice.invoiceDate)})   |   FY: ${cn.financialYear}`,
        { align: 'center' },
      );
      doc.moveDown(0.8);

      const startY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Supplier:', 36, startY);
      doc.font('Helvetica').fontSize(8.5).text(cn.companyLegalName, 36, startY + 13);
      doc.text(`GSTIN: ${cn.companyGstin} (State: ${cn.companyStateCode})`, 36, startY + 25);
      doc.text(cn.companyAddress, 36, startY + 37, { width: 240 });

      doc.font('Helvetica-Bold').fontSize(9).text('Recipient:', 310, startY);
      doc.font('Helvetica').fontSize(8.5).text(cn.customerLegalName, 310, startY + 13);
      doc.text(
        `GSTIN: ${cn.customerGstin || 'Unregistered'} (State: ${cn.customerStateCode})`,
        310,
        startY + 25,
      );
      doc.text(`Place of Supply: ${cn.placeOfSupply}`, 310, startY + 37, { width: 240 });

      doc.y = startY + 75;
      doc.font('Helvetica-Bold').fontSize(8.5).text(`Reason: `, { continued: true });
      doc.font('Helvetica').text(cn.reason);
      doc.moveDown(0.6);

      // Table Header
      const colX = [36, 60, 210, 265, 315, 365, 425, 490];
      const hy = doc.y;
      doc.rect(36, hy, 523, 18).fill('#e6f4ea');
      doc.fillColor('#1b4332').font('Helvetica-Bold').fontSize(8);
      doc.text('#', colX[0] + 4, hy + 5);
      doc.text('Item / Description', colX[1], hy + 5);
      doc.text('HSN', colX[2], hy + 5);
      doc.text('Qty', colX[3], hy + 5);
      doc.text('Rate', colX[4], hy + 5);
      doc.text('Taxable', colX[5], hy + 5);
      doc.text('GST', colX[6], hy + 5);
      doc.text('Total', colX[7], hy + 5);

      let y = hy + 22;
      doc.font('Helvetica').fontSize(8).fillColor('#111827');
      for (const line of cn.lines) {
        const lineGst = new Prisma.Decimal(line.cgstAmount)
          .add(new Prisma.Decimal(line.sgstAmount))
          .add(new Prisma.Decimal(line.igstAmount));
        doc.text(String(line.lineNumber), colX[0] + 4, y);
        doc.text(`${line.descriptionSnapshot} (${line.itemCodeSnapshot})`, colX[1], y, { width: 145 });
        doc.text(line.hsnCodeSnapshot, colX[2], y);
        doc.text(`${fmt(line.quantity, 2)} ${line.uomSymbolSnapshot}`, colX[3], y);
        doc.text(fmt(line.unitPrice), colX[4], y);
        doc.text(fmt(line.taxableValue), colX[5], y);
        doc.text(`${fmt(lineGst)} (${fmt(line.taxRateSnapshot, 0)}%)`, colX[6], y);
        doc.text(fmt(line.totalAmount), colX[7], y);
        y += 20;
      }

      doc.moveTo(36, y + 4).lineTo(559, y + 4).stroke('#d1d5db');
      y += 12;

      doc.font('Helvetica').fontSize(9);
      doc.text(`Taxable Value: INR ${fmt(cn.taxableValue)}`, 360, y);
      y += 14;
      if (cn.isInterState) {
        doc.text(`IGST: INR ${fmt(cn.igstAmount)}`, 360, y);
        y += 14;
      } else {
        doc.text(`CGST: INR ${fmt(cn.cgstAmount)}`, 360, y);
        y += 14;
        doc.text(`SGST: INR ${fmt(cn.sgstAmount)}`, 360, y);
        y += 14;
      }
      doc.text(`Round Off: INR ${fmt(cn.roundOff)}`, 360, y);
      y += 16;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1b4332').text(`Credit Note Total: INR ${fmt(cn.grandTotal)}`, 360, y);

      doc.end();
    });
  }
}
