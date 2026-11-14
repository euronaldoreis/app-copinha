"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ConfirmOptions {
  /** O que vai acontecer. Aparece no corpo do aviso. */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação que apaga ou desfaz algo: o botão de confirmar fica vermelho. */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

function Modal({ pending, close }: { pending: Pending; close: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    // O foco começa em "Cancelar": Enter sem querer não destrói nada.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
      if (e.key === "Tab") {
        // Mantém o foco entre os dois botões enquanto o aviso estiver aberto.
        e.preventDefault();
        const next =
          document.activeElement === cancelRef.current
            ? confirmRef.current
            : cancelRef.current;
        next?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [close]);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
        className="card modal-window"
      >
        <h2 id="modal-title" className="heading">
          {pending.title ?? (pending.danger ? "Tem certeza?" : "Confirmar")}
        </h2>
        <p id="modal-message" className="mt-4 text-body">
          {pending.message}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="btn"
            onClick={() => close(false)}
          >
            {pending.cancelLabel ?? "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={pending.danger ? "btn btn-alert" : "btn btn-primary"}
            onClick={() => close(true)}
          >
            {pending.confirmLabel ?? (pending.danger ? "Sim, continuar" : "Confirmar")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Aviso de confirmação no estilo do site, no lugar do window.confirm.
 *
 *   const [ask, dialog] = useConfirm();
 *   if (!(await ask({ message: "Apagar tudo?", danger: true }))) return;
 *   ...
 *   return <>{...}{dialog}</>;
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);

  const ask = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      setPending((current) => {
        current?.resolve(ok);
        return null;
      });
    },
    [],
  );

  return [ask, pending ? <Modal pending={pending} close={close} /> : null];
}
