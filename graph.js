// Карта связей. Все люди истории одним графом: главные, NPC из «Людей», малыш из Зёрнышка.
// Линии — по отношениям (любовь, близость, доверие, напряжение, ревность; Horae и «отношение к героине» у NPC),
// толщина — сила; погибшие — серым, пропавшие — пунктиром. Раскладка запоминается, тап по лицу — его карточка.

let A = null;
export function initGraph(api) { A = api; }

const esc = (v) => A.esc(v);
const W = 1000, H = 760;

const KIND = {
    love: ['любовь', '#d9687b', ''],
    close: ['близость', '#eab3bc', ''],
    trust: ['доверие', '#8fc3d6', ''],
    tension: ['напряжение', '#e9a46a', '7 6'],
    jealous: ['ревность', '#c9c46a', '2 6'],
    hostile: ['вражда', '#b04a4a', '10 5'],
    family: ['семья', '#e7c77a', ''],
    known: ['знакомы', '#8a7d76', '3 5'],
};

function M() {
    const cm = A.chatMeta();
    if (!cm.graph || typeof cm.graph !== 'object') cm.graph = {};
    if (!cm.graph.pos || typeof cm.graph.pos !== 'object') cm.graph.pos = {};
    return cm.graph;
}

const HOSTILE = /враг|ненавид|угрож|охот|убить|месть|соперни|презира/i;
const WARM = /друг|люб|предан|уваж|довер|забот|защищ|восхищ|обожа/i;

function pairKind(p) {
    const s = (k) => Number(p[k]) || 0;
    if (s('desire') >= 55 || (s('closeness') >= 70 && s('desire') >= 40)) return ['love', (s('closeness') + s('desire')) / 2];
    if (s('tension') >= 60 && s('tension') > s('closeness')) return ['tension', s('tension')];
    if (s('jealousy') >= 50) return ['jealous', s('jealousy')];
    if (s('closeness') >= 55) return ['close', s('closeness')];
    if (s('trust') >= 60) return ['trust', s('trust')];
    if (s('tension') >= 45) return ['tension', s('tension')];
    return ['known', 25];
}

/** Узлы и связи. */
export function graphData() {
    const nodes = [];
    const idOf = new Map();
    const add = (n) => { const k = A.norm(A.canonName(n.name)); if (!k || idOf.has(k)) return idOf.get(k); n.id = `n${nodes.length}`; nodes.push(n); idOf.set(k, n.id); return n.id; };
    const find = (name) => idOf.get(A.norm(A.canonName(name))) || null;
    const user = A.canonName(A.ctx().name1);
    if (user) add({ name: user, kind: 'main', me: true, img: A.avatarUrl(user) });
    for (const n of A.groupMembers()) add({ name: A.canonName(n), kind: 'main', img: A.avatarUrl(n) });
    let people = [];
    try { people = A.peopleList?.() || []; } catch { /* */ }
    for (const x of people) {
        if (!x?.name) continue;
        const st = A.chatMeta().people?.status?.[x.id]?.v || x.status || 'active';
        add({ name: x.name, kind: 'npc', ref: x.id, img: x.img || '', group: x.group || '', dead: st === 'dead', missing: st === 'missing', toUser: x.toUser || '' });
    }
    // малыш из Зёрнышка
    const kids = A.ctx().chatMetadata?.zernyshko?.kids || [];
    for (const k of kids) {
        if (!k?.id) continue;
        const name = k.name || (k.stage === 'preg' ? 'Зёрнышко' : 'Малыш');
        add({ name: `${name}#${k.id}`, label: name, kind: 'kid', ref: k.id, img: k.photo || k.avatar || '', preg: k.stage === 'preg' });
    }
    const edges = [];
    const seen = new Set();
    const link = (a, b, kind, w, label = '') => {
        if (!a || !b || a === b) return;
        const key = [a, b].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        edges.push({ a, b, kind, w: Math.max(1, Math.min(100, w)), label: label || KIND[kind][0] });
    };
    for (const k of kids) {
        const id = find(`${k.name || (k.stage === 'preg' ? 'Зёрнышко' : 'Малыш')}#${k.id}`);
        if (k.mother) link(id, find(k.mother), 'family', 70, k.stage === 'preg' ? 'носит' : 'мама');
        if (k.father) link(id, find(k.father), 'family', 70, 'папа');
    }
    // отношения героев (шкалы Летописца)
    let pairs = {};
    try { pairs = A.relationsState(); } catch { /* */ }
    for (const p of Object.values(pairs)) {
        const a = find(p.a), b = find(p.b);
        if (!a || !b) continue;
        const [kind, w] = pairKind(p);
        link(a, b, kind, w);
    }
    // Horae: «отношения» с подписью
    let hr = [];
    try { hr = A.horaeRelationships?.() || []; } catch { /* */ }
    for (const r of hr) {
        let a = find(r.from), b = find(r.to);
        if (!a && r.from && !A.sameName(r.from, user)) a = add({ name: A.canonName(r.from), kind: 'npc', img: A.npcImg?.(r.from) || '' });
        if (!b && r.to && !A.sameName(r.to, user)) b = add({ name: A.canonName(r.to), kind: 'npc', img: A.npcImg?.(r.to) || '' });
        const t = `${r.type || ''} ${r.note || ''}`;
        link(a, b, HOSTILE.test(t) ? 'hostile' : /семь|брат|сестр|мать|отец|сын|дочь|муж|жена/i.test(t) ? 'family' : WARM.test(t) ? 'trust' : 'known', 40, A.cut(String(r.type || '').trim(), 18));
    }
    // NPC → героиня по их карточке
    const me = find(user);
    for (const nd of nodes) {
        if (nd.kind !== 'npc' || !nd.toUser || !me) continue;
        link(nd.id, me, HOSTILE.test(nd.toUser) ? 'hostile' : WARM.test(nd.toUser) ? 'trust' : 'known', 35, A.cut(nd.toUser.split(/[.;,]/)[0], 18));
    }
    // NPC без связей, но из одного круга — к первому главному, кто с ними связан по кругу, нет: оставим свободными
    return { nodes, edges };
}

