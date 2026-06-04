class EmailService {
  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async sendEmail({ to, subject, text, html }) {
    if (!to) return false;

    const from = process.env.EMAIL_FROM || process.env.PASSWORD_RESET_FROM;
    if (process.env.RESEND_API_KEY && from) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          text,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email failed: ${errorText}`);
      }

      return true;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[email:dev] to=${to}`);
      console.log(`[email:dev] subject=${subject}`);
      console.log(`[email:dev] text=${text}`);
    }

    return false;
  }

  async sendPasswordReset({ to, token }) {
    if (!to) return false;

    const subject = "Reset your NendPlay password";
    const text = [
      "Use this password reset token in NendPlay:",
      "",
      token,
      "",
      "This token expires in 15 minutes. If you did not request this, you can ignore this message.",
    ].join("\n");

    return this.sendEmail({ to, subject, text });
  }

  async sendWelcomeEmail({ to, name }) {
    if (!to) return false;

    const displayName = name || "there";
    const appUrl = process.env.CLIENT_URL || "https://nendplay.com";
    const safeDisplayName = this.escapeHtml(displayName);
    const safeAppUrl = this.escapeHtml(appUrl);
    const subject = "Welcome to NendPlay";
    const text = [
      `Hi ${displayName},`,
      "",
      "Welcome to NendPlay, your entertainment home for movies, shorts, music, novels, daily news, downloads, rewards, and more.",
      "",
      "Here are a few things you can do:",
      "- Watch movies, shorts, live content, and other media.",
      "- Read novels and PDF documents in NovelHub.",
      "- Download eligible media and documents for offline access.",
      "- Subscribe to a package when you want premium access.",
      "- Use rewards to earn coins from ads and redeem ad-free days or plans.",
      "- Invite friends with your referral link to unlock more rewards.",
      "",
      "To subscribe, open NendPlay, go to Profile, choose Subscribe, select a package, and follow the payment steps.",
      "To enjoy ad-free access, go to Rewards and redeem coins for 1 day, 7 days, 30 days, or eligible premium plans.",
      "",
      `Start exploring: ${appUrl}`,
      "",
      "Thanks for joining NendPlay.",
      "The NendPlay Team",
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
        <h1 style="color:#7C3AED;margin-bottom:8px;">Welcome to NendPlay</h1>
        <p>Hi ${safeDisplayName},</p>
        <p>Welcome to <strong>NendPlay</strong>, your entertainment home for movies, shorts, music, novels, daily news, downloads, rewards, and more.</p>
        <h2 style="font-size:18px;margin-top:24px;">What you can enjoy</h2>
        <ul>
          <li>Watch movies, shorts, live content, and other media.</li>
          <li>Read novels and PDF documents in NovelHub.</li>
          <li>Download eligible media and documents for offline access.</li>
          <li>Subscribe to a package when you want premium access.</li>
          <li>Earn coins from ads and redeem ad-free days or plans.</li>
          <li>Invite friends with your referral link to unlock more rewards.</li>
        </ul>
        <h2 style="font-size:18px;margin-top:24px;">How to subscribe</h2>
        <p>Open NendPlay, go to <strong>Profile</strong>, choose <strong>Subscribe</strong>, select a package, and follow the payment steps.</p>
        <h2 style="font-size:18px;margin-top:24px;">How to enjoy ad-free packages</h2>
        <p>Go to <strong>Rewards</strong>, watch rewarded ads to earn coins, then redeem coins for 1 day, 7 days, 30 days, or eligible premium plans.</p>
        <p style="margin-top:28px;">
          <a href="${safeAppUrl}" style="background:#7C3AED;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">Start exploring NendPlay</a>
        </p>
        <p style="margin-top:28px;color:#4B5563;">Thanks for joining NendPlay.<br/>The NendPlay Team</p>
      </div>
    `;

    return this.sendEmail({ to, subject, text, html });
  }
}

module.exports = new EmailService();
