const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Synthetic ID document image. Always watermarked SYNTHETIC. */
export function documentSvg(kind: string, name: string, country: string, ref: string): string {
  const title = kind === "passport" ? "PASSPORT" : kind === "selfie" ? "SELFIE CAPTURE" : "DRIVER LICENSE";
  const color = kind === "passport" ? "#1e3a8a" : kind === "selfie" ? "#334155" : "#065f46";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">
<rect width="420" height="260" rx="14" fill="#f8fafc" stroke="${color}" stroke-width="4"/>
<rect width="420" height="44" rx="14" fill="${color}"/>
<text x="20" y="29" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff">${title} · ${esc(country)}</text>
<rect x="20" y="64" width="110" height="140" rx="8" fill="#cbd5e1"/>
<circle cx="75" cy="115" r="28" fill="#94a3b8"/><rect x="40" y="150" width="70" height="40" rx="20" fill="#94a3b8"/>
<text x="150" y="90" font-family="sans-serif" font-size="13" fill="#475569">Name</text>
<text x="150" y="110" font-family="sans-serif" font-size="17" font-weight="600" fill="#0f172a">${esc(name)}</text>
<text x="150" y="140" font-family="sans-serif" font-size="13" fill="#475569">Document no.</text>
<text x="150" y="160" font-family="monospace" font-size="16" fill="#0f172a">${esc(ref.toUpperCase())}</text>
<text x="210" y="190" font-family="sans-serif" font-size="46" font-weight="800" fill="#dc2626" fill-opacity="0.28" transform="rotate(-18 210 150)" text-anchor="middle">SYNTHETIC</text>
<text x="20" y="240" font-family="monospace" font-size="11" fill="#64748b">P&lt;${esc(country)}&lt;&lt;${esc(name.toUpperCase().replace(/\s+/g, "&lt;"))}&lt;&lt;&lt;&lt;</text>
</svg>`;
}
