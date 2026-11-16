import { Fragment, type ReactNode } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { CodeBlock } from '@/components/setup/CodeBlock';
import { SetupPrompt } from '@/components/setup/SetupPrompt';
import { SetupTabs } from '@/components/setup/SetupTabs';
import { headingId, type Block } from '@/lib/docs/content';
import { PROMPTS, TOOLS, type ToolDoc } from '@/lib/docs/tools';

/** Renders the docs' inline syntax: `code`, **bold** and [text](href). */
export function Inline({ text }: { text: string }): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('`')) return <span key={i} className="m-inline">{part.slice(1, -1)}</span>;
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) return <a key={i} href={link[2]}>{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="m-table-box">
      <table className="m-table">
        <thead><tr>{head.map((h) => <th key={h}>{h.toUpperCase()}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>{row.map((cell, c) => <td key={c}><Inline text={cell} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolTables() {
  const groups = Array.from(new Set(TOOLS.map((t) => t.group)));
  return (
    <>
      {groups.map((group) => (
        <Fragment key={group}>
          <h2 id={headingId(group)}>{group}</h2>
          {TOOLS.filter((t) => t.group === group).map((tool: ToolDoc) => (
            <Fragment key={tool.name}>
              <h3 id={tool.name}>
                <span className="m-inline">{tool.name}</span>{' '}
                <span className={`tag ${tool.writes ? 'tag--amber' : 'tag--green'}`} style={{ verticalAlign: 'middle' }}>
                  {tool.writes ? 'Changes data' : 'Read only'}
                </span>
              </h3>
              <p><strong>{tool.title}.</strong> {tool.does}</p>
              <p className="m-fine"><strong>Arguments:</strong> {tool.args}</p>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  );
}

export function DocBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return <p key={i}><Inline text={b.text} /></p>;
          case 'h2':
            return <h2 key={i} id={headingId(b.text)}>{b.text}</h2>;
          case 'h3':
            return <h3 key={i}>{b.text}</h3>;
          case 'ul':
            return <ul key={i}>{b.items.map((item) => <li key={item}><Inline text={item} /></li>)}</ul>;
          case 'ol':
            return <ol key={i}>{b.items.map((item) => <li key={item}><Inline text={item} /></li>)}</ol>;
          case 'code':
            return <CodeBlock key={i} code={b.code} />;
          case 'note':
            return <div key={i} className={`d-note${b.warn ? ' d-note--warn' : ''}`}><Inline text={b.text} /></div>;
          case 'say':
            return (
              <div key={i} className="d-say">
                <span>&ldquo;{b.text}&rdquo;</span>
                <CopyButton text={b.text} />
              </div>
            );
          case 'table':
            return <Table key={i} head={b.head} rows={b.rows} />;
          case 'cards':
            return (
              <div key={i} className="d-cards">
                {b.items.map((card) => (
                  <a key={card.href} href={card.href} className="d-card">
                    <b>{card.title}</b>
                    <span>{card.text}</span>
                  </a>
                ))}
              </div>
            );
          case 'setupPrompt':
            return <SetupPrompt key={i} stacked heading="Let your AI set Deno up for you" />;
          case 'setupTabs':
            return <SetupTabs key={i} />;
          case 'tools':
            return <ToolTables key={i} />;
          case 'prompts':
            return (
              <Table
                key={i}
                head={['Prompt', 'Title', 'Arguments (defaults)', 'What it does']}
                rows={PROMPTS.map((p) => [p.name, p.title, p.args, p.does])}
              />
            );
        }
      })}
    </>
  );
}
