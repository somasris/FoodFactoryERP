import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { resolveOfficialLogoPath } from '../../utils/export/export-theme';

export interface InvoicePdfLine {
  lineNumber: number;
  itemCode: string;
  itemName: string;
  description: string | null;
  hsnCode: string;
  uomSymbol: string;
  quantity: Prisma.Decimal | string;
  unitPrice: Prisma.Decimal | string;
  discountPercent: Prisma.Decimal | string;
  discountAmount: Prisma.Decimal | string;
  taxableAmount: Prisma.Decimal | string;
  gstRate: Prisma.Decimal | string;
  cgstRate: Prisma.Decimal | string;
  sgstRate: Prisma.Decimal | string;
  igstRate: Prisma.Decimal | string;
  cgstAmount: Prisma.Decimal | string;
  sgstAmount: Prisma.Decimal | string;
  igstAmount: Prisma.Decimal | string;
  taxAmount: Prisma.Decimal | string;
  lineTotal: Prisma.Decimal | string;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  financialYear: string;
  invoiceDate: Date;
  dueDate: Date | null;
  status: string;
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
  salesOrder: { orderNumber: string };
  subtotal: Prisma.Decimal | string;
  discountAmount: Prisma.Decimal | string;
  taxableAmount: Prisma.Decimal | string;
  cgstAmount: Prisma.Decimal | string;
  sgstAmount: Prisma.Decimal | string;
  igstAmount: Prisma.Decimal | string;
  taxAmount: Prisma.Decimal | string;
  roundOffAmount: Prisma.Decimal | string;
  grandTotal: Prisma.Decimal | string;
  notes: string | null;
  termsAndConditions: string | null;
  lines: InvoicePdfLine[];
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function integerToIndianWords(num: number): string {
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const rest = num % 100;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${integerToIndianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred > 0) parts.push(`${ONES[hundred]} Hundred`);
  if (rest > 0) parts.push(twoDigitsToWords(rest));
  return parts.join(' ').trim();
}

export function amountToIndianWords(value: Prisma.Decimal | string): string {
  const dec = new Prisma.Decimal(value).toDecimalPlaces(2);
  const fixed = dec.toFixed(2);
  const [rupeesStr, paiseStr] = fixed.split('.');
  const rupees = parseInt(rupeesStr, 10);
  const paise = parseInt(paiseStr, 10);
  const rupeePart = `Rupees ${integerToIndianWords(rupees)}`;
  if (paise > 0) {
    return `${rupeePart} and ${twoDigitsToWords(paise)} Paise Only`;
  }
  return `${rupeePart} Only`;
}

const fmt = (val: Prisma.Decimal | string, dp = 2) =>
  new Prisma.Decimal(val).toDecimalPlaces(dp).toFixed(dp);

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export class SalesInvoicePdfService {
  /**
   * Render a GST Tax Invoice PDF buffer strictly from the stored invoice snapshot.
   */
  static async generateInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const pageWidth = doc.page.width - 72;

      // Header
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#172F50')
        .text('TAX INVOICE', { align: 'center' });
      if (invoice.status === 'DRAFT') {
        doc
          .fontSize(9)
          .fillColor('#B45309')
          .text('DRAFT PREVIEW – NOT ISSUED', { align: 'center' });
      } else if (invoice.status === 'CANCELLED') {
        doc
          .fontSize(9)
          .fillColor('#B91C1C')
          .text('CANCELLED INVOICE', { align: 'center' });
      }

      doc.moveDown(0.5);

      // Seller & Invoice Meta Box
      const topY = doc.y;
      const logoPath = resolveOfficialLogoPath();
      let sellerX = 36;
      let sellerWidth = 280;
      if (logoPath) {
        try {
          doc.image(logoPath, 36, topY, { width: 32, height: 32 });
          sellerX = 76;
          sellerWidth = 240;
        } catch {
          // Ignore invalid image files gracefully
        }
      }
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#1E293B')
        .text(invoice.companyLegalName, sellerX, topY, { width: sellerWidth });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .text(invoice.companyAddress, sellerX, doc.y + 2, { width: sellerWidth })
        .text(`GSTIN: ${invoice.companyGstin}  |  State Code: ${invoice.companyStateCode}`, {
          width: sellerWidth,
        });

      const metaX = 340;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`Invoice No: ${invoice.invoiceNumber}`, metaX, topY, { width: 215, align: 'right' })
        .font('Helvetica')
        .fontSize(8.5)
        .text(`Invoice Date: ${fmtDate(invoice.invoiceDate)}`, metaX, doc.y + 2, {
          width: 215,
          align: 'right',
        })
        .text(`Due Date: ${invoice.dueDate ? fmtDate(invoice.dueDate) : 'On Receipt'}`, {
          width: 215,
          align: 'right',
        })
        .text(`Order Ref: ${invoice.salesOrder.orderNumber}`, { width: 215, align: 'right' })
        .text(`FY: ${invoice.financialYear}`, { width: 215, align: 'right' });

