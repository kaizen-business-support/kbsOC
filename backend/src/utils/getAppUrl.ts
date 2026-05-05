/**
 * getAppUrl.ts — Returns the public frontend URL used in emails.
 *
 * Priority:
 * 1. FRONTEND_URL env var if it does NOT contain "localhost" or "127.0.0.1"
 * 2. Auto-detect the first non-internal IPv4 address of this machine
 * 3. Fallback to FRONTEND_URL (even if localhost) or bare localhost
 *
 * This avoids sending "http://localhost:3006" links in welcome / reset emails
 * when the server is accessed from another machine on the network.
 */

import os from 'os';

export function getAppUrl(): string {
  const configured = process.env.FRONTEND_URL || '';
  const port = process.env.FRONTEND_PORT || '3006';

  // If explicitly configured with a real hostname/IP, trust it
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured;
  }

  // Auto-detect the first non-loopback IPv4 address
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return `http://${addr.address}:${port}`;
      }
    }
  }

  // Last resort: use whatever is configured (or bare localhost)
  return configured || `http://localhost:${port}`;
}
