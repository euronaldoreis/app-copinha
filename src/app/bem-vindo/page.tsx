import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Arcade } from "@/components/Arcade";
import { Avatar } from "@/components/Avatar";
import { ChartIcon, PencilIcon, SwordsIcon, TrophyIcon } from "@/components/icons";
import { Trophy3D } from "@/components/icons3d";
import { currentPlayerId } from "@/lib/auth";
import { getData } from "@/lib/data";
import { plural } from "@/lib/labels";
import { computeRanking } from "@/lib/stats";
import { TIER_LABELS, tierOf } from "@/lib/tier";

export const metadata: Metadata = {
  title: "Bem-vindo",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/**
 * Primeira tela de quem abre o link de acesso que o organizador mandou: a
 * carta do jogador, o que dá para fazer e os atalhos para o visual e o perfil.
 */
export default async function WelcomePage() {
  const [playerId, data] = await Promise.all([currentPlayerId(), getData()]);
  const player =
    playerId != null ? data.players.find((p) => p.id === playerId) : undefined;
  if (!player) redirect("/meu-perfil");

  const stats = computeRanking(data).find((r) => r.player.id === player.id);
  const participations = stats?.participations ?? 0;
  const titles = stats?.titles ?? 0;
  const tier = tierOf(stats?.bestResult ?? null, titles);
  const hasLook = !!player.photoUrl || !!player.avatar;

  const steps = [
    {
      icon: <PencilIcon width={22} height={22} />,
      title: hasLook ? "Ajuste o seu visual" : "Monte o seu visual",
      text: "Crie o seu boneco ou use uma foto. É assim que você aparece nos jogos, nas tabelas e no ranking.",
    },
    {
      icon: <ChartIcon width={22} height={22} />,
      title: "Veja os seus números",
      text: "Títulos, finais, gols, aproveitamento e os rivais de cada confronto ficam no seu perfil.",
    },
    {
      icon: <SwordsIcon width={22} height={22} />,
      title: "Acompanhe as copinhas",
      text: "Jogos, grupos e mata-mata de cada edição, com o placar atualizado pelo organizador.",
    },
  ];

  return (
    <div className="welcome mx-auto flex max-w-lg flex-col items-center gap-6 pt-2 text-center">
      <p className="welcome-kicker anim-pop">Bem-vindo ao lixão</p>

      {/* A carta do jogador, a mesma da lista de jogadores. */}
      <div className={`player-card tier-${tier} welcome-card champ-latest`}>
        <span className="flex w-full items-center justify-between gap-1">
          <span className="player-badge" title="Nível: edições disputadas">
            Nv {participations}
          </span>
          <span className="player-badge !px-1.5" title={plural(titles, "título", "títulos")}>
            <Trophy3D width={16} height={16} />
            <span className="num">{titles}</span>
          </span>
        </span>
        <span className="profile-card-photo">
          <Avatar
            name={player.name}
            photoUrl={player.photoUrl}
            avatar={player.avatar}
            size={112}
            tier={false}
          />
        </span>
        <span className="player-plate whitespace-nowrap text-[12px] font-black uppercase tracking-wide text-accent">
          {participations ? TIER_LABELS[tier] : "Estreante"}
        </span>
      </div>

      <div className="anim-pop" style={{ "--i": 2 } as CSSProperties}>
        <h1 className="text-title font-pixel leading-none" aria-label={`Fala, ${player.name}!`}>
          <Arcade>{`Fala, ${player.name}!`}</Arcade>
        </h1>
        <p className="mt-3 text-body text-muted">
          {participations
            ? `${plural(participations, "copinha disputada", "copinhas disputadas")}${
                titles ? ` e ${plural(titles, "título", "títulos")}` : ""
              }. Agora o seu perfil é seu: este aparelho já está conectado.`
            : "A sua carta já está na Copinha dos Lixos. Agora o seu perfil é seu: este aparelho já está conectado."}
        </p>
      </div>

      <div
        className="anim-pop flex w-full flex-col gap-2.5 sm:flex-row"
        style={{ "--i": 3 } as CSSProperties}
      >
        <Link
          href={`/jogadores/${player.id}/editar`}
          className="btn btn-primary flex-1 justify-center"
        >
          <PencilIcon width={18} height={18} />
          {hasLook ? "Meu visual" : "Montar meu visual"}
        </Link>
        <Link href={`/jogadores/${player.id}`} className="btn flex-1 justify-center">
          <TrophyIcon width={18} height={18} />
          Ver meu perfil
        </Link>
      </div>

      <ul className="flex w-full flex-col gap-2.5 text-left">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="card anim-pop flex items-start gap-3 px-4 py-3"
            style={{ "--i": 4 + i } as CSSProperties}
          >
            <span className="welcome-step-icon">{s.icon}</span>
            <span className="min-w-0">
              <span className="block text-[16px] font-black">{s.title}</span>
              <span className="block text-body text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[13px] text-muted">
        Para desconectar este aparelho, use &quot;Sair deste aparelho&quot; na tela do visual.
      </p>
    </div>
  );
}