      doc.moveDown(0.8);
      const dividerY = Math.max(doc.y, topY + 58);
      doc.moveTo(36, dividerY).lineTo(36 + pageWidth, dividerY).strokeColor('#CBD5E1').stroke();

      // Buyer & Place of Supply
      doc.y = dividerY + 8;
      const buyerY = doc.y;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#172F50')
        .text('Bill To:', 36, buyerY)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#1E293B')
        .text(invoice.customerLegalName, 36, doc.y + 2, { width: 290 })
        .font('Helvetica')
        .fontSize(8.5)
        .text(invoice.customerBillingAddress, 36, doc.y + 2, { width: 290 })
        .text(
          `Customer GSTIN: ${invoice.customerGstin || 'Unregistered'}  |  State Code: ${invoice.customerStateCode}`,
          { width: 290 },
        );

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#172F50')
        .text('Supply Details:', 340, buyerY, { width: 215, align: 'right' })
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#1E293B')
        .text(`Place of Supply: ${invoice.placeOfSupply}`, 340, doc.y + 2, {
          width: 215,
          align: 'right',
        })
        .text(`Supply Type: ${invoice.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}`, {
          width: 215,
          align: 'right',
        });

      doc.y = Math.max(doc.y, buyerY + 55) + 8;

      // Table Header
      const colX = {
        sr: 36,
        item: 56,
        hsn: 205,
        qty: 250,
        rate: 295,
        disc: 342,
        taxable: 382,
        gst: 438,
        total: 492,
      };

      const renderTableHeader = (y: number) => {
        doc.rect(36, y, pageWidth, 18).fill('#172F50');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
        doc.text('#', colX.sr + 2, y + 5, { width: 18 });
        doc.text('Item Description', colX.item, y + 5, { width: 145 });
        doc.text('HSN', colX.hsn, y + 5, { width: 42 });
        doc.text('Qty', colX.qty, y + 5, { width: 42, align: 'right' });
        doc.text('Rate', colX.rate, y + 5, { width: 44, align: 'right' });
        doc.text('Disc', colX.disc, y + 5, { width: 38, align: 'right' });
        doc.text('Taxable', colX.taxable, y + 5, { width: 52, align: 'right' });
        doc.text('GST', colX.gst, y + 5, { width: 50, align: 'right' });
        doc.text('Total', colX.total, y + 5, { width: 62, align: 'right' });
        return y + 20;
      };

      let rowY = renderTableHeader(doc.y);
      doc.font('Helvetica').fontSize(7.5).fillColor('#1E293B');

