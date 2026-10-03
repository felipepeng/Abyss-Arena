import { NAV } from "../config/nav";
import { UNSET } from "./body";
import type { Body } from "./body";
import type { World } from "./world";
import type { Grid } from "../world/grid";

// Navegação dos inimigos. Um mapa de distâncias (busca em largura) a partir do bloco do jogador
// diz, de qualquer bloco aberto, para que vizinho andar para chegar nele contornando a rocha.
//
// Só entra em cena quando a linha reta está bloqueada: com o caminho livre o inimigo anda como
// sempre (e a paridade com o protótipo, que roda em arena aberta, fica intacta). Quando está
// bloqueado, o inimigo olha à frente pelo caminho e vai ao ponto mais longe que ainda enxerga,
// o que dá uma curva suave em vez de zigue-zague de bloco em bloco.
//
// Tudo é preenchido em vetores criados uma vez por mundo: o passo não aloca.

const UNREACHED = 32767;

/** Vizinhos em 8 direções. As diagonais só valem se os dois blocos ao lado estiverem abertos. */
const DX = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const DY = [0, 0, 1, -1, 1, -1, 1, -1] as const;

export interface Nav {
  /** Passos até o jogador, por bloco; `UNREACHED` onde não chega. */
  readonly dist: Int16Array;
  /** 1 onde o bloco é água com `clearanceCells` de folga em volta. */
  readonly open: Uint8Array;
  readonly queue: Int32Array;
  /** Versão da grade e bloco do jogador do último cálculo (para só refazer quando mudar). */
  gridVersion: number;
  goalCell: number;
  /** Saída de `pathTarget`: para onde ir. Nasce NaN para o campo continuar double (ver UNSET). */
  wx: number;
  wy: number;
  /** Segmento em teste (início, fim e meia largura): campos, e não argumentos, para não empacotar números. */
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  hw: number;
  /** Saída de `pathTarget`: verdadeiro quando o caminho reto estava bloqueado e `wx, wy` é um desvio. */
  detour: boolean;
}

export function createNav(grid: Grid): Nav {
  const n = grid.cols * grid.rows;
  return {
    dist: new Int16Array(n).fill(UNREACHED),
    open: new Uint8Array(n),
    queue: new Int32Array(n),
    gridVersion: -1,
    goalCell: -1,
    wx: UNSET,
    wy: UNSET,
    sx: UNSET,
    sy: UNSET,
    ex: UNSET,
    ey: UNSET,
    hw: UNSET,
    detour: false,
  };
}

/** Refaz o mapa de distâncias se a rocha mudou ou o jogador trocou de bloco. */
export function updateNav(w: World): void {
  const nav = w.nav;
  const g = w.grid;
  const p = w.player;
  const cx = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.tile)));
  const cy = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.tile)));
  const goal = cy * g.cols + cx;
  if (nav.gridVersion === g.version && nav.goalCell === goal) return;
  if (nav.gridVersion !== g.version) computeOpen(g, nav);
  nav.gridVersion = g.version;
  nav.goalCell = goal;
  computeDist(g, nav, cx, cy);
}

function computeOpen(g: Grid, nav: Nav): void {
  const c = NAV.clearanceCells;
  for (let y = 0; y < g.rows; y++) {
    for (let x = 0; x < g.cols; x++) {
      let ok = 1;
      for (let oy = -c; oy <= c && ok; oy++) {
        for (let ox = -c; ox <= c; ox++) {
          if (g.isSolid(x + ox, y + oy)) {
            ok = 0;
            break;
          }
        }
      }
      nav.open[y * g.cols + x] = ok;
    }
  }
}

