"use client";

import { useState } from "react";
import { deleteTeamAction, renameTeamAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "./forms";
import { CheckIcon, PencilIcon, TrashIcon } from "./icons";
import { TeamShield } from "./TeamShield";

export interface ManagedTeam {
  id: number;
  name: string;
  uses: number;
  titles: number;
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/** Lista de times do organizador: busca, renomear e apagar os sem uso. */
export function TeamManager({ teams }: { teams: ManagedTeam[] }) {
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const shown = q ? teams.filter((t) => fold(t.name).includes(q)) : teams;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        className="field"
        placeholder="Buscar time"
        aria-label="Buscar time"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="card px-3 py-1.5">
        {shown.map((t) => (
          <TeamRow key={`${t.id}:${t.name}`} team={t} />
        ))}
        {shown.length === 0 && (
          <p className="px-2 py-4 text-body text-muted">
            Nenhum time encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

function TeamRow({ team }: { team: ManagedTeam }) {
  const [editing, setEditing] = useState(false);
  const detail = [
    team.uses
      ? `usado ${team.uses === 1 ? "1 vez" : `${team.uses} vezes`}`
      : "sem uso",
    team.titles
      ? `${team.titles} ${team.titles === 1 ? "título" : "títulos"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-[64px] flex-col justify-center gap-2 border-b border-bevel-dark/60 py-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <TeamShield team={team.name} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black">{team.name}</span>
          <span
            className={`block text-body ${team.uses ? "text-muted" : "text-danger"}`}
          >
            {detail}
          </span>
        </span>

        {team.uses === 0 && (
          <ActionForm action={deleteTeamAction}>
            <input type="hidden" name="teamId" value={team.id} />
            <SubmitButton
              className="btn btn-icon btn-danger"
              title="Apagar"
              confirm={`Apagar o time ${team.name}?`}
            >
              <TrashIcon />
              <span className="sr-only">Apagar {team.name}</span>
            </SubmitButton>
          </ActionForm>
        )}
        <button
          type="button"
          className="btn btn-icon"
          aria-expanded={editing}
          aria-label={`Renomear ${team.name}`}
          title="Renomear"
          onClick={() => setEditing((v) => !v)}
        >
          <PencilIcon />
        </button>
      </div>
      {editing && (
        <ActionForm
          action={renameTeamAction}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="teamId" value={team.id} />
          <input
            name="name"
            className="field min-w-0 flex-1"
            defaultValue={team.name}
            maxLength={60}
            required
            autoFocus
            aria-label={`Novo nome de ${team.name}`}
          />
          <SubmitButton
            className="btn btn-icon btn-primary"
            title="Salvar nome"
          >
            <CheckIcon />
            <span className="sr-only">Salvar nome</span>
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