      for (const line of invoice.lines) {
        if (rowY > 690) {
          doc.addPage();
          rowY = renderTableHeader(36);
          doc.font('Helvetica').fontSize(7.5).fillColor('#1E293B');
        }

        const itemLabel = `${line.itemName} (${line.itemCode})`;
        doc.text(String(line.lineNumber), colX.sr + 2, rowY + 3, { width: 18 });
        doc.text(itemLabel, colX.item, rowY + 3, { width: 145 });
        doc.text(line.hsnCode, colX.hsn, rowY + 3, { width: 42 });
        doc.text(`${fmt(line.quantity, 2)} ${line.uomSymbol}`, colX.qty, rowY + 3, {
          width: 42,
          align: 'right',
        });
        doc.text(fmt(line.unitPrice), colX.rate, rowY + 3, { width: 44, align: 'right' });
        doc.text(fmt(line.discountAmount), colX.disc, rowY + 3, { width: 38, align: 'right' });
        doc.text(fmt(line.taxableAmount), colX.taxable, rowY + 3, { width: 52, align: 'right' });
        doc.text(`${fmt(line.gstRate, 1)}% (${fmt(line.taxAmount)})`, colX.gst, rowY + 3, {
          width: 50,
          align: 'right',
        });
        doc.text(fmt(line.lineTotal), colX.total, rowY + 3, { width: 62, align: 'right' });

        rowY = Math.max(doc.y + 4, rowY + 18);
        doc.moveTo(36, rowY).lineTo(36 + pageWidth, rowY).strokeColor('#E2E8F0').stroke();
        rowY += 2;
      }

      // Totals Section
      if (rowY > 620) {
        doc.addPage();
        rowY = 36;
      }
      rowY += 10;

      // Amount in words (left)
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#172F50')
        .text('Amount in Words:', 36, rowY, { width: 290 })
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#1E293B')
        .text(amountToIndianWords(invoice.grandTotal), 36, doc.y + 2, { width: 290 });

      // Financial summary (right)
      const sumLabelX = 350;
      const sumValX = 470;
      const summaryRows: Array<[string, string, boolean?]> = [
        ['Subtotal:', `INR ${fmt(invoice.subtotal)}`],
        ['Discount:', `INR ${fmt(invoice.discountAmount)}`],
        ['Taxable Value:', `INR ${fmt(invoice.taxableAmount)}`],
      ];
      if (invoice.isInterState) {
        summaryRows.push(['IGST:', `INR ${fmt(invoice.igstAmount)}`]);
      } else {
        summaryRows.push(['CGST:', `INR ${fmt(invoice.cgstAmount)}`]);
        summaryRows.push(['SGST:', `INR ${fmt(invoice.sgstAmount)}`]);
      }
      summaryRows.push(['Round Off:', `INR ${fmt(invoice.roundOffAmount)}`]);
      summaryRows.push(['Grand Total:', `INR ${fmt(invoice.grandTotal)}`, true]);

      let sumY = rowY;
      for (const [label, val, bold] of summaryRows) {
        doc
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 9.5 : 8.5)
          .fillColor(bold ? '#172F50' : '#1E293B')
          .text(label, sumLabelX, sumY, { width: 115, align: 'right' })
          .text(val, sumValX, sumY, { width: 85, align: 'right' });
        sumY += bold ? 16 : 13;
      }

      // Notes, Terms & Signatory
      doc.y = Math.max(doc.y, sumY) + 14;
      if (invoice.notes) {
        doc.font('Helvetica-Bold').fontSize(8).text('Notes:', 36);
        doc.font('Helvetica').fontSize(8).text(invoice.notes, 36, doc.y + 2, { width: 320 });
        doc.moveDown(0.5);
      }
      if (invoice.termsAndConditions) {
        doc.font('Helvetica-Bold').fontSize(8).text('Declaration / Terms:', 36);
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .text(invoice.termsAndConditions, 36, doc.y + 2, { width: 320 });
      }

      const sigY = Math.max(doc.y + 12, 710);
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#1E293B')
        .text(`For ${invoice.companyLegalName}`, 360, sigY, { width: 195, align: 'right' })
        .moveDown(2)
        .font('Helvetica')
        .fontSize(8)
        .text('Authorized Signatory', 360, doc.y, { width: 195, align: 'right' });

      doc.end();
    });
  }
}
