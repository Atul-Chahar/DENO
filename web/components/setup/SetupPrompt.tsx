import { CopyButton } from '@/components/CopyButton';
import { SETUP_PROMPT } from '@/lib/site';

/** The one-paste prompt that lets a founder's AI set Deno up by itself. */
export function SetupPrompt({ stacked = false, heading = 'Let your AI set it up.' }: { stacked?: boolean; heading?: string }) {
  return (
    <div className={`m-prompt${stacked ? ' m-prompt--stack' : ''}`}>
      <div className="m-prompt__say">
        <span className="m-mono">The easy way · one paste</span>
        <h3>{heading}</h3>
        <p>
          Copy this prompt and paste it into Claude, ChatGPT, Cursor or any AI agent. It has every step for every app,
          so your AI does the setup and checks the connection. You only sign in.
        </p>
        <CopyButton text={SETUP_PROMPT} label="Copy the setup prompt" done="Copied. Paste it into your AI" className="btn btn--lime" chime />
      </div>
      <pre className="m-prompt__text" tabIndex={0} aria-label="The setup prompt">{SETUP_PROMPT}</pre>
    </div>
  );
}
