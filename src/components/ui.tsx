import Link from "next/link";
import type { ReactNode } from "react";
import { arcade } from "@/lib/labels";
import type { AvatarLook } from "@/lib/sprite";
import { Avatar } from "./Avatar";
import { ChevronIcon, RecycleIcon } from "./icons";

/** Título da página sobre uma faixa de gramado, de ponta a ponta da coluna. */
export function PageTitle({
  title,
  subtitle,
  recycle = false,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Mostra o símbolo de reciclagem ao lado do título (página inicial). */
  recycle?: boolean;
}) {
  return (
    <header className="pitch -mx-6 mb-8 px-6 py-6">
      <h1
        className={recycle ? "flex items-center gap-3 text-title" : "text-title"}
        aria-label={title}
      >
        {recycle && (
          <RecycleIcon
            width={40}
            height={37}
            className="h-[27px] w-[29px] shrink-0 text-ink drop-shadow-[3px_3px_0_#04051a] sm:h-[37px] sm:w-[40px]"
          />
        )}
        <span className="min-w-0">{arcade(title)}</span>
      </h1>
      {subtitle && <p className="mt-2 text-body text-muted">{subtitle}</p>}
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
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="heading" aria-label={title}>
          {arcade(title)}
        </h2>
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
  avatar,
  detail,
  trailing,
  size = 44,
}: {
  href?: string;
  name: string;
  photoUrl?: string | null;
  avatar?: AvatarLook | null;
  detail?: ReactNode;
  trailing?: ReactNode;
  size?: number;
}) {
  const body = (
    <>
      <Avatar name={name} photoUrl={photoUrl} avatar={avatar} size={size} />
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

/** Número grande com legenda, como um quadro de estatística do jogo. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="card px-4 py-4">
      <div className="num text-title text-accent">{value}</div>
      <div className="mt-1 text-body text-muted">{label}</div>
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
        <ChevronIcon className="text-accent group-open:rotate-90" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
