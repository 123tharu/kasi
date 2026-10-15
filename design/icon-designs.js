// Three original icon designs. Each returns an SVG string (512x512, full-bleed so Android can mask it).
const defs = `
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbe7a1"/><stop offset=".35" stop-color="#e8b84a"/><stop offset=".7" stop-color="#c38a1e"/><stop offset="1" stop-color="#8f5f0c"/>
  </linearGradient>
  <linearGradient id="goldEdge" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b47a14"/><stop offset="1" stop-color="#6e4607"/>
  </linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#cfd3d8"/><stop offset=".75" stop-color="#9aa1aa"/><stop offset="1" stop-color="#6b727b"/>
  </linearGradient>
  <linearGradient id="silverEdge" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8a9099"/><stop offset="1" stop-color="#555b63"/>
  </linearGradient>
  <radialGradient id="bgDark" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#1d2a1a"/><stop offset="1" stop-color="#0e0e0f"/></radialGradient>
  <radialGradient id="bgGreen" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="#3f7a33"/><stop offset="1" stop-color="#173512"/></radialGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".45"/></filter>
</defs>`
const WORD = process.env.WORD || 'රු'
const ru = (x, y, size, fill, op = 1) =>
  `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Kasi Sinhala" font-weight="800" font-size="${size}" fill="${fill}" opacity="${op}" textLength="${WORD.length > 2 ? size * 1.45 : ''}" lengthAdjust="spacingAndGlyphs">${WORD}</text>`.replace(' textLength=""', '')
const ticks = (cx, cy, r, n, len, color, w = 3) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r
    const x2 = cx + Math.cos(a) * (r - len), y2 = cy + Math.sin(a) * (r - len)
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`
  }).join('')
const beads = (cx, cy, r, n, rad, color) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${rad}" fill="${color}"/>`
  }).join('')

// A: stack of gold coins, top face shows රු
function stackCoin(cy, rx, ry, thick, face = false) {
  return `
  <path d="M ${256 - rx} ${cy} v ${thick} a ${rx} ${ry} 0 0 0 ${rx * 2} 0 v ${-thick} z" fill="url(#goldEdge)"/>
  ${Array.from({ length: 22 }, (_, i) => { const x = 256 - rx + ((i + .5) / 22) * rx * 2; const dy = ry * Math.sqrt(Math.max(0, 1 - ((x - 256) / rx) ** 2)); return `<line x1="${x.toFixed(1)}" y1="${(cy + dy).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(cy + dy + thick).toFixed(1)}" stroke="#5a3a05" stroke-width="2" opacity=".5"/>` }).join('')}
  <ellipse cx="256" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#gold)"/>
  <ellipse cx="256" cy="${cy}" rx="${rx - 14}" ry="${ry - 6}" fill="none" stroke="#a8740f" stroke-width="4" opacity=".7"/>
  ${face ? `<g transform="translate(256 ${cy}) scale(1 ${ry / rx}) translate(-256 ${-cy})">${ru(256, cy + 4, WORD.length > 2 ? 120 : 150, '#8a5a08')}${ru(253, cy, WORD.length > 2 ? 120 : 150, '#fff2c4', .55)}</g>` : ''}`
}
const A = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#bgDark)"/>
  <g filter="url(#shadow)">
    ${stackCoin(352, 150, 52, 30)}
    ${stackCoin(312, 150, 52, 30)}
    ${stackCoin(250, 150, 52, 30, true)}
  </g>
  <circle cx="392" cy="128" r="10" fill="#86d16f"/><circle cx="420" cy="160" r="6" fill="#86d16f" opacity=".7"/>
</svg>`

// B: gold coin in front of a silver coin, like change in your pocket
const B = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#bgDark)"/>
  <g filter="url(#shadow)">
    <circle cx="196" cy="200" r="122" fill="url(#silverEdge)"/>
    <circle cx="196" cy="196" r="118" fill="url(#silver)"/>
    ${beads(196, 196, 100, 40, 3.2, '#7d848d')}
    <text x="196" y="190" text-anchor="middle" dominant-baseline="central" font-family="Kasi Num" font-weight="800" font-size="96" fill="#6b727b">5</text>
  </g>
  <g filter="url(#shadow)">
    <circle cx="316" cy="322" r="142" fill="url(#goldEdge)"/>
    <circle cx="316" cy="316" r="138" fill="url(#gold)"/>
    ${ticks(316, 316, 136, 90, 9, '#8f5f0c', 2.5)}
    <circle cx="316" cy="316" r="112" fill="none" stroke="#a8740f" stroke-width="4" opacity=".75"/>
    ${ru(318, 322, WORD.length > 2 ? 112 : 150, '#8a5a08')}${ru(314, 318, WORD.length > 2 ? 112 : 150, '#fff2c4', .5)}
  </g>
</svg>`

// C: one big coin on Kasi green, beaded border
const C = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#bgGreen)"/>
  <g filter="url(#shadow)">
    <circle cx="256" cy="264" r="176" fill="url(#goldEdge)"/>
    <circle cx="256" cy="256" r="172" fill="url(#gold)"/>
    ${ticks(256, 256, 170, 110, 10, '#8f5f0c', 2.5)}
    ${beads(256, 256, 138, 48, 4.5, '#a8740f')}
    ${ru(259, 262, WORD.length > 2 ? 150 : 190, '#8a5a08')}${ru(254, 257, WORD.length > 2 ? 150 : 190, '#fff2c4', .5)}
  </g>
</svg>`

module.exports = { A, B, C }
