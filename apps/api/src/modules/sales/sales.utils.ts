import { Prisma, TaxRate } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Build a Prisma DateTimeFilter from optional fromDate / toDate query strings.
 * Calendar dates (YYYY-MM-DD) are normalized in UTC:
 * - fromDate -> 00:00:00.000Z (start of day)
 * - toDate   -> 23:59:59.999Z (inclusive end of day)
 */
export function buildDateRangeFilter(
  fromDate?: string,
  toDate?: string,
): Prisma.DateTimeFilter | undefined {
  if (!fromDate && !toDate) return undefined;

  const filter: Prisma.DateTimeFilter = {};

  if (fromDate) {
    const start = DATE_ONLY_REGEX.test(fromDate)
      ? new Date(`${fromDate}T00:00:00.000Z`)
      : new Date(fromDate);
    if (Number.isNaN(start.getTime())) {
      throw new AppError(`Invalid fromDate value: ${fromDate}`, 400);
    }
    filter.gte = start;
  }

  if (toDate) {
    const end = DATE_ONLY_REGEX.test(toDate)
      ? new Date(`${toDate}T23:59:59.999Z`)
      : new Date(toDate);
    if (Number.isNaN(end.getTime())) {
      throw new AppError(`Invalid toDate value: ${toDate}`, 400);
    }
    filter.lte = end;
  }

  return filter;
}

/**
 * Resolve the authoritative TaxRate for a given HSN code and effective date.
 * 1. Checks active TaxConfiguration records for the HSN code on the normalized UTC date.
 * 2. Rejects ambiguous/conflicting active configurations sharing the same effectiveFrom date.
 * 3. Falls back to the provided active TaxRate (e.g., product.taxRate or orderLine.taxRate).
 */
export async function resolveApplicableTaxRate(
  tx: Prisma.TransactionClient,
  hsnCode: string,
  effectiveDate: Date,
  fallbackTaxRate?: TaxRate | null,
): Promise<TaxRate> {
  const normalizedDate = new Date(`${effectiveDate.toISOString().slice(0, 10)}T00:00:00.000Z`);

  const configs = await tx.taxConfiguration.findMany({
    where: {
      hsnCode,
      isActive: true,
      effectiveFrom: { lte: normalizedDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: normalizedDate } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: { taxRate: true },
  });

  if (configs.length > 0) {
    const top = configs[0];
    const hasConflict = configs.some(
      c =>
        c.effectiveFrom.getTime() === top.effectiveFrom.getTime() &&
        c.taxRateId !== top.taxRateId,
    );
    if (hasConflict) {
      throw new AppError(
        `Conflicting active tax configurations found for HSN code ${hsnCode}.`,
        400,
      );
    }
    if (!top.taxRate || !top.taxRate.isActive) {
      throw new AppError(
        `Configured tax rate for HSN code ${hsnCode} is inactive or missing.`,
        400,
      );
    }
    return top.taxRate;
  }

  if (fallbackTaxRate && fallbackTaxRate.isActive) {
    return fallbackTaxRate;
  }

  throw new AppError(
    `No active tax rate or tax configuration found for HSN code ${hsnCode}.`,
    400,
  );
}
