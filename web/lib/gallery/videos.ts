/**
 * Videos shown in the public gallery at /videos (docs/23).
 *
 * To publish one: add an entry here and open a PR. Rules:
 * - `url` is where the maker posted it (YouTube, Vimeo, X, LinkedIn). Deno never hosts the file.
 * - Credit the maker and link to their original post. Community entries (`madeWithDeno: false`) are public posts
 *   listed with credit; remove one as soon as its maker asks (/takedown).
 * - `prompt` is the maker's own prompt, word for word, and only when they invited reuse (an open licence, or a
 *   post that says "copy this"). Otherwise leave it out and set `promptUrl` to where they posted it.
 * - `format` and `style` are slugs from formats.json (the Studio's recipes and styles).
 */
export type GalleryVideo = {
  /** URL part: /videos/<slug>. Lowercase letters, numbers and dashes. */
  slug: string;
  title: string;
  /** One or two sentences: what the video is for and what makes it work. */
  summary: string;
  /** Public link to the video. YouTube and Vimeo play on the page; anything else opens in a new tab. */
  url: string;
  /** Optional still. A YouTube link gets its own thumbnail without this. Must be a path under /assets/. */
  poster?: string;
  maker: { name: string; url?: string };
  /** The AI that made it, as the maker reported it, e.g. "Claude Opus 5.5". */
  model: string;
  /** The app or tools it was made with, as the maker reported them, e.g. "Claude Code". Leave out if not stated. */
  app?: string;
  /** Recipe slug, e.g. "saas-launch-32". */
  format: string;
  /** Style slug, e.g. "living-ui". */
  style: string;
  ratio: string;
  seconds: number;
  /** The maker's first prompt, word for word. Only when the maker invited reuse. */
  prompt?: string;
  /** Public link to where the maker posted their prompt (their post, thread or repo). Shown as "Read the maker's prompt". */
  promptUrl?: string;
  /** Number of review rounds, if the maker shared it. */
  rounds?: number;
  /** Date published in the gallery, YYYY-MM-DD. */
  published: string;
  /** True only for videos made with Deno Studio. Others are shown as "Community". */
  madeWithDeno: boolean;
};

/** Shorthand for community entries: public posts listed with credit (docs/23 §3). */
const community = (v: Omit<GalleryVideo, 'published' | 'madeWithDeno' | 'model'> & { model?: string }): GalleryVideo => ({
  model: 'Claude Opus 5.5',
  published: '2026-11-17',
  madeWithDeno: false,
  ...v,
});

/**
 * Community entries were taken from the claudevideo.org index (2026-11-17), which links each video to its maker's
 * original post on X. Model and app are what the maker's post says; summaries are our own words.
 */