// ───────────── раскладка (пружины) ─────────────

function hashN(t) { let h = 0; for (const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0) / 4294967295; }

function layout(nodes, edges) {
    const mem = M().pos;
    const P = {};
    nodes.forEach((n, k) => {
        const m = mem[A.norm(n.name)];
        if (m) { P[n.id] = { x: m[0] * W, y: m[1] * H, vx: 0, vy: 0 }; return; }
        const ring = n.kind === 'main' ? 150 : 330;
        const ang = (n.me ? 0 : hashN(n.name) * Math.PI * 2) + k * 0.3;
        P[n.id] = { x: W / 2 + (n.me ? 0 : Math.cos(ang) * ring), y: H / 2 + (n.me ? 0 : Math.sin(ang) * ring * 0.8), vx: 0, vy: 0 };
    });
    const fresh = nodes.some(n => !mem[A.norm(n.name)]);
    // новые встают среди старых, старые не сдвигаются (если все новые — раскладка с нуля)
    const pinned = new Set(nodes.filter(n => mem[A.norm(n.name)]).map(n => n.id));
    const iters = fresh ? 360 : 0;   // все уже стоят — не двигаем (граф не прыгает); «Разложить заново» — с нуля
    const k = Math.sqrt((W * H) / Math.max(4, nodes.length)) * 0.62;
    for (let it = 0; it < iters; it++) {
        const t = 1 - it / iters;
        for (const a of nodes) for (const b of nodes) {
            if (a === b) continue;
            const pa = P[a.id], pb = P[b.id];
            let dx = pa.x - pb.x, dy = pa.y - pb.y;
            let d = Math.hypot(dx, dy) || 0.01;
            const f = (k * k) / d / 60;
            pa.vx += (dx / d) * f; pa.vy += (dy / d) * f;
        }
        for (const e of edges) {
            const pa = P[e.a], pb = P[e.b];
            const dx = pa.x - pb.x, dy = pa.y - pb.y;
            const d = Math.hypot(dx, dy) || 0.01;
            const f = (d * d) / k / 80 * (0.6 + e.w / 120);
            pa.vx -= (dx / d) * f; pa.vy -= (dy / d) * f;
            pb.vx += (dx / d) * f; pb.vy += (dy / d) * f;
        }
        for (const n of nodes) {
            const p = P[n.id];
            if (pinned.has(n.id)) { p.vx = 0; p.vy = 0; continue; }
            const g = n.me ? 0.08 : n.kind === 'main' ? 0.03 : 0.012;
            p.vx += (W / 2 - p.x) * g; p.vy += (H / 2 - p.y) * g;
            const lim = 18 * t + 1;
            p.x += Math.max(-lim, Math.min(lim, p.vx)); p.y += Math.max(-lim, Math.min(lim, p.vy));
            p.vx *= 0.5; p.vy *= 0.5;
            p.x = Math.max(70, Math.min(W - 70, p.x)); p.y = Math.max(60, Math.min(H - 70, p.y));
        }
    }
    for (const n of nodes) mem[A.norm(n.name)] = [+(P[n.id].x / W).toFixed(4), +(P[n.id].y / H).toFixed(4)];
    return P;
}

