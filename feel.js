// Экран чувствует тебя. Тело твоей персоны — эффектами поверх чата, тихо и по краям, читать не мешают:
//  • ранена — красная виньетка, чем тяжелее, тем гуще; тяжёлая — ещё и пульс;
//  • Камни гудят — по краям лёгкая рябь света; приступ — свет мерцает и сбоит;
//  • вымоталась (так её видят в последнем ответе) — края плывут;
//  • беременность с ~18 недель — иногда снизу толчок малыша (чем больше срок, тем чаще).
// Включается в пульт → Вид → «Экран». Без анимаций, если в системе включено «уменьшить движение».

import { pregnancies } from './zr.js';

let A = null;
let kickT = null;

export function initFeel(api) {
    A = api;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) applyFeel(); });
}

function cfg() {
    const s = A.settings();
    if (!s.feel || typeof s.feel !== 'object') s.feel = {};
    if (s.feel.on === undefined) s.feel.on = true;
    return s.feel;
}
export const feelOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;
export function toggleFeel() { cfg().on = !(cfg().on !== false); A.saveSettings(); applyFeel(); return cfg().on; }

/** Что сейчас с твоей персоной: { hurt: 0–4, stones: calm|hum|attack|'', tired, week }. */
export function feelState() {
    const out = { hurt: 0, stones: '', tired: false, week: 0 };
    if (!A?.hasChat?.()) return out;
    const U = A.canonName(A.ctx().name1);
    try { out.hurt = A.hurtLevel?.(U) || 0; } catch { /* */ }
    try { const s = A.stonesNow?.(); if (s && A.sameName(s.who, U)) out.stones = s.mode; } catch { /* */ }
    try {
        const e = A.chronOf(A.lastAiIndex());
        const em = Object.entries(e?.emo || {}).find(([n]) => A.sameName(n, U))?.[1];
        out.tired = em === 'tired';
    } catch { /* */ }
    try { const p = pregnancies().find(x => A.sameName(x.mother, U)); out.week = p?.ow || 0; } catch { /* */ }
    return out;
}

function layer() {
    let el = document.getElementById('lf-feel');
    if (!el) {
        el = document.createElement('div');
        el.id = 'lf-feel';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<i class="lf-feel-v"></i><i class="lf-feel-s"></i><i class="lf-feel-t"></i><i class="lf-feel-k"></i>';
        document.body.append(el);
    }
    return el;
}

/** Пересчитать эффекты (после поста, при смене чата, по таймеру). */
export function applyFeel() {
    if (!A) return;
    const on = feelOn() && A.hasChat?.();
    const st = on ? feelState() : { hurt: 0, stones: '', tired: false, week: 0 };
    const el = on ? layer() : document.getElementById('lf-feel');
    if (!el) return;
    const cls = [
        st.hurt >= 1 ? `hurt${Math.min(4, st.hurt)}` : '',
        st.stones === 'attack' ? 'attack' : st.stones === 'hum' ? 'hum' : '',
        st.tired ? 'tired' : '',
    ].filter(Boolean);
    el.className = cls.join(' ');
    el.dataset.week = String(st.week || 0);
    clearTimeout(kickT);
    if (on && st.week >= 18) scheduleKick(st.week);
}

function scheduleKick(week) {
    // 18 недель — раз в пару минут, к 36 — почти каждые полминуты
    const k = Math.min(1, Math.max(0, (week - 18) / 18));
    const base = 150000 - k * 115000;
    kickT = setTimeout(() => {
        try {
            if (!document.hidden && feelOn()) {
                const el = document.getElementById('lf-feel');
                const x = el?.querySelector('.lf-feel-k');
                if (x) {
                    x.style.left = `${25 + Math.random() * 50}%`;
                    x.classList.remove('go');
                    void x.offsetWidth;
                    x.classList.add('go');
                }
            }
        } catch { /* */ }
        scheduleKick(week);
    }, base * (0.6 + Math.random() * 0.8));
}