export const VIDEOS: GalleryVideo[] = [
  // ---- Launch videos and product promos, 16:9 ----
  community({
    slug: 'inference-startup-launch',
    title: 'Launch video for an inference startup',
    summary: 'Floating terms about tokens and caching settle into a throughput stat card. Made from a one-line brief in about a minute.',
    url: 'https://x.com/deedydas/status/2102787937482252537',
    maker: { name: 'Deedy', url: 'https://x.com/deedydas' },
    app: 'JavaScript, Playwright and ffmpeg',
    format: 'saas-launch-32',
    style: 'swiss-kinetic',
    ratio: '16:9',
    seconds: 26,
    promptUrl: 'https://x.com/deedydas/status/2102787937482252537',
  }),
  community({
    slug: 'notion-column-permissions-trailer',
    title: 'Feature trailer: Notion column permissions',
    summary: 'Big type and a table whose sensitive columns lock one by one. A Notion engineer made it over a weekend, outside the video team.',
    url: 'https://x.com/wustep/status/2104610435571884086',
    maker: { name: 'Stephen Wu', url: 'https://x.com/wustep' },
    app: 'Remotion',
    format: 'saas-launch-32',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 32,
  }),
  community({
    slug: 'kotlin-product-promo',
    title: 'Kotlin language promo',
    summary: 'A dark editor types and runs a short Kotlin program under one-word headlines. The AI was pointed at the language website and nothing else.',
    url: 'https://x.com/jetbrains/status/2102459650125754812',
    maker: { name: 'JetBrains', url: 'https://x.com/jetbrains' },
    app: 'HyperFrames skills',
    format: 'saas-launch-32',
    style: 'dark-keynote',
    ratio: '16:9',
    seconds: 35,
  }),
  community({
    slug: 'rankhog-launch-video',
    title: 'Launch video for rankhog',
    summary: 'The hedgehog mascot works through a Reddit checklist and posts in a subreddit. One prompt and six rounds of changes.',
    url: 'https://x.com/anthonyriera/status/2103784508860305566',
    maker: { name: 'Anthony Riera', url: 'https://x.com/anthonyriera' },
    format: 'saas-launch-32',
    style: 'flat-explainer',
    ratio: '16:9',
    seconds: 53,
  }),
  community({
    slug: 'decktype-launch-film',
    title: 'Launch film for Decktype',
    summary: 'An agent command adds a pricing tier and the slide updates itself. A one-minute film for a Mac app that renders decks written by AI.',
    url: 'https://x.com/AChevenementM/status/2103503936632102938',
    maker: { name: 'Axel Chevenement Miranda', url: 'https://x.com/AChevenementM' },
    format: 'saas-launch-32',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 69,
  }),
  community({
    slug: 'climbx-post-ideas-promo',
    title: 'Promo for ClimbX, a posting assistant',
    summary: 'Starts on the question every creator asks, then shows ready posts, a weekly calendar and follower growth. One prompt, 20 minutes.',
    url: 'https://x.com/DanielSmidstrup/status/2104013515623170390',
    maker: { name: 'Daniel Smidstrup', url: 'https://x.com/DanielSmidstrup' },
    format: 'saas-launch-32',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 30,
  }),
  community({
    slug: 'docjev-teaser',
    title: 'Teaser for DocJev, an open-source document sorter',
    summary: 'Piles of tax forms and notices sort themselves into categories under a perfect score. A short teaser for an open-source library.',
    url: 'https://x.com/jerryjliu0/status/2102479924032577686',
    maker: { name: 'Jerry Liu', url: 'https://x.com/jerryjliu0' },
    format: 'repo-promo-20',
    style: 'swiss-kinetic',
    ratio: '16:9',
    seconds: 31,
  }),
  community({
    slug: 'otto-post-scheduler-promo',
    title: 'Promo for Otto, a post scheduler',
    summary: 'Write, approve, publish: a week of draft posts moves through the product in fifteen seconds. Portuguese captions.',
    url: 'https://x.com/condzxyz/status/2103570367763882199',
    maker: { name: 'Condz', url: 'https://x.com/condzxyz' },
    format: 'vertical-feature-15',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 15,
  }),
  community({
    slug: 'dub-partners-promo',
    title: 'Promo for Dub partner programs',
    summary: 'Partner avatars orbit the logo while payouts add up. Made in one shot through Cursor.',
    url: 'https://x.com/steventey/status/2103625902211088880',
    maker: { name: 'Steven Tey', url: 'https://x.com/steventey' },
    app: 'Cursor',
    format: 'saas-launch-32',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 15,
  }),
  community({
    slug: '1kpapers-launch-video',
    title: 'Launch video for 1kpapers',
    summary: 'Opens on a grid of nearly a thousand research papers, then walks through the app with animated charts. One shot from the live app.',
    url: 'https://x.com/nutlope/status/2103471839494500671',
    maker: { name: 'Hassan', url: 'https://x.com/nutlope' },
    format: 'saas-launch-32',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 30,
  }),
  community({
    slug: 'cosmos-moodboard-promo',
    title: 'Promo for Cosmos, a moodboard app',
    summary: 'A colour search fills an image grid, then hundreds of images swirl into one cosmos. Two prompts, no references.',
    url: 'https://x.com/kaolti/status/2103481296018092204',
    maker: { name: 'Zsolt Kacso', url: 'https://x.com/kaolti' },
    app: 'HyperFrames',
    format: 'saas-launch-32',
    style: 'dark-keynote',
    ratio: '16:9',
    seconds: 40,
    promptUrl: 'https://x.com/kaolti/status/2103481296018092204',
  }),
  community({
    slug: 'inbox-zero-product-video',
    title: 'Product video for Inbox Zero',
    summary: 'Emails get labelled as they arrive, a reply is drafted in the user’s voice and an urgent message pings. A one-minute product tour.',
    url: 'https://x.com/elie2222/status/2104037812119150735',
    maker: { name: 'Elie Steinbock', url: 'https://x.com/elie2222' },
    format: 'saas-launch-32',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 60,
  }),
  community({
    slug: 'lottiego-product-video',
    title: 'Product video for LottieGo',
    summary: 'A wall of raw animation JSON labelled heavy turns into light app tiles and a phone preview. Clean, off-white and quick.',
    url: 'https://x.com/okooo5km/status/2104068955853967700',
    maker: { name: '十里', url: 'https://x.com/okooo5km' },
    format: 'saas-launch-32',
    style: 'swiss-kinetic',
    ratio: '16:9',
    seconds: 25,
  }),
  community({
    slug: 'gofy-live-map-intro',
    title: 'Introduction video for gofy, a live city map',
    summary: 'Sticker icons pop onto a map of London, a phone shows live pins, and alert types lead to the logo.',
    url: 'https://x.com/heymrzak/status/2103768331782349060',
    maker: { name: 'ZAK', url: 'https://x.com/heymrzak' },
    app: 'Remotion',
    format: 'saas-launch-32',
    style: 'paper-cutout',
    ratio: '16:9',
    seconds: 30,
  }),
  community({
    slug: 'm3e-canvas-motion-video',
    title: 'Motion video for M3E Canvas',
    summary: 'Material-style phone screens for recipes, trips and settings rearrange across a dotted canvas as cards are dragged.',
    url: 'https://x.com/lnkiai/status/2103759350330544254',
    maker: { name: 'いのり', url: 'https://x.com/lnkiai' },
    app: 'Remotion and three.js',
    format: 'ui-loop-30',
    style: 'living-ui',
    ratio: '16:9',
    seconds: 32,
  }),
  community({
    slug: 'ajustacv-showreel',
    title: 'Showreel-style promo for AjustaCV',
    summary: 'Job cards fan out, per-application pricing is compared with a Pro plan, and the features tile in. Fifteen seconds from a one-line prompt.',
    url: 'https://x.com/thayto_dev/status/2104200591278739735',
    maker: { name: 'rafael thayto', url: 'https://x.com/thayto_dev' },
    app: 'HyperFrames skill',
    format: 'showreel-15',
    style: 'swiss-kinetic',
    ratio: '16:9',
    seconds: 15,
    prompt:
      "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.",
    promptUrl: 'https://x.com/thayto_dev/status/2104200591278739735',
  }),

  // ---- Explainers ----
  community({
    slug: 'how-browsers-work-40s',
    title: 'How browsers work, in 40 seconds',
    summary: 'A blueprint-style walk through the browser pipeline, down to the paint step drawing boxes and text onto the page. Every frame drawn in JavaScript.',
    url: 'https://x.com/addyosmani/status/2103009037164110327',
    maker: { name: 'Addy Osmani', url: 'https://x.com/addyosmani' },
    format: 'explainer-30',
    style: 'flat-explainer',
    ratio: '16:9',
    seconds: 40,
  }),
  community({
    slug: 'celld-job-lease-explainer',
    title: 'Why Celld earns its place: a systems explainer',
    summary: 'Diagrams show how job ownership moves between machines using timed leases on a shared bucket. From a one-line prompt.',
    url: 'https://x.com/0xnfrith/status/2103358957050068999',
    maker: { name: 'nick frith', url: 'https://x.com/0xnfrith' },
    format: 'explainer-30',
    style: 'flat-explainer',
    ratio: '16:9',
    seconds: 53,
    promptUrl: 'https://x.com/0xnfrith/status/2103358957050068999',
  }),
  community({
    slug: 'crm-redesign-case-study',
    title: 'UX case study: redesigning a CRM record',
    summary: 'A company record goes from cluttered wireframe to a cleaner layout, with a caption explaining each decision. Made to explain design choices in interviews.',
    url: 'https://x.com/moguzbulbul/status/2104206095313215591',
    maker: { name: 'Oğuz B', url: 'https://x.com/moguzbulbul' },
    format: 'explainer-30',
    style: 'living-ui',
    ratio: '4:3',
    seconds: 42,
  }),

  // ---- Square ----
  community({
    slug: 'herdr-projects-promo',
    title: 'Promo for the herdr-projects plugin',
    summary: 'A headline about parallel threads sits over branch cards ticking up their progress. Made in one shot from a phone.',
    url: 'https://x.com/eliasstravik/status/2102826740951232530',
    maker: { name: 'Elias Stråvik', url: 'https://x.com/eliasstravik' },
    format: 'repo-promo-20',
    style: 'dark-keynote',
    ratio: '1:1',
    seconds: 15,
  }),
  community({
    slug: 'makermap-one-shape-explainer',
    title: 'MakerMap explained with one morphing shape',
    summary: 'A single shape turns into sign-up, a map pin, a globe of makers, matches and a meetup. The whole video is code in one HTML file.',
    url: 'https://x.com/verbove/status/2103483957266268381',
    maker: { name: 'Martijn Verbove', url: 'https://x.com/verbove' },
    format: 'explainer-30',
    style: 'swiss-kinetic',
    ratio: '1:1',
    seconds: 20,
    promptUrl: 'https://x.com/verbove/status/2103483957266268381',
  }),

  // ---- Vertical, 9:16 ----
  community({
    slug: 'best-productivity-resources-launch',
    title: 'Vertical launch video for Best Productivity Resources',
    summary: 'Outdated top-ten lists scatter, then a search returns rated tools and a collection for remote workers.',
    url: 'https://x.com/shushant_l/status/2102730243576619370',
    maker: { name: 'Shushant Lakhyani', url: 'https://x.com/shushant_l' },
    app: 'Claude Code with the HyperFrames skill',
    format: 'vertical-feature-15',
    style: 'vertical-captions',
    ratio: '9:16',
    seconds: 35,
  }),
  community({
    slug: 'grouped-news-launch-ad',
    title: 'Vertical launch ad for grouped.news',
    summary: 'Serif headlines, drifting news cards and a chart that plots outlets by tone, ending on a free-trial card. Built in an hour from the site’s own design tokens.',
    url: 'https://x.com/l3d1c/status/2104649028193632524',
    maker: { name: 'Josip', url: 'https://x.com/l3d1c' },
    app: 'Remotion',
    format: 'vertical-feature-15',
    style: 'vertical-captions',
    ratio: '9:16',
    seconds: 34,
  }),
  community({
    slug: 'licitacerta-tender-ad',
    title: 'Vertical ad for LicitaCerta, a tender finder',
    summary: 'A radar sweep finds public tenders and a phone gets the alert. Portuguese, made in one prompt with Remotion.',
    url: 'https://x.com/thallisribeiro/status/2103107359727829318',
    maker: { name: 'Benza', url: 'https://x.com/thallisribeiro' },
    app: 'Remotion',
    format: 'vertical-feature-15',
    style: 'vertical-captions',
    ratio: '9:16',
    seconds: 21,
  }),
  community({
    slug: 'tv-track-app-promo',
    title: 'App promo for TV Track',
    summary: 'The app icon rises from a home screen, then a season checklist and cast row fill in. About 30 minutes to make and export.',
    url: 'https://x.com/SeanTiffonnet/status/2102518598736675262',
    maker: { name: 'Sean', url: 'https://x.com/SeanTiffonnet' },
    app: 'Remotion skill',
    format: 'vertical-feature-15',
    style: 'living-ui',
    ratio: '9:16',
    seconds: 33,
  }),
  community({
    slug: 'habit-tracker-update-reel',
    title: 'Update reel for a habit tracker',
    summary: 'Shows the latest product changes, like finished tasks getting out of the way. One shot from a short prompt.',
    url: 'https://x.com/SebastianRoehl/status/2103912457836323096',
    maker: { name: 'Sebastian Röhl', url: 'https://x.com/SebastianRoehl' },
    format: 'changelog-30',
    style: 'living-ui',
    ratio: '9:16',
    seconds: 15,
    promptUrl: 'https://x.com/SebastianRoehl/status/2103912457836323096',
  }),
  community({
    slug: 'arabic-ai-tutor-promo',
    title: 'Arabic promo for an AI coding tutor',
    summary: 'Bold kinetic type, a racing clock and tilted phone screens pitch an app for learning to code. Animated in Remotion.',
    url: 'https://x.com/YarHmm/status/2103505435802341449',
    maker: { name: 'Yarob', url: 'https://x.com/YarHmm' },
    format: 'vertical-feature-15',
    style: 'vertical-captions',
    ratio: '9:16',
    seconds: 56,
  }),
  community({
    slug: 'query-fan-out-explainer',
    title: 'Query fan-out, explained in 20 seconds',
    summary: 'One search question about CRMs branches into five related searches. A short vertical explainer for marketers.',
    url: 'https://x.com/harpreetchatha_/status/2103591810253914585',
    maker: { name: 'Harpreet', url: 'https://x.com/harpreetchatha_' },
    format: 'explainer-30',
    style: 'vertical-captions',
    ratio: '9:16',
    seconds: 20,
  }),
];