// ───────────── вид ─────────────

export function graphHtml(focus = '') {
    if (!A?.hasChat?.()) return '';
    const { nodes, edges } = graphData();
    if (nodes.length < 2) return '<div class="lf-empty small">Связей пока нет — граф соберётся из отношений, Horae и «Людей».</div>';
    const P = layout(nodes, edges);
    A.saveMeta();
    const fid = focus ? nodes.find(n => A.sameName(n.name, focus))?.id : '';
    const on = (e) => !fid || e.a === fid || e.b === fid;
    const lines = edges.map(e => {
        const [label, color, dash] = KIND[e.kind];
        const a = P[e.a], b = P[e.b];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dead = nodes.find(n => n.id === e.a)?.dead || nodes.find(n => n.id === e.b)?.dead;
        return `<g class="lf-gr-e${on(e) ? '' : ' dim'}${dead ? ' dead' : ''}">
            <line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${dead ? '#6b6160' : color}" stroke-width="${(1.5 + e.w / 22).toFixed(1)}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>
            ${on(e) && fid ? `<text x="${mx.toFixed(1)}" y="${(my - 6).toFixed(1)}" class="lf-gr-l">${esc(e.label || label)}</text>` : ''}
        </g>`;
    }).join('');
    const nodeHtml = nodes.map(n => {
        const p = P[n.id];
        const r = n.me ? 46 : n.kind === 'main' ? 40 : n.kind === 'kid' ? 32 : 30;
        const cls = `lf-gr-n k-${n.kind}${n.dead ? ' dead' : ''}${n.missing ? ' missing' : ''}${fid && n.id === fid ? ' focus' : ''}${fid && n.id !== fid && !edges.some(e => (e.a === fid && e.b === n.id) || (e.b === fid && e.a === n.id)) ? ' dim' : ''}`;
        const label = n.label || A.shortName(n.name);
        const img = n.img ? `<clipPath id="lfc-${n.id}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"/></clipPath><image href="${esc(n.img)}" x="${(p.x - r).toFixed(1)}" y="${(p.y - r).toFixed(1)}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#lfc-${n.id})"/>`
            : `<text x="${p.x.toFixed(1)}" y="${(p.y + r * 0.35).toFixed(1)}" class="lf-gr-ini" font-size="${r}">${n.kind === 'kid' ? '✦' : esc(String(label).charAt(0))}</text>`;
        return `<g class="${cls}" data-act="gr-node" data-kind="${n.kind}" data-name="${esc(n.name)}" data-ref="${esc(n.ref || '')}">
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r + 3}" class="lf-gr-ring"/>
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" class="lf-gr-bg"/>
            ${img}
            <text x="${p.x.toFixed(1)}" y="${(p.y + r + 20).toFixed(1)}" class="lf-gr-t">${n.dead ? '† ' : ''}${esc(label)}</text>
            ${n.group ? `<text x="${p.x.toFixed(1)}" y="${(p.y + r + 36).toFixed(1)}" class="lf-gr-g">${esc(A.cut(n.group, 16))}</text>` : ''}
        </g>`;
    }).join('');
    const used = [...new Set(edges.map(e => e.kind))];
    return `<div class="lf-graph"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${lines}${nodeHtml}</svg></div>
    <div class="lf-gr-legend">${used.map(k => `<span><i style="background:${KIND[k][1]}"></i>${KIND[k][0]}</span>`).join('')}</div>
    <div class="lf-actions tight"><button class="lf-btn ghost" data-act="gr-reset">${A.icon('refresh')} Разложить заново</button></div>
    <div class="lf-hint">Линии — из шкал отношений, Horae и «отношения к героине» у людей. ${fid ? 'Подсвечены связи выбранного; ' : ''}тап по лицу — его карточка.</div>`;
}

export function graphClick(act, el) {
    if (!act.startsWith('gr-')) return false;
    if (act === 'gr-reset') { M().pos = {}; A.saveMeta(); A.render(); return true; }
    if (act === 'gr-node') {
        const kind = el.dataset.kind;
        if (kind === 'main') { A.ui.who = el.dataset.name; A.ui.pTab = 'rel'; A.openHub('person'); return true; }
        if (kind === 'kid') { A.ui.who = `zr:${el.dataset.ref}`; A.openHub('person'); return true; }
        if (kind === 'npc' && el.dataset.ref) { A.ui.npc = el.dataset.ref; A.openHub('people'); return true; }
        return true;
    }
    return false;
}
