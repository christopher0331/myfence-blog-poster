import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const NOTIFY_EMAILS = ["admin@reactivlabs.com", "info@myfence.com"];
const FROM_EMAIL = "MyFence Studio <notifications@reactivlabs.com>";

interface PublishNotification {
  title: string;
  slug: string;
  commitUrl?: string;
  scheduledPublish?: boolean;
}

/**
 * Send an email notification when a blog post is published.
 * Non-throwing — logs errors but doesn't break the publish flow.
 */
export async function notifyPostPublished({
  title,
  slug,
  commitUrl,
  scheduledPublish = false,
}: PublishNotification): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Notify] RESEND_API_KEY not set, skipping email notification");
    return;
  }

  const postUrl = `https://www.myfence.com/blog/${slug}`;
  const method = scheduledPublish ? "automatically (scheduled)" : "manually";

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAILS,
      subject: `New Blog Published: ${title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">New Blog Post Published</h2>
          <p style="color: #666; margin-top: 0;">A new article was published ${method} via MyFence Studio.</p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">${title}</h3>
            <p style="margin: 0;">
              <a href="${postUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                View on myfence.com &rarr;
              </a>
            </p>
          </div>

          ${commitUrl ? `<p style="color: #999; font-size: 13px;">GitHub commit: <a href="${commitUrl}" style="color: #999;">${commitUrl}</a></p>` : ""}
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Sent by MyFence Studio</p>
        </div>
      `,
    });
    console.log(`[Notify] Email sent to ${NOTIFY_EMAILS.join(", ")} for: ${title}`);
  } catch (err: any) {
    console.error(`[Notify] Failed to send email: ${err.message}`);
  }
}
