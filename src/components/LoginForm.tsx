"use client";

import { useActionState, useRef, useState } from "react";
import { loginAction } from "@/app/actions";
import { LockIcon } from "./icons";

/**
 * Entrada do organizador. Feita para o celular:
 * - sem foco automático (no iPhone ele não abre o teclado e trava o toque
 *   seguinte no campo);
 * - rótulo ligado ao campo por id e a caixa inteira repassa o toque para ele;
 * - letra de 16 px, para o iPhone não dar zoom ao focar;
 * - botão para ver a senha digitada.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="card flex max-w-sm flex-col gap-4 p-5">
      <div>
        <label htmlFor="admin-password" className="label">
          Senha de administrador
        </label>
        {/* A caixa inteira é a área de toque: qualquer ponto dela foca o campo. */}
        <div
          className={`login-box ${state?.error ? "login-box-error" : ""}`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          <LockIcon width={20} height={20} className="shrink-0 text-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            id="admin-password"
            name="password"
            type={visible ? "text" : "password"}
            className="login-input"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Digite a senha"
            required
            aria-invalid={state?.error ? true : undefined}
            aria-describedby={state?.error ? "login-error" : undefined}
          />
          <button
            type="button"
            className="login-eye"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Esconder senha" : "Mostrar senha"}
            aria-pressed={visible}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="3" />
              {!visible && <path d="M4 20 20 4" />}
            </svg>
          </button>
        </div>
        {state?.error && (
          <p id="login-error" role="alert" className="mt-2 text-body font-bold text-danger">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
