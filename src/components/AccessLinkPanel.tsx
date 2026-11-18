"use client";

import { useActionState, useState } from "react";
import {
  createAccessLinkAction,
  revokeAccessAction,
  type AccessLinkState,
} from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";

/**
 * Organizador: gera o link com que o jogador entra para editar o próprio
 * perfil. O link só aparece na hora em que é gerado (no banco fica o hash).
 */
export function AccessLinkPanel({
  playerId,
  playerName,
  hasAccess,
}: {
  playerId: number;
  playerName: string;
  hasAccess: boolean;
}) {
  const [state, generate, pending] = useActionState<AccessLinkState, FormData>(
    createAccessLinkAction,
    null,
  );
  const [copied, setCopied] = useState(false);
  const link = state?.path ? `${window.location.origin}${state.path}` : null;

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sem permissão de área de transferência: o campo continua selecionável
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-muted">
        {hasAccess || link
          ? "O acesso está ativo. Quem abre o link pode trocar a foto e o avatar de "
          : "Gere um link para "}
        <strong>{playerName}</strong>
        {hasAccess || link
          ? "."
          : " trocar a própria foto e o próprio avatar. O nome continua só com você."}
      </p>

      {link && (
        <div className="flex flex-col gap-2">
          <input
            readOnly
            value={link}
            className="field"
            aria-label="Link de acesso"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={copy}>
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <a
              className="btn"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(
                `Seu link para editar seu perfil na Copinha dos Lixos: ${link}`,
              )}`}
            >
              Enviar no WhatsApp
            </a>
          </div>
          <p className="text-body text-muted">
            Esse link só aparece agora. Quem o tiver edita o perfil de{" "}
            {playerName}, então mande só para ele.
          </p>
        </div>
      )}

      <form action={generate} className="flex flex-wrap gap-2">
        <input type="hidden" name="playerId" value={playerId} />
        <button className="btn" type="submit" disabled={pending}>
          {hasAccess || link ? "Gerar novo link" : "Gerar link de acesso"}
        </button>
      </form>
      {(hasAccess || link) && (
        <p className="text-body text-muted">
          Gerar um novo link desativa o anterior.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-body text-danger">
          {state.error}
        </p>
      )}

      {(hasAccess || link) && (
        <ActionForm action={revokeAccessAction}>
          <input type="hidden" name="playerId" value={playerId} />
          <SubmitButton
            className="btn btn-danger"
            confirm={`Desativar o acesso de ${playerName}?`}
          >
            Desativar acesso
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
