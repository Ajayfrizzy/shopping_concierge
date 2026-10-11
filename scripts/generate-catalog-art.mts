/** Original geometric demo illustrations. No external imagery or AI service calls. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { fixtureProducts } from '../fixtures/catalog.ts';
const directory = new URL('../apps/mobile/assets/catalog/', import.meta.url);
await mkdir(directory, { recursive: true });
function motif(n: number) {
  switch (n) {
    case 2:
    case 10:
      return (
        Array.from(
          { length: 5 },
          (_, i) => `<ellipse cx="0" cy="-20" rx="13" ry="24" transform="rotate(${i * 72})"/>`,
        ).join('') + '<circle r="10" fill="#faf6ea"/>'
      );
    case 4:
    case 6:
      return '<path d="M0 -42 L36 0 L0 42 L-36 0 Z" fill="none" stroke-width="9"/>';
    case 7:
      return '<path d="M0 35 C-70 -8 -25 -65 0 -28 C25 -65 70 -8 0 35Z"/>';
    case 8:
    case 15:
      return '<rect x="-32" y="-32" width="64" height="64" rx="7" fill="none" stroke-width="12"/>';
    case 9:
      return '<ellipse rx="25" ry="40" fill="none" stroke-width="10"/>';
    case 13:
      return '<path d="M0 0 C-70 -65 -60 55 0 0 C70 -65 60 55 0 0 M0 0 L-18 40 M0 0 L18 40" fill="none" stroke-width="9"/>';
    case 5:
    case 12:
    case 18:
      return '<path d="M0 -40 L28 0 L0 42 L-28 0Z"/><path d="M0 -32 L0 32 M-22 0 L22 0" stroke="#fff" stroke-opacity=".65" stroke-width="2"/>';
    case 3:
      return '<path d="M-28 -15 A33 33 0 1 0 28 -15" fill="none" stroke-width="12"/>';
    case 16:
      return '<ellipse rx="17" ry="33"/><circle cy="-42" r="8"/>';
    case 17:
      return '<path d="M-35 -24H35M-35 0H35M-35 24H35" stroke-width="10"/>';
    case 14:
      return '<circle r="34" fill="none" stroke-width="9"/><circle r="17" fill="#f8f4e9" stroke-width="4"/>';
    default:
      return '<circle r="28" fill="none" stroke-width="12"/>';
  }
}
const manifest: Record<string, string> = {};
for (const p of fixtureProducts) {
  if (p.id === 'E12') {
    const source = await readFile(new URL('sources/E12-chandelier.png', directory));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="white"/><image x="24" y="24" width="464" height="464" href="data:image/png;base64,${source.toString('base64')}"/></svg>`;
    await writeFile(new URL('E12.svg', directory), svg + '\n');
    await sharp(Buffer.from(svg)).png().toFile(new URL('E12.png', directory).pathname);
    manifest[p.imageUrl] = p.id;
    continue;
  }
  const n = Number(p.id.slice(1));
  const colors =
    p.color === 'gold'
      ? ['#8d6221', '#ffecb0', '#bd8c39']
      : p.color === 'pink'
        ? ['#97594b', '#fbd6c4', '#ba8273']
        : p.color === 'black'
          ? ['#171b22', '#69717c', '#252c35']
          : ['#647784', '#f8ffff', '#91a1ad'];
  const m = motif(n);
  let drawing = '';
  if (p.category === 'earrings')
    drawing = [170, 342]
      .map(
        (x) =>
          `<g transform="translate(${x} 264)"><circle cy="-90" r="10"/><path d="M0 -80V-42" fill="none" stroke-width="5"/><g transform="scale(${n === 5 || n === 6 ? 1.4 : 1})">${m}</g></g>`,
      )
      .join('');
  if (p.category === 'necklaces')
    drawing = `<path d="M126 104 C100 346 190 318 256 353 C322 318 412 346 386 104" fill="none" stroke-width="7"/><path d="M132 104 C108 331 194 310 256 345 C318 310 404 331 380 104" fill="none" stroke-width="2" stroke="#fff"/><g transform="translate(256 363) scale(.8)">${m}</g>`;
  if (p.category === 'rings')
    drawing = `<ellipse cx="256" cy="296" rx="89" ry="108" fill="none" stroke-width="${n === 15 ? 27 : 18}"/><ellipse cx="256" cy="296" rx="82" ry="101" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/><g transform="translate(256 188) scale(.9)">${m}</g>`;
  if (p.category === 'watches')
    drawing = `<rect x="213" y="66" width="86" height="380" rx="23" stroke-width="5"/>${Array.from({ length: 12 }, (_, i) => `<path d="M218 ${82 + i * 30}H294" stroke="#33414a" stroke-opacity=".3" stroke-width="2"/>`).join('')}<rect x="342" y="241" width="14" height="27" rx="4"/>${n === 8 || n === 15 ? '<rect x="163" y="163" width="186" height="186" rx="25"/>' : '<circle cx="256" cy="256" r="96"/>'}<circle cx="256" cy="256" r="80" fill="#f9f7ef" stroke-width="3"/>${Array.from({ length: 12 }, (_, i) => `<path d="M256 188V197" transform="rotate(${i * 30} 256 256)" stroke="#42544d" stroke-width="3"/>`).join('')}<g transform="translate(256 278) scale(.2)" opacity=".65">${m}</g><path d="M220 222L256 256L289 239" fill="none" stroke="#293e35" stroke-width="6" stroke-linecap="round"/><circle cx="256" cy="256" r="5" fill="#293e35"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="metal" x1="0" x2="1" y2=".6"><stop stop-color="${colors[0]}"/><stop offset=".42" stop-color="${colors[1]}"/><stop offset=".7" stop-color="${colors[2]}"/><stop offset="1" stop-color="${colors[0]}"/></linearGradient><radialGradient id="bg"><stop stop-color="#fffefb"/><stop offset="1" stop-color="#eae7df"/></radialGradient></defs><rect width="512" height="512" fill="url(#bg)"/><ellipse cx="256" cy="452" rx="125" ry="9" fill="#344437" opacity=".08"/><g fill="url(#metal)" stroke="url(#metal)" stroke-width="2" stroke-linejoin="round">${drawing}</g></svg>`;
  await writeFile(new URL(`${p.id}.svg`, directory), svg + '\n');
  await sharp(Buffer.from(svg))
    .png()
    .toFile(new URL(`${p.id}.png`, directory).pathname);
  manifest[p.imageUrl] = p.id;
}
await writeFile(
  new URL('../apps/mobile/src/catalog-assets.ts', import.meta.url),
  `/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static image imports. */\n// Generated by scripts/generate-catalog-art.mts. Static requires let Metro bundle offline assets.\nexport const catalogAssets: Record<string, number> = {\n${Object.entries(
    manifest,
  )
    .map(([url, id]) => `  '${url}': require('../assets/catalog/${id}.png') as number,`)
    .join('\n')}\n};\n`,
);
