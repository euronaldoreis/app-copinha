import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { deleteUnusedTeamsAction, mergeTeamsAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { BadgeAutoFill } from "@/components/BadgeEditor";
import { TeamManager } from "@/components/TeamManager";
import { apiFootballKey, suggestedTerm } from "@/lib/apiFootball";
import { Empty, PageTitle, Section } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { plural } from "@/lib/labels";
import { badgeCoverage } from "@/lib/services";

export const metadata: Metadata = { title: "Times" };

export default async function TeamsAdminPage() {
  if (!(await isAdmin())) redirect("/admin");
  const data = await getData();
  const uses = new Map<number, number>();
  const titles = new Map<number, number>();
  for (const e of data.entries) {
    if (e.teamId == null) continue;
    uses.set(e.teamId, (uses.get(e.teamId) ?? 0) + 1);
    if (e.result === "campeao")
      titles.set(e.teamId, (titles.get(e.teamId) ?? 0) + 1);
  }
  const teams = [...data.teams].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const unused = teams.filter((t) => !uses.has(t.id));
  const hasKey = apiFootballKey() !== "";
  const coverage = badgeCoverage(teams).filter((c) => c.teams > 0);
  const option = (t: { id: number; name: string }) => (
    <option key={t.id} value={t.id}>
      {t.name} ({plural(uses.get(t.id) ?? 0, "uso", "usos")})
    </option>
  );

  return (
    <>
      <PageTitle
        title="Times"
        subtitle={
          teams.length
            ? plural(teams.length, "time cadastrado", "times cadastrados")
            : undefined
        }
      />
      {coverage.length > 0 && (
        <Section title="Escudos">
          <BadgeAutoFill coverage={coverage} hasKey={hasKey} />
        </Section>
      )}
      {teams.length === 0 ? (
        <Empty>Nenhum time cadastrado ainda.</Empty>
      ) : (
        <div className={coverage.length > 0 ? "mt-8" : undefined}>
        <TeamManager
          hasKey={hasKey}
          teams={teams.map((t) => ({
            id: t.id,
            name: t.name,
            uses: uses.get(t.id) ?? 0,
            titles: titles.get(t.id) ?? 0,
            badgeUrl: t.badgeUrl,
            searchTerm: suggestedTerm(t.name),
          }))}
        />
        </div>
      )}
      {unused.length > 0 && (
        <Section title="Times sem uso">
          <ActionForm
            action={deleteUnusedTeamsAction}
            className="card flex flex-col gap-3 p-5"
          >
            <p className="text-body text-muted">
              {plural(
                unused.length,
                "time cadastrado não é usado",
                "times cadastrados não são usados",
              )}{" "}
              por nenhum participante:{" "}
              <span className="font-black text-ink">
                {unused.map((t) => t.name).join(", ")}
              </span>
              . Apagar tira esses times do ranking de times e das sugestões (os
              que estiverem na lista de sorteio de uma edição continuam lá).
            </p>
            <div>
              <SubmitButton
                className="btn btn-danger"
                confirm={`Apagar ${plural(unused.length, "time sem uso", "times sem uso")}?`}
              >
                Apagar times sem uso
              </SubmitButton>
            </div>
          </ActionForm>
        </Section>
      )}

      {teams.length > 1 && (
        <Section title="Juntar times">
          <ActionForm
            action={mergeTeamsAction}
            className="card flex flex-col gap-3 p-5"
          >
            <p className="text-body text-muted">
              Para nomes repetidos ou digitados errado (ex.: &quot;Al
              Hilan&quot; e &quot;Al Hilal&quot;). Os participantes e as listas
              de sorteio do time errado passam para o certo, e o errado é
              apagado.
            </p>
            <label>
              <span className="label">Time errado (some)</span>
              <select name="fromId" className="field" required defaultValue="">
                <option value="" disabled>
                  Escolha o time
                </option>
                {teams.map(option)}
              </select>
            </label>
            <label>
              <span className="label">Time certo (fica)</span>
              <select name="intoId" className="field" required defaultValue="">
                <option value="" disabled>
                  Escolha o time
                </option>
                {teams.map(option)}
              </select>
            </label>
            <div>
              <SubmitButton
                className="btn btn-primary"
                confirm="Juntar os dois times? O time errado será apagado."
              >
                Juntar times
              </SubmitButton>
            </div>
          </ActionForm>
        </Section>
      )}
    </>
  );
}
