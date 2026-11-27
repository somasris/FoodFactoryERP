import ExcelJS from 'exceljs';
import {
  ExportColumn,
  ExportDocumentOptions,
  ExportResult,
} from './export.types';
import {
  buildExportFilename,
  EXPORT_EXCEL_COLORS,
  formatDateIso,
  formatDateTimeReadable,
  isNumericColumnType,
  resolveOfficialLogoPath,
} from './export-theme';

function sanitizeWorksheetName(raw: string, fallback = 'Report'): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 31);
}

function toNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str =
    typeof value === 'object' && value !== null && 'toString' in value
      ? String((value as { toString: () => string }).toString()).trim()
      : String(value).trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function toExcelCellValue(value: unknown, col: ExportColumn): ExcelJS.CellValue {
  if (value === null || value === undefined || value === '') return '';

  switch (col.type) {
    case 'integer':
    case 'number':
    case 'currency':
    case 'percent': {
      const num = toNumericValue(value);
      return num !== null ? num : String(value);
    }
    case 'date': {
      const iso = formatDateIso(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const d = new Date(`${iso}T00:00:00.000Z`);
        return Number.isNaN(d.getTime()) ? iso : d;
      }
      return iso;
    }
    case 'datetime':
      return formatDateTimeReadable(value);
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

function getExcelNumFmt(col: ExportColumn): string | undefined {
  switch (col.type) {
    case 'currency':
      return '₹#,##0.00';
    case 'number':
      return '#,##0.00';
    case 'integer':
      return '#,##0';
    case 'percent':
      return '0.00"%"';
    case 'date':
      return 'yyyy-mm-dd';
    default:
      return undefined;
  }
}

function getHorizontalAlignment(col: ExportColumn): 'left' | 'center' | 'right' {
  if (col.align) return col.align;
  if (isNumericColumnType(col.type)) return 'right';
  if (col.type === 'date' || col.type === 'datetime' || col.type === 'boolean') return 'center';
  return 'left';
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: EXPORT_EXCEL_COLORS.border },
  };
  return { top: side, left: side, bottom: side, right: side };
}

/**
 * Generates a professionally formatted .xlsx workbook using ExcelJS.
 */
