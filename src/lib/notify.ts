import { Resend } from "resend";
import type { SiteConfig } from "@/lib/types";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_FROM_EMAIL = "Studio CMS <notifications@reactivlabs.com>";

interface PublishNotification {
  title: string;
  slug: string;
  commitUrl?: string;
  scheduledPublish?: boolean;
  site?: SiteConfig;
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
  site,
}: PublishNotification): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Notify] RESEND_API_KEY not set, skipping email notification");
    return;
  }

  const siteName = site?.name || "Studio CMS";
  const siteDomain = site?.domain || "myfence.com";
  const blogPrefix = site?.blog_path_prefix || "/blog/";
  const notifyEmails =
    site?.notify_emails && site.notify_emails.length > 0
      ? site.notify_emails
      : ["info@myfence.com"];
  const postUrl = `https://www.${siteDomain}${blogPrefix}${slug}`;
  const method = scheduledPublish ? "automatically (scheduled)" : "manually";

  try {
    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: notifyEmails,
      subject: `New Blog Published: ${title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">New Blog Post Published</h2>
          <p style="color: #666; margin-top: 0;">A new article was published ${method} via ${siteName}.</p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">${title}</h3>
            <p style="margin: 0;">
              <a href="${postUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                View on ${siteDomain} &rarr;
              </a>
            </p>
          </div>

          ${commitUrl ? `<p style="color: #999; font-size: 13px;">GitHub commit: <a href="${commitUrl}" style="color: #999;">${commitUrl}</a></p>` : ""}
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Sent by ${siteName}</p>
        </div>
      `,
    });
    console.log(`[Notify] Email sent to ${notifyEmails.join(", ")} for: ${title}`);
  } catch (err: any) {
    console.error(`[Notify] Failed to send email: ${err.message}`);
  }
}
