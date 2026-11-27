import { config } from '../config/env';
import { getAccessToken } from '../services/api-client';

export function extractFilenameFromDisposition(
  disposition: string | null,
  fallbackFilename: string,
): string {
  if (!disposition) return fallbackFilename;
  const quoted = disposition.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const unquoted = disposition.match(/filename=([^;\s]+)/i);
  if (unquoted?.[1]) return unquoted[1];
  return fallbackFilename;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchExportBlob(
  path: string,
  fallbackFilename: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getAccessToken();
  const url = path.startsWith('http') ? path : `${config.apiBaseUrl}${path}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // Ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename = extractFilenameFromDisposition(
    res.headers.get('Content-Disposition'),
    fallbackFilename,
  );
  return { blob, filename };
}

export async function downloadAuthenticatedExport(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const { blob, filename } = await fetchExportBlob(path, fallbackFilename);
  triggerBlobDownload(blob, filename);
}
