import fs from 'fs';
import path from 'path';
import { prisma } from '../../services/prisma.service';
import { ExportCompanyInfo } from './export.types';

/**
 * Official FoodFactoryERP visual identity palette for exported documents.
 */
export const EXPORT_BRAND_COLORS = {
  primaryGreen: '#245C3A',
  darkGreen: '#17452C',
  deepForest: '#103B28',
  secondaryGreen: '#3D7651',
  lightBg: '#F7F8F2',
  subtleGreen: '#EAF1E8',
  warmCream: '#F4F0E4',
  goldAccent: '#C39A45',
  mainText: '#24352A',
  secondaryText: '#66756A',
  border: '#E1E7DD',
  white: '#FFFFFF',
} as const;

export const EXPORT_EXCEL_COLORS = {
  primaryGreen: 'FF245C3A',
  darkGreen: 'FF17452C',
  deepForest: 'FF103B28',
  secondaryGreen: 'FF3D7651',
  lightBg: 'FFF7F8F2',
  subtleGreen: 'FFEAF1E8',
  warmCream: 'FFF4F0E4',
  goldAccent: 'FFC39A45',
  mainText: 'FF24352A',
  secondaryText: 'FF66756A',
  border: 'FFE1E7DD',
  white: 'FFFFFFFF',
} as const;

const CANDIDATE_LOGO_PATHS = [
  path.resolve(process.cwd(), 'apps/web/public/icons/icon-192.png'),
  path.resolve(process.cwd(), '../web/public/icons/icon-192.png'),
  path.resolve(__dirname, '../../../../web/public/icons/icon-192.png'),
];

function resolveExistingLogoPath(customUrl?: string | null): string | null {
  if (customUrl && !/^https?:\/\//i.test(customUrl)) {
    const resolved = path.isAbsolute(customUrl)
      ? customUrl
      : path.resolve(process.cwd(), customUrl);
    if (fs.existsSync(resolved) && /\.(png|jpe?g)$/i.test(resolved)) {
      return resolved;
    }
  }
  for (const candidate of CANDIDATE_LOGO_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Fetches actual active company metadata from the database for report headers.
 * Never fabricates GSTIN, address, or registration details if unavailable.
 */
export async function getExportCompanyInfo(companyId?: string): Promise<ExportCompanyInfo | null> {
  try {
    const company = companyId
      ? await prisma.company.findUnique({
          where: { id: companyId },
          select: {
            legalName: true,
            tradeName: true,
            gstin: true,
            address: true,
            logoUrl: true,
          },
        })
      : await prisma.company.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            legalName: true,
            tradeName: true,
            gstin: true,
            address: true,
            logoUrl: true,
          },
        });

    if (!company) return null;

    return {
      name: company.tradeName || company.legalName,
      tradeName: company.tradeName,
      gstin: company.gstin || null,
      address: company.address || null,
      logoPath: resolveExistingLogoPath(company.logoUrl),
    };
  } catch {
    return null;
  }
}

export function formatDateIso(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
}

export function formatDateTimeReadable(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)} UTC`;
}

export function isNumericColumnType(type?: string): boolean {
  return type === 'number' || type === 'integer' || type === 'currency' || type === 'percent';
}

export function sanitizeFilenameSegment(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function buildExportFilename(
  prefix: string,
  extension: 'csv' | 'xlsx' | 'pdf',
  generatedAt: Date = new Date(),
): string {
  const safePrefix = sanitizeFilenameSegment(prefix) || 'FoodFactory_Report';
  const dateStamp = generatedAt.toISOString().slice(0, 10);
  return `${safePrefix}_${dateStamp}.${extension}`;
}
