export function SiteFooter() {
  return (
    <footer id="trust" className="site-footer slab m-flat">
      <div className="site-footer__inner">
        <div className="site-footer__grid">
          <div>
            <div className="brand" style={{ marginBottom: 14 }}>
              <span className="brand__word" style={{ color: 'var(--on-dark)' }}>deno</span>
              <span className="brand__chip">GTM</span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--on-dark-soft)', maxWidth: 240 }}>
              Marketing content your AI edits, grounded in real evidence.
            </p>
          </div>
          <div className="site-footer__col">
            <div className="display site-footer__heading">Product</div>
            <a href="/#how">How it works</a>
            <a href="/#make">Studio</a>
            <a href="/#proof">Idea validation</a>
            <a href="/pricing">Pricing</a>
          </div>
          <div className="site-footer__col">
            <div className="display site-footer__heading">Docs</div>
            <a href="/docs/quickstart">Quickstart</a>
            <a href="/docs/claude-code">Connect Claude</a>
            <a href="/docs/chatgpt">Connect ChatGPT</a>
            <a href="/docs/tools">Tool reference</a>
            <a href="/llms.txt">llms.txt</a>
          </div>
          <div className="site-footer__col">
            <div className="display site-footer__heading">Company</div>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/takedown">Takedown</a>
            <a href="mailto:hello@deno.gtm">Contact</a>
          </div>
        </div>
        <div className="site-footer__bottom">
          <span>© 2026 DENO GTM</span>
          <span>NEVER POSTS · NEVER VOTES · NEVER DMs</span>
        </div>
      </div>
    </footer>
  );
}
