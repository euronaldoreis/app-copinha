import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "../actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageTitle } from "@/components/ui";
import { adminConfigured, isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  if (await isAdmin()) {
    return (
      <>
        <PageTitle
          title="Modo admin"
          subtitle="Você pode criar edições, sortear times e lançar placares."
        />
        <div className="flex flex-wrap gap-3">
          <Link href="/edicoes/nova" className="btn btn-primary">
            Nova edição
          </Link>
          <Link href="/jogadores" className="btn">
            Gerenciar jogadores
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Entrar"
        subtitle="Só quem organiza a Copinha precisa entrar. O resto do site é aberto para todo mundo ver."
      />
      {adminConfigured() ? (
        <ActionForm
          action={loginAction}
          className="flex max-w-sm flex-col gap-3"
        >
          <label>
            <span className="label">Senha de administrador</span>
            <input
              type="password"
              name="password"
              className="field"
              autoComplete="current-password"
              required
              autoFocus
            />
          </label>
          <SubmitButton>Entrar</SubmitButton>
        </ActionForm>
      ) : (
        <p className="card max-w-lg px-6 py-5 text-body text-muted"></p>
      )}
    </>
  );
}
