// Альбом моментов: ключевые моменты пары (из «Связей») — полароидами. Фото — картинка у этого поста
// (SLAY, кадр, деталь), своя загруженная или «Снять» — Гардероб/SLAY рисует моментальный снимок с лицами пары.
// Подпись от руки, дата истории и цитата из поста; тап по фото — во весь экран, по подписи — к посту.

let A = null;
export function initAlbum(api) { A = api; }

const esc = (v) => A.esc(v);

function M() {
    const cm = A.chatMeta();
    if (!cm.album || typeof cm.album !== 'object') cm.album = {};
    return cm.album;
}

const pk = (a, b) => [A.canonName(a), A.canonName(b)].sort().join('|');
export const momentKey = (a, b, m) => `${pk(a, b)}|${m.mes}|${A.hash(m.text || '')}`;

/** Цитата из поста: первая прямая речь, иначе первая фраза. */
function quoteOf(mes) {
    const t = A.plainText(A.chatArr()[mes]?.mes || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const q = t.match(/«([^»]{6,140})»/) || t.match(/(?:^|\s)[—–-]\s*([^—–\n]{6,140}?)(?:[,.!?…]\s*[—–]|$)/) || t.match(/"([^"]{6,140})"/);
    const s = q ? q[1] : (t.match(/^[^.!?…]{8,140}[.!?…]/) || [t.slice(0, 120)])[0];
    return A.cut(s.trim(), 120);
}

function photoOf(a, b, m) {
    const k = momentKey(a, b, m);
    const own = M()[k]?.img;
    if (own) return { src: own, own: true };
    const near = A.imagesBetween(A.imgs(), m.mes - 1, m.mes + 2);
    if (near.length) return { src: near[near.length - 1].src, own: false };
    const det = A.chronOf(m.mes)?.detImg;
    if (det) return { src: det, own: false, det: true };
    return null;
}

const tilt = (k) => { let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((h >>> 0) % 7) - 3; };

export function albumHtml(who, other, moments) {
    if (!moments?.length) return '<div class="lf-empty small">Моментов пары пока нет — Летописец отмечает их сам (первый поцелуй, ключ от квартиры, ссора и примирение).</div>';
    const list = [...moments].reverse().slice(0, 40);
    return `<div class="lf-album">${list.map(m => {
        const k = momentKey(who, other, m);
        const ph = photoOf(who, other, m);
        const q = quoteOf(m.mes);
        const date = m.ts?.story_date || '';
        return `<figure class="lf-pol" style="--tilt:${tilt(k) * 0.7}deg">
            <div class="lf-pol-ph${ph ? '' : ' empty'}"${ph ? ` style="background-image:url('${esc(ph.src)}')" data-act="lightbox" data-src="${esc(ph.src)}" data-mes="${m.mes}"` : ''}>
                ${ph ? '' : `<button class="lf-pol-shoot" data-act="al-shoot" data-k="${esc(k)}" data-mes="${m.mes}" data-a="${esc(who)}" data-b="${esc(other)}" data-t="${esc(m.text)}">${A.icon('camera')}<span>Снять</span></button>`}
            </div>
            <figcaption data-act="jump" data-mes="${m.mes}">
                <b>${esc(m.text)}</b>
                ${q ? `<q>${esc(q)}</q>` : ''}
                <small>${esc(date)}${date ? ' · ' : ''}#${m.mes}</small>
            </figcaption>
            <div class="lf-pol-tools">
                <button data-act="al-shoot" data-k="${esc(k)}" data-mes="${m.mes}" data-a="${esc(who)}" data-b="${esc(other)}" data-t="${esc(m.text)}" title="Снять заново">${A.icon('camera')}</button>
                <label title="Своё фото">${A.icon('upload')}<input type="file" accept="image/*" data-file="album" data-k="${esc(k)}" hidden></label>
                ${ph?.own ? `<button data-act="al-clear" data-k="${esc(k)}" title="Убрать фото">${A.icon('x')}</button>` : ''}
            </div>
        </figure>`;
    }).join('')}</div>`;
}

export function albumSetImg(k, path) { if (!k) return; M()[k] = { ...(M()[k] || {}), img: path }; A.saveMeta(); }

async function shoot(el) {
    const { k, mes, a, b, t } = el.dataset;
    const m = A.chatArr()[Number(mes)];
    const meta = m?.horae_meta || {};
    const refs = [];
    for (const n of [a, b]) { try { const r = await A.faceRef(n, 512); if (r) refs.push(r); } catch { /* без лица */ } }
    const scene = A.cut(A.plainText(m?.mes || ''), 600);
    const prompt = `Candid instant-film photo (Polaroid look): ${t}. ${A.shortName(A.canonName(a))} and ${A.shortName(A.canonName(b))} — the two people from the reference images (keep their faces exactly).${meta.scene?.location ? ` Place: ${meta.scene.location}.` : ''}${meta.timestamp?.story_time ? ` Time: ${meta.timestamp.story_time}.` : ''}
Moment from the story (for mood, do not draw text): ${scene}
Soft natural light, slight film grain, warm faded colours, intimate snapshot, square framing. No text, no letters, no white border.`;
    const img = await A.drawPicture(prompt, { aspect: '1:1', max: 900, refs, prefix: 'life_pol' });
    albumSetImg(k, img);
}

export async function albumClick(act, el) {
    if (!act.startsWith('al-')) return false;
    if (act === 'al-shoot') {
        await A.withBusy(el, async () => { await shoot(el); }, '');
        A.render();
        return true;
    }
    if (act === 'al-clear') { delete M()[el.dataset.k]?.img; A.saveMeta(); A.render(); return true; }
    return false;
}
