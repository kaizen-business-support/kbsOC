import nodemailer from 'nodemailer';
import { prisma } from '../server';
import { buildEventEmail } from '../utils/emailTemplates';

// ─── Template rendering ────────────────────────────────────────────────────────

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Strip HTML tags and collapse whitespace for in-app plain-text messages */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 300);
}

/** Detect if body is a full HTML document/table (email template) */
function isHtmlTemplate(body: string): boolean {
  const trimmed = body.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<table');
}

// ─── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const channel = await prisma.notificationChannel.findUnique({ where: { type: 'EMAIL' } });
  if (!channel || !channel.isActive) return;

  const cfg = channel.config as any;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port) || 587,
    secure: cfg.secure === true || cfg.secure === 'true',
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });

  await transporter.sendMail({
    from: `"${cfg.fromName || 'OptimusCredit'}" <${cfg.fromEmail || cfg.user}>`,
    to,
    subject,
    html,
  });
}

// ─── SMS ───────────────────────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<void> {
  const channel = await prisma.notificationChannel.findUnique({ where: { type: 'SMS' } });
  if (!channel || !channel.isActive) return;

  const cfg = channel.config as any;

  if (cfg.provider === 'orange') {
    // Orange SMS API
    const senderAddress = encodeURIComponent(cfg.senderId || 'tel:+221');
    const url = `${cfg.baseUrl || 'https://api.orange.com/smsmessaging/v1'}/outbound/${senderAddress}/requests`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: `tel:${to}`,
          senderAddress,
          outboundSMSTextMessage: { message: body },
        },
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Orange SMS error:', response.status, text);
    }
  } else {
    // Generic REST SMS
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    const response = await fetch(cfg.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to, message: body, senderId: cfg.senderId }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('SMS error:', response.status, text);
    }
  }
}

// ─── In-app notification ───────────────────────────────────────────────────────

export async function createInAppNotification(
  userId: string,
  data: {
    title: string;
    message: string;
    type?: 'INFO' | 'ACTION_REQUIRED' | 'SUCCESS' | 'WARNING';
    relatedType?: string;
    relatedId?: string;
    actionUrl?: string;
  }
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title: data.title,
      message: data.message,
      type: data.type || 'INFO',
      relatedType: data.relatedType,
      relatedId: data.relatedId,
      actionUrl: data.actionUrl,
    },
  });
}

// ─── Main trigger ──────────────────────────────────────────────────────────────

export async function triggerNotification(
  event: string,
  applicationId: string,
  context?: Record<string, string>
): Promise<void> {
  try {
    // Load active rules for this event
    const rules = await prisma.notificationRule.findMany({
      where: { event: event as any, isActive: true },
      include: { template: { include: { channel: true } } },
    });

    if (rules.length === 0) return;

    // Load application with related data
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: {
        client: true,
        creator: true,
        workflowSteps: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!application) return;

    const latestStep = application.workflowSteps[0];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';

    const templateVars: Record<string, string> = {
      clientName: application.client.companyName,
      applicationNumber: application.applicationNumber,
      amount: Number(application.amount).toLocaleString('fr-FR'),
      currency: application.currency,
      stepName: latestStep?.stepName || '',
      assigneeName: '',
      actionUrl: `${frontendUrl}/workflow`,
      createdByName: application.creator.name,
      decision: '',
      comments: latestStep?.comments || '',
      ...context,
    };

    for (const rule of rules) {
      const recipientRoles = rule.recipientRoles as string[];

      // Find users matching the roles
      const users = await prisma.user.findMany({
        where: {
          role: { in: recipientRoles as any[] },
          isActive: true,
        },
        select: { id: true, email: true, phone: true, name: true },
      });

      for (const user of users) {
        const vars: Record<string, string> = { ...templateVars, assigneeName: user.name };
        const renderedBody = renderTemplate(rule.template.body, vars);
        const renderedSubject = rule.template.subject
          ? renderTemplate(rule.template.subject, vars)
          : 'Notification OptimusCredit';

        // Plain-text message for in-app (strip HTML if template is HTML)
        const inAppMessage = isHtmlTemplate(renderedBody)
          ? stripHtmlToText(renderedBody)
          : renderedBody;

        // Always create in-app notification
        await createInAppNotification(user.id, {
          title: renderedSubject,
          message: inAppMessage,
          type: event.includes('REJECTED') ? 'WARNING'
               : event.includes('APPROVED') ? 'SUCCESS'
               : event === 'STEP_ASSIGNED' ? 'ACTION_REQUIRED'
               : 'INFO',
          relatedType: 'application',
          relatedId: applicationId,
          actionUrl: '/workflow',
        });

        // Send external notifications if channel active
        const channelType = rule.template.channel.type;

        if (channelType === 'EMAIL' && user.email) {
          try {
            // HTML templates stored in DB (legacy) are sent as-is.
            // Plain-text bodies are automatically wrapped in the professional HTML template.
            const htmlBody = isHtmlTemplate(renderedBody)
              ? renderedBody
              : buildEventEmail(event, renderedBody, {
                  clientName: vars.clientName,
                  applicationNumber: vars.applicationNumber,
                  amount: vars.amount,
                  currency: vars.currency,
                  actionUrl: vars.actionUrl,
                });
            await sendEmail(user.email, renderedSubject, htmlBody);
          } catch (err) {
            console.error(`Email send failed to ${user.email}:`, err);
          }
        }

        if (channelType === 'SMS' && user.phone) {
          try {
            await sendSms(user.phone, renderedBody);
          } catch (err) {
            console.error(`SMS send failed to ${user.phone}:`, err);
          }
        }
      }
    }
  } catch (err) {
    // Non-blocking — log but don't propagate
    console.error('triggerNotification error:', err);
  }
}
