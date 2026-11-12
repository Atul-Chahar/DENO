import { SimpleShell } from '@/components/pages/SimpleShell';

export const metadata = { title: 'Deno — Privacy' };

export default function Privacy() {
  return (
    <SimpleShell>
      <div className="section-title">
        <h2>Privacy</h2>
        <p>Plain-language summary of what Deno stores and why. Last updated November 2026.</p>
      </div>
      <div className="card prose">
        <h3>Your account</h3>
        <p>We store your email (through Supabase Auth), your ideas, validation reports, voice samples, Story Bank entries and drafts. They are visible only to you. We never sell them or use them to train models.</p>
        <h3>Signing in with Google</h3>
        <p>If you sign in with Google, we receive only your name, email address and profile picture (the <code>openid</code>, <code>email</code> and <code>profile</code> scopes). We use them to create and identify your Deno account and nothing else. We don&apos;t read your Gmail, Drive, contacts or any other Google data, and we never share or sell what Google gives us. Deno&apos;s use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including its Limited Use requirements. To disconnect, delete your Deno account or remove Deno at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
        <h3>Apps you connect</h3>
        <p>If you connect Claude, ChatGPT or another app to Deno, it can act on your Deno data only after you approve it on our consent screen, and only as you. What it creates appears on your dashboard. Disconnect it from that app&apos;s settings at any time.</p>
        <h3>Public posts we read</h3>
        <p>When you run a validation, Deno fetches public posts (Reddit via Arctic Shift, Hacker News, X, Product Hunt and others) that match your idea. We only fetch when you start a run, never by crawling. The text of those posts is deleted after 90 days; we keep the link so your report&apos;s citations still work. Anyone can ask us to remove their posts on the <a href="/takedown">takedown page</a>.</p>
        <h3>AI providers</h3>
        <p>Your idea and the retrieved posts are sent to NVIDIA&apos;s hosted models to analyse them. We don&apos;t send your email or payment details.</p>
        <h3>Payments</h3>
        <p>Stripe handles payments. We never see or store your card.</p>
        <h3>Your rights</h3>
        <p>You can download all your data or delete your account at any time from <a href="/app/account">Account</a>. Deletion is immediate and permanent.</p>
      </div>
    </SimpleShell>
  );
}