function computeDist(g: Grid, nav: Nav, gx: number, gy: number): void {
  const { dist, open, queue } = nav;
  const cols = g.cols;
  dist.fill(UNREACHED);
  let head = 0;
  let tail = 0;
  // parte do bloco do jogador; se ele estiver colado na rocha (bloco não aberto), parte dos
  // blocos abertos mais próximos, todos com distância 0
  if (open[gy * cols + gx]) {
    dist[gy * cols + gx] = 0;
    queue[tail++] = gy * cols + gx;
  } else {
    const r = NAV.seedRadiusCells;
    for (let y = gy - r; y <= gy + r; y++) {
      for (let x = gx - r; x <= gx + r; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= g.rows) continue;
        const i = y * cols + x;
        if (!open[i]) continue;
        dist[i] = 0;
        queue[tail++] = i;
      }
    }
  }
  while (head < tail) {
    const i = queue[head++] as number;
    const x = i % cols;
    const y = (i - x) / cols;
    const d = (dist[i] as number) + 1;
    for (let k = 0; k < 8; k++) {
      const nx = x + (DX[k] as number);
      const ny = y + (DY[k] as number);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= g.rows) continue;
      const j = ny * cols + nx;
      if (!open[j] || (dist[j] as number) <= d) continue;
      // sem cortar quina: uma diagonal precisa dos dois blocos ao lado abertos
      if (k >= 4 && (!open[y * cols + nx] || !open[ny * cols + x])) continue;
      dist[j] = d;
      queue[tail++] = j;
    }
  }
}

/**
 * O segmento de (sx, sy) a (ex, ey), com meia largura `hw`, está livre? Três raios paralelos: o do
 * centro e os dois das bordas do corpo. Lê tudo de `nav` (e não de argumentos) para o passo não
 * alocar: o V8 empacota números decimais passados a funções que ele não embute.
 */
function segmentClear(g: Grid, nav: Nav): boolean {
  const x0 = nav.sx;
  const y0 = nav.sy;
  const dx = nav.ex - x0;
  const dy = nav.ey - y0;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return true;
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy * nav.hw;
  const ny = ux * nav.hw;
  const step = NAV.stepPx;
  for (let t = 0; t <= d; t += step) {
    const px = x0 + ux * t;
    const py = y0 + uy * t;
    if (g.isSolidAt(px, py) || g.isSolidAt(px + nx, py + ny) || g.isSolidAt(px - nx, py - ny)) return false;
  }
  return !g.isSolidAt(nav.ex, nav.ey);
}

/**
 * Para onde o corpo deve ir para chegar ao jogador. Escreve em `w.nav`: se o caminho reto até ele
 * está livre, `detour` é falso e `wx, wy` é o próprio jogador (o inimigo anda como sempre, e cada
 * um usa o ponto que quiser: a órbita, o deslocamento); se está bloqueado, `detour` é verdadeiro e
 * `wx, wy` é um ponto de desvio ao longo do mapa de distâncias. Sem caminho conhecido (um bolsão
 * fechado), `detour` é verdadeiro e `wx, wy` continua sendo o jogador.
 */
export function pathTarget(w: World, e: Body): void {
  const nav = w.nav;
  const g = w.grid;
  const p = w.player;
  nav.wx = p.x;
  nav.wy = p.y;
  nav.detour = false;
  nav.hw = e.collR + NAV.bodyMarginPx;
  nav.sx = e.x;
  nav.sy = e.y;
  nav.ex = p.x;
  nav.ey = p.y;
  if (segmentClear(g, nav)) return;
  nav.detour = true;

  const { dist, open } = nav;
  const cols = g.cols;
  const t = g.tile;
  let cx = Math.min(cols - 1, Math.max(0, Math.floor(e.x / t)));
  let cy = Math.min(g.rows - 1, Math.max(0, Math.floor(e.y / t)));
  let found = false;
  for (let step = 0; step < NAV.lookAheadCells; step++) {
    // o próximo bloco é o vizinho de menor distância (e menor que a daqui, se aqui tem distância)
    let bestD = dist[cy * cols + cx] as number;
    let bx = -1;
    let by = -1;
    for (let k = 0; k < 8; k++) {
      const nx = cx + (DX[k] as number);
      const ny = cy + (DY[k] as number);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= g.rows) continue;
      const d = dist[ny * cols + nx] as number;
      if (d >= bestD) continue;
      if (k >= 4 && (!open[cy * cols + nx] || !open[ny * cols + cx])) continue;
      bestD = d;
      bx = nx;
      by = ny;
    }
    if (bx < 0) break;
    cx = bx;
    cy = by;
    // o primeiro bloco sempre serve (é para onde o mapa manda); os seguintes só se ainda se vê
    nav.ex = (cx + 0.5) * t;
    nav.ey = (cy + 0.5) * t;
    if (!found || segmentClear(g, nav)) {
      nav.wx = nav.ex;
      nav.wy = nav.ey;
      found = true;
    }
    if (bestD === 0) break;
  }
}
