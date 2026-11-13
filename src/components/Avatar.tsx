/* eslint-disable @next/next/no-img-element -- as fotos vêm de links externos quaisquer */

export function Avatar({
  name,
  photoUrl,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };
  const base = "shrink-0 rounded-full ring-1 ring-black/5 shadow-soft";
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        style={style}
        className={`${base} object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }
  // Sem foto: monograma neutro, sem cores sorteadas.
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      style={{ ...style, fontSize: Math.max(12, Math.round(size * 0.36)) }}
      className={`${base} flex items-center justify-center bg-wash font-semibold text-muted`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
