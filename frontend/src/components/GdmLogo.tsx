/**
 * GdmLogo — monograma corporativo "GDM" en SVG inline.
 *
 * Basado en el logo oficial de GDM High Consulting México: letras serif
 * plateadas entrelazadas dentro de un anillo, sobre fondo rojo degradado.
 * Al ser SVG inline escala nítido a cualquier tamaño (sidebar 40px,
 * login 56px, favicon 32px) sin assets externos.
 */

export function GdmLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="GDM High Consulting México"
    >
      <defs>
        <linearGradient id="gdm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b91c1c" />
          <stop offset="0.55" stopColor="#8f1616" />
          <stop offset="1" stopColor="#6d0f0f" />
        </linearGradient>
        <linearGradient id="gdm-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#d7dde5" />
          <stop offset="0.6" stopColor="#aab4c0" />
          <stop offset="1" stopColor="#e8edf2" />
        </linearGradient>
      </defs>

      {/* Fondo circular rojo */}
      <circle cx="32" cy="32" r="31" fill="url(#gdm-bg)" />
      {/* Anillo plateado del monograma */}
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="url(#gdm-silver)" strokeWidth="2.6" />

      {/* Monograma: G grande, D central superpuesta, M pequeña arriba-derecha */}
      <text
        x="17" y="44.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold" fontSize="31"
        fill="url(#gdm-silver)"
      >G</text>
      <text
        x="28" y="47"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold" fontSize="35"
        fill="url(#gdm-silver)"
      >D</text>
      <text
        x="41.5" y="26.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold" fontSize="15"
        fill="url(#gdm-silver)"
      >M</text>
    </svg>
  );
}

export default GdmLogo;
