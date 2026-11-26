import { z } from 'zod';

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export interface SearchResultItem {
  category: 'Sales' | 'Inventory' | 'Production' | 'Master Data' | 'Administration';
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string;
  documentNumber: string | null;
  status: string | null;
  navigationPath: string;
}
