"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";
import { useConfirm } from "./ConfirmDialog";

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Formulário ligado a uma ação do servidor, mostrando o erro que ela devolver. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="w-full basis-full text-body text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  className = "btn btn-primary",
  confirm,
  title,
}: {
  children: ReactNode;
  className?: string;
  /** Dica ao passar o mouse (útil em botão só com ícone). */
  title?: string;
  /** Pergunta de confirmação antes de enviar (para ações destrutivas). */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const [ask, dialog] = useConfirm();
  return (
    <>
      <button
        type="submit"
        className={className}
        title={title}
        disabled={pending}
        onClick={(e) => {
          if (!confirm) return;
          // Segura o envio, pergunta, e só então envia o formulário.
          e.preventDefault();
          const button = e.currentTarget;
          const form = button.form;
          void ask({
            message: confirm,
            // Botão vermelho (btn-danger) = ação que apaga ou desfaz algo.
            danger: className.includes("btn-danger"),
          }).then((ok) => {
            if (ok) form?.requestSubmit(button);
          });
        }}
      >
        {children}
      </button>
      {dialog}
    </>
  );
}
