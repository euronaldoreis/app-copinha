import Link from "next/link";
import type { ReactNode } from "react";
import type { AvatarLook } from "@/lib/sprite";
import { Arcade } from "./Arcade";
import { Avatar } from "./Avatar";
import { ChevronIcon, RecycleIcon } from "./icons";

/** Título da página sobre uma faixa de gramado, de ponta a ponta da coluna. */
export function PageTitle({
  title,
  subtitle,
  recycle = false,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Mostra o símbolo de reciclagem ao lado do título (página inicial). */
  recycle?: boolean;
  /** Botão no canto direito da faixa (por exemplo, um ícone de configurações). */
  action?: ReactNode;
}) {
  return (
    <header className="pitch -mx-4 mb-7 flex items-start justify-between gap-4 px-4 py-5">
      <div className="min-w-0 flex-1">
      <h1
        className={recycle ? "flex items-center gap-3 text-title" : "text-title"}
        aria-label={title}
      >
        {recycle && (
          <RecycleIcon
            width={36}
            height={36}
            className="size-8 shrink-0 text-ink drop-shadow-[0_3px_0_#0a1a52] sm:size-9"
          />
        )}
        <span className="min-w-0">
          <Arcade>{title}</Arcade>
        </span>
      </h1>
      {subtitle && <p className="mt-2 text-body text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="heading" aria-label={title}>
          <Arcade>{title}</Arcade>
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
    <div className="card flex flex-col items-center px-2 py-3 text-center">
      <div className="num text-title text-accent">{value}</div>
      <div className="mt-0.5 text-body text-muted">{label}</div>
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
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between px-5 text-name font-black [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronIcon className="text-accent group-open:rotate-90" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
