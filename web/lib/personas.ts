/**
 * Creator personas (docs/18 §17): "Who are you?" sets how every video is made, and it learns from use.
 *
 * - The defaults (recipe, ratios, length, pacing, hook, tone, captions, style) come from `personas.json`, generated
 *   by `scripts/build_plugin.py` from packages/studio/src/deno_studio/personas.py. Never edit that file by hand.
 * - The website copy below (headline, pitch, example prompts, card colour) lives only here.
 */
import data from './personas.json';

export interface PersonaDefaults {
  id: string;
  label: string;
  blurb: string;
  recipe: string;
  also: string[];
  ratios: string[];
  ratio: string;
  length_s: number[];
  shot_s: number[];
  pacing: string;
  hook: string;
  tone: string;
  captions: string;
  caption_note: string;
  style: string;
  sound: string;
  ending: string;
}

interface PersonaCopy {
  /** Plural, for titles: "Deno for indie hackers and developers". */
  audience: string;
  /** What changes in their videos, in plain words (dashboard card, landing card). */
  videos: string;
  headline: string;
  pitch: string;
  prompts: string[];
  bg: string;
}

export type Persona = PersonaDefaults & PersonaCopy;

const COPY: Record<string, PersonaCopy> = {
  founder: {
    audience: 'founders',
    videos: '30 s launch films, 16:9 and square, real screens and numbers.',
    headline: 'Launch videos that sound like proof, not hype.',
    pitch: 'You are building a product. Your videos open on the pain your customers wrote about, show the real product, and end on your name and URL.',
    prompts: [
      'Make a launch video for my validated idea.',
      'Turn the strongest pain from my validation into a 30 second film.',
      'Make a changelog video of what we shipped this month.',
    ],
    bg: 'var(--lime)',
  },
  creator: {
    audience: 'content creators',
    videos: '15 s vertical reels, fast cuts on the beat, big word-by-word captions.',
    headline: 'Reels that stop the scroll in the first second.',
    pitch: 'You post for an audience. Your videos are vertical, fast, cut on the beat, with big captions that work with the sound off.',
    prompts: [
      'Make a 15 second reel about the mistake my audience keeps making.',
      'Cut my talking clip into a reel with word-by-word captions.',
      'Make three hooks for this reel and show me the strongest.',
    ],
    bg: 'var(--peach)',
  },
  indie_dev: {
    audience: 'indie hackers and developers',
    videos: '20 s demos that show it working in the first frame, terminal and code.',
    headline: 'Show it working in frame one.',
    pitch: 'You ship tools. Your videos skip the intro: the command, the result, the repo link. Numbers only when they are true.',
    prompts: [
      'Make a 20 second promo for my GitHub repo.',
      'Make a release video for the changes in my latest tag.',
      'Show install to first result in one take.',
    ],
    bg: 'var(--green-soft)',
  },
  agency: {
    audience: 'agencies and marketers',
    videos: "15–20 s ads cut for every platform (9:16, 1:1, 16:9), on the client's brand.",
    headline: "Every cut, every platform, on the client's brand.",
    pitch: "You make videos for clients. One brief becomes a 9:16, a square and a 16:9 cut, in the client's colours, fonts and words.",
    prompts: [
      "Set the brand kit from my client's website, then make a 15 second ad.",
      'Make this ad in 9:16, 1:1 and 16:9 with the same ending.',
      'Make a brand film around one hero object.',
    ],
    bg: 'var(--blue-soft)',
  },
  educator: {
    audience: 'educators and coaches',
    videos: '30–60 s explainers, calm pacing, numbered steps, full-sentence captions.',
    headline: 'Lessons people can follow with the sound off.',
    pitch: 'You teach. Your videos open on a question, go one step at a time, and keep full captions so the lesson works muted.',
    prompts: [
      'Make a 45 second explainer of the one idea my students miss most.',
      'Turn this lesson outline into a narrated explainer.',
      'Make a vertical tip video from step 2 of my course.',
    ],
    bg: 'var(--amber-soft)',
  },
};

export const DEFAULT_PERSONA: string = data.default;

export const PERSONAS: Persona[] = (data.personas as PersonaDefaults[]).map((p) => ({ ...p, ...COPY[p.id] }));

export const findPersona = (id: string | null | undefined): Persona | undefined => PERSONAS.find((p) => p.id === id);
export const personaLabel = (id: string | null | undefined): string | null => findPersona(id)?.label ?? null;
export const personaHref = (id: string) => `/for/${id.replace('_', '-')}`;
export const personaFromSlug = (slug: string) => PERSONAS.find((p) => personaHref(p.id) === `/for/${slug}`);

/** "20–35 s" */
export const lengthText = (p: PersonaDefaults) => (p.length_s[0] === p.length_s[1] ? `${p.length_s[0]} s` : `${p.length_s[0]}–${p.length_s[1]} s`);
/** "a cut every 1–1.5 s" */
export const pacingText = (p: PersonaDefaults) => `a cut every ${p.shot_s[0]}–${p.shot_s[1]} s`;
