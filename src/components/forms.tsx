"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";

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
}: {
  children: ReactNode;
  className?: string;
  /** Pergunta de confirmação antes de enviar (para ações destrutivas). */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
