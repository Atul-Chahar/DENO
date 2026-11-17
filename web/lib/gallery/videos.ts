/**
 * Videos shown in the public gallery at /videos (docs/23).
 *
 * To publish one: add an entry here and open a PR. Rules:
 * - `url` is where the maker posted it (YouTube, Vimeo, X, LinkedIn). Deno never hosts the file.
 * - Only list a video with its maker's permission, and credit them. Remove it when they ask.
 * - `prompt` is the maker's own first prompt, word for word. Leave it out if they did not share it.
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
  /** The app it was made in, e.g. "Claude Code". */
  app: string;
  /** Recipe slug, e.g. "saas-launch-32". */
  format: string;
  /** Style slug, e.g. "living-ui". */
  style: string;
  ratio: string;
  seconds: number;
  /** The maker's first prompt. */
  prompt?: string;
  /** Number of review rounds, if the maker shared it. */
  rounds?: number;
  /** Date published in the gallery, YYYY-MM-DD. */
  published: string;
  /** True only for videos made with Deno Studio. Others are shown as "Community". */
  madeWithDeno: boolean;
};

export const VIDEOS: GalleryVideo[] = [];
