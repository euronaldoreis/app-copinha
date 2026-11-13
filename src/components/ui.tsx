import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { ChevronIcon } from "./icons";

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <h1 className="text-title">{title}</h1>
      {subtitle && <p className="mt-1.5 text-body text-muted">{subtitle}</p>}
    </header>
  );
}

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3.5 flex items-baseline justify-between gap-4">
        <h2 className="text-name font-semibold">{title}</h2>
        {aside && <div className="text-body text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Linha de pessoa: retrato, nome e uma linha secundária. */
export function PersonRow({
  href,
  name,
  photoUrl,
  detail,
  trailing,
  size = 44,
}: {
  href?: string;
  name: string;
  photoUrl?: string | null;
  detail?: ReactNode;
  trailing?: ReactNode;
  size?: number;
}) {
  const body = (
    <>
      <Avatar name={name} photoUrl={photoUrl} size={size} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-name font-semibold">{name}</span>
        {detail && (
          <span className="block truncate text-body text-muted">{detail}</span>
        )}
      </span>
    </>
  );
  return (
    <div className="flex min-h-[68px] items-center gap-3.5">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3.5">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3.5">{body}</div>
      )}
      {trailing}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card px-6 py-8 text-body text-muted">{children}</p>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="num text-title">{value}</div>
      <div className="text-body text-muted">{label}</div>
    </div>
  );
}

/** Bloco recolhível, usado nos formulários de administração. */
export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="card group">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between px-5 text-name font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronIcon className="text-faint transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
