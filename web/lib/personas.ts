/**
 * "Who are you?" choices (docs/18 §17). The ids and defaults live in
 * packages/studio/src/deno_studio/personas.py; tests/unit/studio/test_personas.py checks this list matches it.
 */
export interface PersonaChoice {
  id: string;
  label: string;
  blurb: string;
  /** What changes in their videos, in plain words. */
  videos: string;
}

export const PERSONAS: PersonaChoice[] = [
  { id: 'founder', label: 'Founder', blurb: "I'm building a product and need launch and feature videos.", videos: '30 s launch films, 16:9 and square, real screens and numbers.' },
  { id: 'creator', label: 'Content creator', blurb: 'I post short videos for my audience on Reels, Shorts and TikTok.', videos: '15 s vertical reels, fast cuts on the beat, big word-by-word captions.' },
  { id: 'indie_dev', label: 'Indie hacker / developer', blurb: 'I ship tools and side projects and share them with other builders.', videos: '20 s demos that show it working in the first frame, terminal and code.' },
  { id: 'agency', label: 'Agency / marketer', blurb: 'I make marketing videos for clients or for the brand I work for.', videos: "15–20 s ads cut for every platform (9:16, 1:1, 16:9), on the client's brand." },
  { id: 'educator', label: 'Educator / coach', blurb: 'I teach: courses, tutorials, coaching, tips.', videos: '30–60 s explainers, calm pacing, numbered steps, full-sentence captions.' },
];

export const personaLabel = (id: string | null | undefined): string | null => PERSONAS.find((p) => p.id === id)?.label ?? null;
