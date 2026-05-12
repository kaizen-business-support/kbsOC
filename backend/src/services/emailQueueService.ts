import { prisma } from '../server';
import { sendEmail } from './notificationService';

// ─── Enqueue ───────────────────────────────────────────────────────────────────

export async function enqueueEmail(data: {
  to: string;
  subject: string;
  html: string;
  event?: string;
  recipientName?: string;
  applicationId?: string;
  companyId?: string;
}): Promise<void> {
  await prisma.emailQueue.create({
    data: {
      to: data.to,
      subject: data.subject,
      html: data.html,
      event: data.event,
      recipientName: data.recipientName,
      applicationId: data.applicationId,
      companyId: data.companyId,
      status: 'PENDING',
    },
  });
}

// ─── Process queue ─────────────────────────────────────────────────────────────

export async function processEmailQueue(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Pick up to 50 PENDING items scheduled now or in the past
  const items = await prisma.emailQueue.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  });

  for (const item of items) {
    // Mark as SENDING to prevent concurrent pickup
    await prisma.emailQueue.update({
      where: { id: item.id },
      data: { status: 'SENDING' },
    });

    try {
      await sendEmail(item.to, item.subject, item.html);
      await prisma.emailQueue.update({
        where: { id: item.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      sent++;
    } catch (err: any) {
      const retries = item.retries + 1;
      const maxRetries = item.maxRetries;
      await prisma.emailQueue.update({
        where: { id: item.id },
        data: {
          status: retries >= maxRetries ? 'FAILED' : 'PENDING',
          retries,
          lastError: err?.message ?? String(err),
          // Back-off: retry after 2^retries minutes
          scheduledAt: retries < maxRetries
            ? new Date(Date.now() + Math.pow(2, retries) * 60_000)
            : item.scheduledAt,
        },
      });
      if (retries >= maxRetries) failed++;
    }
  }

  return { sent, failed };
}
