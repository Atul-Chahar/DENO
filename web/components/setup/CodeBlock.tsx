import { CopyButton } from '@/components/CopyButton';

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="m-code">
      <pre>{code}</pre>
      <CopyButton text={code} className="btn" />
    </div>
  );
}
