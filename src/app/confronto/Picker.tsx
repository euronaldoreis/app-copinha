import type { Player } from "@/db/schema";

/** Escolha dos dois jogadores: um formulário simples que vai para /confronto. */
export function Picker({ players, a, b }: { players: Player[]; a: number | null; b: number | null }) {
  const select = (name: string, value: number | null, label: string) => (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-bold text-muted">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="field" required>
        <option value="" disabled>
          Escolha
        </option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form method="get" action="/confronto" className="card flex flex-col gap-4 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        {select("a", a, "Jogador")}
        <span className="pb-3 font-pixel text-[18px] text-muted">X</span>
        {select("b", b, "Adversário")}
      </div>
      <button type="submit" className="btn btn-primary w-full">
        Ver confronto
      </button>
    </form>
  );
}