export async function generateExcelExport(
  options: ExportDocumentOptions,
): Promise<ExportResult> {
  const generatedAt = options.generatedAt ?? new Date();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.company?.name || 'FoodFactoryERP';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const dataSheetName = sanitizeWorksheetName(
    options.sheetName || options.title,
    'Report Data',
  );
  const sheet = workbook.addWorksheet(dataSheetName, {
    properties: { defaultRowHeight: 20 },
  });

  // 1. Report Header & Metadata Block (above the data table — no merged cells inside table)
  const logoPath = options.company?.logoPath ?? resolveOfficialLogoPath();
  if (logoPath) {
    try {
      const imageId = workbook.addImage({ filename: logoPath, extension: 'png' });
      const anchorCol = Math.max(2, options.columns.length - 1);
      sheet.addImage(imageId, {
        tl: { col: anchorCol, row: 0.15 },
        ext: { width: 36, height: 36 },
        editAs: 'oneCell',
      });
    } catch {
      // Ignore invalid image files gracefully
    }
  }

  const titleRow = sheet.addRow([options.title]);
  titleRow.height = 26;
  const titleCell = titleRow.getCell(1);
  titleCell.font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: EXPORT_EXCEL_COLORS.darkGreen },
  };

  if (options.company?.name) {
    const companyParts = [options.company.name];
    if (options.company.gstin) companyParts.push(`GSTIN: ${options.company.gstin}`);
    const compRow = sheet.addRow([companyParts.join('  |  ')]);
    compRow.getCell(1).font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: EXPORT_EXCEL_COLORS.primaryGreen },
    };
  }

  const metaParts: string[] = [
    `Module: ${options.module}`,
    `Generated: ${formatDateTimeReadable(generatedAt)}`,
    `Records: ${options.rows.length}`,
  ];
  if (options.reportingPeriod) {
    metaParts.push(`Period: ${options.reportingPeriod}`);
  }
  if (options.warehouseOrFactory) {
    metaParts.push(`Facility: ${options.warehouseOrFactory}`);
  }
  const metaRow = sheet.addRow([metaParts.join('  |  ')]);
  metaRow.getCell(1).font = {
    name: 'Calibri',
    size: 9,
    color: { argb: EXPORT_EXCEL_COLORS.secondaryText },
  };

  if (options.appliedFilters && options.appliedFilters.length > 0) {
    const filterText = options.appliedFilters.map(f => `${f.label}: ${f.value}`).join('  |  ');
    const filterRow = sheet.addRow([`Filters: ${filterText}`]);
    filterRow.getCell(1).font = {
      name: 'Calibri',
      size: 9,
      italic: true,
      color: { argb: EXPORT_EXCEL_COLORS.secondaryText },
    };
  }

  sheet.addRow([]); // Spacer row

  // 2. Table Header Row
  const headerRow = sheet.addRow(options.columns.map(c => c.label));
  const headerRowNumber = headerRow.number;
  headerRow.height = 24;

  headerRow.eachCell((cell, colNumber) => {
    const col = options.columns[colNumber - 1];
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: EXPORT_EXCEL_COLORS.white },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXPORT_EXCEL_COLORS.primaryGreen },
    };
    cell.alignment = {
      horizontal: getHorizontalAlignment(col),
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = thinBorder();
  });

  // Track max text length for auto-sizing columns
  const maxColWidths = options.columns.map(c => Math.max(c.label.length + 4, c.minWidth ?? 12));

  // 3. Data Rows
  options.rows.forEach((row, idx) => {
    const values = options.columns.map(col => toExcelCellValue(row[col.key], col));
    const excelRow = sheet.addRow(values);
    const isAlt = idx % 2 === 1;

    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = options.columns[colNumber - 1];
      if (!col) return;

      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: EXPORT_EXCEL_COLORS.mainText },
      };
      if (isAlt) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXPORT_EXCEL_COLORS.lightBg },
        };
      }
      const numFmt = getExcelNumFmt(col);
      if (numFmt) {
        cell.numFmt = numFmt;
      }
      cell.alignment = {
        horizontal: getHorizontalAlignment(col),
        vertical: 'middle',
        wrapText: !isNumericColumnType(col.type),
      };
      cell.border = thinBorder();

      const displayLen = String(cell.value ?? '').length + 3;
      if (displayLen > maxColWidths[colNumber - 1]) {
        maxColWidths[colNumber - 1] = displayLen;
      }
    });
  });

  // 4. Optional Totals Row
  const hasTotals = options.columns.some(c => c.includeInTotal);
  if (hasTotals && options.rows.length > 0) {
    const totalsValues = options.columns.map((col, idx) => {
      if (idx === 0) return 'Total';
      if (!col.includeInTotal) return '';
      let sum = 0;
      for (const r of options.rows) {
        const n = toNumericValue(r[col.key]);
        if (n !== null) sum += n;
      }
      return Math.round(sum * 10000) / 10000;
    });
    const totalRow = sheet.addRow(totalsValues);
    totalRow.height = 22;
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = options.columns[colNumber - 1];
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: EXPORT_EXCEL_COLORS.darkGreen },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXPORT_EXCEL_COLORS.subtleGreen },
      };
      const numFmt = col ? getExcelNumFmt(col) : undefined;
      if (numFmt && colNumber > 1 && col?.includeInTotal) {
        cell.numFmt = numFmt;
      }
      cell.alignment = {
        horizontal: colNumber === 1 ? 'left' : col ? getHorizontalAlignment(col) : 'left',
        vertical: 'middle',
      };
      cell.border = thinBorder();
    });
  }

  // 5. Column widths, Freeze Panes, AutoFilter
  options.columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 1);
    const bounded = Math.min(col.maxWidth ?? 42, Math.max(col.minWidth ?? 12, maxColWidths[i]));
    column.width = bounded;
  });

  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  if (options.columns.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: options.columns.length },
    };
  }

  // 6. Optional Summary Worksheet (only when summaryMetrics are provided & meaningful)
  if (options.summaryMetrics && options.summaryMetrics.length > 0) {
    const summarySheet = workbook.addWorksheet('Summary');
    const sTitle = summarySheet.addRow([`${options.title} — Executive Summary`]);
    sTitle.height = 26;
    sTitle.getCell(1).font = {
      name: 'Calibri',
      size: 13,
      bold: true,
      color: { argb: EXPORT_EXCEL_COLORS.darkGreen },
    };

    if (options.company?.name) {
      const sComp = summarySheet.addRow([options.company.name]);
      sComp.getCell(1).font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: EXPORT_EXCEL_COLORS.primaryGreen },
      };
    }

    summarySheet.addRow([`Generated: ${formatDateTimeReadable(generatedAt)}`]);
    if (options.reportingPeriod) {
      summarySheet.addRow([`Reporting Period: ${options.reportingPeriod}`]);
    }
    summarySheet.addRow([]);

    const sHeader = summarySheet.addRow(['Metric', 'Value']);
    sHeader.height = 22;
    sHeader.eachCell(cell => {
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: EXPORT_EXCEL_COLORS.white },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXPORT_EXCEL_COLORS.primaryGreen },
      };
      cell.border = thinBorder();
    });

    options.summaryMetrics.forEach((m, idx) => {
      const val =
        m.type && isNumericColumnType(m.type)
          ? (toNumericValue(m.value) ?? String(m.value))
          : String(m.value);
      const r = summarySheet.addRow([m.label, val]);
      r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: EXPORT_EXCEL_COLORS.mainText } };
      r.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: EXPORT_EXCEL_COLORS.darkGreen } };
      if (m.type === 'currency') r.getCell(2).numFmt = '₹#,##0.00';
      else if (m.type === 'percent') r.getCell(2).numFmt = '0.00"%"';
      else if (m.type === 'integer') r.getCell(2).numFmt = '#,##0';
      else if (m.type === 'number') r.getCell(2).numFmt = '#,##0.00';

      if (idx % 2 === 1) {
        r.eachCell(c => {
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: EXPORT_EXCEL_COLORS.lightBg },
          };
        });
      }
      r.eachCell(c => {
        c.border = thinBorder();
      });
    });

    summarySheet.getColumn(1).width = 34;
    summarySheet.getColumn(2).width = 24;
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);

  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: buildExportFilename(options.filenamePrefix, 'xlsx', generatedAt),
  };
}
