// ✦ LIFE — визуальный хаб для SillyTavern поверх Horae.
// Время, место, одежду, вещи и события ведёт Horae (поле horae_meta в каждом сообщении).
// Летописец (дешёвая модель после каждого поста) чинит за Horae инвентарь, ведёт отношения, тайны и названия глав.
// Life режет общий чат на главы-комнаты только на экране, рисует карты районов и даёт кнопки.

import { icon, CANDLE, guessPlaceIcon, PLACE_ICON_NAMES, iconName } from './icons.js';
import { initControl, applyTheme, openCC, refreshAvatars } from './control.js';
import { bank, bankNow, bankState, moneyView, autopay, payBill, payLoan, addBill, delBill } from './money.js';
import { chatImages, imageNear, imagesBetween, imagesWith, lightbox, playCut, periodOf, PERIODS, setSceneBg, Music, uploadTrack, resetImages } from './media.js';
import { initSim, simCfg, simChronOpts, simAfterPost, simPrompt, simClick, simSetPetImg, renderLife, renderPet, petsRowHtml, renderRoom, roomButton, renderRumors, simSceneHtml, itemHistoryHtml, initChipFor , lifeKey as simLifeKey } from './sim.js';
import { initErrors } from './errors.js';
import { peopleDedupe, peopleDropCards, peopleClaimEra, renderPeople, peopleClick, peoplePrompt, npcImg, peopleSetImg, findPerson, peopleList } from './people.js';
import { agendaClick, agendaCfgHtml, agendaUpdate } from './agenda.js';
import { initMood, MOOD_RULE, normalizeScene, moodPrompt, moodHtml, setMood, cycleIntim, moodNow, setTone, toggleIntimOpt, sceneLabel, cycleBond, setBondTone } from './mood.js';
import { initModes, MODES_KEY, MODES, modesOn, modesPrompt, modesHtml, toggleMode, armOnce, disarmOnce, syncBody } from './modes.js';
import { initTwists, twistPrompt, twistsHtml, twistClick, twistChron, twistAfterPost, armTwist, clearTwist, twistByWord, TWISTS } from './twists.js';
import { hurtLevel, initHurt, hurtPrompt, hurtChron, hurtAfterPost, hurtSceneHtml, hurtClick } from './hurt.js';
import { initDays, daysPrompt, daysAfterPost, daysHtml, daysClick, daysBrief, paintDateGuard } from './days.js';
import { initArcs, arcPrompt, arcOnce, arcChron, arcAfterPost, arcSceneHtml, arcClick } from './arcs.js';
import { initAlbum, albumHtml, albumClick, albumSetImg } from './album.js';
import { initEmo, emoChron, emoAfterPost, emoSrc, emoStripHtml, emoClick, emoSetImg, EMOS } from './emo.js';
import { initReply, replyReady, replyPrompt, replyChron, replyAfterPost, paintReply, replyClick, warm as replyWarm } from './reply.js';
import { initFresh, freshPrompt, freshAfterPost, freshHtml, freshClick } from './fresh.js';
import { initFrames, framesChron, framesAfterPost, paintFrame, frameRowHtml, frameClick, FRAMES } from './frames.js';
import { initWeather, updateWeather, cycleWx, wxLevel, wxLabel } from './weather.js';
import { initZr } from './zr.js';
import { initVoice, voicePrompt, voiceHtml, voiceRowHtml, voiceClick } from './voice.js';
import { initSlip, slipChron, slipAfterPost, paintSlip, slipClick, slipCfgHtml, slipInput, slipAuto, locate } from './slip.js';
import { initCal, calPrompt, calChron, calAfterPost, calHtml, calClick } from './cal.js';
import { initSkip, skipHtml, skipClick, skipInput } from './skip.js';
import { initStage, stagePrompt, stageChron, stageAfterPost, stageHtml, stageClick } from './stage.js';
import { initWhois, whereAll, whoAtPin, whoisHtml } from './whois.js';
import { initPush, push as pushBanner } from './push.js';
import { initGraph, graphHtml, graphClick } from './graph.js';
import { initBelly, bellyNote, bellyWardrobeHtml, bellyClick } from './belly.js';
import { initStance, stancePrompt, stanceChron, stanceAfterPost, stanceSceneHtml, stanceClick } from './stance.js';
import { initRitual, ritualPrompt, ritualChron, ritualAfterPost, ritualHtml, ritualClick } from './ritual.js';
import { initSteps, stepsPrompt, stepsChron, stepsAfterPost, stepsHtml, stepsClick } from './steps.js';
import { initSee, seeWarm, seeReady, seePrompt, paintSee, seeClick } from './see.js';
import { initSeason, seasonPrompt, applySeason, seasonHtml, seasonClick } from './season.js';
import { initTriggers, trigPrompt, trigChron, trigAfterPost, trigHtml, trigClick } from './triggers.js';
import { initShards, shardsPrompt, shardsChron, shardsAfterPost, shardsHtml, shardsClick } from './shards.js';
import { initHabits, habitsPrompt, habitsHtml, habitsClick } from './habits.js';
import { initCrowd, crowdPrompt, crowdSceneHtml, crowdClick } from './crowd.js';
import { initStones, stonesNow, stonesPrompt, stonesChron, stonesAfterPost, stonesHtml, stonesClick, stonesOwns } from './stones.js';
import { initEra, applyEra, eraHtml, eraClick } from './era.js';
import { initFix, paintFix, fixTap, fixClick, rewriteFor } from './fix.js';
import { initLore, coreRefresh } from './lore.js';
import { initSeed, seedApply } from './seed.js';
import { makeChronMemory } from './memory.js';
import { eraId, inEra, addEra } from './scope.js';
import { initCare, careHtml, careClick, careInput, statsHtml, promptHtml, backupAuto } from './care.js';
import { splitEvent } from './hsplit.js';
import { crossSame } from './names.js';
import { initOoc, oocChron, oocAfterPost, paintOoc, oocClick, oocHtml, oocInput, oocEnsure, coreOf, oocAuto } from './ooc.js';
import { initLang, langPrompt, langHtml, langInput, langClick } from './lang.js';
import { initFeel, applyFeel, feelOn, toggleFeel } from './feel.js';
import { initHand, paintHand, handHtml, handClick } from './hand.js';
import { initDuo, duoPrompt, duoSpeaker, paintDuo, duoSceneHtml, duoClick, duoCCHtml } from './duo.js';
import { initCall, callPrompt, callChron, callAfterPost, paintCall, callCfgHtml } from './call.js';
import { initEcho, echoAdd, paintEcho, echoHtml, echoClick, echoRecs } from './echo.js';
import { initRecs, addRecs, recsSheet, recsClick } from './recs.js';
import { initGuide, guideSheet } from './guide.js';
import { initDraft, paintDraft } from './draft.js';
import { calRecs } from './cal.js';
import { stanceRecs } from './stance.js';
import { ritualRecs } from './ritual.js';
import { stepsRecs } from './steps.js';
import { shardsRecs } from './shards.js';
import { trigRecs } from './triggers.js';
import { hurtRecs } from './hurt.js';
import { simRecs } from './sim.js';
import { innerRecs } from './inner.js';
import { replyRecs } from './reply.js';
import { initCanon, canonEnsure, canonClick } from './canon.js';
import { initHero, heroClick, heroInput, fameEnsure } from './hero.js';
import { makeAskJson } from './ask.js';
import { initArm, armPrompt, armChron, armAfterPost, armSceneHtml, armNote, armRecs, armClick, armCfgHtml } from './arm.js';
import { initDollhouse, dollhouseHtml, dhClick, dhDefault, dhRemember, dhHomeKey } from './dollhouse.js';
import { initHeroes, heroesPrompt, heroesChron, heroesAfterPost, heroesRecs, heroesHtml, heroesClick, heroesInput, heroNote } from './heroes.js';
import { initDrama, dramaPrompt, dramaSceneHtml, dramaClick } from './drama.js';
import { initRoute, estimate as routeEstimate, cached as routeCached, routeNote, routeHtml, routeSvg, routeClick } from './route.js';
import { initAmbient, update as ambUpdate, ambLabel, ambLevel, cycleAmb, smellPrompt, smellAfterPost, smellSceneHtml, ambClick } from './ambient.js';
import { initRecap, maybeShow as recapMaybe, markSeen as recapSeen, showRecap, recapCfgHtml, recapClick, recapInput } from './recap.js';
import { fmRescue, fmWatch, fmStatus } from './rescue.js';
import { initPress, renderPress, pressPrompt, pressClick } from './press.js';
import { initPlates, platesSync, platesPrompt } from './plates.js';
import { initCast, castPrompt } from './cast.js';
import { initKnock, knockClick, paintKnock, knockSceneHtml } from './knock.js';
import { initTidy, tidyMessage } from './tidy.js';
import { initMend, mendWanted, mendPost, mendLast, setMesText } from './mend.js';
import { initTaste, tastePrompt, tasteOnce, tasteChron, tasteAfterPost, paintTaste, tasteClick, tasteHtml, polish, tasteSnap, tasteEdited, tasteGenEnd, paintOocBar } from './taste.js';
import { initArt, onArtClick, artOnReceived, artTidy, paintArt, onArtPick } from './art.js';
import { initShots, paintShots, onShotClick, shoot as shootShot, styleChips, chatStyle, styleText, styleName, shotAct, SHOT_STYLES, shotsHeal } from './shots.js';
import { chronSystem, detailSystem, CLEAN_SYSTEM, chronInput, cleanInput, extractJson, normalizeResult, applyItemOps, restoreItems } from './chronicler.js';

const MODULE = 'life';
const VERSION = '0.50.1';
const PROMPT_KEY = 'life_move';
const WARDROBE_DRAW = '/scripts/extensions/third-party/wardrobe/draw.js';

const DEFAULTS = {
    enabled: true,
    showFab: true,
    fabPos: null,
    chatMarks: 'off',
    chapterBy: 'top',
    aliases: '',
    artStyle: 'semi-realistic colored-pencil sketch on toned paper, moody cinematic light, graphite and deep wine palette',
    regions: [],
    places: {},
    itemInfo: {},
    looks: {},
    pairs: {},
    autoMaps: 'ask',
    chron: { on: true, profile: '', backup: '', effort: 'low', tokens: 4000, timeoutSec: 120, titles: true, relations: true, secrets: true, delaySec: 20, waitSec: 25 },
    money: { autopay: true },
    music: { tracks: [], auto: true, vol: 0.6 },
    sceneBg: true,
    detail: { on: true, auto: true, motion: true },
    shot: { suggest: true, btn: true, style: 'story', custom: '' },
    plates: { on: true },
    cast: { on: true },
    tidy: true,
    mend: { on: true, tries: 2 },
};

const ctx = () => SillyTavern.getContext();
const settingsReady = new WeakSet();
function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

function settings() {
    const ext = ctx().extensionSettings;
    if (!ext[MODULE] || typeof ext[MODULE] !== 'object') ext[MODULE] = {};
    const s = ext[MODULE];
    if (settingsReady.has(s)) return s;   // значения по умолчанию — один раз на объект настроек, не на каждый вызов
    for (const [k, v] of Object.entries(DEFAULTS)) if (s[k] === undefined) s[k] = clone(v);
    for (const [k, v] of Object.entries(DEFAULTS.chron)) if (s.chron[k] === undefined) s.chron[k] = v;
    // 0.12.1: под думающие модели (Аргон, Gemini Pro) — запас токенов и времени, иначе размышления съедают ответ
    if (!s.chron.v121) { if ((Number(s.chron.tokens) || 0) < 4000) s.chron.tokens = 4000; if ((Number(s.chron.timeoutSec) || 0) < 120) s.chron.timeoutSec = 120; s.chron.v121 = 1; }
    for (const [k, v] of Object.entries(DEFAULTS.money)) if (s.money[k] === undefined) s.money[k] = v;
    for (const [k, v] of Object.entries(DEFAULTS.music)) if (s.music[k] === undefined) s.music[k] = clone(v);
    if (!s.detail || typeof s.detail !== 'object') s.detail = clone(DEFAULTS.detail);
    for (const [k, v] of Object.entries(DEFAULTS.detail)) if (s.detail[k] === undefined) s.detail[k] = v;
    if (!s.plates || typeof s.plates !== 'object') s.plates = clone(DEFAULTS.plates);
    if (!s.cast || typeof s.cast !== 'object') s.cast = clone(DEFAULTS.cast);
    if (!s.mend || typeof s.mend !== 'object') s.mend = clone(DEFAULTS.mend);
    if (!s.shot || typeof s.shot !== 'object') s.shot = clone(DEFAULTS.shot);
    for (const [k, v] of Object.entries(DEFAULTS.shot)) if (s.shot[k] === undefined) s.shot[k] = v;
    if (!s.migr02) migrate01(s);
    if (!s.migr03) { s.chatMarks = 'off'; delete s.dividers; delete s.focusDefault; s.migr03 = true; }
    if (!Array.isArray(s.regions)) s.regions = [];
    if (!s.regions.length) s.regions.push({ id: uid(), name: 'Манхэттен', map: '', note: '' });
    settingsReady.add(s);
    return s;
}

/** Из 0.1: миры → районы, картинки вещей → itemInfo, значки FA → линейные. */
function migrate01(s) {
    if (Array.isArray(s.worlds) && s.worlds.length && !s.regions.length) {
        s.regions = s.worlds.map(w => ({ id: w.id, name: w.name, map: w.map || '', cover: w.cover || '', note: w.note || '' }));
    }
    for (const p of Object.values(s.places || {})) {
        if (p.world && !p.region) p.region = p.world;
        delete p.world;
        p.icon = iconName(p.icon);
    }
    for (const [k, img] of Object.entries(s.itemImgs || {})) {
        s.itemInfo[k] = { ...(s.itemInfo[k] || {}), img };
    }
    delete s.itemImgs;
    delete s.worlds;
    s.migr02 = true;
}

const saveSettings = () => ctx().saveSettingsDebounced();

// ───────────── мелочи ─────────────

function uid() { return Math.random().toString(36).slice(2, 10); }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function norm(v) { return String(v ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'`]/g, '').replace(/\s+/g, ' ').trim(); }
function cut(t, n) { t = String(t ?? ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }
function cap(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
function pad2(n) { return String(n).padStart(2, '0'); }
function absUrl(u) { try { return new URL(u, location.href).href; } catch { return u; } }
/** картинка целиком, по краям — размытая она же (вместо обрезки) */
function fitAttr(src) { return src ? ` style="--img:url('${esc(absUrl(src))}')"` : ''; }
function hash(t) { let h = 0; t = String(t || ''); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
}
function toast(kind, msg, title = '✦ Life', opts = {}) {
    try { window.toastr?.[kind]?.(msg, title, { timeOut: 3000, ...opts }); } catch { /* нет тостов */ }
}

function locParts(loc) { return String(loc || '').split(/\s*[·・›>]\s*/).map(x => x.trim()).filter(Boolean); }
function locTop(loc) { return locParts(loc)[0] || ''; }
function locLeaf(loc) { const p = locParts(loc); return p[p.length - 1] || ''; }
function placeKey(loc) { return locParts(loc).map(norm).join('·'); }

function plainText(mes) {
    return String(mes || '')
        .replace(/<(horae\w*|details|think|thinking|summary|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_~`#|]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

// даты: «20.11.2024», «2024/11/20», «20 ноября 2024»
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = [/^янв/, /^фев/, /^мар/, /^апр/, /^ма[йя]/, /^июн/, /^июл/, /^авг/, /^сен/, /^окт/, /^ноя/, /^дек/];
function parseDate(s) {
    s = String(s || '');
    let m = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
    if (m) { const mi = MONTHS.findIndex(re => re.test(m[2].toLowerCase())); if (mi >= 0) return new Date(+m[3], mi, +m[1]); }
    return null;
}
function weekday(date) { const d = parseDate(date); return d && !isNaN(d) ? WEEKDAYS[d.getDay()] : ''; }
function whenLabel(date, time) { return [weekday(date) || date, time].filter(Boolean).join(', '); }
function fmtWhen(date, time) { return [date, time].filter(Boolean).join(' · '); }
function weatherWord(atm) { return cap(cut(String(atm || '').split(/[,;.]/)[0].trim(), 22)); }

// ───────────── Horae ─────────────

function chatArr() { return ctx().chat || []; }
function hasChat() { const c = ctx(); return !!(c.chatId || c.groupId || c.characterId !== undefined) && Array.isArray(c.chat); }
function chatMeta() {
    const md = ctx().chatMetadata;
    if (!md) return {};
    if (!md.life || typeof md.life !== 'object') md.life = {};
    return md.life;
}
function saveMeta() { try { ctx().saveMetadataDebounced?.(); } catch { /* */ } }
function horaeOn() { try { return !!window.Horae?.isEnabled?.(); } catch { return false; } }

function emptyMeta() {
    return {
        timestamp: { story_date: '', story_time: '', absolute: '' },
        scene: { location: '', characters_present: [], atmosphere: '' },
        costumes: {}, items: {}, deletedItems: [], deletedAgenda: [], events: [],
        affection: {}, npcs: {}, agenda: [], mood: {}, relationships: [],
    };
}

function worldState() {
    if (horaeOn()) {
        try { return window.Horae.getLatestState() || emptyMeta(); } catch (e) { console.warn('[Life] Horae.getLatestState', e); }
    }
    const st = emptyMeta();
    for (const m of chatArr()) {
        const meta = m?.horae_meta;
        if (!meta || meta._skipHorae) continue;
        if (meta.timestamp?.story_date) st.timestamp.story_date = meta.timestamp.story_date;
        if (meta.timestamp?.story_time) st.timestamp.story_time = meta.timestamp.story_time;
        if (meta.scene?.location) st.scene.location = meta.scene.location;
        if (meta.scene?.atmosphere) st.scene.atmosphere = meta.scene.atmosphere;
        if (meta.scene?.characters_present?.length) st.scene.characters_present = [...meta.scene.characters_present];
        if (meta.costumes) Object.assign(st.costumes, meta.costumes);
        if (meta.mood) Object.assign(st.mood, meta.mood);
        if (meta.items) Object.assign(st.items, meta.items);
        for (const d of meta.deletedItems || []) delete st.items[d];
    }
    return st;
}

function horaeEvents() {
    // склеенные Horae события («…event:Important|… event:Normal|…») — каждое своей строкой
    try { if (horaeOn()) return (window.Horae.getEvents(0) || []).flatMap(splitEvent); } catch (e) { console.warn('[Life] Horae.getEvents', e); }
    const out = [];
    chatArr().forEach((m, i) => (m?.horae_meta?.events || []).forEach((event, j) => { if (event?.summary) out.push({ messageIndex: i, eventIndex: j, timestamp: m.horae_meta.timestamp, event }); }));
    return out.flatMap(splitEvent);
}

function horaeAgenda() {
    const chat = chatArr();
    const seen = new Set();
    const deleted = new Set(chat[0]?.horae_meta?._deletedAgendaTexts || []);
    const out = [];
    const add = (item, i) => {
        if (!item?.text || item._deleted || deleted.has(item.text) || seen.has(item.text)) return;
        seen.add(item.text);
        out.push({ ...item, messageIndex: i });
    };
    for (const it of chat[0]?.horae_meta?.agenda || []) add(it, 0);
    for (let i = 1; i < chat.length; i++) for (const it of chat[i]?.horae_meta?.agenda || []) add(it, i);
    return out.filter(a => !a.done);
}

function locationMemory() { return chatArr()[0]?.horae_meta?.locationMemory || {}; }
function horaeRelationships() { return chatArr()[0]?.horae_meta?.relationships || []; }

// ───────────── главы ─────────────

let chCache = { sig: '', list: [] };

function chatSig() {
    const chat = chatArr();
    const last = chat[chat.length - 1];
    return `${ctx().chatId || ctx().groupId}|${chat.length}|${last?.swipe_id ?? ''}|${last?.horae_meta?.scene?.location || ''}|${settings().chapterBy}|${chatMeta().ver || 0}`;
}

/** Главы = отрезки чата, где место (по Horae) одно; новая глава — когда место меняется или на отметке Life. */
function chapters() {
    const sig = chatSig();
    if (chCache.sig === sig) return chCache.list;
    const chat = chatArr();
    const by = settings().chapterBy;
    const cm = chatMeta();
    const titles = cm.titles || {};
    const auto = cm.autoTitles || {};
    const list = [];
    let loc = '', date = '', time = '';
    let cur = null;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        const meta = m?.horae_meta;
        const mark = m?.extra?.life;
        if (meta && !meta._skipHorae) {
            if (meta.scene?.location) loc = meta.scene.location;
            if (meta.timestamp?.story_date) date = meta.timestamp.story_date;
            if (meta.timestamp?.story_time) time = meta.timestamp.story_time;
        }
        if (mark?.location) loc = mark.location;
        const key = by === 'full' ? placeKey(loc) : norm(locTop(loc));
        const forced = !!mark?.chapter;
        if (cur && !forced && key && key !== cur.key && cur.marker >= 0 && cur.count === 0) { cur.key = key; cur.loc = loc; }
        if (!cur || forced || (key && key !== cur.key)) {
            cur = { idx: list.length, start: i, end: i, key, loc, date, time, endDate: date, endTime: time, count: 0, marker: forced ? i : -1, mtitle: mark?.title || '', preview: '', previewId: -1, lastId: -1, locs: new Set() };
            list.push(cur);
        }
        cur.end = i;
        if (cur.marker >= 0 && cur.marker !== i && cur.count === 0 && meta?.timestamp?.story_date) { cur.date = date; cur.time = time; }
        if (!cur.key && key) { cur.key = key; cur.loc = loc; }
        if (loc) cur.locs.add(loc);
        cur.endDate = date || cur.endDate;
        cur.endTime = time || cur.endTime;
        if (!cur.date && date) { cur.date = date; cur.time = time; }
        if (isPost(m)) {
            cur.count++;
            if (cur.previewId < 0) cur.previewId = i;
            cur.lastId = i;
        }
    }
    for (const ch of list) {
        if (ch.previewId >= 0) ch.preview = cut(plainText(chat[ch.previewId]?.mes).replace(/\s+/g, ' '), 170);
        ch.autoTitle = auto[ch.start] || '';
        ch.title = titles[ch.start] || ch.mtitle || ch.autoTitle || (ch.loc ? placeName(locTop(ch.loc)) : (ch.idx === 0 ? 'Пролог' : 'Без места'));
        ch.userTitled = !!(titles[ch.start] || ch.mtitle);
        ch.locs = [...ch.locs];
        ch.num = ch.idx + 1;
    }
    chCache = { sig, list };
    return list;
}

function invalidate() { chCache.sig = ''; }

function chapterOf(mesId, list = chapters()) {
    let lo = 0, hi = list.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (mesId < list[mid].start) hi = mid - 1;
        else if (mesId > list[mid].end) lo = mid + 1;
        else return list[mid];
    }
    return null;
}

// ───────────── места и районы ─────────────

function regionById(id) { return settings().regions.find(r => r.id === id) || null; }
/** Районы и места этой эпохи (без ядра таймлайна — все). */
const regionsNow = () => settings().regions.filter(inEra);
const placesNow = () => Object.entries(settings().places).filter(([, p]) => inEra(p));
/**
 * Что появилось в этом чате — этой эпохи: места из его истории (и их комнаты), их районы, люди. Список эпох
 * у записи только растёт; «ничьи» записи видны везде, как раньше.
 */
function claimEra() {
    if (!eraId() || !hasChat()) return false;
    const s = settings();
    const own = new Set();
    const add = (raw) => { const k = placeKey(raw); if (k) own.add(k); const tk = placeKey(locTop(raw)); if (tk) own.add(tk); };
    try { for (const c of chapters()) for (const l of c.locs) add(l); } catch { /* */ }
    try { for (const name of Object.keys(locationMemory())) add(name); } catch { /* */ }
    let ch = false;
    for (const [k, p] of Object.entries(s.places)) {
        if (!own.has(k) && !own.has(k.split('·')[0])) continue;
        if (addEra(p)) ch = true;
        const r = p.region ? regionById(p.region) : null;
        if (r && addEra(r)) ch = true;
    }
    const cr = regionById(chatMeta().region);
    if (cr && addEra(cr)) ch = true;
    try { if (peopleClaimEra()) ch = true; } catch (e) { console.warn('[Life] эпохи: люди', e); }
    if (ch) saveSettings();
    return ch;
}

function findRegion(name, create = false) {
    const s = settings();
    const n = norm(name);
    if (!n) return null;
    let r = s.regions.find(x => norm(x.name) === n);
    if (!r && create) {
        r = { id: uid(), name: cap(String(name).trim()), map: '', note: '', fresh: true };
        addEra(r);
        s.regions.push(r);
        saveSettings();
    }
    return r;
}

function getPlace(loc, create = false) {
    const key = placeKey(loc);
    if (!key) return null;
    const s = settings();
    if (!s.places[key] && create) {
        s.places[key] = { name: locParts(loc).join(' · '), raw: loc, icon: guessPlaceIcon(norm(locLeaf(loc))), img: '', plan: '', region: '', x: null, y: null, kind: '' };
        addEra(s.places[key]);   // новое место — этой эпохи (ядро таймлайна)
    }
    return s.places[key] || null;
}

function placeName(loc) { return getPlace(loc)?.name || locParts(loc).join(' · ') || 'Без места'; }
function placeIcon(loc) { return iconName(getPlace(loc)?.icon || guessPlaceIcon(norm(locLeaf(loc)))); }

function placeCover(loc) {
    const parts = locParts(loc);
    for (let n = parts.length; n > 0; n--) {
        const p = getPlace(parts.slice(0, n).join('·'));
        if (p?.img) return p.img;
    }
    return '';
}

function placeRegion(loc) {
    const top = getPlace(locTop(loc));
    return top?.region ? regionById(top.region) : null;
}

function currentRegion() {
    const s = settings();
    const st = worldState();
    return placeRegion(st.scene?.location) || regionById(chatMeta().region) || regionsNow()[0] || s.regions[0];
}

function placeDesc(loc) {
    const key = placeKey(loc);
    for (const [name, v] of Object.entries(locationMemory())) if (placeKey(name) === key && !v?._deleted) return v.desc || '';
    return getPlace(loc)?.desc || '';
}

/** Все места: из глав, из памяти мест Horae и из реестра Life. key → «сырое» имя. */
function knownLocations() {
    const map = new Map();
    const add = (raw) => {
        const k = placeKey(raw);
        if (k && !map.has(k)) map.set(k, raw);
        const tk = placeKey(locTop(raw));
        if (tk && !map.has(tk)) map.set(tk, locTop(raw));
    };
    for (const ch of chapters()) for (const l of ch.locs) add(l);
    for (const name of Object.keys(locationMemory())) add(name);
    for (const [k, p] of placesNow()) if (!map.has(k)) map.set(k, p.raw || p.name);   // только места этой эпохи
    return map;
}

function chaptersAt(loc) {
    const key = placeKey(loc);
    return chapters().filter(ch => ch.locs.some(l => { const k = placeKey(l); return k === key || k.startsWith(key + '·'); }));
}

const SLOTS = [
    [50, 52, 'center'], [22, 30, 'upper-left'], [78, 30, 'upper-right'], [24, 78, 'lower-left'], [76, 78, 'lower-right'],
    [50, 24, 'upper-center'], [50, 82, 'lower-center'], [18, 55, 'middle-left'], [82, 55, 'middle-right'],
];

// ───────────── персонажи ─────────────

function parseAliases(text) {
    const out = {};
    for (const line of String(text || '').split('\n')) {
        const m = line.split('=');
        if (m.length < 2) continue;
        const card = m[0].trim();
        if (card) out[card] = [card, ...m.slice(1).join('=').split(',').map(x => x.trim()).filter(Boolean)];
    }
    return out;
}
function aliasTable() { return { ...parseAliases(ctx().extensionSettings?.wardrobe?.aliases), ...parseAliases(settings().aliases) }; }

function canonName(name) {
    const n = norm(name);
    if (!n) return '';
    const c = ctx();
    const cards = (c.characters || []).map(x => x.name).filter(Boolean);
    const exact = cards.find(x => norm(x) === n) || (norm(c.name1) === n ? c.name1 : '');
    if (exact) return exact;
    const table = aliasTable();
    for (const [card, list] of Object.entries(table)) {
        if (list.some(a => norm(a) === n || norm(a).split(' ')[0] === n || n.split(' ')[0] === norm(a))) return card;
    }
    const first = cards.find(x => norm(x).split(' ')[0] === n.split(' ')[0]);
    if (first) return first;
    // то же имя другим алфавитом: «Гельмут» → карточка «Helmut Zemo», «Pepper» → «Пеппер Поттс»
    const raw = String(name).trim();
    if (crossSame(c.name1, raw)) return c.name1;
    const cross = cards.find(x => crossSame(x, raw));
    if (cross) return cross;
    for (const [card, list] of Object.entries(table)) if (list.some(a => crossSame(a, raw))) return card;
    return raw;
}
function sameName(a, b) { return !!a && !!b && norm(canonName(a)) === norm(canonName(b)); }

/** Пост истории: обычный или скрытый от модели (/hide ставит is_system, но extra.type не трогает). Не пост — системные сообщения ST и разделители Life. */
function isPost(m) { return !!m && (!m.is_system || (!m.extra?.type && !m.extra?.life)); }

function groupMembers() {
    const c = ctx();
    if (c.groupId) {
        const g = (c.groups || []).find(x => x.id === c.groupId);
        return (g?.members || []).map(av => (c.characters || []).find(x => x.avatar === av)?.name).filter(Boolean);
    }
    if (c.characterId !== undefined && c.characters?.[c.characterId]) return [c.characters[c.characterId].name];
    return [];
}

/** Карточки этого чата: участники группы (по файлу аватарки) или открытая карточка. */
function chatCards() {
    const c = ctx();
    if (c.groupId) {
        const g = (c.groups || []).find(x => x.id === c.groupId);
        return (g?.members || []).map(av => (c.characters || []).find(x => x.avatar === av)).filter(Boolean);
    }
    const ch = c.characters?.[c.characterId];
    return ch ? [ch] : [];
}

let cxMemo = { at: 0, cx: null };
function timelineCx() {
    if (Date.now() - cxMemo.at > 500) cxMemo = { at: Date.now(), cx: globalThis.SacredTimeline?.context?.() || null };
    return cxMemo.cx;
}

/**
 * Карточка человека по имени. У одного человека бывает несколько карточек с одним и тем же именем — эпохи
 * «Священного таймлайна», по карточке на год, — и первая по списку может оказаться из чужого года. Поэтому: та,
 * которой он представлен в этом чате (ядро: people[имя].card — с датой, если в группе их несколько), иначе та, что
 * в этом чате, иначе базовая «Имя.png», иначе первая.
 */
function cardOf(name) {
    const c = ctx();
    const n = canonName(name);
    const all = (c.characters || []).filter(x => x.name === n);
    if (all.length < 2) return all[0] || null;
    const cx = timelineCx();
    const want = cx?.chatId && cx.chatId === c.getCurrentChatId?.() ? cx.people?.[n]?.card : null;
    const here = chatCards().filter(x => x.name === n);
    return here.find(x => x.avatar === want) || here[0] || all.find(x => x.avatar === want)
        || all.find(x => x.avatar === `${n}.png`) || all[0];
}

/** Кто из своих (ты + группа) упомянут в тексте — по именам и алиасам; «Наташи» ловится по «Наташа». */
function namesInText(text) {
    const t = ` ${norm(text)} `;
    const out = [];
    const c = ctx();
    const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const card of [c.name1, ...groupMembers()].filter(Boolean)) {
        if (out.includes(card)) continue;
        const list = [card, ...(aliasTable()[card] || [])].map(norm).filter(Boolean);
        const keys = [...new Set(list.flatMap(a => [a, a.split(' ')[0]]))]
            .filter(k => k.length >= 3)
            .map(k => (k.length >= 5 && /[аяйьоеиыу]$/.test(k) ? k.slice(0, -1) : k));
        if (keys.some(k => new RegExp(`(^|[^a-zа-я0-9])${esc(k)}`).test(t))) out.push(card);
    }
    return out;
}

function castNames(st = worldState()) {
    const names = [];
    const add = (n) => { const k = canonName(n); if (k && !names.some(x => norm(x) === norm(k))) names.push(k); };
    add(ctx().name1);
    groupMembers().forEach(add);
    (st.scene?.characters_present || []).forEach(add);
    Object.keys(st.costumes || {}).forEach(add);
    Object.keys(st.mood || {}).forEach(add);
    return names;
}

/** Свои: ты, группа и те, у кого есть карточка. Врачи, бармены и прочие NPC сцены живут в «Людях»;
 *  в группе — строго свои, в одиночном чате убираем только тех, кто записан в «Людях». */
function isOwn(n) {
    const c = ctx();
    if (sameName(n, c.name1) || groupMembers().some(g => sameName(g, n)) || (c.characters || []).some(x => x?.name && sameName(x.name, n))) return true;
    return !c.groupId && !findPerson(n);
}
/** Вкладка «Персонаж» — только свои. */
function personNames(st = worldState()) { return castNames(st).filter(isOwn); }

/** Имя так, как его пишет Horae (чтобы он сопоставил одежду и настроение). */
function horaeName(n, st = worldState()) {
    const pool = [...(st.scene?.characters_present || []), ...Object.keys(st.costumes || {}), ...Object.keys(st.mood || {})];
    return pool.find(h => sameName(h, n)) || n;
}

function userAvatar() { return document.querySelector('#chat .mes[is_user="true"] .avatar img')?.getAttribute('src') || ''; }

function avatarUrl(name, full = false) {
    const c = ctx();
    const n = canonName(name);
    if (norm(n) === norm(c.name1)) {
        const t = userAvatar();
        if (full && t.includes('thumbnail')) {
            try { const f = new URL(t, location.href).searchParams.get('file'); if (f) return `/User Avatars/${encodeURIComponent(f)}`; } catch { /* */ }
        }
        return t;
    }
    const face = c.extensionSettings?.wardrobe?.faces?.[n];
    if (face && !full) return face;
    const ch = cardOf(n);
    if (!ch?.avatar) return face || npcImg(n) || '';
    return full ? `/characters/${encodeURIComponent(ch.avatar)}` : `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`;
}

function shortName(n) { const f = String(n || '').split(/\s+/)[0]; return f.length > 11 ? f.slice(0, 10) + '…' : f; }

function ava(name, cls = '') {
    const url = avatarUrl(name);
    const letter = esc(String(name || '?').trim().charAt(0).toUpperCase());
    return `<span class="lf-ava ${cls}" title="${esc(name)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i>${letter}</i></span>`;
}

function moodOf(name, st) { return Object.entries(st.mood || {}).find(([k]) => sameName(k, name))?.[1] || ''; }

// ───────────── вещи ─────────────

const VEHICLE_RE = /машин|купе|авто|мотоцикл|байк|джип|седан|внедорожник|мустанг|порше|харлей|квинджет|\bcar\b|bike|mustang/i;

function itemInfo(name) { return settings().itemInfo[norm(name)] || {}; }
function setItemInfo(name, patch) {
    const s = settings();
    const k = norm(name);
    s.itemInfo[k] = { ...(s.itemInfo[k] || {}), ...patch };
    saveSettings();
}
function isVehicle(name, it) {
    const k = itemInfo(name).kind;
    if (k) return k === 'транспорт';
    if (/ключ|брелок|документ|права/i.test(name)) return false;
    return VEHICLE_RE.test(name) || (/^🚗|^🏍|^🚙/.test(it?.icon || ''));
}
function itemImg(name) { return itemInfo(name).img || ''; }

function itemOrigin(name) {
    const chat = chatArr();
    for (let i = 0; i < chat.length; i++) if (chat[i]?.horae_meta?.items?.[name]) return { i, ts: chat[i].horae_meta.timestamp, loc: chat[i].horae_meta.scene?.location };
    return null;
}

// ───────────── картинки ─────────────

async function fileToJpeg(file, max = 1600, q = 0.86) {
    const src = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('файл не прочитался'));
        r.readAsDataURL(file);
    });
    return toJpeg(src, max, q);
}

/**
 * Картинка → JPEG data:URL не больше max по длинной стороне. src — data:URL или адрес с этого же сайта.
 * 0.19.1: холст и картинка обнуляются сразу после кодирования — Safari на айфоне держит память холстов,
 * пока их не обнулишь, у вкладки общий лимит на холсты, и при череде картинок (реролл → деталь с рефами) она падала.
 */
async function toJpeg(src, max = 1600, q = 0.86) {
    const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('это не картинка'));
        i.src = src;
    });
    const cv = document.createElement('canvas');
    try {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        cv.width = Math.max(1, Math.round(img.naturalWidth * k));
        cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        const g = cv.getContext('2d');
        g.fillStyle = '#111';
        g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        return cv.toDataURL('image/jpeg', q);
    } finally {
        cv.width = 0;
        cv.height = 0;
        img.onload = img.onerror = null;
        img.removeAttribute('src');
    }
}

async function urlToDataUrl(u) {
    if (String(u).startsWith('data:')) return u;
    const r = await fetch(u);
    if (!r.ok) throw new Error(`картинка не скачалась (${r.status})`);
    const blob = await r.blob();
    return await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('картинка не прочиталась'));
        fr.readAsDataURL(blob);
    });
}

async function uploadImage(dataUrl, prefix = 'life') {
    const r = await fetch('/api/images/upload', {
        method: 'POST',
        headers: ctx().getRequestHeaders(),
        body: JSON.stringify({ image: dataUrl.split(',')[1], format: 'jpg', ch_name: 'life', filename: `${prefix}_${Date.now()}` }),
    });
    if (!r.ok) throw new Error(`таверна не сохранила картинку (${r.status})`);
    const p = String((await r.json()).path || '');
    return p.startsWith('/') ? p : `/${p}`;
}

// 0.19.1: рефы (лица, места) не перечитываются заново на каждом посте — раньше каждая деталь/кадр качали
// исходник целиком (PNG карточки вместе со вшитым лорбуком), переводили в base64 и декодировали снова.
const refCache = new Map();
async function refData(path, max = 1024) {
    if (!path) return '';
    const s = String(path);
    const key = `${hash(s)}:${s.length}|${max}`;
    if (refCache.has(key)) { const v = refCache.get(key); refCache.delete(key); refCache.set(key, v); return v; }
    try {
        // свой сайт и data: — картинка грузится напрямую, без base64 всего файла; чужой адрес — как раньше, через fetch
        const local = s.startsWith('data:') || !/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith(location.origin);
        const out = await toJpeg(local ? s : await urlToDataUrl(s), max, 0.86);
        if (max <= 1024) {
            refCache.set(key, out);
            while (refCache.size > 8) refCache.delete(refCache.keys().next().value);
        }
        return out;
    } catch { return ''; }
}

/** Рисую через движок Гардероба: тот же SLAY/Atlas/Naistera, что у тебя настроен. refs — data:URL. */
async function drawPicture(prompt, { aspect = '4:3', max = 1600, refs = [], prefix = 'life', who = null } = {}) {
    // живот по сроку: у кого в кадре какой срок (who — кто в кадре; не передали — ищу имена в промпте)
    try { const bn = bellyNote(Array.isArray(who) ? who : namesInText(prompt)); if (bn) prompt = `${prompt}\n${bn}`; } catch (e) { console.warn('[Life] живот по сроку', e); }
    // протез: в кадре без руки, если её сняли (или разбита)
    try { const an = armNote(Array.isArray(who) ? who : namesInText(prompt)); if (an) prompt = `${prompt}\n${an}`; } catch (e) { console.warn('[Life] рука', e); }
    // костюм героя: как выглядит и его картинка рефом, если в кадре он в костюме
    try {
        const hn = heroNote(Array.isArray(who) ? who : namesInText(prompt), prompt);
        if (hn.text) prompt = `${prompt}\n${hn.text}`;
        if (hn.refs.length) { refs = [...refs]; for (const r of hn.refs) { if (refs.length >= 4) break; const d = await refData(r); if (d) refs.push(d); } }
    } catch (e) { console.warn('[Life] костюм', e); }
    let mod;
    try { mod = await import(WARDROBE_DRAW); } catch { throw new Error('Рисую через Гардероб, а он не найден. Можно загрузить свою картинку.'); }
    const c = ctx();
    const conn = mod.resolveConnection(c.extensionSettings?.wardrobe || {}, c.extensionSettings);
    if (conn?.error) throw new Error(conn.error);
    const out = await mod.generateImage(conn, prompt, refs.filter(Boolean), { aspect, onWait: (sec) => toast('info', `Сервис занят, повтор через ${sec} с`) });
    return uploadImage(await toJpeg(await urlToDataUrl(out), max, 0.88), prefix);
}

const style = () => settings().artStyle;

function placeLine(p) {
    const desc = placeDesc(p.raw || p.name);
    return `${p.name}${p.kind ? ` (${p.kind})` : ''}${desc ? ` — ${cut(desc, 110)}` : ''}`;
}

function placePrompt(loc) {
    const desc = placeDesc(loc);
    const r = placeRegion(loc);
    return `Atmospheric establishing shot of a place: ${locParts(loc).join(', ')}${r ? `, ${r.name}` : ''}.${desc ? ` Details: ${desc}` : ''}${r?.note ? ` Setting: ${r.note}.` : ''}\nStyle: ${style()}. Wide cinematic composition, no people, no text.`;
}

function mapPrompt(region, assigned) {
    const parts = assigned.map(([p, slot]) => `${slot[2]} — ${placeLine(p)}`).join('; ');
    return `Illustrated aerial bird's-eye map of ${region.name}${region.note ? ` (${region.note})` : ''}: streets, rooftops, a few distinct landmark buildings, night, warm windows.`
        + (parts ? `\nComposition — keep each landmark clearly visible in its part of the frame: ${parts}.` : '')
        + `\nStyle: ${style()}. No labels, no text, no legend, no people.`;
}

function addToMapPrompt(p, slot) {
    return `This is an illustrated map. Add one new landmark in the ${slot[2]} part of the image: ${placeLine(p)}. Keep everything else exactly as it is — same style, same layout, same colors. No labels, no text.`;
}

function planPrompt(loc) {
    const desc = placeDesc(loc);
    return `Isometric cutaway floor plan illustration of ${locParts(loc).join(', ')}, several rooms visible from above with furniture and warm lamps.${desc ? ` Details: ${desc}` : ''}\nStyle: ${style()}. No labels, no text, no people.`;
}

function itemPrompt(name, it) {
    return `Still life close-up of a single object: ${name}.${it?.description ? ` ${it.description}` : ''} On dark fabric, soft side light.\nStyle: ${style()}. Only this object, nothing else, no text.`;
}

// ───────────── отметки глав и переходы ─────────────

/**
 * Скрытая отметка: системное сообщение (в промпт не идёт), но с horae_meta, чтобы Horae
 * считал новое место текущим. chapter=false — просто переход между комнатами без новой главы.
 */
async function insertMarker({ location = '', title = '', who = [], how = '', note = '', chapter = true, date = '', time = '' }) {
    const c = ctx();
    if (!hasChat()) throw new Error('сначала открой чат');
    const meta = emptyMeta();
    meta.scene.location = location || '';
    // перемотка: новое время истории — сразу в отметку (Horae и Life видят его до следующего ответа)
    if (date) meta.timestamp.story_date = date;
    if (time) meta.timestamp.story_time = time;
    if (who.length) meta.scene.characters_present = [...who];
    const msg = {
        name: 'Life',
        is_user: false,
        is_system: true,
        send_date: new Date().toLocaleString(),
        mes: `✦ ${title || location || 'Новая глава'}`,
        extra: { type: 'comment', life: { chapter, location, title, who, how, note } },
        horae_meta: meta,
    };
    c.chat.push(msg);
    try { c.addOneMessage(msg, { scroll: true }); } catch (e) { console.warn('[Life] addOneMessage', e); }
    await c.saveChat();
    invalidate();
    updateMovePrompt();
    return c.chat.length - 1;
}

function pendingMarker() {
    const chat = chatArr();
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m?.extra?.life?.chapter !== undefined && m.extra.life.location !== undefined) return { id: i, mark: m.extra.life };
        if (m && !m.is_system && !m.is_user) return null;
    }
    return null;
}

// ───────────── мост для соседних расширений (Зёрнышко и др.) ─────────────
// Соседнее расширение зовёт LifeBridge.register({ id, init(api), prompt(type), chron(), afterPost(i, json, msg), personRow(who), renderPerson(rest), sceneHtml() }).

const bridgeMods = [];
function bridgeEach(fn, label = '') {
    const out = [];
    for (const m of bridgeMods) {
        try { const v = fn(m); if (v) out.push(v); } catch (e) { console.warn(`[Life] ${m.id}${label ? `: ${label}` : ''}`, e); }
    }
    return out;
}
const bridgeOf = (who) => bridgeMods.find(m => String(who || '').startsWith(`${m.id}:`)) || null;

function moveNote(mark) {
    const who = (mark.who || []).filter(Boolean);
    const whoTxt = who.length ? who.join(', ') : 'Персонажи';
    if (mark.location) {
        return `[${mark.chapter === false ? 'Переход' : 'Смена сцены'}${mark.how ? ` (${mark.how})` : ''}: ${whoTxt} теперь — «${locParts(mark.location).join(', ')}»${mark.title ? `. Глава: ${mark.title}` : ''}.${mark.note ? ` ${mark.note}` : ''} Пиши уже оттуда (или дорогу туда, если так логичнее), без телепортов; кто не пошёл — остался где был.]`;
    }
    return `[Новая глава${mark.title ? `: ${mark.title}` : ''}.${mark.note ? ` ${mark.note}` : ''}]`;
}

let promptParts = [];
const BRIDGE_NAMES = { 'life-heroes': 'герои', 'life-arm': 'рука', 'life-arc': 'сюжетка', 'life-stones': 'Камни', 'life-habits': 'привычки', 'life-crowd': 'массовка', 'life-trig': 'триггеры', 'life-shards': 'осколки памяти', 'life-stage': 'мизансцена', 'life-cal': 'календарь', 'life-steps': 'прожитое', 'life-ritual': 'своё', 'life-stance': 'позиции и споры', 'life-voice': 'голос', 'life-echo': 'эхо решений', 'life-canon': 'канон', 'life-lang': 'языки', 'life-ooc': 'ядро характера', 'life-hurt': 'травмы', 'life-call': 'звонок', 'life-see': 'покажи им', 'life-route': 'дорога', 'life-season': 'сезон', 'life-who': 'кто где', 'life-hand': 'почерк', 'life-belly': 'срок', 'life-taste': 'вкус: правила, образцы, темп, нити', 'life-smell': 'запахи' };
function updateMovePrompt(type, consume = false) {
    const c = ctx();
    const p = settings().enabled ? pendingMarker() : null;
    const dir = settings().enabled ? chatMeta().director : null;
    const parts = [];
    const named = [];   // те же блоки с подписями — для «что уходит модели» (Мир → ⚙)
    const add = (label, t, first = false) => { if (!t) return; if (first) { parts.unshift(t); named.unshift({ label, text: t }); } else { parts.push(t); named.push({ label, text: t }); } };
    if (p) add('переход', moveNote(p.mark));
    if (dir?.once && dir.text) add('режиссёр', `[Режиссёр: ${dir.text}]`);
    if (settings().enabled && hasChat()) {
        try { add('жизнь', simPrompt(type)); } catch (e) { console.warn('[Life] Жизнь: заметка', e); }
        try { add('отношения', relPrompt()); } catch (e) { console.warn('[Life] отношения: заметка', e); }
        try { add('люди', peoplePrompt(type)); } catch (e) { console.warn('[Life] люди: заметка', e); }
        try { add('настроение', moodPrompt(type)); } catch (e) { console.warn('[Life] настроение', e); }
        try { add('СМИ', pressPrompt()); } catch (e) { console.warn('[Life] СМИ', e); }
        try { add('плашки', platesPrompt()); } catch (e) { console.warn('[Life] плашки', e); }
        for (const m of bridgeMods) { try { add(BRIDGE_NAMES[m.id] || m.id, m.prompt?.(type)); } catch (e) { console.warn(`[Life] ${m.id}: заметка`, e); } }
        try { add('дни', daysPrompt(type), true); } catch (e) { console.warn('[Life] дни', e); }
        try { add('свежесть', freshPrompt(type)); } catch (e) { console.warn('[Life] свежесть', e); }
    }
    const text = parts.join('\n');
    try { c.setExtensionPrompt(PROMPT_KEY, text, c.extension_prompt_types?.IN_CHAT ?? 1, 0, false, c.extension_prompt_roles?.SYSTEM ?? 0); } catch (e) { console.warn('[Life] заметка', e); }
    // режимы — отдельным ключом, который сортируется последним: самый конец промпта
    // накал — до режимов: «на один ответ» и твист ещё взведены, их видно
    let drama = '';
    try { drama = settings().enabled && hasChat() ? dramaPrompt(type, consume) : ''; } catch (e) { console.warn('[Life] накал', e); }
    let modes = '';
    try { modes = settings().enabled && hasChat() ? modesPrompt(type, consume) : ''; } catch (e) { console.warn('[Life] режимы', e); }
    try { const tp = settings().enabled && hasChat() ? twistPrompt(type, consume) : ''; if (tp) modes = [modes, tp].filter(Boolean).join('\n'); } catch (e) { console.warn('[Life] твист', e); }
    if (drama) modes = [modes, drama].filter(Boolean).join('\n');
    try { const tp = settings().enabled && hasChat() ? tasteOnce(type) : ''; if (tp) modes = [modes, tp].filter(Boolean).join('\n'); } catch (e) { console.warn('[Life] вкус', e); }
    try { const ap = settings().enabled && hasChat() ? arcOnce(type, consume) : ''; if (ap) modes = [modes, ap].filter(Boolean).join('\n'); } catch (e) { console.warn('[Life] ружьё', e); }
    try { const cp = settings().enabled && hasChat() ? castPrompt(type, consume) : ''; if (cp) modes = [modes, cp].filter(Boolean).join('\n'); } catch (e) { console.warn('[Life] каждый за себя', e); }
    try { const dp = settings().enabled && hasChat() ? duoPrompt(type, consume) : ''; if (dp) modes = [modes, dp].filter(Boolean).join('\n'); } catch (e) { console.warn('[Life] вдвоём', e); }
    try { const rp = settings().enabled && hasChat() ? replyPrompt(type) : ''; if (rp) modes = [modes, rp].filter(Boolean).join('\n'); } catch (e) { console.warn('[Life] не пропусти', e); }
    try { paintKnock(); } catch (e) { console.warn('[Life] стук', e); }
    try { applySeason(); } catch (e) { console.warn('[Life] сезон', e); }
    try { applyEra(); } catch (e) { console.warn('[Life] эпоха', e); }
    try { applyFeel(); } catch (e) { console.warn('[Life] экран', e); }
    try { c.setExtensionPrompt(MODES_KEY, modes, c.extension_prompt_types?.IN_CHAT ?? 1, 0, false, c.extension_prompt_roles?.SYSTEM ?? 0); } catch (e) { console.warn('[Life] режимы', e); }
    if (modes) named.push({ label: 'режимы и на один ответ', text: modes });
    promptParts = named;
    return [text, modes].filter(Boolean).join('\n');
}

globalThis.life_intercept = async function (_chat, _size, _abort, type) {
    // «не пропусти»: дождаться разбора поста игрока (не дольше нескольких секунд)
    try { if (type !== 'quiet' && settings().enabled) await replyReady(type); } catch (e) { console.warn('[Life] не пропусти', e); }
    // «покажи им»: дождаться, пока модель разглядит картинку из поста игрока
    try { if (type !== 'quiet' && settings().enabled) await seeReady(type); } catch (e) { console.warn('[Life] покажи им', e); }
    // Летописец ещё читает прошлый ответ — подождать, чтобы модель видела свежее состояние (раны, рука, кто где)
    try { await chronReady(type); } catch (e) { console.warn('[Life] Летописец: ожидание', e); }
    try { if (type !== 'quiet') updateMovePrompt(type, true); } catch (e) { console.warn('[Life] перехват', e); }
};

async function removeMarker(id) {
    const c = ctx();
    if (!c.chat?.[id]?.extra?.life) return;
    if (typeof c.deleteMessage === 'function') await c.deleteMessage(id);
    else { c.chat.splice(id, 1); await c.saveChat(); await c.reloadCurrentChat?.(); }
    invalidate();
    updateMovePrompt();
}

// ───────────── Летописец ─────────────

const chronBusy = new Set();
const chronQueue = [];
let chronRunning = false;

// память Летописца — memory.js
const { msgKey, chronStore, chronOf, rekeyChron, trimChron, forget: chronForget } = makeChronMemory({ chatArr: () => chatArr(), chatMeta: () => chatMeta(), saveMeta: () => saveMeta(), hash: (t) => hash(t) });

/**
 * Чистка рероллов: у поста i остаётся только вариант cur и становится нулевым. Зовётся ДО правки сообщения,
 * возвращает функцию для ПОСЛЕ: запись Летописца, отметка правок Horae и кадры переезжают на новый ключ,
 * записи выброшенных вариантов уходят.
 */
function rekeySwipe(i, cur) {
    const m = chatArr()[i];
    if (!m) return null;
    const st = chronStore();
    const oldSuf = msgKey(m);
    const oldShot = `${i}:${m.swipe_id ?? 0}`;
    return () => {
        const newSuf = msgKey(m);
        const keep = st[`${i}:${oldSuf}`];
        for (const k of Object.keys(st)) if (parseInt(k, 10) === i && k.startsWith(`${i}:`)) delete st[k];
        if (keep) st[`${i}:${newSuf}`] = keep;
        if (m.horae_meta?._lifeFix === oldSuf) m.horae_meta._lifeFix = newSuf;
        const cm = chatMeta();
        if (Array.isArray(cm.cuts)) {
            cm.cuts = cm.cuts.filter(c => !String(c.key || '').startsWith(`${i}:`) || c.key === oldShot);
            for (const c of cm.cuts) if (c.key === oldShot) c.key = `${i}:0`;
        }
        chronForget();
    };
}

function profiles() { return ctx().extensionSettings?.connectionManager?.profiles || []; }
function chronProfile() { const s = settings(); return s.chron.profile || ctx().extensionSettings?.wardrobe?.watcherProfile || ''; }

// ───────────── счётчик вызовов ─────────────
// Сколько раз за день Life ходил к модели и сколько примерно токенов — по модулям (Мир → ⚙).
const dayStamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
function callerLabel() {
    try {
        const files = [...String(new Error().stack || '').matchAll(/\/([a-z]+)\.js[:?]/g)].map(m => m[1]);
        return files.find(f => f !== 'index' && f !== 'ask') || 'index';
    } catch { return 'index'; }
}
function countCall(label, messages, out) {
    try {
        const s = settings();
        if (!s.stats || typeof s.stats !== 'object') s.stats = {};
        const day = dayStamp();
        const d = s.stats[day] = s.stats[day] || {};
        const r = d[label] = d[label] || { n: 0, i: 0, o: 0 };
        r.n++;
        r.i += messages.reduce((a, m) => a + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length), 0);
        r.o += String(out || '').length;
        const days = Object.keys(s.stats).sort();
        for (const k of days.slice(0, Math.max(0, days.length - 7))) delete s.stats[k];
        saveSettings();
    } catch { /* счётчик не важнее запроса */ }
}

async function askModel(messages, maxTokens, label = '') {
    const c = ctx();
    const s = settings();
    const who = label || callerLabel();
    if (!c.ConnectionManagerRequestService?.sendRequest) throw new Error('в таверне нет Connection Manager');
    const find = (name) => (name ? profiles().find(x => x.name === name) || profiles().find(x => x.id === name) : null);
    const p = find(chronProfile());
    if (!p) throw new Error('Выбери профиль Летописца: Мир → ⚙');
    const alt = find(s.chron.backup) || p;
    const override = s.chron.effort ? { reasoning_effort: s.chron.effort } : {};
    const base = Number(maxTokens) || 2000;
    const once = async (prof, tokens) => {
        // не дождались — запрос отменяется (раньше модель дописывала в пустоту, а деньги шли)
        const ac = typeof AbortController === 'function' ? new AbortController() : null;
        let timer = null;
        try {
            const r = await Promise.race([
                c.ConnectionManagerRequestService.sendRequest(prof.id, messages, tokens, ac ? { signal: ac.signal } : {}, override),
                new Promise((_, rej) => { timer = setTimeout(() => { try { ac?.abort(); } catch { /* */ } rej(new Error('Летописец не ответил вовремя')); }, (Number(s.chron.timeoutSec) || 75) * 1000); }),
            ]);
            const text = String(typeof r === 'string' ? r : (r?.content ?? ''));
            countCall(who, messages, text + String(r?.reasoning || ''));
            return { text, thought: !!String(r?.reasoning || '').trim() };
        } catch (e) { countCall(who, messages, ''); throw e; } finally { clearTimeout(timer); }
    };
    let a;
    try { a = await once(p, base); } catch (e) {
        // провайдер отказал («API request failed»: баланс, лимит, модель недоступна) — один раз запасным профилем
        const why = String(e?.message || e);
        console.warn(`[Life] Летописец: «${p.name}» — ${why}`);
        if (alt === p) throw new Error(`${why} — профиль «${p.name}»: проверь баланс и модель, или задай запасной профиль (Мир → ⚙)`);
        await new Promise(res => setTimeout(res, 1200));
        try { a = await once(alt, base); } catch (e2) { throw new Error(`${why} — и запасной «${alt.name}»: ${String(e2?.message || e2)}`); }
    }
    if (a.text.trim()) return a.text;
    // Пусто — обычно фильтр модели или мысли съели токены. Один раз переспросить сами: с запасом токенов и запасным профилем, если он задан.
    console.warn(`[Life] Летописец: пустой ответ${a.thought ? ' (одни размышления)' : ''} — переспрашиваю${alt !== p ? ` через «${alt.name}»` : ''}`);
    await new Promise(res => setTimeout(res, 1200));
    const b = await once(alt, Math.min(Math.round(base * 1.5), 16000));
    if (b.text.trim()) return b.text;
    if (a.thought || b.thought) throw new Error('пустой ответ Летописца: всё ушло в размышления — прибавь токенов (Мир → ⚙)');
    throw new Error(alt !== p ? 'пустой ответ Летописца — и у запасного профиля' : 'пустой ответ Летописца дважды — похоже, фильтр модели; помогает запасной профиль (Мир → ⚙)');
}

// Летописцу — за JSON с переспросом на обрезанный/битый ответ (ask.js)
const askJsonAs = (label, messages, tokens) => makeAskJson({ ask: (m, t) => askModel(m, t, label), parse: (t) => extractJson(t), base: () => 0 })(messages, tokens, { what: label });
const askJson = makeAskJson({ ask: (m, t, w) => askModel(m, t, w), parse: (t) => extractJson(t), base: () => Number(settings().chron.tokens) || 4000 });

async function waitHorae(i) {
    if (!horaeOn()) return;
    for (let t = 0; t < 40; t++) {
        if (chatArr()[i]?.horae_meta) { await new Promise(r => setTimeout(r, 400)); return; }
        await new Promise(r => setTimeout(r, 500));
    }
}

function manualFor(i) { return (chatMeta().manual || []).filter(x => x.mes === i); }

function reapplyManual(i) {
    const m = chatArr()[i];
    if (!m) return;
    for (const rec of manualFor(i)) {
        m.horae_meta = m.horae_meta || emptyMeta();
        applyItemOps(m.horae_meta, worldState().items, rec.ops);
    }
}

/** Если Horae перечитал сообщение и стёр наши правки — накатить их снова (без нового запроса). */
function ensureFix(i) {
    const m = chatArr()[i];
    const e = chronOf(i);
    if (!m || !e || e.undone) return false;
    const k = msgKey(m);
    if (m.horae_meta?._lifeFix === k) return false;
    m.horae_meta = m.horae_meta || emptyMeta();
    applyItemOps(m.horae_meta, worldState().items, e.ops || []);
    reapplyManual(i);
    m.horae_meta._lifeFix = k;
    return true;
}

function shouldChron(i) {
    const s = settings();
    const m = chatArr()[i];
    return s.enabled && s.chron.on && m && !m.is_user && !m.is_system && m.extra?.type !== 'comment' && String(m.mes || '').trim().length > 20;
}

function queueChron(i, opts = {}) {
    if (!shouldChron(i) && !opts.force) return;
    if (chronBusy.has(i)) return;
    chronQueue.push([i, opts]);
    if (!chronRunning) drainChron();
}

// «Ленивый» Летописец: ждёт chron.delaySec после ответа. Свайпнула за это время — тот вариант не читается вовсе
// (раньше каждый реролл стоил полного вызова). Отправила свой пост раньше — читает сразу, генерация его подождёт.
const chronTimers = new Map();
function scheduleChron(i) {
    cancelChron(i);
    const sec = Math.max(0, Math.min(120, Number(settings().chron.delaySec ?? 20) || 0));
    if (!sec) { setTimeout(() => queueChron(i), 700); return; }
    if (!shouldChron(i)) return;
    chronTimers.set(i, setTimeout(() => { chronTimers.delete(i); queueChron(i); }, sec * 1000));
    paintChips();
}
function cancelChron(i) { const t = chronTimers.get(i); if (t) { clearTimeout(t); chronTimers.delete(i); } }
function cancelChronAll() { for (const t of chronTimers.values()) clearTimeout(t); chronTimers.clear(); }
/** Она ответила — всё, что ждало паузу (в группе это могут быть ответы нескольких персонажей), читать сейчас, по порядку. */
function flushChron() { const ids = [...chronTimers.keys()].sort((a, b) => a - b); for (const i of ids) { cancelChron(i); queueChron(i); } return ids.length; }
const polishing = new Set();   // посты у редактора «Вкуса» — Летописец читает после него
const chronPending = () => chronTimers.size > 0 || chronBusy.size > 0 || chronQueue.length > 0 || polishing.size > 0;
/** Перед ответом модели на пост игрока: дочитать последний ответ (если ещё не) и подождать — не дольше chron.waitSec. */
async function chronReady(type) {
    if (['quiet', 'swipe', 'regenerate', 'continue', 'impersonate'].includes(type)) return;
    const s = settings();
    if (!s.enabled || !s.chron.on || !hasChat()) return;
    const chat = chatArr();
    if (!chat[chat.length - 1]?.is_user) return;   // в группе отвечают подряд — следующего не задерживать
    flushChron();
    const until = Date.now() + Math.max(0, Math.min(90, Number(s.chron.waitSec ?? 25) || 0)) * 1000;
    while (chronPending() && Date.now() < until) await new Promise(r => setTimeout(r, 250));
}

async function drainChron() {
    chronRunning = true;
    try {
        while (chronQueue.length) {
            const [i, opts] = chronQueue.shift();
            try { await runChron(i, opts); } catch (e) { console.warn('[Life] Летописец', e); }
        }
    } finally { chronRunning = false; }
}

async function runChron(i, { force = false } = {}) {
    const s = settings();
    const chat = chatArr();
    const m = chat[i];
    if (!m) return;
    const store = chronStore();
    const key = `${i}:${msgKey(m)}`;
    if (store[key] && !force) { if (ensureFix(i)) await ctx().saveChat(); return; }
    chronBusy.add(i);
    paintChips();
    try {
        await waitHorae(i);
        if (chatArr()[i] !== m) return; // чат сменился
        const st = worldState();
        const list = chapters();
        const ch = chapterOf(i, list);
        const askTitle = s.chron.titles && ch && !ch.userTitled && !ch.autoTitle && ch.count >= 2;
        let prev = '';
        for (let j = i - 1; j >= 0 && !prev; j--) if (chat[j] && !chat[j].is_system) prev = cut(plainText(chat[j].mes), 700);
        const cast = castNames(st).map(n => {
            const al = aliasTable()[n];
            const hn = horaeName(n, st);
            return [hn, ...(al || []).filter(a => norm(a) !== norm(hn))].slice(0, 4).join(' / ');
        });
        let so = null;
        try { so = simChronOpts(); } catch (e) { console.warn('[Life] Жизнь: опции', e); }
        const ext = bridgeEach(x => x.chron?.(i), 'Летописец');
        const input = chronInput({
            cast, location: st.scene?.location, when: fmtWhen(st.timestamp?.story_date, st.timestamp?.story_time),
            regions: regionsNow().map(r => r.name), items: st.items, post: cut(plainText(m.mes), 9000), speaker: duoSpeaker(m) || m.name, prev,
            chapterTitle: ch?.title, sim: so?.input, extra: ext.map(x => x.input).filter(Boolean),
        });
        const askDetail = !!s.detail.on;
        const askShot = !!s.shot.suggest;
        // ответ оборвался или пришёл битым — один переспрос с запасом токенов (ask.js), а не потерянный пост
        const j = await askJsonAs('Летописец', [{ role: 'system', content: chronSystem(askTitle, askDetail, { ...(so?.flags || {}), moodRule: MOOD_RULE, ext, shot: askShot }) }, { role: 'user', content: input }], (Number(s.chron.tokens) || 4000) + (askDetail ? 300 : 0) + (askShot ? 150 : 0) + (so?.tokens || 0) + ext.reduce((a, x) => a + (Number(x.tokens) || 0), 0) + 40);
        const res = normalizeResult(j);
        if (chatArr()[i] !== m || msgKey(m) !== key.split(':').slice(1).join(':')) return; // пока думал — свайпнули
        m.horae_meta = m.horae_meta || emptyMeta();
        const { undo, kinds } = applyItemOps(m.horae_meta, worldState().items, res.items);
        reapplyManual(i);
        m.horae_meta._lifeFix = msgKey(m);
        for (const [name, kind] of Object.entries(kinds)) setItemInfo(name, { kind });
        if (res.place) notePlace(res.place);
        if (askTitle && res.title && ch) {
            const cm = chatMeta();
            cm.autoTitles = cm.autoTitles || {};
            cm.autoTitles[ch.start] = res.title;
            cm.ver = (cm.ver || 0) + 1;
        }
        const old = store[key];
        store[key] = { chips: res.chips, ops: res.items, rel: s.chron.relations ? res.relations : [], sec: s.chron.secrets ? res.secrets : [], place: res.place, title: res.title, scene: normalizeScene(j), undo, at: Date.now() };
        if (old?.detImg && old.det) { store[key].det = old.det; store[key].detImg = old.detImg; }
        else if (askDetail && res.detail) store[key].det = res.detail;
        if (old?.shotUsed || old?.shotX) { store[key].shot = old.shot; store[key].shotUsed = old.shotUsed; store[key].shotX = old.shotX; }
        else if (askShot && res.shot) store[key].shot = res.shot;
        trimChron();
        await ctx().saveChat();
        saveMeta();
        invalidate();
        if (store[key].det && !store[key].detImg && s.detail.auto) queueDetail(key);
        try { simAfterPost(i, res, m); updateMovePrompt(); } catch (e) { console.warn('[Life] Жизнь после поста', e); }
        bridgeEach(x => x.afterPost?.(i, j, m), 'после поста');
        try { claimEra(); } catch { /* */ }
        updateMovePrompt();
    } catch (e) {
        console.warn('[Life] Летописец:', e);
        toast('warning', `${esc(String(e?.message || e))}<br><small>Тапни сюда — перечитает пост #${i}</small>`, '✦ Летописец', { timeOut: 12000, escapeHtml: false, onclick: () => { queueChron(i, { force: true }); toast('info', `Летописец перечитывает #${i}…`); } });
    } finally {
        chronBusy.delete(i);
        paintChips();
        decorateSoon(100);
        if (ui.open) renderSoon();
    }
}

// ───────────── деталь крупным планом ─────────────

const detBusy = new Set();
const detQueue = [];
let detRunning = false;
let detPick = null; // открытая под деталью панель «перерисовать»: { key, style, fix }

function detailPrompt(d, sid = '', fix = '', note = '') {
    const look = d.motion === 'scan'
        ? 'Look: grainy black-and-white medical ultrasound sonogram, fan-shaped scan sector on a dark monitor, soft speckle noise'
        : `Style: ${(() => { try { return styleText(sid || chatStyle()); } catch { return style(); } })()}`;
    return `Extreme close-up insert shot, like a cutaway in a film: ${d.prompt}${fix ? `\nCorrection from the player (follow it exactly): ${fix}` : ''}\n${note}${look}. Macro lens, shallow depth of field, one clear subject, cinematic still. No text, no letters, no watermark, no visible faces, no nudity.`;
}

/** Рефы к детали: лица тех, чья рука, глаз, кожа в кадре (как у кадров) — чтобы цвет глаз, кожа, волосы, шрамы, кольца были их. */
async function detailRefs(who) {
    const refs = [];
    const names = [];
    for (const n of (who || []).slice(0, 2)) {
        try { const r = await faceRef(n, 512); if (r) { refs.push(r); names.push(canonName(n)); } } catch { /* без рефа */ }
    }
    const note = refs.length
        ? `Reference images, in order: ${names.join(', ')} — the people whose hand, eye, skin or hair is in the frame. Keep their skin tone, eye colour, hair colour and texture, scars, rings and other marks exactly as in the references; draw only the small part named above, not the whole person and not a full face — the references are only for who is who, the style is below.\n`
        : '';
    return { refs, note };
}

function queueDetail(key) {
    if (detBusy.has(key) || detQueue.includes(key)) return;
    detQueue.push(key);
    if (!detRunning) drainDetail();
}

async function drainDetail() {
    detRunning = true;
    try { while (detQueue.length) await drawDetail(detQueue.shift()); } finally { detRunning = false; }
}

/** Деталь относится к тому варианту поста, что сейчас на экране (после реролла старый вариант уже не нужен). */
function detailCurrent(key) {
    const i = Number(String(key).split(':')[0]);
    const m = chatArr()[i];
    return !!m && key === `${i}:${msgKey(m)}`;
}

async function drawDetail(key) {
    const cm = chatMeta();
    const e = chronStore()[key];
    if (!e?.det) return;
    // 0.19.1: пока пишется ответ (реролл, свайп) — не рисовать: генерация, Летописец, SLAY и деталь с рефами
    // одновременно — это пик памяти, на котором Safari перезагружал вкладку. И деталь к варианту, который
    // уже свайпнули прочь, не рисовать вовсе.
    detBusy.add(key);
    paintChips();
    try {
        await genIdle();
        if (chatMeta() !== cm || !detailCurrent(key)) return;
        const { refs, note } = e.det.motion === 'scan' ? { refs: [], note: '' } : await detailRefs(e.det.who);
        const img = await drawPicture(detailPrompt(e.det, e.detStyle, e.detFix, note), { aspect: '16:9', max: 1400, refs, prefix: 'life_det', who: e.det.motion === 'scan' ? [] : (e.det.who || []) });
        if (chatMeta() !== cm) return; // чат сменился, пока рисовала
        const e2 = chronStore()[key];
        if (e2) { e2.detImg = img; saveMeta(); }
    } catch (err) {
        console.warn('[Life] деталь', err);
        toast('warning', esc(String(err?.message || err)), '✦ Деталь', { timeOut: 5000 });
    } finally {
        detBusy.delete(key);
        paintChips();
    }
}

function detailHtml(i) {
    const s = settings();
    const m = chatArr()[i];
    if (!m || !s.detail.on) return '';
    const key = `${i}:${msgKey(m)}`;
    const e = chronStore()[key];
    if (!e?.det || e.undone || e.detHidden) return '';
    const d = e.det;
    const busy = detBusy.has(key) || detQueue.includes(key);
    const cap = esc(d.caption || 'Деталь');
    if (!e.detImg) {
        return busy
            ? `<div class="lf-detail wait" data-key="${esc(key)}"><i class="lf-det-sh"></i><span>${icon('camera')} ${cap}<small>рисую крупный план…</small></span></div>`
            : `<div class="lf-detail wait idle" data-key="${esc(key)}" data-det="draw" role="button"><span>${icon('camera')} ${cap}<small>нарисовать крупный план</small></span></div>`;
    }
    const mo = s.detail.motion ? ` m-${esc(d.motion || 'drift')}` : '';
    return `<figure class="lf-detail lf-mo${mo}${busy ? ' redraw' : ''}" data-key="${esc(key)}" data-det="open" data-src="${esc(e.detImg)}" data-motion="${esc(d.motion || '')}" data-cap="${cap}">
        <img src="${esc(e.detImg)}" alt="" loading="lazy" decoding="async"><i class="fx"></i><i class="fx2"></i>
        <figcaption>${cap}</figcaption>
        <span class="lf-det-btns"><button data-det="redo" title="Перерисовать">${icon('refresh')}</button><button data-det="hide" title="Убрать">${icon('x')}</button></span>
    </figure>`;
}

/** Панель «перерисовать» под деталью — стиль, правка, другая деталь (как у кадров). */
function detPickHtml(i) {
    const m = chatArr()[i];
    if (!detPick || !m) return '';
    const key = `${i}:${msgKey(m)}`;
    if (detPick.key !== key) return '';
    const e = chronStore()[key];
    if (!e?.det || !e.detImg || e.detHidden || e.undone) return '';
    const cur = detPick.style;
    const scan = e.det.motion === 'scan';
    const custom = cur === 'custom' && !String(settings().shot?.custom || '').trim();
    return `<div class="lf-shot-pick lf-detpick" data-key="${esc(key)}" contenteditable="false">
        <div class="lf-shot-pick-h">${icon('palette')}<b>Перерисовать деталь</b><small>сейчас: ${esc(scan ? 'снимок УЗИ' : styleName(e.detStyle || chatStyle()).toLowerCase())}</small></div>
        ${scan ? '<div class="lf-shot-pick-note">Это снимок УЗИ — он и рисуется как УЗИ, стиль на него не влияет.</div>' : `<div class="lf-shot-pick-st">${styleChips('pk-style', cur, 'data-det')}</div>`}
        ${custom ? '<div class="lf-shot-pick-note">Свой стиль пустой — впиши его в Режиссёре (Стиль кадров → Свой), пока будет как у истории.</div>' : ''}
        ${scan ? '' : (() => {
            const names = [...new Set([...(detPick.who || []), ...castNames()].map(canonName).filter(Boolean))].slice(0, 6);
            return names.length ? `<div class="lf-shot-pick-who"><small>Чья рука, глаз, кожа в кадре — их рефы:</small><div class="lf-shot-pick-st">${names.map(n => `<button class="lf-chip${(detPick.who || []).some(w => sameName(w, n)) ? ' on' : ''}" data-det="pk-who" data-v="${esc(n)}">${icon('user')} ${esc(shortName(n))}</button>`).join('')}</div></div>` : '';
        })()}
        <input type="text" class="lf-shot-fix" placeholder="Что поправить (можно пусто): крупнее, мужская рука, на столе чашка…" value="${esc(detPick.fix || '')}">
        <div class="lf-shot-pick-b">
            <button data-det="pk-go" class="on">${icon('refresh')} Перерисовать</button>
            <button data-det="pk-new" title="Летописец выберет из поста другой момент">${icon('sparkles')} Другая деталь</button>
            <button data-det="pk-x" title="Закрыть">${icon('x')}</button>
        </div>
    </div>`;
}

async function newDetail(i) {
    const m = chatArr()[i];
    const st = worldState();
    const input = `Место: ${st.scene?.location || '—'}. Время: ${fmtWhen(st.timestamp?.story_date, st.timestamp?.story_time) || '—'}.\nПерсонажи: ${castNames(st).join(', ') || '—'}.\nПост (${m?.name || ''}):\n${cut(plainText(m?.mes || ''), 6000)}`;
    const out = await askModel([{ role: 'system', content: detailSystem() }, { role: 'user', content: input }], 700);
    const j = extractJson(out);
    const d = normalizeResult({ detail: j?.detail || j }).detail;
    if (!d) throw new Error('Летописец не придумал деталь');
    return d;
}

// живые детали двигаются только на экране — айфону так легче
let detIO = null;
function watchDetails(root) {
    if (!('IntersectionObserver' in window)) { root.querySelectorAll('.lf-mo').forEach(x => x.classList.add('play')); return; }
    detIO = detIO || new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('play', en.isIntersecting)), { rootMargin: '80px' });
    root.querySelectorAll('.lf-mo:not([data-io])').forEach(x => { x.dataset.io = '1'; detIO.observe(x); });
}

async function onDetailClick(b, el) {
    const key = el.dataset.key;
    const e = chronStore()[key];
    if (!e) return;
    const act = b.dataset.det;
    if (act === 'open') { lightbox(el.dataset.src, el.dataset.cap || '', null, settings().detail.motion ? el.dataset.motion : ''); return; }
    if (act === 'hide') { e.detHidden = true; saveMeta(); paintChips(); toast('info', 'Деталь убрана. Вернуть — в карточке Летописца.'); return; }
    if (act === 'draw') { queueDetail(key); return; }
    if (act === 'redo') {
        detPick = detPick?.key === key ? null : { key, style: e.detStyle || chatStyle(), fix: e.detFix || '', who: [...(e.det?.who || [])] };
        paintChips();
        if (detPick) requestAnimationFrame(() => document.querySelector(`#chat .lf-detpick[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
        return;
    }
    if (!act.startsWith('pk-') || detPick?.key !== key) return;
    detPick.fix = el.querySelector('.lf-shot-fix')?.value?.trim() || detPick.fix || '';
    if (act === 'pk-x') { detPick = null; paintChips(); return; }
    if (act === 'pk-style') { if (b.dataset.v) detPick.style = b.dataset.v; paintChips(); return; }
    if (act === 'pk-who') {
        const n = b.dataset.v;
        const w = detPick.who || [];
        detPick.who = w.some(x => sameName(x, n)) ? w.filter(x => !sameName(x, n)) : [...w, n].slice(-2);
        paintChips();
        return;
    }
    const { style: sid, fix, who } = detPick;
    detPick = null;
    e.detStyle = sid;
    e.detFix = fix;
    if (e.det) e.det.who = who || [];
    if (act === 'pk-new') {
        paintChips();
        toast('info', 'Летописец ищет в посте другую деталь…', '✦ Деталь', { timeOut: 4000 });
        try { e.det = await newDetail(Number(key.split(':')[0])); } catch (err) { toast('warning', esc(String(err?.message || err)), '✦ Деталь', { timeOut: 5000 }); return; }
        if (!e.det.who?.length && who?.length) e.det.who = who; // выбрала людей сама — пусть остаются
    }
    saveMeta();
    queueDetail(key); // старая картинка остаётся под шиммером, пока рисуется новая
}

/** Летописец сказал, где сцена: отнести место к району (новый район — завести). */
function notePlace(pl) {
    const top = locTop(pl.location);
    if (!top) return;
    const p = getPlace(top, true);
    if (!p.kind && pl.kind) p.kind = pl.kind;
    if (p.icon === 'pin' && pl.kind) p.icon = guessPlaceIcon(norm(pl.kind));
    if (!p.region && pl.region) {
        const r = findRegion(pl.region, true);
        p.region = r.id;
        if (r.fresh) {
            delete r.fresh;
            const mode = settings().autoMaps;
            if (mode === 'auto') setTimeout(() => drawRegionMap(r).catch(e => toast('warning', esc(String(e.message || e)))), 500);
            else if (mode === 'ask') { r.needsMap = true; toast('info', `Новый район на карте: «${esc(r.name)}». Карту можно нарисовать в Life → Карта.`, '✦ Life', { timeOut: 6000 }); }
        }
    }
    saveSettings();
}

async function undoChron(i) {
    const m = chatArr()[i];
    const e = chronOf(i);
    if (!m || !e) return;
    restoreItems(m.horae_meta, e.undo);
    e.undone = true;
    if (m.horae_meta) delete m.horae_meta._lifeFix;
    await ctx().saveChat();
    saveMeta();
    invalidate();
}

/** Ручная правка вещей: в последнее сообщение, с записью, чтобы пережила перечитывание Horae. */
async function manualItems(ops) {
    const chat = chatArr();
    if (!chat.length) return;
    const i = chat.length - 1;
    const m = chat[i];
    m.horae_meta = m.horae_meta || emptyMeta();
    applyItemOps(m.horae_meta, worldState().items, ops);
    const cm = chatMeta();
    cm.manual = (cm.manual || []).filter(x => x.mes < chat.length);
    cm.manual.push({ mes: i, ops, at: Date.now() });
    if (cm.manual.length > 200) cm.manual.splice(0, cm.manual.length - 200);
    await ctx().saveChat();
    saveMeta();
}

async function cleanInventory() {
    const st = worldState();
    const items = st.items || {};
    if (!Object.keys(items).length) throw new Error('инвентарь пуст');
    const out = await askModel([{ role: 'system', content: CLEAN_SYSTEM }, { role: 'user', content: cleanInput({ cast: castNames(st).map(n => horaeName(n, st)), items }) }], 3000);
    const j = extractJson(out);
    const res = normalizeResult(j || {});
    if (!res.items.length) return 0;
    await manualItems(res.items);
    return res.items.length;
}

// отношения и тайны — свёртка записей Летописца по чату (ветки и свайпы учитываются сами)
// Отношения направленные: «Баки → Хеди» и «Хеди → Баки» — две разные строки шкал.
function pairKey(a, b) { return [canonName(a), canonName(b)].map(norm).sort().join('|'); }
function dirKey(from, to) { return `${norm(canonName(from))}>${norm(canonName(to))}`; }

const SCALES = [['trust', 'Доверие', 'handshake', 50], ['closeness', 'Близость', 'heart', 50], ['desire', 'Влечение', 'flame', 30], ['jealousy', 'Ревность', 'eye', 10], ['tension', 'Напряжение', 'zap', 25], ['guilt', 'Вина', 'moon', 5]];
const scaleBase = () => Object.fromEntries(SCALES.map(([k, , , v]) => [k, v]));

/** Шкалы «from → to» внутри пары. */
function relSide(p, from) { return sameName(from, p.a) ? p.ab : p.ba; }

function relationsState() {
    const chat = chatArr();
    const cm = chatMeta();
    const oldBase = cm.pairBase || {};
    const base = cm.relBase || {};
    const pairs = {};
    const get = (a, b) => {
        const k = pairKey(a, b);
        if (!pairs[k]) {
            const p = pairs[k] = { key: k, a: canonName(a), b: canonName(b), moments: [] };
            const b0 = oldBase[k] || {};
            const bab = base[dirKey(p.a, p.b)] || {}, bba = base[dirKey(p.b, p.a)] || {};
            p.ab = {}; p.ba = {};
            for (const [f, , , v] of SCALES) { p.ab[f] = bab[f] ?? b0[f] ?? v; p.ba[f] = bba[f] ?? b0[f] ?? v; }
        }
        return pairs[k];
    };
    const clamp = (v) => Math.max(0, Math.min(100, v));
    for (let i = 0; i < chat.length; i++) {
        const e = chronOf(i);
        if (!e || e.undone) continue;
        for (const r of e.rel || []) {
            if (sameName(r.a, r.b)) continue;
            const p = get(r.a, r.b);
            // старые записи (до 0.8) были общими на пару — двигают обе стороны
            const sides = r.dir ? [relSide(p, r.a)] : [p.ab, p.ba];
            for (const sd of sides) for (const [f] of SCALES) sd[f] = clamp(sd[f] + (r[f] || 0));
            if (r.moment && !p.moments.some(x => norm(x.text) === norm(r.moment))) p.moments.push({ text: r.moment, mes: i, ts: chat[i]?.horae_meta?.timestamp });
        }
    }
    for (const k of Object.keys(oldBase)) if (!pairs[k]) { const [a, b] = k.split('|'); get(a, b); }
    for (const k of Object.keys(base)) { const [a, b] = k.split('>'); if (a && b && !pairs[pairKey(a, b)]) get(a, b); }
    // плоские поля — среднее двух сторон (для старых мест, где хватает общей картины)
    for (const p of Object.values(pairs)) for (const [f] of SCALES) p[f] = Math.round((p.ab[f] + p.ba[f]) / 2);
    return pairs;
}

/** Чувства from к to: { trust, closeness, … } или null. */
function relOf(from, to) {
    const p = relationsState()[pairKey(from, to)];
    return p ? { ...relSide(p, from), moments: p.moments } : null;
}

// как отношения выглядят в поведении — чтобы модель играла чувства, а не читала цифры
const REL_HINT = {
    trust: ['не верит ни слову', 'настороже', '', 'доверяет, открывается', 'верит без оглядки'],
    closeness: ['чужой человек', 'держит дистанцию', '', 'дорожит, тянется', 'не представляет себя без другого'],
    desire: ['физически не тянет', '', 'лёгкий физический интерес', 'физически тянет, заводится рядом', 'сильное желание, физический голод'],
    jealousy: ['', '', 'тревога за своё место', 'ревнует, следит за соперниками', 'жгучая ревность'],
    tension: ['', '', 'что-то копится', 'колется, обижается', 'на грани взрыва'],
    guilt: ['', '', 'лёгкое чувство вины', 'вина давит, пытается загладить', 'вина съедает изнутри'],
};
const relLvl = (v) => v < 15 ? 0 : v < 35 ? 1 : v < 60 ? 2 : v < 80 ? 3 : 4;
const relBits = (sd) => SCALES.map(([f]) => REL_HINT[f][relLvl(sd[f])]).filter(Boolean);

function scenePresent() {
    const st = worldState();
    return [ctx().name1, ...(st.scene?.characters_present || [])].map(canonName).filter(Boolean);
}

function relPrompt() {
    if (!settings().chron.relations) return '';
    const here = scenePresent();
    const out = [];
    if (here.length >= 2) {
        const pairs = Object.values(relationsState()).filter(p => here.some(n => sameName(n, p.a)) && here.some(n => sameName(n, p.b)));
        const lines = pairs.slice(0, 4).map(p => {
            const x = relBits(p.ab), y = relBits(p.ba);
            const last = p.moments.slice(-2).map(m => `«${m.text}»`).join(', ');
            const A = shortName(p.a), B = shortName(p.b);
            let body;
            if (x.join() === y.join()) body = x.length ? `${A} и ${B}: ${x.join('; ')}` : '';
            else body = [x.length ? `${A} → ${B}: ${x.join('; ')}` : '', y.length ? `${B} → ${A}: ${y.join('; ')}` : ''].filter(Boolean).join('. ');
            if (!body && !last) return '';
            return `${body || `${A} и ${B}`}${last ? `. Недавно: ${last}` : ''}`;
        }).filter(Boolean);
        if (lines.length) out.push(`[Отношения сейчас — чувства не всегда взаимны (→ — кто к кому), играй их в поведении, не называя: ${lines.join('. ')}.]`);
    }
    try { const t = triPrompt(here); if (t) out.push(t); } catch (e) { console.warn('[Life] треугольники: заметка', e); }
    return out.join('\n');
}

// ───── треугольники: трое, у которых чувства к одному влияют на другого ─────

const TRI_KINDS = [
    ['jeal', 'Ревность', 'eye', '{c} в центре: один ревнует к другому, а тот дразнит, флиртует или просто существует — и этого хватает'],
    ['loyal', 'Верность', 'handshake', '{c} между двумя, которые друг другу не доверяют: каждый тянет на себя, перемирие держится на {c}'],
    ['rival', 'Соперники', 'zap', 'двое меряются — за внимание, правоту, место рядом с {c}; {c} — то приз, то судья'],
    ['secret', 'Тайна', 'lock', 'между ними троими есть недосказанное: один знает то, чего не знает другой, и {c} это чувствует'],
];
const TRI_ENDS = [
    ['hold', 'Держать', 'тлеет и не решается: искры, взгляды, колкости — без развязки'],
    ['never', 'Не за грань', 'искры и ревность да, но без измены и без разрыва — никогда за грань'],
    ['blow', 'Взорвать', 'постепенно к открытому столкновению: каждая сцена чуть острее, но не взрывай в одном посте'],
    ['fade', 'Помирить', 'напряжение постепенно гаснет: шаги навстречу, уважение, перемирие'],
];
const triKind = (id) => TRI_KINDS.find(k => k[0] === id) || TRI_KINDS[0];
const triEnd = (id) => TRI_ENDS.find(k => k[0] === id) || TRI_ENDS[0];

function triangles() {
    const cm = chatMeta();
    if (!Array.isArray(cm.triangles)) cm.triangles = [];
    return cm.triangles;
}

/** Накал треугольника — из направленных шкал ревности и напряжения между тремя. */
function triHeat(t, rs = relationsState()) {
    const [x, y, z] = t.who;
    const vals = [];
    for (const [a, b] of [[x, y], [y, z], [x, z]]) {
        const p = rs[pairKey(a, b)];
        if (!p) continue;
        for (const sd of [p.ab, p.ba]) vals.push(Math.max(sd.jealousy, sd.tension, t.kind === 'secret' ? sd.guilt : 0));
    }
    if (!vals.length) return 0;
    vals.sort((a, b) => b - a);
    return Math.round((vals[0] + (vals[1] ?? vals[0])) / 2);
}

function triLine(t, mode) {
    const c = shortName(t.center);
    const sides = t.who.filter(n => !sameName(n, t.center)).map(shortName);
    const k = triKind(t.kind), e = triEnd(t.end);
    const heat = triHeat(t);
    const head = `Треугольник ${sides[0]} — ${c} — ${sides[1]}`;
    const what = k[3].replaceAll('{c}', c);
    const note = t.note ? ` ${t.note}.` : '';
    if (mode === 'all') return `${head}: ${what}. Накал ${heat < 35 ? 'низкий' : heat < 65 ? 'заметный' : 'высокий'}. Куда идёт: ${e[2]}.${note} Держи эту ось в поведении всех троих, не проговаривай её и не решай в одном посте.`;
    return `${head}: ${what}.${note} Третьего упомянули — пусть это отзовётся в реакции, но не втаскивай его в сцену.`;
}

function triPrompt(here) {
    const list = triangles().filter(t => t.on !== false && t.who?.length === 3);
    if (!list.length) return '';
    const userText = (() => { const ch = chatArr(); for (let i = ch.length - 1; i >= 0 && i >= ch.length - 3; i--) if (ch[i]?.is_user) return norm(ch[i].mes || ''); return ''; })();
    const mentions = (n) => [canonName(n), ...(aliasTable()[canonName(n)] || [])].some(a => { const w = norm(a).split(' ')[0]; if (w.length < 3) return false; const stem = w.length <= 4 ? w : w.slice(0, -1); return new RegExp(`(^|[^a-zа-яё])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(userText); });
    const lines = [];
    for (const t of list) {
        const inScene = t.who.filter(n => here.some(h => sameName(h, n)));
        if (inScene.length === 3) lines.push(triLine(t, 'all'));
        else if (inScene.length === 2) {
            const third = t.who.find(n => !inScene.some(h => sameName(h, n)));
            if (third && mentions(third)) lines.push(triLine(t, 'shadow'));
        }
    }
    return lines.length ? `[${lines.slice(0, 2).join(' ')}]` : '';
}

function secretsState() {
    const out = [];
    chatArr().forEach((m, i) => {
        const e = chronOf(i);
        if (!e || e.undone) return;
        for (const sec of e.sec || []) out.push({ ...sec, mes: i, ts: m?.horae_meta?.timestamp });
    });
    const hidden = new Set(chatMeta().hiddenSecrets || []);
    return out.filter(x => !hidden.has(norm(x.text)));
}

function lastChron(from = chatArr().length - 1, to = 0) {
    for (let i = from; i >= to; i--) { const e = chronOf(i); if (e && !e.undone && e.chips?.length) return { i, e }; }
    return null;
}

// ───────────── чат: разделители, главы, плашки ─────────────

const ui = {
    open: false, tab: 'scene', focus: 'last', who: '', pTab: 'life', itemsTab: 'with', item: '', worldTab: 'days',
    mapStack: [], region: '', sel: '', atlas: false, editPins: false, chShow: 30, pair: '', relTab: 'common', car: '', wset: '', galShow: 48,
    room: '', tracePin: '',
};
let observer = null;
let decorating = false;

// глава, которую сейчас показывает хаб (в самом чате ничего не прячется)
function focusChapter(list = chapters()) {
    if (!list.length) return null;
    if (ui.focus === 'last' || ui.focus === null) return list[list.length - 1];
    return list.find(ch => ch.start === ui.focus) || list[list.length - 1];
}

function firstShownId(chatEl) {
    const first = chatEl.querySelector(':scope > .mes[mesid]');
    return first ? Number(first.getAttribute('mesid')) : Infinity;
}

const imgs = () => chatImages(chatArr());
function chapterCover(ch) { return (chatMeta().frames || {})[ch.start] || placeCover(ch.loc) || (ch.start != null ? imagesBetween(imgs(), ch.start, ch.end ?? ch.start)[0]?.src || '' : ''); }
/** Все имена, под которыми человек может стоять в промпте картинки. */
function nameKeys(n) { const c = canonName(n); return [n, c, ...(aliasTable()[c] || [])].filter(Boolean); }
const cuts = () => (Array.isArray(chatMeta().cuts) ? chatMeta().cuts : []);
function cutTile(c) {
    const f = (c.frames || []).find(x => x.img);
    if (c.kind === 'frame' && f) return `<button class="lf-cuttile" data-act="lightbox" data-src="${esc(f.img)}" data-mes="${c.mes}"><span class="lf-cuttile-img" style="background-image:url('${esc(f.img)}')"></span><small>${esc(cut(f.caption || c.title || 'Кадр', 26))}</small></button>`;
    return `<button class="lf-cuttile" data-act="cut-play" data-id="${esc(c.id)}">${f ? `<span class="lf-cuttile-img" style="background-image:url('${esc(f.img)}')"></span>` : '<span class="lf-cuttile-img"></span>'}<span class="lf-cuttile-play">${icon('play')}</span><small>${esc(cut(c.title || 'Кат-сцена', 26))}</small></button>`;
}

function thinHtml(ch) {
    const where = ch.loc ? placeName(locTop(ch.loc)) : '';
    const label = [where && norm(where) !== norm(ch.title) ? `${ch.title} · ${where}` : ch.title, ch.time].filter(Boolean).join(' · ');
    return `<div class="lf-thin" data-start="${ch.start}" role="button">${esc(cut(label, 60))}</div>`;
}

function chipsHtml(i) {
    if (chronBusy.has(i)) return `<div class="lf-pchips busy" data-mes="${i}">${icon('spark')}<span>Летописец читает…</span></div>`;
    const e = chronOf(i);
    let ini = '';
    try { ini = initChipFor(i); } catch { /* */ }
    if (!e || e.undone || (!e.chips?.length && !ini)) return '';
    return `<div class="lf-pchips" data-mes="${i}" role="button">${icon('spark')}<span>${(e.chips || []).map(esc).join(' <i>·</i> ')}${ini ? `${e.chips?.length ? ' <i>·</i> ' : ''}<b class="lf-ini">${icon('heart')} ${esc(ini)}</b>` : ''}</span></div>`;
}

function cutCardHtml(i) {
    const cs = cuts().filter(c => !c.key && c.mes === i && c.frames?.some(f => f.img)); // старые кат-сцены, снятые до 0.13 — под постом
    if (!cs.length) return '';
    return cs.map(c => `<div class="lf-cutcard" data-cut="${esc(c.id)}" role="button">
        <span class="lf-cutcard-strip">${c.frames.filter(f => f.img).map(f => `<i style="background-image:url('${esc(f.img)}')"></i>`).join('')}</span>
        <span class="lf-cutcard-t">${icon('play')}<b>${esc(c.title || 'Кат-сцена')}</b><small>кат-сцена · ${c.frames.length} ${plural(c.frames.length, 'кадр', 'кадра', 'кадров')}</small></span>
    </div>`).join('');
}

// свои отрисовщики поста: «не пропусти», сны/флешбеки и т. п. — и их кнопки в чате
const painters = [];
const chatClicks = [];
// модули со своими кнопками в хабе: префикс data-act → обработчик; и свои поля (change)
const hubMods = [];
const hubInputs = [];

function paintChips() {
    const chatEl = document.getElementById('chat');
    if (!chatEl || !settings().enabled) return;
    chatEl.querySelectorAll(':scope > .mes[mesid]').forEach(el => {
        const id = Number(el.getAttribute('mesid'));
        try { paintShots(el, id); } catch (e) { console.warn('[Life] кадры в посте', e); }
        for (const p of painters) { try { p(el, id); } catch (e) { console.warn('[Life] пост', e); } }
        const host0 = el.querySelector('.mes_block') || el;
        const oldCut = host0.querySelector(':scope > .lf-cutcards');
        const cutHtml = cutCardHtml(id);
        if (!cutHtml) oldCut?.remove();
        else if (!oldCut || oldCut.dataset.sig !== String(cutHtml.length)) { oldCut?.remove(); host0.insertAdjacentHTML('beforeend', `<div class="lf-cutcards" data-sig="${cutHtml.length}">${cutHtml}</div>`); }
        const oldDet = host0.querySelector(':scope > .lf-detail');
        const detHtml = detailHtml(id);
        const detSig = hash(detHtml);
        if (!detHtml) oldDet?.remove();
        else if (!oldDet || oldDet.dataset.sig !== detSig) {
            oldDet?.remove();
            const anchor = host0.querySelector(':scope > .mes_text');
            const tmp = document.createElement('div');
            tmp.innerHTML = detHtml.trim();
            const node = tmp.firstElementChild;
            node.dataset.sig = detSig;
            if (anchor) anchor.after(node); else host0.append(node);
        }
        const oldPick = host0.querySelector(':scope > .lf-detpick');
        const pickHtml = detPickHtml(id);
        if (!pickHtml) oldPick?.remove();
        else if (!oldPick || oldPick.dataset.sig !== hash(pickHtml)) {
            const typed = oldPick?.querySelector('.lf-shot-fix')?.value;
            oldPick?.remove();
            const tmp = document.createElement('div');
            tmp.innerHTML = pickHtml.trim();
            const node = tmp.firstElementChild;
            node.dataset.sig = hash(pickHtml);
            if (typed != null && node.querySelector('.lf-shot-fix')) node.querySelector('.lf-shot-fix').value = typed;
            const det = host0.querySelector(':scope > .lf-detail');
            if (det) det.after(node); else host0.append(node);
        }
        const old = el.querySelector('.lf-pchips');
        const html = chipsHtml(id);
        if (!html) { old?.remove(); return; }
        if (old && old.outerHTML === html) return;
        const host = el.querySelector('.mes_block') || el;
        old?.remove();
        host.insertAdjacentHTML('beforeend', html);
    });
    watchDetails(chatEl);
}

function decorate() {
    const chatEl = document.getElementById('chat');
    if (!chatEl || decorating) return;
    decorating = true;
    try {
        chatEl.querySelectorAll(':scope > .lf-div, :scope > #lf-bar, :scope > .lf-more, :scope > .lf-move, :scope > .lf-thin').forEach(x => x.remove());
        chatEl.classList.remove('lf-focus', 'lf-focus-full');
        const s = settings();
        const mesEls = chatEl.querySelectorAll(':scope > .mes[mesid]');
        if (!s.enabled || !hasChat()) {
            mesEls.forEach(el => { el.classList.remove('lf-out', 'lf-marker'); el.querySelectorAll('.lf-pchips, .lf-shot, .lf-shot-sug, .lf-shot-btn').forEach(x => x.remove()); });
            return;
        }
        // чат остаётся сплошным: только прячем служебные отметки Life и (по желанию) ставим тонкую черту, где сменилось место
        const chat = chatArr();
        const thin = s.chatMarks === 'thin';
        const list = thin ? chapters() : [];
        const starts = new Map(list.map(ch => [ch.start, ch]));
        for (const el of mesEls) {
            const id = Number(el.getAttribute('mesid'));
            el.classList.remove('lf-out');
            el.classList.toggle('lf-marker', !!chat[id]?.extra?.life);
            const st = starts.get(id);
            if (st && st.idx > 0) el.insertAdjacentHTML('beforebegin', thinHtml(st));
        }
        paintChips();
    } catch (e) {
        console.error('[Life] decorate', e);
    } finally {
        observer?.takeRecords();
        decorating = false;
    }
}

let decoTimer = null;
function decorateSoon(ms = 60) {
    clearTimeout(decoTimer);
    decoTimer = setTimeout(() => { decorate(); if (ui.open) renderSoon(); }, ms);
}

function hookChat() {
    const chatEl = document.getElementById('chat');
    if (!chatEl || chatEl.dataset.lfHooked) return !!chatEl;
    chatEl.dataset.lfHooked = '1';
    observer = new MutationObserver(() => { if (!decorating) decorateSoon(80); });
    observer.observe(chatEl, { childList: true });
    chatEl.addEventListener('click', onChatClick);
    return true;
}

async function onChatClick(ev) {
    // режим правки поста: тап по абзацу
    try { if (fixTap(ev)) return; } catch (e) { console.warn('[Life] правка', e); }
    try { if (onArtPick(ev)) return; } catch (e) { console.warn('[Life] карточка', e); }
    if (onArtClick(ev)) return;
    if (onShotClick(ev)) return;
    // свои кнопки в посте (чипы «не пропусти» и т. п.)
    const own = ev.target.closest('.lf-reply [data-act], .lf-frame [data-act], .lf-own [data-act]');
    if (own) {
        ev.preventDefault();
        ev.stopPropagation();
        const act = own.dataset.act;
        try { if (replyClick(act, own)) return; } catch (e) { console.warn('[Life] не пропусти', e); }
        for (const h of chatClicks) { try { if (await h(act, own)) return; } catch (e) { console.warn('[Life] пост', e); } }
        return;
    }
    const det = ev.target.closest('.lf-detail, .lf-detpick');
    if (det) {
        if (ev.target.closest('input')) { ev.stopPropagation(); return; } // поле «что поправить» — дать фокус
        const db = ev.target.closest('[data-det]');
        if (!db) return;
        ev.preventDefault();
        ev.stopPropagation();
        onDetailClick(db, det);
        return;
    }
    const b = ev.target.closest('.lf-thin, .lf-pchips, .lf-cutcard');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (b.classList.contains('lf-cutcard')) { const c = cuts().find(x => x.id === b.dataset.cut); if (c) playCut(c, { music: cutMusic(c) }); return; }
    if (b.classList.contains('lf-pchips')) { if (!b.classList.contains('busy')) { openHub('world'); chronSheet(Number(b.dataset.mes)); } return; }
    ui.focus = Number(b.dataset.start);
    openHub('scene');
}

function scrollChatBottom() { const el = document.getElementById('chat'); if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }

async function jumpTo(mesId) {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    if (mesId < firstShownId(chatEl)) {
        try { await ctx().executeSlashCommandsWithOptions?.(`/chat-jump ${mesId}`); } catch (e) { console.warn('[Life] chat-jump', e); }
        decorate();
    }
    const el = chatEl.querySelector(`.lf-thin[data-start="${mesId}"]`) || chatEl.querySelector(`.mes[mesid="${mesId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function gotoChapter(start, { close = true } = {}) {
    const list = chapters();
    const ch = list.find(x => x.start === start);
    if (!ch) return;
    if (close) closeHub();
    decorate();
    if (ch.idx === list.length - 1 && ch.end - ch.start > 3) scrollChatBottom(); else await jumpTo(ch.start);
}

// ───────────── хаб: каркас ─────────────

let openedAt = 0;
let renderTimer = null;
function renderSoon() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 120); }

const TABS = [['scene', 'scene', 'Сцена'], ['map', 'pin', 'Карта'], ['person', 'user', 'Персонаж'], ['people', 'users', 'Люди'], ['world', 'globe', 'Мир']];

function buildHub() {
    if (document.getElementById('lf-dialog')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'lf-dialog';
    dlg.innerHTML = `
    <div id="lf-app">
        <header class="lf-top">
            <div class="lf-brand">${CANDLE}<div><div class="lf-brand-t">Таверна <span>/</span> LIFE</div><div class="lf-brand-s">SillyTavern</div></div></div>
            <div class="lf-top-r"><span class="lf-me"></span><button class="lf-x" data-act="close" title="Закрыть">${icon('x')}</button></div>
        </header>
        <main class="lf-body"></main>
        <nav class="lf-tabs">${TABS.map(([k, ic, t]) => `<button class="lf-tab" data-act="tab" data-tab="${k}">${icon(ic)}<span>${t}</span></button>`).join('')}<i class="lf-tab-ink"></i></nav>
        <div class="lf-sheet-host"></div>
        <div class="lf-travel"></div>
    </div>`;
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (!closeSheet()) closeHub(); });
    document.body.append(dlg);
    const app = dlg.querySelector('#lf-app');
    app.addEventListener('click', onClick);
    app.addEventListener('change', onChange);
    app.addEventListener('input', onInput);
    app.addEventListener('pointerdown', onPointerDown);
    app.addEventListener('pointerdown', ripple, true);
}

function ripple(ev) {
    const b = ev.target.closest('.lf-btn, .lf-tab, .lf-chip, .lf-card, .lf-pin, .lf-tile, .lf-seg button');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 1.6;
    const sp = document.createElement('span');
    sp.className = 'lf-ripple';
    sp.style.cssText = `width:${d}px;height:${d}px;left:${ev.clientX - r.left - d / 2}px;top:${ev.clientY - r.top - d / 2}px`;
    b.append(sp);
    setTimeout(() => sp.remove(), 650);
}

function openHub(tab) {
    if (!hasChat()) { toast('info', 'Сначала открой чат'); return; }
    openedAt = Date.now();
    buildHub();
    if (tab) ui.tab = tab;
    ui.open = true;
    render();
    const dlg = document.getElementById('lf-dialog');
    if (dlg && !dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
    requestAnimationFrame(() => requestAnimationFrame(() => dlg?.classList.add('on')));
}

function closeHub() {
    ui.open = false;
    ui.focus = 'last';
    closeSheet();
    const dlg = document.getElementById('lf-dialog');
    if (!dlg) return;
    dlg.classList.remove('on');
    const t = openedAt;
    setTimeout(() => { if (dlg.open && !ui.open && openedAt === t) dlg.close(); }, 320);
}

function render() {
    const app = document.getElementById('lf-app');
    if (!app || !ui.open) return;
    app.querySelectorAll('.lf-tab').forEach((b, i) => {
        const on = b.dataset.tab === ui.tab;
        b.classList.toggle('on', on);
        if (on) app.querySelector('.lf-tab-ink').style.transform = `translateX(${i * 100}%)`;
    });
    const me = app.querySelector('.lf-me');
    if (me) me.innerHTML = ava(ui.tab === 'person' && ui.who && !String(ui.who).startsWith('pet:') && !bridgeOf(ui.who) ? ui.who : ctx().name1, 'ring');
    const body = app.querySelector('.lf-body');
    const same = body.dataset.tab === ui.tab;
    const keep = same ? body.scrollTop : 0;
    try {
        body.innerHTML = ui.tab === 'map' ? renderMap() : ui.tab === 'person' ? renderPerson() : ui.tab === 'people' ? renderPeople() : ui.tab === 'world' ? renderWorld() : renderScene();
    } catch (e) {
        console.error('[Life] render', e);
        body.innerHTML = `<div class="lf-empty"><b>Ошибка Life</b><pre class="lf-pre">${esc(String(e?.stack || e).slice(0, 900))}</pre>Сделай скрин и кинь Claude.</div>`;
    }
    body.classList.toggle('lf-anim', !same);
    body.dataset.tab = ui.tab;
    body.scrollTop = keep;
}

const seg = (items, cur, act) => `<div class="lf-seg">${items.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${esc(k)}">${t}</button>`).join('')}</div>`;
const sec = (t, small = '') => `<div class="lf-sec"><span>${t}</span>${small ? `<i class="lf-sec-line"></i><small>${small}</small>` : ''}</div>`;

function pillHtml(st) {
    const parts = [weekday(st.timestamp?.story_date) || st.timestamp?.story_date, st.timestamp?.story_time, weatherWord(st.scene?.atmosphere)].filter(Boolean);
    return parts.length ? `<div class="lf-pill">${parts.map(esc).join(' <b>·</b> ')}</div>` : '';
}

// ───── Сцена ─────

function lastPost(ch) {
    const chat = chatArr();
    for (let i = ch.end; i >= ch.start; i--) {
        const m = chat[i];
        if (!isPost(m)) continue;
        const t = plainText(m.mes);
        if (!t) continue;
        const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
        const lineIdx = lines.findIndex(l => /^[—–-]\s|^«/.test(l));
        const line = lineIdx >= 0 ? lines[lineIdx].replace(/^[—–-]\s*/, '').split(/\s[—–]\s/)[0] : '';
        const narr = lines.filter((_, k) => k !== lineIdx).join(' ');
        return { i, name: m.name, line: cut(line, 120), narr: cut(narr, 330) };
    }
    return null;
}

function chapterCard(ch, curStart) {
    const cover = chapterCover(ch);
    return `<button class="lf-card lf-chcard${ch.start === curStart ? ' on' : ''}" data-act="chapter" data-start="${ch.start}">
        <span class="lf-chcard-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>${cover ? '' : icon(placeIcon(ch.loc))}</span>
        <span class="lf-chcard-txt">
            <span class="lf-chcard-head"><b>${esc(ch.title)}</b><small>${esc(whenLabel(ch.endDate || ch.date, ch.endTime || ch.time))}</small></span>
            <span class="lf-chcard-prev">${esc(ch.preview || '…')}</span>
        </span>
    </button>`;
}

function renderScene() {
    const st = worldState();
    const list = chapters();
    if (!list.length) return `<div class="lf-empty">${icon('book', 'xl')}<b>Чат пуст</b></div>`;
    const last = list[list.length - 1];
    const fch = focusChapter(list) || last;
    const isCur = fch === last;
    const loc = isCur ? (st.scene?.location || fch.loc) : fch.loc;
    const cover = chapterCover(fch) || placeCover(loc);
    const when = isCur ? whenLabel(st.timestamp?.story_date, st.timestamp?.story_time) : whenLabel(fch.date, fch.time);
    const weather = isCur ? weatherWord(st.scene?.atmosphere) : '';
    const post = lastPost(fch);
    const ch = lastChron(fch.end, fch.start);
    const present = isCur ? (st.scene?.characters_present || []).map(canonName).filter(Boolean).filter(isOwn) : [];
    const warn = horaeOn() ? '' : `<div class="lf-note">${icon('activity')} Horae выключен или не найден — места и время беру только из уже записанного.</div>`;
    const shown = [...list].reverse().slice(0, ui.chShow);
    return `${warn}
    <div class="lf-titlebar">
        <button class="lf-iconbtn" data-act="to-chapters" title="Все главы">${icon('left')}</button>
        <h1>${esc(fch.title)}</h1>
        <span class="lf-kicker">гл. ${pad2(fch.num)}</span>
    </div>
    <section class="lf-frame${cover ? '' : ' empty'}">
        <div class="lf-frame-img${cover ? ' lf-fit' : ''}"${fitAttr(cover)}>${cover ? '<i class="lf-fit-i"></i>' : ''}</div>
        <button class="lf-glass" data-act="frame" data-start="${fch.start}" data-loc="${esc(loc)}">${icon('refresh')} ${cover ? 'Обновить кадр' : 'Добавить кадр'}</button>
        <div class="lf-frame-cap">${icon(placeIcon(loc))}<span>${esc(loc ? placeName(locTop(loc)) : 'место не отмечено')}${locParts(loc).length > 1 ? ` · ${esc(locLeaf(loc))}` : ''}${when ? ` <b>·</b> ${esc(when)}` : ''}${weather ? ` <b>·</b> ${esc(weather)}` : ''}</span></div>
    </section>
    ${post ? `<div class="lf-post">
        ${ava(canonName(post.name), 'post')}
        <div class="lf-post-body">
            <div class="lf-post-n">${esc(canonName(post.name))}</div>
            ${post.line ? `<div class="lf-post-line">— ${esc(post.line)}</div>` : ''}
            ${post.narr ? `<div class="lf-post-narr">${esc(post.narr)}</div>` : ''}
        </div>
    </div>` : ''}
    ${ch ? `<button class="lf-statechip" data-act="chron" data-mes="${ch.i}">${icon('spark')}<span>${ch.e.chips.map(esc).join(' <b>·</b> ')}</span></button>` : ''}
    ${present.length ? `<div class="lf-present">${present.map(n => {
        const mood = moodOf(n, st);
        return `<button class="lf-pers" data-act="person" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span>${mood ? `<span class="lf-pers-m">${esc(cut(mood, 20))}</span>` : ''}</button>`;
    }).join('')}</div>` : ''}
    ${isCur ? (() => { try { return stageHtml(); } catch (e) { console.warn('[Life] мизансцена', e); return ''; } })() : ''}
    ${isCur ? (() => { try { return simSceneHtml(); } catch (e) { console.warn('[Life] Жизнь: сцена', e); return ''; } })() : ''}
    ${isCur ? bridgeEach(m => m.sceneHtml?.(), 'сцена').join('') : ''}
    ${isCur ? `${sec('Настроение сцены', 'до конца главы')}${moodHtml('life')}` : ''}
    ${(() => {
        const ci = imagesBetween(imgs(), fch.start, fch.end).slice(-14).reverse();
        const cc = cuts().filter(c => c.mes >= fch.start && c.mes <= fch.end).reverse();
        return ci.length || cc.length ? `${sec('Кадры главы', String(ci.length + cc.length))}<div class="lf-strip">${cc.map(cutTile).join('')}${ci.map(x => `<button class="lf-strip-i" data-act="lightbox" data-src="${esc(x.src)}" data-mes="${x.mes}" style="background-image:url('${esc(x.src)}')"></button>`).join('')}</div>` : '';
    })()}
    <div class="lf-actions">
        <button class="lf-btn primary serif" data-act="read" data-start="${fch.start}">${isCur ? 'Вернуться в сцену' : 'Читать главу'}</button>
        <button class="lf-btn" data-act="new-chapter">${icon('feather')} Новая глава</button>
    </div>
    <div class="lf-actions">
        <button class="lf-btn" data-act="director">${icon('scene')} Режиссёр</button>
        <button class="lf-btn" data-act="time-skip">${icon('sunrise')} Перейти к утру</button>
    </div>
    <div id="lf-chapters">${sec('Главы', `${list.length} · один чат, модель видит всё`)}</div>
    <div class="lf-chlist">${shown.map(c => chapterCard(c, fch.start)).join('')}</div>
    ${list.length > shown.length ? `<button class="lf-btn ghost full" data-act="more-ch">Ещё ${Math.min(30, list.length - shown.length)}</button>` : ''}`;
}

// ───── Карта ─────

function mapLevel() { const key = ui.mapStack[ui.mapStack.length - 1]; return key ? { key, place: settings().places[key] } : null; }

function pinsFor(level, region) {
    const out = [];
    for (const [key, p] of placesNow()) {
        if (p.x == null || p.y == null) continue;
        const parts = key.split('·');
        if (level) { if (parts.length < 2 || parts.slice(0, -1).join('·') !== level.key) continue; }
        else if (parts.length !== 1 || p.region !== region?.id) continue;
        out.push([key, p]);
    }
    return out;
}

function vehicleFor(names, st) {
    for (const [n, it] of Object.entries(st.items || {})) if (isVehicle(n, it) && names.some(x => sameName(x, it.holder))) return n;
    for (const [n, it] of Object.entries(st.items || {})) if (isVehicle(n, it)) return n;
    return '';
}

function placeCardHtml(loc, { inline = false } = {}) {
    const st = worldState();
    const cover = placeCover(loc);
    const curKey = placeKey(st.scene?.location);
    const key = placeKey(loc);
    const here = curKey === key || curKey.startsWith(key + '·');
    const present = here ? (st.scene?.characters_present || []).map(canonName).filter(isOwn) : [];
    const chs = chaptersAt(loc);
    const p = getPlace(loc);
    const desc = placeDesc(loc);
    const inside = !!p?.plan || [...knownLocations().keys()].some(k => k.startsWith(key + '·'));
    const car = vehicleFor(present.length ? present : (st.scene?.characters_present || []), st);
    const meta = [present.length ? `${present.map(shortName).join(', ')} ${present.length > 1 ? 'здесь' : 'здесь'}` : '', chs.length ? `${chs.length} ${plural(chs.length, 'глава', 'главы', 'глав')}` : 'ещё не бывали'].filter(Boolean).join(' · ');
    return `<div class="lf-placecard${inline ? ' inline' : ''}" data-key="${esc(key)}">
        <div class="lf-pc-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>${cover ? '' : icon(placeIcon(loc), 'xl')}</div>
        <div class="lf-pc-body">
            <h3>${esc(placeName(loc))}</h3>
            <div class="lf-pc-meta">${esc(meta)}</div>
            ${desc && !inline ? `<div class="lf-pc-desc">${esc(cut(desc, 200))}</div>` : ''}
            ${!here ? (() => { try { return routeHtml(st.scene?.location || '', loc, car ? 'car' : 'walk'); } catch { return ''; } })() : ''}
            ${here ? `<div class="lf-here">${icon('target')} Вы здесь</div>` : `<button class="lf-btn primary serif go" data-act="travel" data-loc="${esc(loc)}">Отправиться ${icon('right')}</button>`}
            <div class="lf-pc-foot">
                ${!here ? `<span>${icon(car ? 'car' : 'walk')} ${car ? `На машине · ${esc(cut(car, 22))}` : 'Пешком'}</span>` : ''}
                ${inside ? `<button class="lf-link" data-act="inside" data-key="${esc(key)}">${icon('door')} Внутри</button>` : ''}
                ${roomButton(key)}
                <button class="lf-link" data-act="place-menu" data-loc="${esc(loc)}">${icon('more')}</button>
            </div>
        </div>
    </div>`;
}

function renderAtlas() {
    const s = settings();
    const cur = currentRegion();
    return `<div class="lf-pagehead"><div><span class="lf-kicker">Атлас</span><h1>Карты</h1></div>
        <button class="lf-iconbtn" data-act="atlas-close">${icon('x')}</button></div>
    <div class="lf-atlas">${regionsNow().map(r => {
        const n = placesNow().filter(([, p]) => p.region === r.id).length;
        return `<button class="lf-card lf-region${r.id === cur?.id ? ' on' : ''}" data-act="region" data-id="${esc(r.id)}">
            <span class="lf-region-img"${r.map ? ` style="background-image:url('${esc(r.map)}')"` : ''}>${r.map ? '' : icon('map', 'xl')}</span>
            <span class="lf-region-t"><b>${esc(r.name)}</b><small>${n} ${plural(n, 'место', 'места', 'мест')}${r.id === cur?.id ? ' · вы здесь' : ''}${r.needsMap ? ' · нужна карта' : ''}</small></span>
        </button>`;
    }).join('')}</div>
    <button class="lf-btn ghost full" data-act="region-new">${icon('plus')} Новый район / город / страна</button>`;
}

function renderMap() {
    if (ui.atlas) return renderAtlas();
    if (ui.room) return renderRoom(ui.room);
    const s = settings();
    const st = worldState();
    const level = mapLevel();
    const region = (ui.region && regionById(ui.region)) || currentRegion();
    const img = level ? level.place?.plan : region?.map;
    const curLoc = st.scene?.location || '';
    const curKey = placeKey(curLoc);
    const pins = pinsFor(level, region);
    let wl = [];
    try { wl = whereAll(); } catch (e) { console.warn('[Life] кто где', e); }
    const pinHtml = pins.map(([key, p]) => {
        const here = curKey === key || curKey.startsWith(key + '·');
        const sel = ui.sel === key;
        const who = whoAtPin(key, wl).map(x => x.who);
        return `<button class="lf-pin${here ? ' here' : ''}${sel ? ' sel' : ''}${ui.editPins ? ' edit' : ''}" data-act="pin" data-key="${esc(key)}" style="left:${p.x}%;top:${p.y}%">
            <span class="lf-pin-label">${icon(iconName(p.icon))}${esc(locLeaf(p.name))}${who.length ? `<span class="lf-pin-who">${who.slice(0, 4).map(n => ava(n, 'xs')).join('')}</span>` : ''}</span>
            <span class="lf-pin-stem"></span><span class="lf-pin-dot"></span>
        </button>`;
    }).join('');

    const known = knownLocations();
    const placed = new Set(pins.map(([k]) => k));
    const unplaced = [];
    for (const [k, raw] of known) {
        if (placed.has(k)) continue;
        const parts = k.split('·');
        if (level) { if (parts.length >= 2 && parts.slice(0, -1).join('·') === level.key) unplaced.push([k, raw]); continue; }
        if (parts.length !== 1) continue;
        const p = s.places[k];
        if (!p?.region || p.region === region?.id) unplaced.push([k, raw]);
    }
    // выбранное место для карточки
    let selLoc = '';
    if (ui.sel && s.places[ui.sel]) selLoc = s.places[ui.sel].raw || s.places[ui.sel].name;
    else if (level) selLoc = curKey.startsWith(level.key + '·') ? curLoc : '';
    else selLoc = placeRegion(curLoc)?.id === region?.id ? locTop(curLoc) : '';

    const head = level
        ? `<div class="lf-pagehead"><button class="lf-iconbtn" data-act="map-up">${icon('left')}</button><div class="lf-grow"><span class="lf-kicker">${esc(region?.name || '')}</span><h1>${esc(level.place?.name || level.key)}</h1></div>${pillHtml(st)}</div>`
        : `<div class="lf-pagehead"><div class="lf-grow"><span class="lf-kicker">Карта</span><h1>${esc(region?.name || 'Мир')}</h1></div>${pillHtml(st)}</div>`;
    // внутри места: дом в разрезе (кукольный домик) или план-картинка
    const dhMode = level ? (ui.dhModes?.[level.key] || dhDefault(level.key)) : '';
    const dhSeg = level ? seg([['cut', `${icon('home')} В разрезе`], ['plan', `${icon('map')} План`]], dhMode, 'map-dh') : '';
    if (level && dhMode === 'cut') {
        let house = '';
        try { house = dollhouseHtml(level.key); } catch (e) { console.warn('[Life] домик', e); house = `<div class="lf-empty small">${esc(String(e?.message || e))}</div>`; }
        return `${head}${dhSeg}${house}`;
    }
    let homeKey = '';
    try { homeKey = dhHomeKey(); } catch { /* */ }
    const regs = !level ? `<div class="lf-chips">
        ${homeKey ? `<button class="lf-chip" data-act="map-home" data-key="${esc(homeKey)}">${icon('home')} Дом</button>` : ''}
        <button class="lf-chip" data-act="atlas">${icon('layers')} Атлас</button>
        ${regionsNow().map(r => `<button class="lf-chip${r.id === region?.id ? ' on' : ''}" data-act="region" data-id="${esc(r.id)}">${esc(r.name)}${r.needsMap ? ' •' : ''}</button>`).join('')}
    </div>` : '';

    const mapBox = img ? `<div class="lf-map${ui.editPins ? ' editing' : ''}">
            <div class="lf-map-in" data-act="map-tap"><img src="${esc(img)}" alt="" draggable="false">${(() => { try { return selLoc && !ui.editPins ? routeSvg(pins, curLoc, selLoc, '') : ''; } catch { return ''; } })()}${pinHtml}</div>
            ${ui.editPins ? '' : `<div class="lf-map-tools"><button class="lf-glass" data-act="edit-pins" title="Метки">${icon('pencil')}</button><button class="lf-glass" data-act="map-menu" data-key="${esc(level?.key || '')}">${icon('refresh')} ${level ? 'План' : 'Карта'}</button></div>`}
            ${ui.editPins ? `<div class="lf-map-hint">${icon('pencil')} Тапни по карте — поставить метку, тяни метку — подвинуть</div>` : ''}
        </div>`
        : `<div class="lf-mapempty">
            ${icon(level ? 'home' : 'map', 'xl')}
            <b>${level ? 'Плана пока нет' : `Карты «${esc(region?.name)}» пока нет`}</b>
            <span>${level ? 'Загрузи свою картинку (квартира сверху, изометрия) или нарисуй — и расставь комнаты.' : `Нарисую ${unplaced.length ? `сразу с местами (${unplaced.slice(0, 9).map(([, r]) => locLeaf(r)).join(', ')}) — метки встанут сами` : 'город сверху'}. Или загрузи свою.`}</span>
            <div class="lf-actions center">
                <button class="lf-btn primary serif" data-act="${level ? 'draw-plan' : 'draw-map'}" data-key="${esc(level?.key || '')}">${icon('wand')} Нарисовать</button>
                <label class="lf-btn">${icon('upload')} Загрузить<input type="file" accept="image/*" data-file="${level ? 'plan' : 'map'}" data-key="${esc(level?.key || '')}" hidden></label>
            </div>
        </div>`;

    return `${head}${regs}${level ? dhSeg : ''}${mapBox}
    ${selLoc ? placeCardHtml(selLoc, { inline: true }) : ''}
    ${!level && wl.length ? (() => { try { return whoisHtml(wl); } catch { return ''; } })() : ''}
    ${img ? `<div class="lf-actions">
        <button class="lf-btn${ui.editPins ? ' primary' : ''}" data-act="edit-pins">${icon(ui.editPins ? 'check' : 'pencil')} ${ui.editPins ? 'Готово' : 'Метки'}</button>
        <button class="lf-btn icon" data-act="map-menu" data-key="${esc(level?.key || '')}" title="Карта">${icon('more')}</button>
    </div>` : ''}
    ${unplaced.length ? `${sec('Без метки', ui.editPins ? 'тапни место, потом точку' : img ? 'нарисую или поставь сама' : 'места из истории')}
        <div class="lf-chips wrap">${unplaced.map(([k, raw]) => `<button class="lf-chip${ui.placing === k ? ' on' : ''}" data-act="${ui.editPins && img ? 'placing' : 'place'}" data-key="${esc(k)}" data-loc="${esc(raw)}">${icon(iconName(s.places[k]?.icon || guessPlaceIcon(norm(locLeaf(raw)))))} ${esc(locLeaf(raw))}</button>`).join('')}</div>` : ''}
    <button class="lf-btn ghost full" data-act="add-place">${icon('plus')} Новое место</button>`;
}

// ───── Персонаж ─────

function wardrobeWorn(name) {
    const w = ctx().chatMetadata?.wardrobe;
    if (!w?.chars) return null;
    for (const [n, st] of Object.entries(w.chars)) if (sameName(n, name)) return st?.worn || [];
    return null;
}

function wardrobeSets(name) {
    // Гардероб 1.7+: только комплекты облика этой эпохи (его же фильтр, «все эпохи» — тоже его); старый — все, как было
    const api = window.Wardrobe?.setsFor;
    const sets = (typeof api === 'function' ? api() : ctx().extensionSettings?.wardrobe?.sets) || [];
    return sets.filter(x => !x.owner || sameName(x.owner, name));
}

function renderPerson() {
    const st = worldState();
    const names = personNames(st);
    const bm = bridgeOf(ui.who);
    const petMode = String(ui.who || '').startsWith('pet:') || !!bm;
    if (!petMode && (!ui.who || !names.some(n => sameName(n, ui.who)))) ui.who = (st.scene?.characters_present || []).map(canonName).find(n => !sameName(n, ctx().name1)) || names.find(n => !sameName(n, ctx().name1)) || names[0] || '';
    const who = ui.who;
    if (!who) return `<div class="lf-empty">${icon('users', 'xl')}В этом чате пока никого.</div>`;
    let petsRow = '';
    try { petsRow = petsRowHtml(who); } catch (e) { console.warn('[Life] питомцы', e); }
    petsRow += bridgeEach(m => m.personRow?.(who), 'персонаж').join('');
    const people = `<div class="lf-people">${names.map(n => `<button class="lf-pers${!petMode && sameName(n, who) ? ' on' : ''}" data-act="who" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}${petsRow}</div>`;
    if (bm) { let body = ''; try { body = bm.renderPerson?.(who.slice(bm.id.length + 1)) || ''; } catch (e) { console.warn(`[Life] ${bm.id}`, e); body = `<div class="lf-empty small">${esc(String(e?.message || e))}</div>`; } return `${people}${body}`; }
    if (petMode) return `${people}${renderPet(who.slice(4))}`;
    const me = sameName(who, ctx().name1);
    if (ui.pTab === 'money' && !me) ui.pTab = 'life';
    const tabList = [['life', 'Жизнь'], ['wardrobe', 'Гардероб'], ['items', 'Вещи'], ['garage', 'Гараж'], ['rel', 'Связи'], ...(me ? [['money', 'Деньги']] : [])];
    const tabs = seg(tabList, ui.pTab, 'p-tab').replace('lf-seg', `lf-seg${tabList.length > 5 ? ' many' : ''}`);
    const body = ui.pTab === 'life' ? `${(() => { try { return emoStripHtml(who); } catch (e) { console.warn('[Life] лица', e); return ''; } })()}${renderLife(who)}` : ui.pTab === 'wardrobe' ? renderWardrobe(who, st) : ui.pTab === 'garage' ? renderGarage(who, st) : ui.pTab === 'rel' ? renderRelations(who, st) : ui.pTab === 'money' ? renderMoney() : renderItems(who, st);
    return `${people}${tabs}${body}`;
}

function wardrobeItem(id) { return (ctx().extensionSettings?.wardrobe?.items || []).find(x => x.id === id) || null; }
function setImg(set) { return set?.img || (set?.itemIds || []).map(wardrobeItem).find(it => it?.img)?.img || ''; }

function renderWardrobe(who, st) {
    const worn = wardrobeWorn(who) || [];
    const wornIds = new Set(worn.map(e => e.itemId).filter(Boolean));
    const sets = wardrobeSets(who);
    const isOn = (set) => set.itemIds?.length && set.itemIds.every(id => wornIds.has(id));
    const current = sets.find(isOn);
    if (!sets.some(x => x.id === ui.wset)) ui.wset = (current || sets.find(x => setImg(x)) || sets[0])?.id || '';
    const set = sets.find(x => x.id === ui.wset) || null;
    const on = !!set && isOn(set);
    const img = set?.img || '';
    const pieces = set ? set.itemIds.map(wardrobeItem).filter(Boolean) : worn;
    const drawingNow = !!set && !!window.Wardrobe?.isDrawing?.(set.id);
    const hasApi = !!window.Wardrobe?.wearSets;
    const tile = (e, tab) => `<button class="lf-wd2-piece" data-act="wardrobe" data-tab="${tab}">${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy">` : `<span class="lf-wd2-noimg">${icon('shirt')}</span>`}<span>${esc(e.name)}</span></button>`;
    const setThumb = (x) => `<button class="lf-wd2-set${x.id === ui.wset ? ' on' : ''}" data-act="wset" data-v="${esc(x.id)}">
        <span class="lf-wd2-set-i">${setImg(x) ? `<img src="${esc(setImg(x))}" alt="" loading="lazy">` : icon('shirt')}${isOn(x) ? `<b>${icon('check')}</b>` : ''}</span>
        <span class="lf-wd2-set-n">${esc(cut(x.name, 24))}</span></button>`;
    return `<div class="lf-pagehead"><h1>Гардероб</h1><span class="lf-tagpill">${icon('sparkles')} ${esc(cut(canonName(who), 22))}</span></div>
    <section class="lf-wd2">
        <div class="lf-wd2-img${img ? '' : ' empty'}">
            ${img ? `<img src="${esc(img)}" alt="" data-act="lightbox" data-src="${esc(img)}">` : `<span class="lf-wd2-ph">${ava(who, 'xl')}</span>`}
            ${on ? `<span class="lf-wd2-badge">${icon('check')} Надето</span>` : ''}
            ${drawingNow ? '<span class="lf-wd2-wait"><span class="lf-spin big"></span></span>' : ''}
        </div>
        <div class="lf-wd2-info">
            <h2>${esc(set ? set.name : 'Сейчас')}</h2>
            <p>${esc(pieces.length ? pieces.map(e => e.name).join(', ') : 'Ничего не записано.')}</p>
            <div class="lf-wd2-acts">
                ${set ? (on ? `<button class="lf-btn primary serif" disabled>${icon('check')} Надето</button>`
                    : `<button class="lf-btn primary serif" data-act="wset-wear" data-v="${esc(set.id)}" ${hasApi ? '' : 'disabled'}>Надеть</button>`)
                    : `<button class="lf-btn primary serif" data-act="wardrobe" data-tab="sets">Собрать комплект</button>`}
                ${set && !img ? `<button class="lf-btn" data-act="wset-draw" data-v="${esc(set.id)}">${icon('sparkles')} Нарисовать</button>` : ''}
                <button class="lf-btn" data-act="wardrobe" data-tab="${set ? 'sets' : 'worn'}">${icon('shirt')} Гардероб</button>
            </div>
            <span class="lf-hint-i">${on || !set ? 'Образ учитывается в сцене' : 'Сейчас надето другое'}</span>
        </div>
    </section>
    ${sets.length > 1 ? `${sec('Комплекты', String(sets.length))}<div class="lf-wd2-sets">${sets.map(setThumb).join('')}</div>` : ''}
    ${pieces.length ? `${sec(set ? 'В комплекте' : 'Надето', String(pieces.length))}<div class="lf-wd2-pieces">${pieces.map(e => tile(e, set ? 'sets' : 'worn')).join('')}</div>` : ''}
    ${set && worn.length && !on ? `${sec('Сейчас надето')}<div class="lf-wd2-pieces">${worn.slice(0, 12).map(e => tile(e, 'worn')).join('')}</div>` : ''}
    ${(() => { try { return bellyWardrobeHtml(who, set); } catch (e) { console.warn('[Life] живот по сроку', e); return ''; } })()}
    ${hasApi ? '' : '<div class="lf-hint">Обнови Гардероб (git pull) — тогда «Надеть» заработает прямо отсюда.</div>'}`;
}

// что точно не носят с собой: недвижимость, брони, мебель, домашняя техника, запасы и упаковки
const STAY_RE = /квартир|апартамент|(?<![а-яёa-z0-9])дом(?![а-яёa-z0-9])|домик|вилл|особняк|коттедж|бронь|брониров|участ|недвиж|кофевар|зеркал|мебел|диван|кроват|шкаф|холодил|плит[аы](?![а-яёa-z0-9])|продукт|запас|аптечк|коробк|переноск|скотч|сейф|пианино|телевиз|ков[её]р|картин|постер|тест на берем|лубрикант|смазк|упаков|пачк|\(\d+\s*(шт|pack)/i;
// где «при себе»: карман, сумка, руки, шея, палец
const CARRY_RE = /карман|при себе|на себе|в руке|в руках|на шее|на пальц|на руке|запясть|сумк|рюкзак|кошел|бумажник|кобур|за пояс|на поясе|в куртк|в пальто/i;
const ownerOf = (it) => it?.owner || it?.holder || '';
/** Вещь при персонаже прямо сейчас (а не просто его). */
function onPerson(name, it, who) {
    if (!sameName(it?.holder, who)) return false;
    if (it.location && !CARRY_RE.test(it.location)) return false;
    return CARRY_RE.test(it.location || '') || !STAY_RE.test(`${name} ${it.description || ''}`.slice(0, 160));
}

function renderItems(who, st) {
    const items = Object.entries(st.items || {}).filter(([n, it]) => !isVehicle(n, it));
    const mine = items.filter(([n, it]) => onPerson(n, it, who));
    const away = items.filter(([n, it]) => !onPerson(n, it, who) && sameName(ownerOf(it), who));
    const list = ui.itemsTab === 'with' ? mine : ui.itemsTab === 'home' ? away : items;
    if (!list.some(([n]) => n === ui.item)) ui.item = list[0]?.[0] || '';
    const tabs = seg([['with', `При себе (${mine.length})`], ['home', `Дома и не при себе (${away.length})`], ['all', `Всё (${items.length})`]], ui.itemsTab, 'items-tab');
    const sel = ui.item ? st.items[ui.item] : null;
    return `<div class="lf-pagehead"><h1>Инвентарь</h1><span class="lf-subtitle">Вещи, детали, следы истории</span></div>
    ${tabs}
    ${list.length ? `<div class="lf-grid">${list.slice(0, 60).map(([n, it]) => itemTile(n, it, n === ui.item)).join('')}</div>` : `<div class="lf-empty small">${ui.itemsTab === 'with' ? `У ${esc(shortName(who))} при себе ничего не записано.` : 'Пусто.'}</div>`}
    ${sel ? itemCard(ui.item, sel) : ''}
    <div class="lf-actions">
        <button class="lf-btn" data-act="item-add">${icon('plus')} Вещь</button>
        <button class="lf-btn" data-act="inv-clean">${icon('sparkles')} Почистить инвентарь</button>
    </div>`;
}

function itemTile(name, it, on) {
    const img = itemImg(name);
    const imp = it?.importance === '!!' || it?.importance === '!';
    return `<button class="lf-tile${on ? ' on' : ''}" data-act="item" data-name="${esc(name)}">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="lf-tile-ico emoji">${esc(it?.icon || '✦')}</span>`}
        <span class="lf-tile-n">${esc(cut(name, 30))}</span>
        ${imp || on ? `<span class="lf-tile-star">${icon('sparkles')}</span>` : ''}
    </button>`;
}

function itemCard(name, it) {
    const img = itemImg(name);
    const org = itemOrigin(name);
    const when = org ? [org.loc ? placeName(locTop(org.loc)) : '', whenLabel(org.ts?.story_date, org.ts?.story_time)].filter(Boolean).join(' · ') : '';
    return `<section class="lf-itemcard">
        <div class="lf-ic-img"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : `<span class="emoji">${esc(it.icon || '✦')}</span>`}
            <button class="lf-ic-draw" data-act="item-pic" data-name="${esc(name)}" title="Картинка">${icon('camera')}</button></div>
        <div class="lf-ic-body">
            <h3>${esc(name)}${it.importance ? ` <span class="lf-gold">${icon('sparkles')}</span>` : ''}</h3>
            ${ownerOf(it) ? `<div class="lf-ic-row">${icon('user')}<span>Чьё: ${esc(ownerOf(it))}</span></div>` : ''}
            ${it.holder && !sameName(it.holder, ownerOf(it)) ? `<div class="lf-ic-row">${icon('handshake')}<span>Сейчас у: ${esc(it.holder)}</span></div>` : ''}
            ${it.location ? `<div class="lf-ic-row">${icon('pin')}<span>${esc(it.location)}</span></div>` : ''}
            ${it.description ? `<div class="lf-ic-row">${icon('file')}<span>${esc(cut(it.description, 160))}</span></div>` : ''}
            ${when ? `<div class="lf-ic-row line" data-act="jump" data-mes="${org.i}">${icon('clock')}<span>${esc(when)}</span></div>` : ''}
            ${(() => { try { return itemHistoryHtml(name); } catch { return ''; } })()}
        </div>
        <div class="lf-ic-actions">
            <button class="lf-btn primary serif" data-act="item-give" data-name="${esc(name)}">Передать</button>
            <button class="lf-btn" data-act="item-edit" data-name="${esc(name)}">Изменить</button>
            <button class="lf-btn" data-act="item-drop" data-name="${esc(name)}">Убрать</button>
        </div>
    </section>`;
}

function renderGarage(who, st) {
    const cars = Object.entries(st.items || {}).filter(([n, it]) => isVehicle(n, it));
    if (!cars.length) {
        return `<div class="lf-pagehead"><h1>${icon('car', 'h')} Гараж</h1></div>
        <div class="lf-empty small">Машин в истории пока нет. Как только в посте появится тачка, Летописец запишет её сюда — или добавь сама.</div>
        <button class="lf-btn ghost full" data-act="item-add" data-kind="транспорт">${icon('plus')} Добавить машину</button>`;
    }
    if (!cars.some(([n]) => n === ui.car)) ui.car = cars.find(([, it]) => sameName(it.holder, who))?.[0] || cars[0][0];
    const it = st.items[ui.car] || {};
    const img = itemImg(ui.car);
    const s = settings();
    const st2 = worldState();
    const present = (st2.scene?.characters_present || []).map(canonName);
    const others = castNames(st2).filter(n => !sameName(n, who));
    const dests = placesNow().filter(([k]) => !k.includes('·')).slice(0, 40);
    return `<div class="lf-pagehead"><h1>${icon('car', 'h')} Гараж</h1></div>
    ${cars.length > 1 ? `<div class="lf-chips">${cars.map(([n]) => `<button class="lf-chip${n === ui.car ? ' on' : ''}" data-act="car" data-v="${esc(n)}">${esc(cut(n, 22))}</button>`).join('')}</div>` : ''}
    <section class="lf-car">
        <div class="lf-car-img"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : icon('car', 'xl')}
            <button class="lf-glass" data-act="item-pic" data-name="${esc(ui.car)}">${icon('camera')} ${img ? 'Сменить' : 'Картинка'}</button></div>
        <h2>${esc(ui.car)}</h2>
        <div class="lf-car-row"><span>${icon('key')} Ключи ${it.holder ? `у ${esc(shortName(it.holder))}` : 'не у кого'}</span>${it.location ? `<span>${icon('pin')} ${esc(cut(it.location, 26))}</span>` : ''}</div>
    </section>
    <div class="lf-field row"><label>Взять с собой</label><select data-in="car-who" data-local="1"><option value="">— никого —</option>${others.map(n => `<option value="${esc(n)}" ${present.some(p => sameName(p, n)) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
    <div class="lf-field row"><label>Куда</label><select data-in="car-to" data-local="1">${dests.map(([k, p]) => `<option value="${esc(p.raw || p.name)}">${esc(p.name)}</option>`).join('')}</select></div>
    <div class="lf-actions">
        <button class="lf-btn primary serif big" data-act="drive" data-name="${esc(ui.car)}">${icon('car')} Поехать</button>
        <button class="lf-btn big" data-act="car-scene" data-name="${esc(ui.car)}">Сцена в машине</button>
    </div>
    <div class="lf-hint-i center">Разговор продолжится в дороге.</div>`;
}

function renderRelations(who, st) {
    const pairs = relationsState();
    const others = castNames(st).filter(n => !sameName(n, who));
    if (!ui.pair || !others.some(n => sameName(n, ui.pair))) {
        const best = Object.values(pairs).filter(p => sameName(p.a, who) || sameName(p.b, who)).sort((a, b) => b.moments.length - a.moments.length)[0];
        ui.pair = best ? (sameName(best.a, who) ? best.b : best.a) : others[0] || '';
    }
    const other = ui.pair;
    const tab = ui.relTab;
    if (tab === 'map') return `<div class="lf-pagehead"><h1>${icon('rings', 'h')} Отношения</h1></div>${seg([['common', 'Общее'], ['steps', 'Прожитое'], ['map', 'Карта'], ['album', 'Альбом'], ['tri', 'Трое'], ['secrets', 'Секреты'], ['history', 'История']], tab, 'rel-tab').replace('lf-seg', 'lf-seg many')}${(() => { try { return graphHtml(who); } catch (e) { console.warn('[Life] карта связей', e); return ''; } })()}`;
    if (!other && tab !== 'tri') return `<div class="lf-empty small">Не с кем строить отношения.</div>`;
    const pp = pairs[pairKey(who, other)];
    const mine = pp ? relSide(pp, who) : scaleBase(), theirs = pp ? relSide(pp, other) : scaleBase();
    const p = { moments: pp?.moments || [] };
    const pairImg = settings().pairs[pairKey(who, other)] || imagesWith(imgs(), [nameKeys(who), nameKeys(other)]).slice(-1)[0]?.src || '';
    const hrel = horaeRelationships().filter(r => (sameName(r.from, who) && sameName(r.to, other)) || (sameName(r.from, other) && sameName(r.to, who)));
    const secrets = secretsState().filter(x => x.knows.some(k => sameName(k, who) || sameName(k, other)));
    const events = horaeEvents().filter(e => { const t = norm(e.event?.summary); return [who, other].every(n => [canonName(n), ...(aliasTable()[canonName(n)] || [])].some(a => t.includes(norm(a).split(' ')[0]))); }).slice(-20).reverse();
    const A = shortName(canonName(who)), B = shortName(canonName(other));
    const meter = (v) => `<i class="lf-meter"><b style="width:${v}%"></b></i><small>${v}</small>`;
    const bars = `<div class="lf-bars2" data-act="pair-edit">
        <div class="lf-b2-head"><span></span><span></span><b>${esc(A)} → ${esc(B)}</b><b>${esc(B)} → ${esc(A)}</b></div>
        ${SCALES.map(([f, label, ic]) => `<div class="lf-b2-row${Math.abs(mine[f] - theirs[f]) >= 25 ? ' asym' : ''}">${icon(ic)}<span>${label}</span><span class="lf-b2-m">${meter(mine[f])}</span><span class="lf-b2-m">${meter(theirs[f])}</span></div>`).join('')}
        <div class="lf-hint-i">Чувства не всегда взаимны: слева — что ${esc(A)} чувствует к ${esc(B)}, справа — наоборот. Нажми, чтобы поправить.</div>
    </div>`;
    let body = '';
    if (tab === 'tri') {
        body = triListHtml(who, other);
    } else if (tab === 'secrets') {
        body = secrets.length ? secrets.map(x => `<button class="lf-secret" data-act="jump" data-mes="${x.mes}">${icon('lock')}<span><b>Знает ${esc(x.knows.map(n => shortName(canonName(n))).join(', ') || '—')}</b>${esc(x.text)}</span></button>`).join('')
            : `<div class="lf-empty small">Тайн между ними пока нет.</div>`;
    } else if (tab === 'album') {
        body = (() => { try { return albumHtml(who, other, p.moments); } catch (e) { console.warn('[Life] альбом', e); return ''; } })();
    } else if (tab === 'steps') {
        body = (() => { try { return stepsHtml(who, other); } catch (e) { console.warn('[Life] прожитое', e); return ''; } })();
    } else if (tab === 'history') {
        body = events.length ? `<div class="lf-timeline">${events.map(e => `<button class="lf-tl" data-act="jump" data-mes="${e.messageIndex}"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><small>${esc(whenLabel(e.timestamp?.story_date, e.timestamp?.story_time))}</small>${esc(e.event?.summary)}</span></button>`).join('')}</div>`
            : `<div class="lf-empty small">Общих событий Horae пока не записал.</div>`;
    } else {
        const ms = [...p.moments].reverse().slice(0, 30);
        body = ms.length ? `<div class="lf-timeline">${ms.map(m => `<button class="lf-tl" data-act="jump" data-mes="${m.mes}"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(m.text)}</b><small>${esc(whenLabel(m.ts?.story_date, m.ts?.story_time))}</small></span></button>`).join('')}</div>`
            : `<div class="lf-empty small">Ключевые моменты появятся, когда Летописец их заметит.</div>`;
        if (hrel.length) body = `<div class="lf-hrel">${hrel.map(r => `<span>${esc(r.type || '')}${r.note ? ` — ${esc(cut(r.note, 90))}` : ''}</span>`).join('')}</div>${body}`;
        try { body += ritualHtml(who, other); } catch (e) { console.warn('[Life] своё', e); }
        const own = secrets.filter(x => x.knows.length === 1)[0];
        if (own) body += `<button class="lf-secret big" data-act="jump" data-mes="${own.mes}">${icon('lock')}<span><b>Знает только ${esc(shortName(canonName(own.knows[0])))}</b>${esc(own.text)}</span></button>`;
    }
    const nTri = triangles().filter(t => t.who?.some(n => sameName(n, who))).length;
    return `<div class="lf-pagehead"><h1>${icon('rings', 'h')} Отношения</h1></div>
    ${others.length ? `<div class="lf-chips">${others.map(n => `<button class="lf-chip${sameName(n, other) ? ' on' : ''}" data-act="pair" data-v="${esc(n)}">${esc(shortName(n))}</button>`).join('')}</div>` : ''}
    ${other ? `<section class="lf-pairhero${pairImg ? ' lf-fit' : ''}"${fitAttr(pairImg)}>${pairImg ? '<i class="lf-fit-i"></i>' : ''}
        ${pairImg ? '' : `<div class="lf-pair-avas">${ava(who, 'xl')}${ava(other, 'xl')}</div>`}
        <button class="lf-glass" data-act="pair-pic">${icon('image')} ${pairImg ? 'Сменить' : 'Кадр пары'}</button>
        <h2>${esc(A)} <i>×</i> ${esc(B)}</h2>
    </section>
    ${bars}` : ''}
    ${seg([['common', 'Общее'], ['steps', 'Прожитое'], ['map', 'Карта'], ['album', 'Альбом'], ['tri', `Трое${nTri ? ` <span class="lf-cnt">${nTri}</span>` : ''}`], ['secrets', 'Секреты'], ['history', 'История']], tab, 'rel-tab').replace('lf-seg', 'lf-seg many')}
    ${body}`;
}

// треугольники: список и лист правки
function triFig(t) {
    const sides = t.who.filter(n => !sameName(n, t.center));
    return `<span class="lf-tri-fig"><svg viewBox="0 0 80 70" aria-hidden="true"><path d="M40 14 L13 56 L67 56 Z"/></svg>
        <span class="v c">${ava(t.center)}</span><span class="v l">${ava(sides[0] || '')}</span><span class="v r">${ava(sides[1] || '')}</span></span>`;
}

function triCard(t, rs) {
    const k = triKind(t.kind), e = triEnd(t.end);
    const heat = triHeat(t, rs);
    const sides = t.who.filter(n => !sameName(n, t.center)).map(n => shortName(canonName(n)));
    return `<button class="lf-tri${t.on === false ? ' off' : ''}" data-act="tri-edit" data-id="${esc(t.id)}">
        ${triFig(t)}
        <span class="lf-tri-t">
            <b>${esc(sides[0] || '?')} — ${esc(shortName(canonName(t.center)))} — ${esc(sides[1] || '?')}</b>
            <small>${icon(k[2])} ${k[1]} · ${e[1]}${t.on === false ? ' · выключен' : ''}</small>
            <span class="lf-tri-heat"><span>Накал</span><i class="lf-meter"><b style="width:${heat}%"></b></i><small>${heat}</small></span>
            ${t.note ? `<span class="lf-tri-note">${esc(cut(t.note, 120))}</span>` : ''}
        </span>
    </button>`;
}

function triListHtml(who, other) {
    const rs = relationsState();
    const list = triangles().filter(t => t.who?.some(n => sameName(n, who)))
        .sort((a, b) => (b.who.some(n => sameName(n, other)) ? 1 : 0) - (a.who.some(n => sameName(n, other)) ? 1 : 0));
    return `<div class="lf-hint-i">Трое, где чувства к одному влияют на другого. Когда все трое в сцене (или третьего упомянули), модель держит эту ось и ведёт её туда, куда ты скажешь.</div>
    ${list.length ? list.map(t => triCard(t, rs)).join('') : `<div class="lf-empty small">Треугольников с ${esc(shortName(canonName(who)))} пока нет.</div>`}
    <button class="lf-btn full" data-act="tri-new">${icon('plus')} Новый треугольник</button>`;
}

function triPool() {
    const st = worldState();
    const names = [...castNames(st)];
    const add = (n) => { const k = canonName(n); if (k && !names.some(x => sameName(x, k))) names.push(k); };
    Object.keys(st.npcs || {}).forEach(add);
    Object.values(relationsState()).forEach(p => { add(p.a); add(p.b); });
    triangles().forEach(t => t.who?.forEach(add));
    (ui.tri?.who || []).forEach(add);
    return names;
}

function triSheetHtml() {
    const d = ui.tri;
    const pool = triPool();
    const chip = (act, v, on, label) => `<button class="lf-chip${on ? ' on' : ''}" data-act="${act}" data-v="${esc(v)}">${label}</button>`;
    const k = triKind(d.kind), e = triEnd(d.end);
    return `<div class="lf-field"><label>Кто (трое)</label><div class="lf-chips wrap">${pool.map(n => chip('tri-who', n, d.who.some(x => sameName(x, n)), esc(shortName(n)))).join('')}</div>
        <div class="lf-inline"><input type="text" data-f="triadd" placeholder="Ещё имя (например, Земо)"><button class="lf-btn" data-act="tri-add">${icon('plus')}</button></div></div>
    ${d.who.length === 3 ? `<div class="lf-field"><label>Кто в центре — между двумя другими</label><div class="lf-chips wrap">${d.who.map(n => chip('tri-center', n, sameName(n, d.center), esc(shortName(n)))).join('')}</div></div>` : `<div class="lf-hint">Выбери троих — осталось ${3 - d.who.length}.</div>`}
    <div class="lf-field"><label>Ось</label><div class="lf-chips wrap">${TRI_KINDS.map(([id, label, ic]) => chip('tri-kind', id, d.kind === id, `${icon(ic)} ${label}`)).join('')}</div>
        <div class="lf-hint">${esc(k[3].replaceAll('{c}', d.center ? shortName(d.center) : 'центр'))}</div></div>
    <div class="lf-field"><label>Куда ведём</label><div class="lf-chips wrap">${TRI_ENDS.map(([id, label]) => chip('tri-end', id, d.end === id, label)).join('')}</div>
        <div class="lf-hint">${esc(e[2])}</div></div>
    <div class="lf-field"><label>Заметка для модели (по желанию)</label><textarea data-f="trinote" rows="2" placeholder="Например: Баки не боится, что она уйдёт, — бесится, что Земо видит его насквозь">${esc(d.note || '')}</textarea></div>
    <button class="lf-btn primary serif full big" data-act="tri-save"${d.who.length === 3 && d.center ? '' : ' disabled'}>${icon('check')} Сохранить</button>
    ${d.id ? `<div class="lf-actions"><button class="lf-btn ghost" data-act="tri-onoff">${icon('power')} ${d.on === false ? 'Включить' : 'Выключить'}</button><button class="lf-btn ghost" data-act="tri-del">${icon('trash')} Удалить</button></div>` : ''}`;
}

function triSheet() {
    const box = document.querySelector('#lf-app .lf-sheet');
    if (box?.dataset.k === 'tri') { box.querySelector('.lf-sheet-body').innerHTML = triSheetHtml(); return; }
    openSheet(ui.tri.id ? 'Треугольник' : 'Новый треугольник', triSheetHtml(), (b) => { b.dataset.k = 'tri'; });
}

function triKeepNote(box) {
    const ta = box?.querySelector('[data-f="trinote"]');
    if (ta && ui.tri) ui.tri.note = ta.value.trim();
}

// ───── Деньги (банк Телефона) ─────

function renderMoney() {
    const v = moneyView();
    if (!v) {
        const stt = bankState();
        if (stt === 'wait') bank().then(() => { if (ui.open && ui.pTab === 'money') render(); });
        return `<div class="lf-empty small">${icon('smartphone', 'xl')}Банк живёт в Телефоне (Phone-ST). ${stt === 'none' ? 'Телефон не найден — без него денег нет.' : 'Ищу его…'}</div>`;
    }
    const s = settings();
    const billIc = (c) => /аренд|кварт|жиль/i.test(c) ? 'home' : /свет|газ|вод|коммун|счета/i.test(c) ? 'zap' : /связ|телефон|интернет/i.test(c) ? 'smartphone' : /подпис/i.test(c) ? 'music' : /машин|авто|страх/i.test(c) ? 'car' : 'calendar';
    const stTxt = (b) => b.state === 'paid' ? 'оплачено' : b.state === 'overdue' ? 'просрочено' : b.state === 'due' ? 'пора платить' : b.left != null ? `через ${b.left} ${plural(b.left, 'день', 'дня', 'дней')}` : `${b.day}-го`;
    return `<section class="lf-bank${v.balance < 0 ? ' neg' : ''}">
        <span class="lf-bank-k">Счёт ${esc(shortName(canonName(ctx().name1)))}${v.date ? ` · на ${esc(v.date)}` : ''}</span>
        <b class="lf-bank-sum">${esc(v.balanceText)}</b>
        <div class="lf-bank-row"><span>${icon('plus')} ${esc(v.income)}</span><span>${icon('activity')} ${esc(v.expense)}</span>${v.debt ? `<span>${icon('lock')} долг ${esc(v.debt)}</span>` : ''}</div>
        <button class="lf-glass" data-act="money-phone">${icon('smartphone')} В телефоне</button>
    </section>
    ${sec('Обязательные платежи', v.bills.length ? `${esc(v.monthly)} в месяц` : '')}
    ${v.bills.length ? `<div class="lf-bills">${v.bills.map(b => `<div class="lf-bill ${b.state}">
        <span class="lf-bill-ic">${icon(billIc(`${b.category} ${b.name}`))}</span>
        <span class="lf-bill-t"><b>${esc(b.name)}</b><small>${b.day}-го числа · ${stTxt(b)}</small></span>
        <span class="lf-bill-s">${esc(b.sum)}</span>
        ${b.state === 'due' || b.state === 'overdue' ? `<button class="lf-btn small primary" data-act="bill-pay" data-id="${esc(b.id)}">Оплатить</button>` : `<button class="lf-iconbtn" data-act="bill-del" data-id="${esc(b.id)}" title="Убрать">${icon('x')}</button>`}
    </div>`).join('')}</div>` : '<div class="lf-empty small">Счетов пока нет: аренда, свет, связь, страховка — добавь, и они будут списываться сами.</div>'}
    <button class="lf-btn full" data-act="bill-add">${icon('plus')} Добавить платёж</button>
    ${v.loans.length ? `${sec('Кредиты')}<div class="lf-bills">${v.loans.map(l => `<div class="lf-bill ${l.state}"><span class="lf-bill-ic">${icon('lock')}</span><span class="lf-bill-t"><b>${esc(l.name)}</b><small>осталось ${esc(l.remaining)} · ${esc(l.monthly)} ${l.day}-го</small></span>${l.state === 'due' || l.state === 'overdue' ? `<button class="lf-btn small primary" data-act="loan-pay" data-id="${esc(l.id)}">Платёж</button>` : `<span class="lf-bill-s">${l.state === 'paid' ? 'оплачено' : ''}</span>`}</div>`).join('')}</div>` : ''}
    <label class="lf-switch"><input type="checkbox" data-set="money.autopay" ${s.money.autopay ? 'checked' : ''}><span></span>Списывать сами в день оплаты ${v.hasDate ? '' : '<small>(нет даты истории — ждём её)</small>'}</label>
    ${sec('Операции')}
    ${v.tx.length ? `<div class="lf-tx">${v.tx.map(t => `<div class="lf-tx-r"><span class="lf-tx-t"><b>${esc(t.label)}</b><small>${esc(t.category)}</small></span><span class="lf-tx-s${t.plus ? ' plus' : ''}">${esc(t.sum)}</span></div>`).join('')}</div>` : '<div class="lf-empty small">Операций пока нет. Траты из истории приходят сюда сами, когда модель отмечает их для телефона.</div>'}`;
}

function billSheet() {
    openSheet(`${icon('calendar')} Обязательный платёж`, `
        <div class="lf-field"><label>Что</label><div class="lf-chips wrap">${['Аренда', 'Коммуналка', 'Связь и интернет', 'Страховка машины', 'Подписки', 'Спортзал'].map(t => `<button class="lf-chip" data-act="fill-bill" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <input type="text" data-in="bname" placeholder="например: Аренда квартиры"></div>
        <div class="lf-field"><label>Сумма</label><input type="number" inputmode="decimal" data-in="bsum" placeholder="1200"></div>
        <div class="lf-field"><label>Какого числа</label><input type="number" inputmode="numeric" min="1" max="31" data-in="bday" value="1"></div>
        <button class="lf-btn primary serif full big" data-act="bill-save">${icon('check')} Добавить</button>
        <div class="lf-hint">Платёж живёт в банке Телефона. В этот день по дате истории он спишется сам (выключается во вкладке Деньги).</div>`);
}

async function runAutopay() {
    if (!settings().money.autopay || !settings().enabled || !hasChat()) return;
    if (!(await bank())) return;
    const paid = autopay();
    if (paid.length) {
        pushBanner({ app: 'Банк', icon: 'wallet', tint: '#9fc79a', title: 'Списано по счетам', text: paid.map(p => `${p.name} ${p.sum}`).join(' · '), onTap: () => controlApi.openMoney(), ms: 7000 });
        if (ui.open) renderSoon();
    }
}

// ───── Мир ─────

function renderWorld() {
    const st = worldState();
    const tab = ui.worldTab;
    let body = '';
    if (tab === 'days') {
        body = (() => { try { return daysHtml() + recapCfgHtml(); } catch (e) { console.warn('[Life] дни', e); return ''; } })();
    } else if (tab === 'cal') {
        body = (() => { try { return calHtml(); } catch (e) { console.warn('[Life] календарь', e); return ''; } })();
    } else if (tab === 'events') {
        let echoTop = '';
        try { echoTop = echoHtml(); } catch (e) { console.warn('[Life] эхо решений', e); }
        const ev = horaeEvents().slice(-60).reverse();
        const lc = lastChron();
        const fsImg = lc ? (imageNear(imgs(), lc.i)?.src || chapterCover(chapterOf(lc.i) || {})) : '';
        body = `${echoTop}${echoTop && ev.length ? sec('События') : ''}${ev.length ? `<div class="lf-events">${ev.map(e => {
            const ch = chapterOf(e.messageIndex);
            const cover = imageNear(imgs(), e.messageIndex)?.src || (ch ? chapterCover(ch) : '');
            return `<button class="lf-ev" data-act="jump" data-mes="${e.messageIndex}">
                <span class="lf-ev-dot"></span>
                <span class="lf-ev-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></span>
                <span class="lf-ev-t">${esc(e.timestamp?.story_time || e.timestamp?.story_date || `#${e.messageIndex}`)}</span>
                <span class="lf-ev-x">${esc(e.event?.summary)}</span>
            </button>`;
        }).join('')}</div>` : `<div class="lf-empty small">Horae ещё не записал событий.</div>`}
        ${lc ? `<section class="lf-fromscene">
            <div class="lf-fs-img${fsImg ? ' lf-fit' : ''}"${fitAttr(fsImg)}>${fsImg ? '<i class="lf-fit-i"></i>' : ''}</div>
            <div class="lf-fs-body"><span class="lf-badge">Из сцены:</span><h3>${esc(lc.e.chips[0])}</h3>${lc.e.chips.length > 1 ? `<small>${esc(lc.e.chips.slice(1).join(' · '))}</small>` : ''}
            <div class="lf-actions tight"><button class="lf-btn primary" data-act="chron-ok" data-mes="${lc.i}">${icon('check')} Подтвердить</button><button class="lf-btn" data-act="chron" data-mes="${lc.i}">${icon('pencil')} Изменить</button></div></div>
        </section>` : ''}`;
    } else if (tab === 'gallery') {
        const list = imgs().slice().reverse();
        const cs = cuts().slice().reverse();
        const shown = list.slice(0, ui.galShow);
        const dets = [];
        for (let i = chatArr().length - 1; i >= 0 && dets.length < 40; i--) { const e = chronOf(i); if (e?.detImg && !e.detHidden) dets.push({ src: e.detImg, mes: i, cap: e.det?.caption || '' }); }
        body = `${cs.length ? `${sec('Кат-сцены', String(cs.length))}<div class="lf-strip">${cs.map(cutTile).join('')}</div>` : ''}
        ${dets.length ? `${sec('Детали', String(dets.length))}<div class="lf-strip">${dets.map(x => `<button class="lf-dettile" data-act="lightbox" data-src="${esc(x.src)}" data-mes="${x.mes}" style="background-image:url('${esc(x.src)}')"><span>${esc(x.cap)}</span></button>`).join('')}</div>` : ''}
        ${sec('Кадры из чата', list.length ? String(list.length) : '')}
        ${list.length ? `<div class="lf-gallery">${shown.map(x => `<button class="lf-gal" data-act="lightbox" data-src="${esc(x.src)}" data-mes="${x.mes}" style="background-image:url('${esc(x.src)}')"></button>`).join('')}</div>
            ${list.length > shown.length ? `<button class="lf-btn ghost full" data-act="gal-more">Ещё ${Math.min(48, list.length - shown.length)}</button>` : ''}`
            : '<div class="lf-empty small">В чате пока нет картинок. Как только SLAY что-нибудь нарисует, оно будет здесь.</div>'}`;
    } else if (tab === 'state') {
        const chat = chatArr();
        const rows = [];
        for (let i = chat.length - 1; i >= 0 && rows.length < 25; i--) {
            const e = chronOf(i);
            if (e) rows.push(`<button class="lf-row${e.undone ? ' off' : ''}" data-act="chron" data-mes="${i}">${icon('spark')}<span><b>#${i}</b> ${esc((e.chips || []).join(' · ') || `${(e.ops || []).length} правок вещей`)}${e.undone ? ' — откатено' : ''}</span>${icon('chevR', 'dim')}</button>`);
        }
        const ag = horaeAgenda();
        body = `${sec('Летописец', chronProfile() ? esc(chronProfile()) : 'профиль не выбран')}
        <div class="lf-actions">
            <button class="lf-btn" data-act="chron-last">${icon('refresh')} Проверить последний пост</button>
            <button class="lf-btn" data-act="inv-clean">${icon('sparkles')} Почистить инвентарь</button>
        </div>
        <div class="lf-list">${rows.join('') || '<div class="lf-empty small">Летописец ещё ничего не записал.</div>'}</div>
        ${ag.length ? `${sec('Планы')}<div class="lf-list">${ag.map(a => `<button class="lf-row" data-act="jump" data-mes="${a.messageIndex}">${icon('calendar')}<span>${a.date ? `<b>${esc(a.date)}</b> · ` : ''}${esc(a.text)}</span>${icon('chevR', 'dim')}</button>`).join('')}</div>` : ''}`;
        try { body += freshHtml(); } catch (e) { console.warn('[Life] свежесть', e); }
        try { body += slipCfgHtml(); } catch (e) { console.warn('[Life] ляп-фикс', e); }
        try { body += `${sec('В чате')}${callCfgHtml()}`; } catch (e) { console.warn('[Life] звонок', e); }
    } else if (tab === 'rumors') {
        body = renderPress(renderRumors());
    } else if (tab === 'heroes') {
        body = (() => { try { return heroesHtml(); } catch (e) { console.warn('[Life] герои', e); return `<div class="lf-empty small">${esc(String(e?.message || e))}</div>`; } })();
    } else if (tab === 'taste') {
        body = (() => { try { return tasteHtml(); } catch (e) { console.warn('[Life] вкус', e); return `<div class="lf-empty small">${esc(String(e?.message || e))}</div>`; } })();
    } else if (tab === 'time') {
        body = `<section class="lf-clock">
            <span class="lf-clock-d">${esc([weekday(st.timestamp?.story_date), st.timestamp?.story_date].filter(Boolean).join(', ') || 'дата не записана')}</span>
            <b>${esc(st.timestamp?.story_time || '—:—')}</b>
            ${st.scene?.atmosphere ? `<span>${esc(st.scene.atmosphere)}</span>` : ''}
        </section>
        ${(() => { try { return skipHtml(); } catch (e) { console.warn('[Life] перемотка', e); return ''; } })()}
        ${(() => { try { return seasonHtml() + eraHtml(); } catch (e) { console.warn('[Life] сезон', e); return ''; } })()}
        <div class="lf-chips wrap">${['Прошло несколько часов.', 'Прошёл день.', 'Прошло несколько дней.', 'Прошла неделя.'].map(t => `<button class="lf-chip" data-act="skip" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <div class="lf-hint">Простой скачок — новая глава со строчкой для модели, без прокрутки. Время дальше ведёт Horae.</div>`;
    } else body = renderCfg();
    return `<div class="lf-pagehead"><h1>Память мира</h1><span class="lf-subtitle">${icon('sparkles')} Хроника событий, состояние и течение времени</span></div>
    ${seg([['days', 'Дни'], ['cal', 'Календарь'], ['events', 'События'], ['rumors', 'СМИ'], ['heroes', 'Герои'], ['taste', 'Вкус'], ['gallery', 'Кадры'], ['state', 'Летописец'], ['time', 'Время'], ['cfg', icon('settings')]], tab, 'world-tab').replace('lf-seg', 'lf-seg cfg many')}
    ${body}`;
}

function renderCfg() {
    const s = settings();
    const sw = (k, label, obj = s, path = k) => `<label class="lf-switch"><input type="checkbox" data-set="${path}" ${obj[k] ? 'checked' : ''}><span></span>${label}</label>`;
    const profOpts = (cur) => `<option value="">— как у костюмера Гардероба —</option>${profiles().map(p => `<option value="${esc(p.name)}" ${p.name === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}`;
    return `<div class="lf-form">
        ${sw('enabled', 'Life включён')}
        <div class="lf-field"><label>Главы в самом чате</label>
            <select data-set="chatMarks"><option value="off" ${s.chatMarks !== 'thin' ? 'selected' : ''}>никак — сплошной чат, главы только здесь</option><option value="thin" ${s.chatMarks === 'thin' ? 'selected' : ''}>тонкая строчка, где сменилось место</option></select></div>
        ${sw('showFab', 'Плавающая кнопка со свечой')}
        <div class="lf-field"><label>Новая глава, когда меняется</label>
            <select data-set="chapterBy"><option value="top" ${s.chapterBy !== 'full' ? 'selected' : ''}>место целиком (квартира → бар)</option><option value="full" ${s.chapterBy === 'full' ? 'selected' : ''}>даже комната (кухня → спальня)</option></select></div>
        ${sec('Летописец')}
        ${sw('on', 'Летописец после каждого поста', s.chron, 'chron.on')}
        <div class="lf-field"><label>Модель (профиль подключения)</label><select data-set="chron.profile">${profOpts(s.chron.profile)}</select></div>
        <div class="lf-field"><label>Запасной профиль <small>(если ответ пустой, Летописец сам переспросит — этим профилем; без него — тем же)</small></label><select data-set="chron.backup"><option value="">— тот же —</option>${profiles().map(p => `<option value="${esc(p.name)}" ${p.name === s.chron.backup ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Reasoning effort</label><select data-set="chron.effort">${['', 'low', 'medium', 'high'].map(v => `<option value="${v}" ${v === s.chron.effort ? 'selected' : ''}>${v || 'из профиля'}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Токенов на ответ <small>(думающим моделям — 4000–8000, иначе мысли съедят ответ)</small></label><input type="number" min="1000" max="32000" step="500" data-set="chron.tokens" value="${esc(s.chron.tokens)}"></div>
        <div class="lf-field"><label>Ждать ответа, сек</label><input type="number" min="30" max="600" step="10" data-set="chron.timeoutSec" value="${esc(s.chron.timeoutSec)}"></div>
        <div class="lf-field"><label>Когда читать ответ <small>(с паузой — рероллы не оплачиваются: свайпнула до конца паузы — тот вариант не читается; отправила свой пост — читает сразу)</small></label>
            <select data-set="chron.delaySec">${[[0, 'сразу'], [10, 'через 10 секунд'], [20, 'через 20 секунд'], [40, 'через 40 секунд'], [90, 'через полторы минуты']].map(([v, l]) => `<option value="${v}" ${Number(s.chron.delaySec ?? 20) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Перед твоим ответом ждать Летописца, сек <small>(чтобы модель видела свежие раны, руку, кто где; 0 — не ждать)</small></label><input type="number" min="0" max="90" step="5" data-set="chron.waitSec" value="${esc(s.chron.waitSec ?? 25)}"></div>
        ${sw('titles', 'Придумывать названия главам', s.chron, 'chron.titles')}
        ${sw('relations', 'Вести шкалы и моменты отношений', s.chron, 'chron.relations')}
        ${sw('secrets', 'Замечать тайны', s.chron, 'chron.secrets')}
        ${sw('on', 'Деталь крупным планом к каждому посту', s.detail, 'detail.on')}
        ${sw('auto', 'Рисовать деталь сразу (иначе — по нажатию)', s.detail, 'detail.auto')}
        ${sw('motion', 'Живые детали: дождь, дым, пульс, УЗИ', s.detail, 'detail.motion')}
        ${sw('suggest', 'Подсказывать, где в посте просится кадр или кат-сцена', s.shot, 'shot.suggest')}
        ${sw('btn', 'Кнопка «кадр» у каждого поста', s.shot, 'shot.btn')}
        ${sw('on', 'В группе каждый пишет за себя (остальные — коротко, кого нет в сцене — не появляются)', s.cast, 'cast.on')}
        ${sw('on', 'Дописывать оборванный пост: модель оборвала заметки или текст на полуслове — Life допишет тихим запросом тем же подключением (вручную — /life fix)', s.mend, 'mend.on')}
        ${sw('tidy', 'Срезать обрезанный блок в конце поста, если дописать не вышло (иначе он глотает блоки ExtBlocks в «Подробнее»)', s, 'tidy')}
        ${sw('on', 'Плашки газет и писем в постах (старая бумага, сургуч)', s.plates, 'plates.on')}
        <div class="lf-hint">${s.plates.found ? 'Плашки на сервере есть: модель вставляет газету после громких событий и письмо, когда кто-то пишет. Старые посты перерисуются после обновления страницы.' : 'Файла плашек на сервере нет (user/files/life-plates.json) — его кладёт команда из чата с Claude.'}</div>
        ${(() => { const f = fmStatus(s.fmBackup); return `<div class="lf-hint">Fetish Manager (его настройки живут только в браузере): сейчас своих фетишей — ${f.cur ? f.cur.custom : 'нет настроек'}${f.old ? `, в старой версии было — ${f.old.custom}` : ''}${f.backup ? `; копия на сервере от ${new Date(f.backup.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '; копии на сервере пока нет'}.</div>`; })()}
        <div class="lf-field"><label>Стиль кадров по умолчанию <small>(в чате — Режиссёр → Стиль кадров)</small></label><select data-set="shot.style">${SHOT_STYLES.map(([id, label]) => `<option value="${id}" ${id === (s.shot.style || 'story') ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        ${sec('Жизнь вокруг')}
        ${sw('on', 'Персонажи проявляют инициативу сами', simCfg(), 'sim.on')}
        ${sw('tease', 'Их задумки — сюрприз (размыто)', simCfg(), 'sim.tease')}
        ${sw('prefs', 'Запоминать вкусы (для подарков)', simCfg(), 'sim.prefs')}
        ${sw('traces', 'Следы сцен в местах (бокалы, записки…)', simCfg(), 'sim.traces')}
        ${sw('pets', 'Питомцы с потребностями', simCfg(), 'sim.pets')}
        ${sw('inner', 'Внутренняя жизнь: тело, состояние, мысли, свои желания, ухаживания', simCfg(), 'sim.inner')}
        ${(() => { try { return agendaCfgHtml(); } catch { return ''; } })()}
        ${(() => { try { return armCfgHtml(); } catch { return ''; } })()}
        ${sw('rumorsAuto', 'Слухи сами с новым игровым днём', simCfg(), 'sim.rumorsAuto')}
        ${sec('Прочее')}
        <label class="lf-switch"><input type="checkbox" data-set="errHelp" ${s.errHelp !== false ? 'checked' : ''}><span></span>Объяснять ошибки по-русски: что случилось и что делать</label>
        ${sec('Карты и картинки')}
        <div class="lf-field"><label>Новый район</label><select data-set="autoMaps">
            <option value="ask" ${s.autoMaps === 'ask' ? 'selected' : ''}>сказать мне, рисую по кнопке</option>
            <option value="auto" ${s.autoMaps === 'auto' ? 'selected' : ''}>сразу рисовать карту</option>
            <option value="off" ${s.autoMaps === 'off' ? 'selected' : ''}>молчать</option></select></div>
        <div class="lf-field"><label>Стиль картинок <small>(по-английски)</small></label><textarea rows="3" data-set="artStyle">${esc(s.artStyle)}</textarea></div>
        <div class="lf-field"><label>Как зовут персонажей в тексте <small>(Имя карточки = прозвища; из Гардероба уже учтены)</small></label><textarea rows="3" data-set="aliases" placeholder="Bucky Barnes = Баки, Джеймс">${esc(s.aliases)}</textarea></div>
        ${sec('Обслуживание')}
        ${(() => { try { return careHtml(); } catch (e) { console.warn('[Life] обслуживание', e); return ''; } })()}
        ${sec('Сколько Life ходил к модели', 'по дням и модулям')}
        ${(() => { try { return statsHtml(); } catch (e) { console.warn('[Life] счётчик', e); return ''; } })()}
        ${sec('Что сейчас уходит модели от Life', 'по блокам')}
        ${(() => { updateMovePrompt(); try { return promptHtml(promptParts); } catch (e) { console.warn('[Life] промпт', e); return ''; } })()}
        <div class="lf-foot">Life ${VERSION} · Horae ${esc(window.Horae?.version || 'не найден')} · <code>/life</code></div>
    </div>`;
}

// ───── листы ─────

function openSheet(title, html, onMount) {
    const host = document.querySelector('#lf-app .lf-sheet-host');
    if (!host) return null;
    host.innerHTML = `<div class="lf-sheet-back" data-act="sheet-close"></div>
        <div class="lf-sheet" role="dialog">
            <div class="lf-sheet-grab"></div>
            <div class="lf-sheet-head"><div class="lf-sheet-title">${title}</div><button class="lf-x" data-act="sheet-close">${icon('x')}</button></div>
            <div class="lf-sheet-body">${html}</div>
        </div>`;
    host.classList.add('on');
    const box = host.querySelector('.lf-sheet');
    requestAnimationFrame(() => host.classList.add('in'));
    onMount?.(box);
    return box;
}

function closeSheet() {
    const host = document.querySelector('#lf-app .lf-sheet-host');
    if (!host?.classList.contains('on')) return false;
    host.classList.remove('in');
    setTimeout(() => { host.classList.remove('on'); host.innerHTML = ''; }, 220);
    ui.placing = null;
    return true;
}

function travelSheet(loc, { how = '' } = {}) {
    const st = worldState();
    const present = (st.scene?.characters_present || []).map(canonName);
    const cast = castNames(st);
    const who = present.length ? present : cast;
    const cover = placeCover(loc);
    const car = vehicleFor(who, st);
    const hows = [['пешком', 'walk'], car ? [`на машине (${car})`, 'car'] : ['на машине', 'car'], ['на мотоцикле', 'bike'], ['на такси', 'car'], ['на квинджете', 'plane']];
    openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, `
        <div class="lf-sheet-cover"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <div class="lf-field"><label>Кто идёт</label>
            <div class="lf-people wrap">${cast.map(n => `<button class="lf-pers sel${who.some(x => sameName(x, n)) ? ' on' : ''}" data-act="toggle" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}</div></div>
        <div class="lf-field"><label>Как</label>
            <div class="lf-chips wrap" data-how>${hows.map(([h, ic]) => `<button class="lf-chip${h === how || (how && h.startsWith(how)) ? ' on' : ''}" data-act="how" data-how="${esc(h)}">${icon(ic)} ${esc(h)}</button>`).join('')}</div></div>
        ${(() => { try { return routeHtml(st.scene?.location || '', loc, car ? 'car' : 'walk'); } catch { return ''; } })()}
        <div class="lf-field"><label>Заметка для модели <small>(необязательно)</small></label><input type="text" data-in="note" placeholder="например: едут молча после ссоры"></div>
        <button class="lf-btn primary serif full big" data-act="travel-go" data-loc="${esc(loc)}">${icon('route')} Отправиться</button>
        <div class="lf-hint">В чат встанет разделитель новой главы, Horae запомнит новое место, а модель один раз получит короткую заметку о переходе. Пост пишешь ты, как обычно.</div>`);
    // дорога: прикинуть сразу, если ещё не знаем
    const from = st.scene?.location || '';
    const how0 = car ? 'car' : 'walk';
    if (from && placeKey(from) !== placeKey(loc) && !routeCached(from, loc, how0)) {
        routeEstimate(from, loc, how0).then(() => { const b = document.querySelector('#lf-app .lf-sheet .lf-route'); if (b) b.outerHTML = routeHtml(from, loc, how0); }).catch(() => { /* */ });
    }
}

async function playTravel(loc, how) {
    const host = document.querySelector('#lf-app .lf-travel');
    if (!host) return;
    const cover = placeCover(loc);
    const ic = /машин|такси/.test(how) ? 'car' : /мотоцикл/.test(how) ? 'bike' : /квинджет/.test(how) ? 'plane' : 'walk';
    host.innerHTML = `<div class="lf-travel-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <div class="lf-travel-txt">${icon(ic, 'travel')}<small>${esc(how || 'в путь')}</small><b>${esc(placeName(loc))}</b><span class="lf-travel-bar"><i></i></span></div>`;
    host.classList.add('on');
    await new Promise(r => setTimeout(r, 1500));
    host.classList.add('out');
    await new Promise(r => setTimeout(r, 380));
    host.classList.remove('on', 'out');
    host.innerHTML = '';
}

function newChapterSheet({ note = '', title = '' } = {}) {
    const st = worldState();
    openSheet(`${icon('feather')} Новая глава`, `
        <div class="lf-field"><label>Название главы</label><input type="text" data-in="title" value="${esc(title)}" placeholder="например: Утро после"></div>
        <div class="lf-field"><label>Место <small>(пусто — то же: ${esc(placeName(st.scene?.location))})</small></label><input type="text" data-in="loc" placeholder="${esc(st.scene?.location || 'Квартира·Кухня')}"></div>
        <div class="lf-field"><label>Что изменилось <small>(уйдёт модели одной строкой)</small></label>
            <div class="lf-chips wrap">${['Прошла ночь, утро.', 'Прошло несколько часов.', 'Прошло несколько дней.', 'Тем временем, в другом месте.'].map(t => `<button class="lf-chip" data-act="fill-note" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <input type="text" data-in="note" value="${esc(note)}" placeholder="или своими словами"></div>
        <button class="lf-btn primary serif full big" data-act="chapter-go">${icon('feather')} Начать главу</button>`);
}

function directorSheet() {
    const d = chatMeta().director || {};
    const s = settings();
    const opt = (k, list) => `<div class="lf-chips wrap" data-dir="${k}">${list.map(v => `<button class="lf-chip${d[k] === v ? ' on' : ''}" data-act="dir-pick" data-k="${k}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
    const playing = Music.now();
    const cs = cuts().slice(-6).reverse();
    const busyCut = cutBusy ? `<div class="lf-progress"><span>${icon('image')} ${esc(cutBusy)}</span><i><b style="width:${Math.round((cutStep / 4) * 100)}%"></b></i></div>` : '';
    openSheet(`${icon('scene')} Режиссёр сцены`, `
        <div class="lf-field"><label>${icon('moon')} Время</label>${opt('time', ['Утро', 'День', 'Вечер', 'Ночь', 'Рассвет'])}</div>
        <div class="lf-field"><label>${icon('rain')} Погода</label>${opt('weather', ['Ясно', 'Дождь', 'Снег', 'Туман', 'Гроза', 'Метель'])}</div>
        <div class="lf-field"><label>Тон</label>${opt('tone', ['Тихое напряжение', 'Нежность', 'Ссора', 'Юмор', 'Тревога', 'Страсть', 'Горе'])}</div>
        <div class="lf-field"><label>Своими словами <small>(необязательно)</small></label><input type="text" data-in="dir-text" value="${esc(d.free || '')}" placeholder="например: за окном впервые за зиму пошёл снег"></div>
        <button class="lf-btn primary serif full big" data-act="dir-go">${icon('sparkles')} Задать для следующего ответа</button>
        ${d.once ? `<button class="lf-btn ghost full" data-act="dir-clear">Снять: «${esc(cut(d.text, 60))}»</button>` : ''}
        ${sec(`${icon('music')} Музыка`, playing ? esc(playing.name) : '')}
        <div class="lf-music${playing ? ' on' : ''}">
            <select data-in="mus">${s.music.tracks.length ? s.music.tracks.map(t => `<option value="${esc(t.id)}" ${playing?.id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('') : '<option value="">— треков нет, загрузи свой —</option>'}</select>
            <span class="lf-eq"><i></i><i></i><i></i><i></i><i></i></span>
            <button class="lf-iconbtn big" data-act="mus-play" ${s.music.tracks.length ? '' : 'disabled'}>${icon(playing ? 'pause' : 'play')}</button>
        </div>
        <div class="lf-actions tight">
            <label class="lf-btn">${icon('upload')} Добавить трек<input type="file" accept="audio/*" data-file="track" hidden></label>
            ${playing ? `<button class="lf-btn" data-act="mus-del" data-id="${esc(playing.id)}">${icon('trash')} Убрать этот</button>` : ''}
        </div>
        <label class="lf-switch"><input type="checkbox" data-set="music.auto" ${s.music.auto ? 'checked' : ''}><span></span>Месту — свой трек <small>(задаётся в меню места, играет, если музыка уже включена)</small></label>
        ${sec(`${icon('palette')} Стиль кадров`, 'в этом чате')}
        <div class="lf-chips wrap lf-shot-styles">${styleChips('sh-chat-style', chatStyle())}</div>
        ${chatStyle() === 'custom' ? `<div class="lf-field"><label>Свой стиль <small>(лучше по-английски)</small></label><input type="text" data-set="shot.custom" value="${esc(s.shot.custom || '')}" placeholder="soft pastel gouache, dreamy light, visible paper grain"></div>` : ''}
        <div class="lf-hint">Для новых кадров, кат-сцен и деталей. Готовый кадр — ↻ на нём: другой стиль, «что поправить» или другой ракурс.</div>
        ${sec(`${icon('image')} Кат-сцена`, 'ключевые кадры')}
        ${cs.length ? `<div class="lf-strip">${cs.map(cutTile).join('')}</div>` : ''}
        ${busyCut || `<button class="lf-btn primary serif full big" data-act="cut-make">${icon('sparkles')} Снять по последнему посту</button>`}
        <div class="lf-hint">3–4 кадра через SLAY по последнему посту — встанут прямо в пост, в тот момент, где всё происходит, и будут листаться сами. Тап по кат-сцене — на весь экран с музыкой. Модель её не видит. Одиночный кадр — кнопка ${icon('film')} у любого поста.</div>
        ${cs.length ? `<div class="lf-actions tight">${cs.slice(0, 3).map(c => `<button class="lf-btn small ghost" data-act="cut-del" data-id="${esc(c.id)}">${icon('trash')} ${esc(cut(c.title || 'кат-сцена', 18))}</button>`).join('')}</div>` : ''}`);
}

// ───── кат-сцены ─────

let cutBusy = '';
let cutStep = 0;
/** Кат-сцена по последнему посту — теперь встаёт прямо в пост, в тот момент, где всё происходит. */
async function makeCut() {
    if (cutBusy) return;
    const i = lastAiIndex();
    if (i < 0) { toast('info', 'Нет поста, по которому снимать'); return; }
    cutBusy = 'Раскадровка…'; cutStep = 0.4; directorSheet();
    try {
        await shootShot(i, { kind: 'cut', play: true, onStep: (label, frac) => { cutBusy = cap(label); cutStep = frac * 4; if (document.querySelector('[data-act="cut-make"], .lf-progress')) directorSheet(); } });
    } finally {
        cutBusy = ''; cutStep = 0;
        if (document.querySelector('.lf-progress')) directorSheet();
    }
}

function trackById(id) { return settings().music.tracks.find(t => t.id === id) || null; }
/** Музыка для кат-сцены: что играет сейчас, иначе трек места, иначе первый загруженный. */
function cutMusic(c) {
    const s = settings();
    if (!s.music.tracks.length) return null;
    const now = Music.now();
    if (now) return null;
    const loc = c ? (chatArr()[c.mes]?.horae_meta?.scene?.location || worldState().scene?.location) : worldState().scene?.location;
    const p = loc ? getPlace(loc) : null;
    return trackById(p?.track) || s.music.tracks[0];
}

// ───── фон сцены ─────

const VARIANT_LIGHT = {
    evening: 'in the evening at golden hour turning to dusk: warm low sun, long shadows, first lamps switched on',
    night: 'at night: dark sky, practical lights and lamps on, streetlight and neon glow through windows, deep shadows',
};
async function drawVariants(loc) {
    const p = getPlace(loc, true);
    const base = placeCover(loc);
    if (!base) throw new Error('Сначала нужна картинка места');
    const ref = await refData(base, 1280);
    p.imgs = p.imgs || {};
    for (const k of ['evening', 'night']) {
        p.imgs[k] = await drawPicture(`The SAME place as in the reference image, same composition, same camera angle, same furniture and objects, ${VARIANT_LIGHT[k]}. ${placeLine(p)}. Style: ${style()}. No people, no text.`, { aspect: '16:9', refs: [ref], prefix: 'life_place' });
        saveSettings();
    }
}

/** Картинка места под нужное время суток (рассвет берёт вечер, день — основу). */
function placeBg(loc, period) {
    const parts = locParts(loc);
    for (let n = parts.length; n > 0; n--) {
        const p = getPlace(parts.slice(0, n).join('·'));
        if (!p) continue;
        const v = p.imgs || {};
        const pick = period === 'night' ? v.night : period === 'evening' || period === 'dawn' ? v.evening : '';
        if (pick) return pick;
        if (p.img) return p.img;
    }
    return '';
}

let lastBgLoc = '';
function updateSceneBg() {
    try { updateWeather(); } catch (e) { console.warn('[Life] погода', e); }
    const s = settings();
    if (!s.enabled || !s.sceneBg || !hasChat()) { setSceneBg(''); return; }
    const st = worldState();
    const loc = st.scene?.location || '';
    const period = periodOf(st.timestamp?.story_time);
    const list = chapters();
    const ch = list[list.length - 1];
    const url = placeBg(loc, period) || (ch ? imagesBetween(imgs(), ch.start, ch.end).slice(-1)[0]?.src : '') || '';
    setSceneBg(url);
    // трек места: сменить, только если музыка уже играет (браузер не даст включить звук без тапа)
    if (s.music.auto && loc && loc !== lastBgLoc && Music.now()) {
        const t = trackById(getPlace(loc)?.track);
        if (t) Music.play(t);
    }
    lastBgLoc = loc;
}

function placeMenu(loc) {
    const p = getPlace(loc, true);
    const key = placeKey(loc);
    const s = settings();
    const top = !key.includes('·');
    openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, `
        ${placeCardHtml(loc)}
        ${sec('Картинка')}
        <div class="lf-actions">
            <button class="lf-btn" data-act="draw-place" data-loc="${esc(loc)}">${icon('wand')} Нарисовать</button>
            <label class="lf-btn">${icon('upload')} Своя<input type="file" accept="image/*" data-file="place" data-loc="${esc(loc)}" hidden></label>
            ${p?.img ? `<button class="lf-btn icon" data-act="place-noimg" data-loc="${esc(loc)}">${icon('trash')}</button>` : ''}
        </div>
        ${p?.img ? `<div class="lf-actions">
            <button class="lf-btn" data-act="place-variants" data-loc="${esc(loc)}">${icon('moon')} ${p.imgs?.night ? 'Перерисовать вечер и ночь' : 'Вечер и ночь для фона'}</button>
        </div>${p.imgs?.night ? `<div class="lf-variants">${['img', 'evening', 'night'].map(k => { const u = k === 'img' ? p.img : p.imgs?.[k]; return u ? `<button class="lf-strip-i" data-act="lightbox" data-src="${esc(u)}" style="background-image:url('${esc(u)}')"><small>${k === 'img' ? 'день' : k === 'evening' ? 'вечер' : 'ночь'}</small></button>` : ''; }).join('')}</div>` : ''}` : ''}
        ${s.music.tracks.length ? `${sec('Музыка места')}<div class="lf-chips wrap">${s.music.tracks.map(t => `<button class="lf-chip${p?.track === t.id ? ' on' : ''}" data-act="place-track" data-id="${esc(t.id)}" data-loc="${esc(loc)}">${icon('music')} ${esc(t.name)}</button>`).join('')}</div>` : ''}
        ${sec('План внутри', `комнаты — «${esc(locTop(loc))}·Кухня»`)}
        <div class="lf-actions">
            <label class="lf-btn">${icon('upload')} ${p?.plan ? 'Сменить план' : 'Загрузить план'}<input type="file" accept="image/*" data-file="plan" data-key="${esc(key)}" hidden></label>
            <button class="lf-btn" data-act="draw-plan" data-key="${esc(key)}">${icon('wand')} Нарисовать план</button>
        </div>
        ${top ? `${sec('Район')}<div class="lf-chips wrap">${regionsNow().map(r => `<button class="lf-chip${p.region === r.id ? ' on' : ''}" data-act="place-region" data-id="${esc(r.id)}" data-loc="${esc(loc)}">${esc(r.name)}</button>`).join('')}</div>` : ''}
        ${sec('Значок')}
        <div class="lf-chips wrap">${PLACE_ICON_NAMES.map(ic => `<button class="lf-chip icon${placeIcon(loc) === ic ? ' on' : ''}" data-act="place-icon" data-icon="${ic}" data-loc="${esc(loc)}">${icon(ic)}</button>`).join('')}</div>
        <div class="lf-field"><label>Название на карте</label><div class="lf-inline"><input type="text" data-in="pname" value="${esc(placeName(loc))}"><button class="lf-btn" data-act="place-rename" data-loc="${esc(loc)}">OK</button></div></div>
        <div class="lf-actions">
            <button class="lf-btn" data-act="place-chapters" data-loc="${esc(loc)}">${icon('book')} Главы здесь</button>
            ${p?.x != null ? `<button class="lf-btn" data-act="unpin" data-loc="${esc(loc)}">${icon('pin')} Снять метку</button>` : ''}
        </div>`);
}

/** Что Летописец записал прямо в запись поста i — для «что записал пост» (✕ — убрать одну строку). */
function coreRecs(i) {
    const e = chronOf(i);
    const m = chatArr()[i];
    if (!e || !m || m.is_user) return [];
    const out = [];
    const opLine = (o) => o.op === 'drop' ? `убрала «${o.name}»`
        : o.op === 'merge' ? `склеила ${(o.names || []).map(n => `«${n}»`).join(', ')} → «${o.into}»`
            : o.op === 'rename' ? `«${o.name}» → «${o.to}»`
                : `«${o.name}»${o.holder ? ` у ${o.holder}` : ''}${o.where ? ` — ${o.where}` : ''}`;
    if (e.scene && (e.scene.mood || e.scene.intim || e.scene.bond)) out.push({ id: 'tone', g: 'Тон', icon: 'flame', t: sceneLabel(e.scene), del: () => { delete e.scene; } });
    if (e.frame) { const f = FRAMES.find(x => x[0] === e.frame.kind); out.push({ id: 'frame', g: 'Тон', icon: f?.[2] || 'moon', t: `в чате — как ${f?.[1] || e.frame.kind}`, del: () => { delete e.frame; e.frameManual = true; } }); }
    if (!e.undone) {
        for (const r of e.rel || []) out.push({ id: `rel:${r.a}:${r.b}:${r.moment || ''}`, g: 'Отношения', icon: 'rings', t: `${r.a} ${r.dir ? '→' : '×'} ${r.b}: ${SCALES.filter(([f]) => r[f]).map(([f, label]) => `${label.toLowerCase()} ${r[f] > 0 ? '+' : ''}${r[f]}`).join(', ')}${r.moment ? ` — ${r.moment}` : ''}`, del: () => { e.rel = (e.rel || []).filter(x => x !== r); } });
        for (const x of e.sec || []) out.push({ id: `sec:${x.text}`, g: 'Тайны', icon: 'lock', t: `${x.text}${x.knows?.length ? ` (знает: ${x.knows.join(', ')})` : ''}`, del: () => { e.sec = (e.sec || []).filter(y => y !== x); } });
        (e.ops || []).forEach((o, k) => out.push({ id: `op:${k}:${o.op}:${o.name || o.into || ''}`, g: 'Вещи', icon: o.op === 'drop' ? 'trash' : 'box', t: opLine(o), del: async () => { await dropOp(i, o); } }));
    }
    for (const [who, em] of Object.entries(e.emo || {})) out.push({ id: `emo:${who}`, g: 'Лица', icon: 'smile', t: `${shortName(who)}: ${EMOS.find(x => x[0] === em)?.[1] || em}`, del: () => { delete e.emo[who]; try { refreshAvatars(); } catch { /* */ } } });
    if (e.det && !e.detHidden) out.push({ id: 'det', g: 'Деталь', icon: 'camera', t: e.det.caption || 'деталь крупным планом', del: () => { e.detHidden = true; } });
    if (e.shot && !e.shotX && !e.shotUsed) out.push({ id: 'shot', g: 'Деталь', icon: 'film', t: `просится кадр: ${e.shot.caption || ''}`, del: () => { e.shotX = true; } });
    for (const [n, p] of Object.entries(e.pos || {})) out.push({ id: `pos:${n}`, g: 'Мизансцена', icon: 'pin', t: `${shortName(n)} — ${p.at}${p.near ? `, рядом с ${shortName(p.near)}` : ''}`, del: () => { delete e.pos[n]; } });
    if (e.call) out.push({ id: 'call', g: 'Звонок', icon: 'phone', t: `${shortName(e.call.a)} ↔ ${shortName(e.call.b)}${e.call.video ? ', по видео' : ''}${e.call.end ? ', закончился' : ''}`, del: () => { delete e.call; } });
    for (const x of e.slip?.list || []) if (!x.off && !x.done) out.push({ id: `slip:${x.q}`, g: 'Ляпы', icon: 'eye', t: x.why, del: () => { x.off = true; } });
    return out;
}

/** Убрать одну правку вещей из поста i: откатить все, выкинуть эту, остальные накатить снова. */
async function dropOp(i, op) {
    const m = chatArr()[i];
    const e = chronOf(i);
    if (!m || !e) return;
    restoreItems(m.horae_meta, e.undo);
    e.ops = (e.ops || []).filter(o => o !== op);
    invalidate();
    m.horae_meta = m.horae_meta || emptyMeta();
    const { undo } = applyItemOps(m.horae_meta, worldState().items, e.ops);
    e.undo = undo;
    reapplyManual(i);
    m.horae_meta._lifeFix = msgKey(m);
    await ctx().saveChat();
    invalidate();
}

function chronSheet(i) {
    const e = chronOf(i);
    const m = chatArr()[i];
    if (!e || !m) { toast('info', 'Для этого поста записи нет'); return; }
    const opLine = (o) => o.op === 'drop' ? `убрала «${esc(o.name)}»`
        : o.op === 'merge' ? `склеила ${(o.names || []).map(n => `«${esc(n)}»`).join(', ')} → «${esc(o.into)}»`
            : o.op === 'rename' ? `«${esc(o.name)}» → «${esc(o.to)}»`
                : `«${esc(o.name)}»${o.holder ? ` у ${esc(o.holder)}` : ''}${o.where ? ` — ${esc(o.where)}` : ''}`;
    openSheet(`${icon('spark')} Летописец · #${i}`, `
        ${e.chips?.length ? `<div class="lf-statechip static">${icon('spark')}<span>${e.chips.map(esc).join(' <b>·</b> ')}</span></div>` : ''}
        ${e.scene ? `<div class="lf-row lf-scene-l">${icon('flame')}<span>Тон поста: ${esc(sceneLabel(e.scene))}</span></div>` : ''}
        ${e.ops?.length ? `${sec('Вещи')}<div class="lf-list">${e.ops.map(o => `<div class="lf-row">${icon(o.op === 'drop' ? 'trash' : o.op === 'merge' ? 'layers' : 'box')}<span>${opLine(o)}</span></div>`).join('')}</div>` : ''}
        ${e.rel?.length ? `${sec('Отношения')}<div class="lf-list">${e.rel.map(r => `<div class="lf-row">${icon('rings')}<span>${esc(r.a)} ${r.dir ? '→' : '×'} ${esc(r.b)}: ${SCALES.filter(([f]) => r[f]).map(([f, label]) => `${label.toLowerCase()} ${r[f] > 0 ? '+' : ''}${r[f]}`).join(', ')}${r.moment ? ` — ${esc(r.moment)}` : ''}</span></div>`).join('')}</div>` : ''}
        ${e.sec?.length ? `${sec('Тайны')}<div class="lf-list">${e.sec.map(x => `<div class="lf-row">${icon('lock')}<span>${esc(x.text)} <small>знает: ${esc(x.knows.join(', '))}</small></span></div>`).join('')}</div>` : ''}
        ${e.place ? `<div class="lf-hint">Место: ${esc(e.place.location)}${e.place.region ? ` · район «${esc(e.place.region)}»` : ''}</div>` : ''}
        ${(() => { try { return frameRowHtml(i); } catch { return ''; } })()}
        ${(() => { try { return voiceRowHtml(i); } catch { return ''; } })()}
        ${sec('Деталь крупным планом')}
        ${e.detImg ? `<div class="lf-detprev" style="background-image:url('${esc(e.detImg)}')"></div>` : ''}
        ${e.det ? `<div class="lf-hint"><b>${esc(e.det.caption || '')}</b> · движение: ${esc(e.det.motion || 'drift')}<br><small>${esc(e.det.prompt)}</small></div>` : '<div class="lf-hint">Детали к этому посту нет.</div>'}
        <div class="lf-actions tight">
            ${e.det && e.detHidden ? `<button class="lf-btn" data-act="det-show" data-mes="${i}">${icon('eye')} Вернуть в чат</button>` : ''}
            ${e.det ? `<button class="lf-btn" data-act="det-draw" data-mes="${i}">${icon('camera')} ${e.detImg ? 'Перерисовать' : 'Нарисовать'}</button>` : ''}
            <button class="lf-btn" data-act="det-new" data-mes="${i}">${icon('sparkles')} ${e.det ? 'Другая деталь' : 'Придумать деталь'}</button>
        </div>
        <div class="lf-actions">
            ${e.undone ? `<button class="lf-btn primary" data-act="chron-redo" data-mes="${i}">${icon('refresh')} Применить снова</button>` : `<button class="lf-btn" data-act="chron-undo" data-mes="${i}">${icon('undo')} Откатить</button>`}
            <button class="lf-btn" data-act="chron-rerun" data-mes="${i}">${icon('refresh')} Перечитать пост</button>
        </div>
        <div class="lf-hint">Вещи поправить руками: Персонаж → Вещи → карточка вещи.</div>`);
}

function itemEditSheet(name = '', kind = '') {
    const st = worldState();
    const it = name ? (st.items?.[name] || {}) : {};
    const cast = castNames(st);
    openSheet(name ? `${esc(it.icon || '✦')} ${esc(name)}` : `${icon('plus')} Новая вещь`, `
        <div class="lf-field"><label>Название</label><input type="text" data-in="iname" value="${esc(name)}"></div>
        <div class="lf-field"><label>У кого</label><select data-in="iholder"><option value="">— ни у кого, лежит —</option>${cast.map(n => `<option value="${esc(horaeName(n, st))}" ${sameName(n, it.holder) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Где лежит <small>(если ни у кого)</small></label><input type="text" data-in="iwhere" value="${esc(it.location || '')}"></div>
        <div class="lf-field"><label>Описание</label><input type="text" data-in="inote" value="${esc(it.description || '')}"></div>
        <div class="lf-field"><label>Тип</label><div class="lf-chips wrap" data-kind>${['вещь', 'транспорт', 'ключи', 'документ', 'оружие', 'техника', 'подарок'].map(k => `<button class="lf-chip${(itemInfo(name).kind || kind || 'вещь') === k ? ' on' : ''}" data-act="kind" data-v="${k}">${k}</button>`).join('')}</div></div>
        <button class="lf-btn primary serif full big" data-act="item-save" data-name="${esc(name)}">${icon('check')} Сохранить</button>
        <div class="lf-hint">Правка уйдёт в Horae — модель увидит её в следующем ответе.</div>`);
}

function picSheet(kind, name, { draw = true } = {}) {
    openSheet(`${icon('image')} Картинка`, `
        <div class="lf-actions">
            ${draw ? `<button class="lf-btn primary" data-act="draw-${kind}" data-name="${esc(name)}">${icon('wand')} Нарисовать</button>` : ''}
            <label class="lf-btn">${icon('upload')} Загрузить<input type="file" accept="image/*" data-file="${kind}" data-name="${esc(name)}" hidden></label>
        </div>`);
}

function addPlaceSheet(x = null, y = null) {
    const level = mapLevel();
    openSheet(`${icon('plus')} Новое место`, `
        <div class="lf-field"><label>Название${level ? ` <small>(внутри «${esc(level.place?.name || level.key)}»)</small>` : ''}</label><input type="text" data-in="newplace" placeholder="${level ? 'Кухня' : 'Бар «Полночь»'}"></div>
        <button class="lf-btn primary full" data-act="add-place-ok" ${x != null ? `data-x="${x}" data-y="${y}"` : ''}>${icon('check')} Добавить</button>`);
}

function frameSheet(start, loc) {
    openSheet(`${icon('image')} Кадр главы`, `
        <div class="lf-actions">
            <button class="lf-btn primary" data-act="draw-frame" data-start="${start}">${icon('wand')} Нарисовать кадр сцены</button>
            <label class="lf-btn">${icon('upload')} Свой<input type="file" accept="image/*" data-file="frame" data-start="${start}" hidden></label>
        </div>
        ${loc ? `<button class="lf-btn full" data-act="place-menu" data-loc="${esc(locTop(loc))}">${icon('pin')} Обложка места «${esc(placeName(locTop(loc)))}»</button>` : ''}
        ${(chatMeta().frames || {})[start] ? `<button class="lf-btn ghost full" data-act="frame-del" data-start="${start}">${icon('trash')} Убрать кадр</button>` : ''}
        <div class="lf-hint">Кадр сцены рисуется по последнему посту главы, с лицами присутствующих из Гардероба.</div>`);
}

// ───── рисование ─────

async function withBusy(el, fn, label = 'Рисую…') {
    const html = el?.innerHTML;
    if (el) { el.disabled = true; el.classList.add('busy'); el.innerHTML = `<span class="lf-spin"></span> ${label}`; }
    try { return await fn(); } catch (e) {
        console.warn('[Life]', e);
        toast('warning', esc(String(e?.message || e)), '✦ Life', { timeOut: 9000, escapeHtml: false });
    } finally {
        if (el?.isConnected) { el.disabled = false; el.classList.remove('busy'); el.innerHTML = html; }
    }
}

async function faceRef(name, max = 768) {
    const c = ctx();
    const n = canonName(name);
    return refData(c.extensionSettings?.wardrobe?.faces?.[n] || avatarUrl(n, true), max);
}

async function drawRegionMap(region) {
    const s = settings();
    const places = placesNow().filter(([k, p]) => !k.includes('·') && (p.region === region.id)).slice(0, SLOTS.length);
    const assigned = places.map(([, p], i) => [p, SLOTS[i]]);
    const path = await drawPicture(mapPrompt(region, assigned), { aspect: '4:3', max: 2200, prefix: 'life_map' });
    region.map = path;
    delete region.needsMap;
    assigned.forEach(([p, slot]) => { p.x = slot[0]; p.y = slot[1]; });
    saveSettings();
    return path;
}

async function addPlaceToMap(region, p) {
    if (!region.map) throw new Error('у района ещё нет карты');
    const used = Object.values(settings().places).filter(x => x.region === region.id && x.x != null);
    const slot = SLOTS.map(sl => [sl, Math.min(...used.map(u => Math.hypot(u.x - sl[0], u.y - sl[1])), 999)]).sort((a, b) => b[1] - a[1])[0][0];
    const ref = await refData(region.map, 1600);
    region.map = await drawPicture(addToMapPrompt(p, slot), { aspect: '4:3', max: 2200, refs: [ref], prefix: 'life_map' });
    p.x = slot[0];
    p.y = slot[1];
    p.region = region.id;
    saveSettings();
}

async function drawFrame(start) {
    const list = chapters();
    const ch = list.find(x => x.start === start);
    if (!ch) return;
    const post = lastPost(ch);
    const st = worldState();
    const isLast = ch === list[list.length - 1];
    const present = (isLast ? (st.scene?.characters_present || []) : []).map(canonName).filter(n => !sameName(n, ctx().name1) || true).slice(0, 2);
    const refs = [];
    for (const n of present) { const r = await faceRef(n); if (r) refs.push(r); }
    const prompt = `Cinematic film still of this moment from a story: ${cut(post?.narr || ch.preview, 500)}`
        + `\nPlace: ${locParts(ch.loc).join(', ') || 'unknown'}. ${placeDesc(ch.loc) ? cut(placeDesc(ch.loc), 200) : ''}`
        + (refs.length ? `\nThe attached images show the faces of: ${present.join(', ')} — keep their faces recognisable, same people.` : '')
        + `\nStyle: ${style()}. Wide 16:9 cinematic framing, no text.`;
    const path = await drawPicture(prompt, { aspect: '16:9', max: 1600, refs, prefix: 'life_frame', who: present });
    const cm = chatMeta();
    cm.frames = cm.frames || {};
    cm.frames[start] = path;
    saveMeta();
}

// ───── обработчики ─────

let pinDrag = null;

function onPointerDown(ev) {
    if (!ui.editPins) return;
    const pin = ev.target.closest('.lf-pin');
    const box = pin?.closest('.lf-map-in');
    if (!pin || !box) return;
    pinDrag = { pin, box, key: pin.dataset.key, x0: ev.clientX, y0: ev.clientY, moved: false };
    pin.setPointerCapture?.(ev.pointerId);
    const move = (e) => {
        if (!pinDrag) return;
        if (!pinDrag.moved && Math.hypot(e.clientX - pinDrag.x0, e.clientY - pinDrag.y0) < 6) return;
        pinDrag.moved = true;
        const r = box.getBoundingClientRect();
        pinDrag.x = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100));
        pinDrag.y = Math.min(98, Math.max(2, ((e.clientY - r.top) / r.height) * 100));
        pin.style.left = `${pinDrag.x}%`;
        pin.style.top = `${pinDrag.y}%`;
    };
    const up = () => {
        pin.removeEventListener('pointermove', move);
        pin.removeEventListener('pointerup', up);
        pin.removeEventListener('pointercancel', up);
        if (pinDrag?.moved) {
            const p = settings().places[pinDrag.key];
            if (p) { p.x = Math.round(pinDrag.x * 10) / 10; p.y = Math.round(pinDrag.y * 10) / 10; saveSettings(); }
            pinDrag.justMoved = Date.now();
        }
        setTimeout(() => { pinDrag = null; }, 50);
    };
    pin.addEventListener('pointermove', move);
    pin.addEventListener('pointerup', up);
    pin.addEventListener('pointercancel', up);
}

function placePin(key, raw, x, y) {
    const s = settings();
    const level = mapLevel();
    if (!s.places[key]) s.places[key] = { name: locParts(raw).join(' · '), raw, icon: guessPlaceIcon(norm(locLeaf(raw))), img: '', plan: '', region: '', x: null, y: null, kind: '' };
    const p = s.places[key];
    p.x = Math.round(x * 10) / 10;
    p.y = Math.round(y * 10) / 10;
    if (!level) p.region = ((ui.region && regionById(ui.region)) || currentRegion())?.id || '';
    saveSettings();
}

async function goTravel(raw, { who = [], how = '', note = '', chapter = true } = {}) {
    await playTravel(raw, how);
    await insertMarker({ location: raw, who, how, note, chapter });
    ui.focus = 'last';
    ui.mapStack = [];
    ui.sel = '';
    closeHub();
    decorate();
    scrollChatBottom();
    toast('success', `Вы в «${esc(placeName(raw))}» — пиши пост`, '✦ Life', { timeOut: 2500 });
}

async function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || !document.getElementById('lf-app')?.contains(el)) return;
    if (el.tagName === 'LABEL') return;
    const act = el.dataset.act;
    const box = el.closest('.lf-sheet');
    const s = settings();
    const loc = el.dataset.loc;
    const val = (sel) => (box || document.getElementById('lf-app'))?.querySelector(sel)?.value?.trim() || '';

    if (act === 'mood') { setMood(el.dataset.v); render(); toast('info', el.dataset.v ? 'Тон уйдёт модели до конца главы' : 'Тон — сам, по ходу сцены', '✦ Настроение', { timeOut: 1600 }); return; }
    if (act === 'intim') { cycleIntim(); render(); return; }
    if (act === 'tone') { const t = setTone(el.dataset.v); render(); toast('info', t ? 'Оттенок уйдёт модели до конца этой сцены' : 'Оттенок — сам, по ходу сцены', '✦ Секс', { timeOut: 1600 }); return; }
    if (act === 'bond') { cycleBond(); render(); return; }
    if (act === 'btone') { const t = setBondTone(el.dataset.v); render(); toast('info', t ? 'Оттенок уйдёт модели до конца главы' : 'Оттенок — сам, по ходу сцены', '✦ Близость', { timeOut: 1600 }); return; }
    if (act === 'iopt') { toggleIntimOpt(el.dataset.v); render(); return; }
    for (const hm of hubMods) {
        if (!act.startsWith(hm.pre)) continue;
        try { await hm.click(act, el); } catch (e) { console.warn(`[Life] ${hm.label}`, e); toast('warning', esc(String(e?.message || e)), `✦ ${hm.label}`); }
        return;
    }
    if (act.startsWith('sh-')) { shotAct(act, el); directorSheet(); return; }
    if (act.startsWith('tw-')) {
        try { await twistClick(act, el, { at: 'data-act', openSheet, closeSheet, rerender: render, busy: withBusy }); } catch (e) { console.warn('[Life] твист', e); toast('warning', esc(String(e?.message || e)), '✦ Твист'); }
        return;
    }
    if (act.startsWith('days-') || act.startsWith('day-')) {
        try { await daysClick(act, el); } catch (e) { console.warn('[Life] дни', e); toast('warning', esc(String(e?.message || e)), '✦ Дни'); }
        return;
    }
    if (act === 'fm-set') {
        try { frameClick(act, el); } catch (e) { console.warn('[Life] вид поста', e); }
        chronSheet(Number(el.dataset.mes));
        return;
    }
    if (act.startsWith('emo-')) {
        try { await emoClick(act, el); } catch (e) { console.warn('[Life] лица', e); toast('warning', esc(String(e?.message || e)), '✦ Лица'); }
        return;
    }
    if (act.startsWith('al-')) {
        try { await albumClick(act, el); } catch (e) { console.warn('[Life] альбом', e); toast('warning', esc(String(e?.message || e)), '✦ Альбом'); }
        return;
    }
    if (act.startsWith('arc-')) {
        try { await arcClick(act, el); } catch (e) { console.warn('[Life] сюжетка', e); toast('warning', esc(String(e?.message || e)), '✦ Сюжетка'); }
        return;
    }
    if (act.startsWith('fr-')) {
        try { await freshClick(act, el); } catch (e) { console.warn('[Life] свежесть', e); toast('warning', esc(String(e?.message || e)), '✦ Свежесть'); }
        return;
    }
    if (act.startsWith('hu-')) {
        try { await hurtClick(act, el); } catch (e) { console.warn('[Life] раны', e); toast('warning', esc(String(e?.message || e)), '🩸 Раны'); }
        return;
    }
    if (act.startsWith('press-')) { await pressClick(act, el); return; }
    if (act.startsWith('kn-')) { try { knockClick(act, el); } catch (e) { console.warn('[Life] стук', e); } return; }
    if (act.startsWith('ag-')) {
        try { await agendaClick(act, el); } catch (e) { console.warn('[Life] Закулисье', e); toast('warning', esc(String(e?.message || e)), '✦ Закулисье'); }
        return;
    }
    if (act.startsWith('pp-')) {
        try { await peopleClick(act, el); } catch (e) { console.warn('[Life] Люди', e); toast('warning', esc(String(e?.message || e)), '✦ Люди'); }
        return;
    }
    if (act.startsWith('sim-') || act.startsWith('in-')) {
        try { await simClick(act, el, ev); } catch (e) { console.warn('[Life] Жизнь', e); toast('warning', esc(String(e?.message || e)), '✦ Life'); }
        return;
    }
    switch (act) {
        case 'close': if (Date.now() - openedAt > 350) closeHub(); break;
        case 'sheet-close': closeSheet(); break;
        case 'tab': ui.tab = el.dataset.tab; ui.editPins = false; ui.atlas = false; ui.room = ''; ui.tracePin = ''; closeSheet(); render(); break;
        case 'person': case 'who': {
            const n = el.dataset.name;
            const npc = ![ctx().name1, ...groupMembers()].some(x => sameName(x, n)) ? findPerson(n) : null;
            if (npc) { ui.tab = 'people'; ui.npc = npc.id; closeSheet(); render(); break; }
            ui.who = n; ui.tab = 'person'; ui.item = ''; ui.pair = ''; ui.wset = ''; render(); break;
        }
        case 'p-tab': ui.pTab = el.dataset.v; if (ui.pTab === 'money') bank().then(() => { if (ui.open && ui.pTab === 'money') render(); }); render(); break;
        case 'items-tab': ui.itemsTab = el.dataset.v; ui.item = ''; render(); break;
        case 'world-tab': ui.worldTab = el.dataset.v; render(); break;
        case 'rel-tab': ui.relTab = el.dataset.v; render(); break;
        case 'pair': ui.pair = el.dataset.v; render(); break;
        case 'car': ui.car = el.dataset.v; render(); break;
        case 'more-ch': ui.chShow += 30; render(); break;
        case 'to-chapters': document.getElementById('lf-chapters')?.scrollIntoView({ behavior: 'smooth' }); break;
        case 'chapter': { const ch = chapters().find(x => x.start === Number(el.dataset.start)); if (ch) chapterSheet(ch); break; }
        case 'read': await gotoChapter(Number(el.dataset.start)); break;
        case 'jump': {
            const id = Number(el.dataset.mes);
            const ch = chapterOf(id);
            if (ch) ui.focus = ch.idx === chapters().length - 1 ? 'last' : ch.start;
            closeHub();
            decorate();
            await jumpTo(id);
            break;
        }
        case 'ch-rename': {
            const cm = chatMeta();
            cm.titles = cm.titles || {};
            const t = val('[data-in="chtitle"]');
            if (t) cm.titles[el.dataset.start] = t; else delete cm.titles[el.dataset.start];
            cm.ver = (cm.ver || 0) + 1;
            saveMeta(); invalidate(); closeSheet(); render(); decorate();
            break;
        }
        case 'ch-unmark': {
            if (!confirm('Убрать разделитель? Глава сольётся с предыдущей (если место то же).')) break;
            await removeMarker(Number(el.dataset.mes));
            closeSheet(); render(); decorate();
            break;
        }
        case 'frame': frameSheet(Number(el.dataset.start), el.dataset.loc || ''); break;
        case 'frame-del': { const cm = chatMeta(); delete (cm.frames || {})[el.dataset.start]; saveMeta(); closeSheet(); render(); decorate(); break; }
        case 'draw-frame': await withBusy(el, async () => { await drawFrame(Number(el.dataset.start)); closeSheet(); render(); decorate(); toast('success', 'Кадр готов'); }); break;
        case 'new-chapter': newChapterSheet(); break;
        case 'time-skip': {
            // «Перейти к утру» — перемотка до утра (с телом, сроком и календарём), без даты истории — простой скачок
            let ok = false;
            try { ok = await skipClick('sk-go', { dataset: { k: 'morning' }, closest: () => null }); } catch (e) { console.warn('[Life] перемотка', e); }
            if (!ok || !document.querySelector('#lf-app .lf-sheet')) newChapterSheet({ title: 'Утро', note: 'Прошла ночь, наступило утро.' });
            break;
        }
        case 'skip': newChapterSheet({ note: el.dataset.text }); break;
        case 'fill-note': { const inp = box?.querySelector('[data-in="note"]'); if (inp) inp.value = el.dataset.text; break; }
        case 'chapter-go': {
            const title = val('[data-in="title"]');
            const l = val('[data-in="loc"]');
            const note = val('[data-in="note"]');
            if (!title && !l && !note) { toast('info', 'Дай главе название, место или заметку'); break; }
            closeSheet();
            await insertMarker({ location: l, title, note });
            ui.focus = 'last';
            closeHub(); decorate(); scrollChatBottom();
            toast('success', `Глава «${esc(title || placeName(l) || 'новая')}» началась — пиши пост`);
            break;
        }
        case 'director': directorSheet(); break;
        case 'bill-add': billSheet(); break;
        case 'fill-bill': { const i = box?.querySelector('[data-in="bname"]'); if (i) i.value = el.dataset.text; break; }
        case 'bill-save': {
            const name = val('[data-in="bname"]'), amount = Math.abs(Number(String(val('[data-in="bsum"]')).replace(',', '.')) || 0), day = Number(val('[data-in="bday"]')) || 1;
            if (!name || !amount) { toast('info', 'Нужны название и сумма'); break; }
            if (!(await bank())) { toast('warning', 'Телефон (Phone-ST) не найден'); break; }
            addBill({ name, amount, day, category: name });
            closeSheet(); render(); runAutopay();
            break;
        }
        case 'bill-pay': if (payBill(el.dataset.id)) { toast('success', 'Оплачено', '✦ Деньги', { timeOut: 1500 }); render(); } break;
        case 'loan-pay': if (payLoan(el.dataset.id)) { toast('success', 'Платёж внесён', '✦ Деньги', { timeOut: 1500 }); render(); } break;
        case 'bill-del': if (confirm('Убрать этот платёж?')) { delBill(el.dataset.id); render(); } break;
        case 'money-phone': closeHub(); setTimeout(async () => { try { (await import('/scripts/extensions/third-party/Phone-ST/ui.js')).openPhone(); } catch { document.getElementById('gp-fab')?.click(); } }, 340); break;
        case 'lightbox': {
            const mes = el.dataset.mes != null ? Number(el.dataset.mes) : null;
            lightbox(el.dataset.src, mes != null ? `#${mes}` : '', mes != null ? async () => { closeHub(); await jumpTo(mes); } : null);
            break;
        }
        case 'gal-more': ui.galShow += 48; render(); break;
        case 'cut-play': { const c = cuts().find(x => x.id === el.dataset.id); if (c) playCut(c, { music: cutMusic(c) }); break; }
        case 'cut-make': await makeCut(el); break;
        case 'cut-del': if (confirm('Удалить кат-сцену?')) { chatMeta().cuts = cuts().filter(x => x.id !== el.dataset.id); saveMeta(); paintChips(); directorSheet(); } break;
        case 'mus-play': { const t = trackById(el.dataset.id || box?.querySelector('[data-in="mus"]')?.value); if (t) { Music.toggle(t); setTimeout(() => directorSheet(), 60); } break; }
        case 'mus-del': { const s2 = settings(); s2.music.tracks = s2.music.tracks.filter(t => t.id !== el.dataset.id); saveSettings(); directorSheet(); break; }
        case 'place-track': { const p = getPlace(loc, true); p.track = el.dataset.id === p.track ? '' : el.dataset.id; saveSettings(); placeMenu(loc); break; }
        case 'place-variants': await withBusy(el, async () => { await drawVariants(loc); closeSheet(); render(); updateSceneBg(); toast('success', 'Вечер и ночь готовы — фон сам сменится по времени'); }); break;
        case 'dir-pick': {
            const on = !el.classList.contains('on');
            el.parentElement.querySelectorAll('.lf-chip').forEach(x => x.classList.remove('on'));
            el.classList.toggle('on', on);
            break;
        }
        case 'dir-go': {
            const pick = (k) => box.querySelector(`[data-dir="${k}"] .lf-chip.on`)?.dataset.v || '';
            const d = { time: pick('time'), weather: pick('weather'), tone: pick('tone'), free: val('[data-in="dir-text"]') };
            const text = [d.time && `время — ${d.time.toLowerCase()}`, d.weather && `погода — ${d.weather.toLowerCase()}`, d.tone && `тон сцены — ${d.tone.toLowerCase()}`, d.free].filter(Boolean).join('; ');
            if (!text) { toast('info', 'Выбери хоть что-нибудь'); break; }
            chatMeta().director = { ...d, text, once: true, after: lastAiIndex() };
            saveMeta(); updateMovePrompt(); closeSheet();
            toast('success', 'Модель получит это в следующем ответе');
            break;
        }
        case 'dir-clear': { chatMeta().director = null; saveMeta(); updateMovePrompt(); closeSheet(); break; }

        // карта
        case 'atlas': ui.atlas = true; render(); break;
        case 'atlas-close': ui.atlas = false; render(); break;
        case 'region': ui.region = el.dataset.id; ui.atlas = false; ui.mapStack = []; ui.sel = ''; ui.editPins = false; render(); break;
        case 'region-new': {
            openSheet(`${icon('map')} Новый район`, `<div class="lf-field"><label>Название (район, город, страна, база)</label><input type="text" data-in="rname" placeholder="Бруклин"></div>
                <div class="lf-field"><label>Пара слов для картинки <small>(эпоха, погода, настроение)</small></label><input type="text" data-in="rnote" placeholder="зима 2024, снег"></div>
                <button class="lf-btn primary full" data-act="region-ok">${icon('check')} Добавить</button>`);
            break;
        }
        case 'region-ok': {
            const n = val('[data-in="rname"]');
            if (!n) break;
            const r = findRegion(n, true);
            delete r.fresh;
            r.note = val('[data-in="rnote"]');
            saveSettings(); ui.region = r.id; ui.atlas = false; closeSheet(); render();
            break;
        }
        case 'map-menu': {
            const level = mapLevel();
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            openSheet(`${icon('map')} ${esc(level ? (level.place?.name || '') : region.name)}`, `
                <div class="lf-actions">
                    <label class="lf-btn">${icon('upload')} Загрузить другую<input type="file" accept="image/*" data-file="${level ? 'plan' : 'map'}" data-key="${esc(level?.key || '')}" hidden></label>
                    <button class="lf-btn primary" data-act="${level ? 'draw-plan' : 'draw-map'}" data-key="${esc(level?.key || '')}">${icon('wand')} Перерисовать</button>
                </div>
                <div class="lf-hint">${level ? 'Нарисую план заново — комнаты потом расставишь метками.' : 'Нарисую карту заново со всеми местами района — метки встанут сами. Старая картинка заменится.'}</div>
                ${level ? '' : `<div class="lf-field"><label>Название района</label><div class="lf-inline"><input type="text" data-in="rname" value="${esc(region.name)}"><button class="lf-btn" data-act="region-rename">OK</button></div></div>
                <div class="lf-field"><label>Пара слов для картинок</label><div class="lf-inline"><input type="text" data-in="rnote" value="${esc(region.note || '')}"><button class="lf-btn" data-act="region-note">OK</button></div></div>
                ${s.regions.length > 1 ? `<button class="lf-btn ghost full" data-act="region-del">${icon('trash')} Удалить район (места останутся)</button>` : ''}`}`);
            break;
        }
        case 'region-rename': { const r = (ui.region && regionById(ui.region)) || currentRegion(); const n = val('[data-in="rname"]'); if (r && n) { r.name = n; saveSettings(); } closeSheet(); render(); break; }
        case 'region-note': { const r = (ui.region && regionById(ui.region)) || currentRegion(); if (r) { r.note = val('[data-in="rnote"]'); saveSettings(); } closeSheet(); break; }
        case 'region-del': {
            const r = (ui.region && regionById(ui.region)) || currentRegion();
            if (!r || s.regions.length < 2 || !confirm(`Удалить район «${r.name}»?`)) break;
            s.regions = s.regions.filter(x => x.id !== r.id);
            for (const p of Object.values(s.places)) if (p.region === r.id) { p.region = ''; p.x = null; p.y = null; }
            ui.region = ''; saveSettings(); closeSheet(); render();
            break;
        }
        case 'map-up': ui.mapStack.pop(); ui.editPins = false; ui.sel = ''; render(); break;
        case 'map-dh': { const lv = mapLevel(); if (lv) { ui.dhModes = { ...(ui.dhModes || {}), [lv.key]: el.dataset.v }; dhRemember(lv.key, el.dataset.v); ui.editPins = false; } render(); break; }
        case 'map-home': { const k = el.dataset.key; if (k) { ui.mapStack = [k]; ui.dhModes = { ...(ui.dhModes || {}), [k]: 'cut' }; ui.sel = ''; ui.editPins = false; ui.atlas = false; } render(); break; }
        case 'inside': ui.mapStack.push(el.dataset.key); ui.tab = 'map'; ui.editPins = false; ui.sel = ''; ui.atlas = false; closeSheet(); render(); break;
        case 'edit-pins': ui.editPins = !ui.editPins; ui.placing = null; render(); break;
        case 'placing': ui.placing = el.dataset.key; ui.placingRaw = el.dataset.loc; render(); toast('info', 'Теперь тапни точку на карте', '✦ Life', { timeOut: 1800 }); break;
        case 'map-tap': {
            if (!ui.editPins || ev.target.closest('.lf-pin')) break;
            const r = el.getBoundingClientRect();
            const x = ((ev.clientX - r.left) / r.width) * 100;
            const y = ((ev.clientY - r.top) / r.height) * 100;
            if (ui.placing) { placePin(ui.placing, ui.placingRaw || ui.placing, x, y); ui.placing = null; render(); }
            else addPlaceSheet(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
            break;
        }
        case 'pin': {
            if (pinDrag?.moved || (pinDrag?.justMoved && Date.now() - pinDrag.justMoved < 300)) break;
            const p = s.places[el.dataset.key];
            if (!p) break;
            if (ui.editPins) { placeMenu(p.raw || p.name); break; }
            ui.sel = el.dataset.key;
            render();
            document.querySelector('#lf-app .lf-placecard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            break;
        }
        case 'place': {
            const p = getPlace(loc);
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            if (!mapLevel() && region?.map && (!p || p.x == null)) {
                openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, `${placeCardHtml(loc)}
                    <div class="lf-actions"><button class="lf-btn primary" data-act="add-to-map" data-loc="${esc(loc)}">${icon('wand')} Дорисовать на карту</button>
                    <button class="lf-btn" data-act="edit-pins">${icon('pin')} Поставить метку самой</button></div>`);
            } else openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, placeCardHtml(loc));
            break;
        }
        case 'add-to-map': await withBusy(el, async () => {
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            const p = getPlace(loc, true);
            await addPlaceToMap(region, p);
            closeSheet(); render(); toast('success', 'Место на карте');
        }); break;
        case 'place-menu': placeMenu(loc); break;
        case 'place-region': { const p = getPlace(loc, true); p.region = el.dataset.id; saveSettings(); box?.querySelectorAll('[data-act="place-region"]').forEach(x => x.classList.toggle('on', x === el)); render(); break; }
        case 'travel': travelSheet(loc); break;
        case 'toggle': el.classList.toggle('on'); break;
        case 'how': case 'kind': {
            const on = !el.classList.contains('on');
            el.parentElement.querySelectorAll('.lf-chip').forEach(x => x.classList.remove('on'));
            el.classList.toggle('on', on || act === 'kind');
            const rb = act === 'how' ? box?.querySelector('.lf-route') : null;
            if (rb) {
                const f = rb.dataset.from, t = rb.dataset.to, h = on ? el.dataset.how : '';
                rb.outerHTML = routeHtml(f, t, h);
                if (!routeCached(f, t, h)) routeEstimate(f, t, h).then(() => { const b = document.querySelector('#lf-app .lf-sheet .lf-route'); if (b) b.outerHTML = routeHtml(f, t, h); }).catch(() => { /* */ });
            }
            break;
        }
        case 'travel-go': {
            const st = worldState();
            const who = [...box.querySelectorAll('.lf-pers.sel.on')].map(x => horaeName(x.dataset.name, st));
            const how = box.querySelector('[data-how] .lf-chip.on')?.dataset.how || '';
            const raw = getPlace(loc)?.raw || loc;
            let rn = '';
            try { rn = routeNote(st.scene?.location || '', raw, how) || routeNote(st.scene?.location || '', loc, how); } catch { /* */ }
            const note = [val('[data-in="note"]'), rn].filter(Boolean).join(' ');
            closeSheet();
            try { await goTravel(raw, { who, how, note, chapter: !mapLevel() || !placeKey(raw).startsWith(mapLevel().key) }); } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'add-place': addPlaceSheet(); break;
        case 'add-place-ok': {
            let name = val('[data-in="newplace"]');
            if (!name) break;
            const level = mapLevel();
            if (level) name = `${level.place?.raw || level.place?.name || level.key}·${name}`;
            const p = getPlace(name, true);
            p.raw = name;
            if (!level) p.region = ((ui.region && regionById(ui.region)) || currentRegion())?.id || '';
            if (el.dataset.x) { p.x = Number(el.dataset.x); p.y = Number(el.dataset.y); }
            saveSettings(); closeSheet(); render();
            break;
        }
        case 'place-icon': { getPlace(loc, true).icon = el.dataset.icon; saveSettings(); box?.querySelectorAll('.lf-chip.icon').forEach(x => x.classList.toggle('on', x === el)); render(); break; }
        case 'place-rename': { const n = val('[data-in="pname"]'); if (n) { getPlace(loc, true).name = n; saveSettings(); invalidate(); closeSheet(); render(); decorate(); } break; }
        case 'place-noimg': { const p = getPlace(loc); if (p) { p.img = ''; saveSettings(); } closeSheet(); render(); decorate(); break; }
        case 'unpin': { const p = getPlace(loc); if (p) { p.x = null; p.y = null; saveSettings(); } closeSheet(); render(); break; }
        case 'place-chapters': {
            const chs = chaptersAt(loc).reverse();
            openSheet(`Главы: ${esc(placeName(loc))}`, chs.length ? `<div class="lf-chlist">${chs.map(ch => chapterCard(ch, -1)).join('')}</div>` : '<div class="lf-empty small">Здесь ещё ничего не было.</div>');
            break;
        }
        case 'draw-place': await withBusy(el, async () => { getPlace(loc, true).img = await drawPicture(placePrompt(loc), { prefix: 'life_place' }); saveSettings(); closeSheet(); render(); decorate(); toast('success', 'Картинка готова'); }); break;
        case 'draw-map': await withBusy(el, async () => {
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            // места района без метки — тоже на карту
            for (const [k, raw] of knownLocations()) if (!k.includes('·')) { const p = getPlace(raw, true); if (!p.region) p.region = region.id; }
            await drawRegionMap(region);
            closeSheet(); render();
        }); break;
        case 'draw-plan': await withBusy(el, async () => {
            const key = el.dataset.key || mapLevel()?.key;
            const p = s.places[key] || getPlace(key, true);
            p.plan = await drawPicture(planPrompt(p.raw || p.name), { aspect: '4:3', max: 2200, prefix: 'life_plan' });
            saveSettings(); closeSheet(); render();
        }); break;

        // вещи
        case 'item': ui.item = el.dataset.name; render(); document.querySelector('#lf-app .lf-itemcard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); break;
        case 'item-pic': picSheet('item', el.dataset.name); break;
        case 'draw-item': await withBusy(el, async () => { const n = el.dataset.name; setItemInfo(n, { img: await drawPicture(itemPrompt(n, worldState().items?.[n]), { aspect: '1:1', max: 900, prefix: 'life_item' }) }); closeSheet(); render(); }); break;
        case 'item-give': {
            const st = worldState();
            const it = st.items?.[el.dataset.name] || {};
            openSheet(`Передать: ${esc(el.dataset.name)}`, `<div class="lf-people wrap">${castNames(st).filter(n => !sameName(n, it.holder)).map(n => `<button class="lf-pers" data-act="give-to" data-name="${esc(n)}" data-item="${esc(el.dataset.name)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}</div>
                <div class="lf-hint">Horae запишет нового владельца — модель увидит это в следующем ответе. Сам момент передачи опиши в посте.</div>`);
            break;
        }
        case 'give-to': {
            await manualItems([{ op: 'set', name: el.dataset.item, holder: horaeName(el.dataset.name), where: '' }]);
            closeSheet(); render(); toast('success', `Теперь у ${esc(shortName(el.dataset.name))}`);
            break;
        }
        case 'item-edit': itemEditSheet(el.dataset.name); break;
        case 'item-add': itemEditSheet('', el.dataset.kind || ''); break;
        case 'item-save': {
            const old = el.dataset.name;
            const name = val('[data-in="iname"]');
            if (!name) break;
            const op = { op: 'set', name, holder: box.querySelector('[data-in="iholder"]').value, where: val('[data-in="iwhere"]'), note: val('[data-in="inote"]') };
            const ops = old && old !== name ? [{ op: 'rename', name: old, to: name }, op] : [op];
            await manualItems(ops);
            const kind = box.querySelector('[data-kind] .lf-chip.on')?.dataset.v;
            if (kind) setItemInfo(name, { kind });
            if (old && old !== name && itemImg(old)) setItemInfo(name, { img: itemImg(old) });
            ui.item = name;
            closeSheet(); render();
            break;
        }
        case 'item-drop': {
            if (!confirm(`Убрать «${el.dataset.name}» из инвентаря?`)) break;
            await manualItems([{ op: 'drop', name: el.dataset.name }]);
            ui.item = ''; render();
            break;
        }
        case 'inv-clean': await withBusy(el, async () => { const n = await cleanInventory(); toast('success', n ? `Правок: ${n}` : 'Инвентарь и так чистый'); render(); }, 'Чищу…'); break;
        case 'drive': {
            const to = val('[data-in="car-to"]');
            const withWho = val('[data-in="car-who"]');
            if (!to) { toast('info', 'Куда едем?'); break; }
            const st = worldState();
            const who = [horaeName(ui.who, st), withWho ? horaeName(withWho, st) : ''].filter(Boolean);
            try { await goTravel(to, { who, how: `на машине (${el.dataset.name})` }); } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'car-scene': {
            const st = worldState();
            const withWho = val('[data-in="car-who"]');
            const to = val('[data-in="car-to"]');
            const who = [horaeName(ui.who, st), withWho ? horaeName(withWho, st) : ''].filter(Boolean);
            closeHub();
            await insertMarker({ location: `${el.dataset.name}`, title: 'В дороге', who, how: 'на машине', note: to ? `Едут в «${to}». Разговор в машине, по дороге.` : 'Разговор в машине, по дороге.' });
            ui.focus = 'last'; decorate(); scrollChatBottom();
            break;
        }
        case 'wset': ui.wset = el.dataset.v; render(); break;
        case 'wset-wear': {
            try { if (window.Wardrobe?.wearSets(ui.who, [el.dataset.v])) { toast('success', 'Надето', '👗 Гардероб', { timeOut: 1500 }); render(); } } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'wset-draw': {
            try { window.Wardrobe?.drawSet(el.dataset.v); toast('info', 'Гардероб рисует образ…'); render(); const id = el.dataset.v; const iv = setInterval(() => { if (!window.Wardrobe?.isDrawing?.(id)) { clearInterval(iv); render(); } }, 2500); } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'wardrobe': {
            closeHub();
            if (window.Wardrobe?.open) { setTimeout(() => window.Wardrobe.open(el.dataset.tab || 'worn', ui.who ? (castNames().find(n => sameName(n, ui.who)) || ui.who) : ''), 340); break; }
            try { await ctx().executeSlashCommandsWithOptions?.('/wardrobe'); } catch { toast('info', 'Гардероб не найден'); }
            break;
        }
        case 'pair-pic': picSheet('pair', pairKey(ui.who, ui.pair)); break;
        case 'draw-pair': await withBusy(el, async () => {
            const refs = [await faceRef(ui.who), await faceRef(ui.pair)].filter(Boolean);
            const prompt = `Intimate cinematic portrait of two people together: ${canonName(ui.who)} and ${canonName(ui.pair)}.` + (refs.length ? ' The attached images are their faces, in this order — keep them recognisable.' : '') + `\nStyle: ${style()}. Horizontal, no text.`;
            s.pairs[el.dataset.name] = await drawPicture(prompt, { aspect: '16:9', refs, prefix: 'life_pair', who: [ui.who, ui.pair] });
            saveSettings(); closeSheet(); render();
        }); break;
        case 'pair-edit': {
            const pp = relationsState()[pairKey(ui.who, ui.pair)];
            const mine = pp ? relSide(pp, ui.who) : scaleBase(), theirs = pp ? relSide(pp, ui.pair) : scaleBase();
            const A = shortName(canonName(ui.who)), B = shortName(canonName(ui.pair));
            const rng = (d, k, label, v) => `<div class="lf-field"><label>${label}: <b data-out>${v}</b></label><input type="range" min="0" max="100" value="${v}" data-rng="${d}.${k}"></div>`;
            openSheet(`${esc(A)} × ${esc(B)}`, `${sec(`${esc(A)} → ${esc(B)}`)}
                ${SCALES.map(([f, label]) => rng('ab', f, label, mine[f])).join('')}
                ${sec(`${esc(B)} → ${esc(A)}`)}
                ${SCALES.map(([f, label]) => rng('ba', f, label, theirs[f])).join('')}
                <button class="lf-btn primary full" data-act="pair-save">${icon('check')} Сохранить</button>
                <div class="lf-hint">Это точка отсчёта — дальше Летописец двигает шкалы сам после каждого поста, отдельно для каждой стороны.</div>`);
            break;
        }
        case 'pair-save': {
            const pp = relationsState()[pairKey(ui.who, ui.pair)];
            const cm = chatMeta();
            cm.relBase = cm.relBase || {};
            const oldB = (cm.pairBase || {})[pairKey(ui.who, ui.pair)] || {};
            for (const [d, from, to] of [['ab', ui.who, ui.pair], ['ba', ui.pair, ui.who]]) {
                const cur = pp ? relSide(pp, from) : scaleBase();
                const dk = dirKey(from, to);
                const b0 = { ...scaleBase(), ...oldB, ...(cm.relBase[dk] || {}) };
                const want = (f) => Number(box.querySelector(`[data-rng="${d}.${f}"]`).value);
                cm.relBase[dk] = Object.fromEntries(SCALES.map(([f]) => [f, b0[f] + want(f) - cur[f]]));
            }
            if (cm.pairBase) delete cm.pairBase[pairKey(ui.who, ui.pair)];
            saveMeta(); closeSheet(); render(); updateMovePrompt();
            break;
        }

        // треугольники
        case 'tri-new': {
            const who = [ui.who, ui.pair].filter(Boolean).map(canonName);
            ui.tri = { id: '', who, center: who.find(n => sameName(n, ctx().name1)) || who[0] || '', kind: 'jeal', end: 'hold', note: '', on: true };
            triSheet();
            break;
        }
        case 'tri-edit': {
            const t = triangles().find(x => x.id === el.dataset.id);
            if (!t) break;
            ui.tri = JSON.parse(JSON.stringify(t));
            triSheet();
            break;
        }
        case 'tri-who': {
            if (!ui.tri) break;
            triKeepNote(box);
            const n = el.dataset.v;
            const i = ui.tri.who.findIndex(x => sameName(x, n));
            if (i >= 0) ui.tri.who.splice(i, 1);
            else if (ui.tri.who.length < 3) ui.tri.who.push(canonName(n));
            else { ui.tri.who.shift(); ui.tri.who.push(canonName(n)); }
            if (!ui.tri.who.some(x => sameName(x, ui.tri.center))) ui.tri.center = ui.tri.who.length === 3 ? ui.tri.who.find(x => sameName(x, ctx().name1)) || ui.tri.who[1] : '';
            triSheet();
            break;
        }
        case 'tri-add': {
            if (!ui.tri) break;
            triKeepNote(box);
            const inp = box?.querySelector('[data-f="triadd"]');
            const n = canonName((inp?.value || '').trim());
            if (!n) break;
            if (!ui.tri.who.some(x => sameName(x, n))) { if (ui.tri.who.length >= 3) ui.tri.who.shift(); ui.tri.who.push(n); }
            if (ui.tri.who.length === 3 && !ui.tri.who.some(x => sameName(x, ui.tri.center))) ui.tri.center = ui.tri.who.find(x => sameName(x, ctx().name1)) || ui.tri.who[1];
            triSheet();
            break;
        }
        case 'tri-center': if (ui.tri) { triKeepNote(box); ui.tri.center = el.dataset.v; triSheet(); } break;
        case 'tri-kind': if (ui.tri) { triKeepNote(box); ui.tri.kind = el.dataset.v; triSheet(); } break;
        case 'tri-end': if (ui.tri) { triKeepNote(box); ui.tri.end = el.dataset.v; triSheet(); } break;
        case 'tri-save': {
            const d = ui.tri;
            if (!d || d.who.length !== 3 || !d.center) break;
            triKeepNote(box);
            const list = triangles();
            const rec = { id: d.id || `t${Date.now().toString(36)}`, who: d.who.map(canonName), center: canonName(d.center), kind: d.kind, end: d.end, note: d.note || '', on: d.on !== false };
            const i = list.findIndex(x => x.id === rec.id);
            if (i >= 0) list[i] = rec; else list.push(rec);
            ui.tri = null;
            saveMeta(); closeSheet(); ui.relTab = 'tri'; render(); updateMovePrompt();
            toast('success', 'Модель будет держать эту ось, когда все трое рядом', '✦ Треугольник', { timeOut: 1800 });
            break;
        }
        case 'tri-onoff': {
            const t = triangles().find(x => x.id === ui.tri?.id);
            if (!t) break;
            t.on = t.on === false;
            ui.tri.on = t.on;
            saveMeta(); triSheet(); render(); updateMovePrompt();
            break;
        }
        case 'tri-del': {
            const list = triangles();
            const i = list.findIndex(x => x.id === ui.tri?.id);
            if (i >= 0) list.splice(i, 1);
            ui.tri = null;
            saveMeta(); closeSheet(); render(); updateMovePrompt();
            break;
        }

        // Летописец
        case 'chron': chronSheet(Number(el.dataset.mes)); break;
        case 'chron-ok': { const e = chronOf(Number(el.dataset.mes)); if (e) { e.seen = true; saveMeta(); } el.closest('.lf-fromscene')?.classList.add('ok'); toast('success', 'Принято', '✦ Летописец', { timeOut: 1200 }); break; }
        case 'chron-undo': await undoChron(Number(el.dataset.mes)); closeSheet(); render(); decorate(); toast('info', 'Откатила правки Летописца'); break;
        case 'chron-redo': {
            const i = Number(el.dataset.mes);
            const e = chronOf(i);
            if (e) { e.undone = false; ensureFix(i); await ctx().saveChat(); saveMeta(); }
            closeSheet(); render(); decorate();
            break;
        }
        case 'det-show': case 'det-draw': case 'det-new': {
            const i = Number(el.dataset.mes);
            const m = chatArr()[i];
            const key = m ? `${i}:${msgKey(m)}` : '';
            const e = key && chronStore()[key];
            if (!e) break;
            const act = el.dataset.act;
            if (act === 'det-show') { e.detHidden = false; saveMeta(); paintChips(); closeSheet(); break; }
            if (act === 'det-new') await withBusy(el, async () => { e.det = await newDetail(i); }, 'Думаю…');
            if (!e.det) break;
            e.detHidden = false;
            delete e.detImg;
            saveMeta();
            closeSheet();
            queueDetail(key);
            toast('info', 'Рисую деталь…');
            break;
        }
        case 'chron-rerun': { const i = Number(el.dataset.mes); closeSheet(); queueChron(i, { force: true }); toast('info', 'Летописец перечитывает…'); break; }
        case 'chron-last': {
            const chat = chatArr();
            let i = chat.length - 1;
            while (i >= 0 && (chat[i].is_user || chat[i].is_system)) i--;
            if (i >= 0) { queueChron(i, { force: true }); toast('info', `Летописец читает #${i}…`); }
            break;
        }
    }
}

function chapterSheet(ch) {
    const list = chapters();
    const isLast = ch.idx === list.length - 1;
    const cover = chapterCover(ch);
    openSheet(`Глава ${pad2(ch.num)}`, `
        <div class="lf-sheet-cover"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}><div class="lf-sheet-cover-t"><b>${esc(ch.title)}</b><span>${esc([placeName(locTop(ch.loc)), whenLabel(ch.date, ch.time)].filter(Boolean).join(' — '))}</span></div></div>
        <div class="lf-chcard-prev big">${esc(ch.preview || '…')}</div>
        <div class="lf-hint">${ch.count} ${plural(ch.count, 'пост', 'поста', 'постов')} · сообщения #${ch.start}–${ch.end}${ch.locs.length > 1 ? ` · ${esc(ch.locs.map(l => locLeaf(l)).join(' → '))}` : ''}</div>
        <button class="lf-btn primary serif full big" data-act="read" data-start="${ch.start}">${isLast ? 'Вернуться в сцену' : 'Читать главу'}</button>
        <div class="lf-field"><label>Название главы${ch.autoTitle && !ch.userTitled ? ' <small>(придумал Летописец)</small>' : ''}</label><div class="lf-inline"><input type="text" data-in="chtitle" value="${esc(ch.title)}"><button class="lf-btn" data-act="ch-rename" data-start="${ch.start}">OK</button></div></div>
        <div class="lf-actions">
            <button class="lf-btn" data-act="frame" data-start="${ch.start}" data-loc="${esc(ch.loc)}">${icon('image')} Кадр</button>
            ${ch.marker >= 0 ? `<button class="lf-btn" data-act="ch-unmark" data-mes="${ch.marker}">${icon('scissors')} Убрать разделитель</button>` : ''}
        </div>`);
}

async function onChange(ev) {
    const el = ev.target;
    const s = settings();
    if (el.dataset.rng) { const out = el.closest('.lf-field')?.querySelector('[data-out]'); if (out) out.textContent = el.value; return; }
    for (const h of hubInputs) { try { if (h(el)) return; } catch (e) { console.warn('[Life] поле', e); } }
    if (el.dataset.set) {
        const path = el.dataset.set.split('.');
        const obj = path.length > 1 ? s[path[0]] : s;
        const k = path[path.length - 1];
        obj[k] = el.type === 'checkbox' ? el.checked : el.value;
        saveSettings();
        if (k === 'showFab' || k === 'enabled') syncFab();
        if (['enabled', 'chatMarks', 'chapterBy', 'aliases'].includes(k)) { invalidate(); decorate(); }
        if (k === 'sceneBg' || k === 'enabled') updateSceneBg();
        if (path[0] === 'detail' || path[0] === 'shot' || path[0] === 'call') paintChips();
        if (path[0] === 'call') updateMovePrompt();
        if (path[0] === 'plates') platesSync().then(() => { updateMovePrompt(); render(); });
        if (path[0] === 'cast') updateMovePrompt();
        if (k === 'autopay' && obj[k]) runAutopay();
        if (k === 'enabled') updateMovePrompt();
        if (el.tagName !== 'TEXTAREA') render();
        return;
    }
    if (el.dataset.file === 'track' && el.files?.[0]) {
        const file = el.files[0];
        await withBusy(el.closest('label'), async () => {
            const url = await uploadTrack(file);
            const t = { id: uid(), name: cut(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Трек', 40), url };
            s.music.tracks.push(t);
            saveSettings();
            Music.play(t);
            directorSheet();
        }, 'Загружаю…');
        return;
    }
    if (el.dataset.file && el.files?.[0]) {
        const file = el.files[0];
        const kind = el.dataset.file;
        await withBusy(el.closest('label'), async () => {
            const max = kind === 'map' || kind === 'plan' ? 2200 : kind === 'item' || kind === 'pet' || kind === 'npc' ? 1100 : 1600;
            const path = await uploadImage(await fileToJpeg(file, max), `life_${kind}`);
            if (kind === 'map') { const r = (ui.region && regionById(ui.region)) || currentRegion(); r.map = path; delete r.needsMap; }
            else if (kind === 'plan') { const key = el.dataset.key || mapLevel()?.key; const p = s.places[key] || getPlace(key, true); p.plan = path; }
            else if (kind === 'place') getPlace(el.dataset.loc, true).img = path;
            else if (kind === 'item') setItemInfo(el.dataset.name, { img: path });
            else if (kind === 'pair') s.pairs[el.dataset.name] = path;
            else if (kind === 'pet') simSetPetImg(el.dataset.id, path);
            else if (kind === 'npc') peopleSetImg(el.dataset.id, path);
            else if (kind === 'frame') { const cm = chatMeta(); cm.frames = cm.frames || {}; cm.frames[el.dataset.start] = path; saveMeta(); }
            else if (kind === 'album') albumSetImg(el.dataset.k, path);
            else if (kind === 'emo') emoSetImg(el.dataset.name, el.dataset.k, path);
            saveSettings();
            closeSheet(); render(); decorate();
            toast('success', 'Картинка сохранена', '✦ Life', { timeOut: 1500 });
        }, 'Загружаю…');
    }
}

function onInput(ev) {
    const el = ev.target;
    if (el.dataset.rng) { const out = el.closest('.lf-field')?.querySelector('[data-out]'); if (out) out.textContent = el.value; return; }
    if (el.dataset.set && el.tagName === 'TEXTAREA') {
        settings()[el.dataset.set] = el.value;
        saveSettings();
        if (el.dataset.set === 'aliases') invalidate();
    }
}

// ───────────── кнопка, меню, команда ─────────────

function syncFab() {
    const s = settings();
    let fab = document.getElementById('lf-fab');
    if (!s.showFab || !s.enabled) { fab?.remove(); return; }
    if (fab) return;
    fab = document.createElement('div');
    fab.id = 'lf-fab';
    fab.title = 'Life';
    fab.innerHTML = CANDLE;
    document.body.append(fab);
    if (s.fabPos) { fab.style.right = `${s.fabPos.r}px`; fab.style.bottom = `${s.fabPos.b}px`; }
    let start = null;
    fab.addEventListener('pointerdown', e => {
        const r = fab.getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, r: window.innerWidth - r.right, b: window.innerHeight - r.bottom, moved: false };
        fab.setPointerCapture?.(e.pointerId);
    });
    fab.addEventListener('pointermove', e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 8) return;
        start.moved = true;
        fab.style.right = `${Math.min(Math.max(4, start.r - dx), window.innerWidth - 56)}px`;
        fab.style.bottom = `${Math.min(Math.max(4, start.b - dy), window.innerHeight - 56)}px`;
    });
    fab.addEventListener('pointerup', () => {
        if (!start) return;
        if (start.moved) { settings().fabPos = { r: parseInt(fab.style.right) || 14, b: parseInt(fab.style.bottom) || 210 }; saveSettings(); }
        else if (ui.open) closeHub(); else openHub();
        start = null;
    });
}

function addWandButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('lf-wand')) return !!menu;
    const btn = document.createElement('div');
    btn.id = 'lf-wand';
    btn.className = 'list-group-item flex-container flexGap5 interactable';
    btn.tabIndex = 0;
    btn.innerHTML = '<div class="fa-solid fa-map-location-dot extensionsMenuExtensionButton"></div><span>Life</span>';
    btn.addEventListener('click', () => openHub());
    const cc = btn.cloneNode(false);
    cc.id = 'lf-wand-cc';
    cc.innerHTML = '<div class="fa-solid fa-sliders extensionsMenuExtensionButton"></div><span>Пульт</span>';
    cc.addEventListener('click', () => openCC());
    menu.append(btn, cc);
    return true;
}

function renderSettingsDrawer() {
    const s = settings();
    const host = document.getElementById('extensions_settings2');
    if (!host || document.getElementById('life_settings')) return;
    host.insertAdjacentHTML('beforeend', `
    <div id="life_settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>✦ Life</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
        <div class="inline-drawer-content">
          <label class="checkbox_label"><input id="lf_set_enabled" type="checkbox" ${s.enabled ? 'checked' : ''}> Включено</label>
          <div class="flex-container">
            <div id="lf_open_btn" class="menu_button"><i class="fa-solid fa-map-location-dot"></i> Открыть Life</div>
            <div id="lf_cc_btn" class="menu_button"><i class="fa-solid fa-sliders"></i> Пульт</div>
          </div>
          <label class="checkbox_label"><input id="lf_set_edge" type="checkbox" ${s.cc?.on !== false ? 'checked' : ''}> Язычок пульта на краю экрана</label>
          <label class="checkbox_label"><input id="lf_set_theme" type="checkbox" ${s.cc?.theme !== false ? 'checked' : ''}> Тема Life на всю Таверну (Графит / Бумага / Луна — в пульте)</label>
          <small>Настройки — в хабе: Мир → ⚙ и в пульте. Команды <code>/life</code>, <code>/life cc</code>, аварийно <code>/life off</code>.</small>
        </div>
      </div>
    </div>`);
    document.getElementById('lf_set_enabled')?.addEventListener('change', function () { setEnabled(this.checked); });
    document.getElementById('lf_open_btn')?.addEventListener('click', () => openHub());
    document.getElementById('lf_cc_btn')?.addEventListener('click', () => openCC());
    document.getElementById('lf_set_edge')?.addEventListener('change', function () { settings().cc.on = this.checked; saveSettings(); applyTheme(); });
    document.getElementById('lf_set_theme')?.addEventListener('change', function () { settings().cc.theme = this.checked; saveSettings(); applyTheme(); });
}

function setEnabled(on) {
    const s = settings();
    s.enabled = !!on;
    saveSettings(); syncFab(); invalidate(); decorate(); updateMovePrompt(); applyTheme(); updateSceneBg();
    const cb = document.getElementById('lf_set_enabled');
    if (cb) cb.checked = s.enabled;
}

function registerSlash() {
    try {
        const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'life',
            helpString: 'Life: без аргумента — открыть хаб; cc — пульт; map / person / people / world — вкладка; chron — Летописец по последнему посту; fix — дописать оборванный последний пост; twist [past|danger|work|guest|secret|drama|body|home|strange|luck|chaos|off] — твист на следующий ответ; theme [graphite|paper|moon|off] — тема; on / off — включить или выключить.',
            unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'cc | map | person | world | chron | theme | on | off', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
            callback: async (_a, value) => {
                const v = String(value || '').trim().toLowerCase();
                if (v === 'on' || v === 'off') { setEnabled(v === 'on'); toast('info', v === 'on' ? 'Life включён' : 'Life выключен — чат как обычно'); return ''; }
                if (v === 'cc' || v === 'пульт') { openCC(); return ''; }
                if (v === 'theme' || v.startsWith('theme ')) {
                    const c = settings().cc;
                    const arg = { 'графит': 'graphite', 'бумага': 'paper', 'луна': 'moon' }[v.split(/\s+/)[1]] || v.split(/\s+/)[1];
                    if (['graphite', 'paper', 'moon'].includes(arg)) { c.theme = true; c.palette = arg; } else if (arg === 'off') c.theme = false; else c.theme = !c.theme;
                    saveSettings(); applyTheme();
                    toast('info', c.theme ? `Тема Life: ${({ graphite: 'Графит', paper: 'Бумага', moon: 'Луна' })[c.palette] || ''}` : 'Тема Life выключена');
                    return '';
                }
                if (v === 'fix' || v === 'дописать' || v === 'mend') { mendLast(); return ''; }
                if (v === 'recap' || v === 'ранее') { showRecap({}); return ''; }
                if (v === 'guide' || v === 'гайд' || v === 'что где') { guideSheet(); return ''; }
                if (v === 'twist' || v.startsWith('twist ') || v.startsWith('твист')) {
                    const arg = v.split(/\s+/).slice(1).join(' ');
                    if (arg === 'off' || arg === 'нет') { clearTwist(); toast('info', 'Твист отменён', '✦ Твист'); return ''; }
                    const k = twistByWord(arg);
                    if (!k) { toast('warning', `Нет такого твиста. Есть: ${TWISTS.map(t => t[0]).join(', ')}`, '✦ Твист', { timeOut: 6000 }); return ''; }
                    armTwist(k); disarmOnce();
                    const t = TWISTS.find(x => x[0] === k);
                    toast('info', `${t[1]} ${esc(t[2])} — в следующем ответе`, '✦ Твист', { timeOut: 1800 });
                    return '';
                }
                if (v === 'chron') { const chat = chatArr(); let i = chat.length - 1; while (i >= 0 && (chat[i].is_user || chat[i].is_system)) i--; if (i >= 0) queueChron(i, { force: true }); return ''; }
                openHub(['map', 'person', 'people', 'world'].includes(v) ? v : 'scene');
                return '';
            },
        }));
    } catch (e) { console.warn('[Life] команда не зарегистрирована', e); }
}

// ───────────── старт ─────────────

window.addEventListener('error', (e) => {
    if (/\/LIFE\/|\/life\//i.test(String(e?.filename || ''))) toast('error', esc(`${e.message} (${String(e.filename).split('/').pop()}:${e.lineno})`), '✦ Life: ошибка', { timeOut: 15000 });
});

function onChatChanged() {
    cancelChronAll();
    polishing.clear();
    setTimeout(() => { try { paintOocBar(); } catch { /* */ } }, 800);
    ui.focus = 'last';
    genActive = false;
    Object.assign(ui, { mapStack: [], who: '', chShow: 30, sel: '', region: '', atlas: false, item: '', pair: '', car: '', wset: '', galShow: 48 });
    resetImages();
    chronQueue.length = 0;
    invalidate();
    hookChat();
    decorateSoon(200);
    updateMovePrompt();
    syncBody();
    if (ui.open) closeHub();
    lastBgLoc = '';
    setTimeout(updateSceneBg, 900);
    setTimeout(runAutopay, 2500);
    setTimeout(() => { try { ambUpdate(); } catch { /* */ } }, 1500);
    setTimeout(() => { try { recapMaybe('open'); } catch (e) { console.warn('[Life] ранее в', e); } }, 1800);
    // ядро «Священный таймлайн»: облик людей на дату и правки персоны эпохи (оно само переключается чуть позже)
    for (const ms of [1500, 6000]) setTimeout(() => { coreRefresh(true).catch(e => console.warn('[Life] ядро таймлайна', e)); }, ms);
    // посев «от Claude» (лорбук на сервере): дни, подвиги — один раз на версию
    setTimeout(() => { seedApply().catch(e => console.warn('[Life] посев', e)); }, 9000);
    setTimeout(() => { try { if (claimEra() && ui.open) renderSoon(); } catch (e) { console.warn('[Life] эпохи', e); } }, 7000);
    setTimeout(() => { try { canonEnsure(); } catch (e) { console.warn('[Life] канон', e); } }, 7000);
    setTimeout(() => { try { oocEnsure(); } catch (e) { console.warn('[Life] ядро', e); } }, 12000);
    setTimeout(() => { try { fameEnsure(); } catch (e) { console.warn('[Life] кого как узнают', e); } }, 16000);
    setTimeout(() => { try { daysAfterPost(); } catch (e) { console.warn('[Life] дни', e); } }, 20000);
    // 0.18.12: исключение — пост, где картинка карточки висит второй раз (см. art.js), перерисовывается он один
    setTimeout(() => { try { artTidy(); } catch (e) { console.warn('[Life] карточки', e); } }, 2500);
    // 0.18.7: на открытии чата старые посты НЕ трогаем и не перерисовываем — после 0.18.4 Safari падал,
    // как только долистывали до конца чата (перерисованный последний пост). Огрызок чинится только у нового поста.
}

// идёт главная генерация (не quiet) — тяжёлое (картинки) ждёт её конца
let genActive = false;
async function genIdle(maxMs = 180000) {
    const t0 = Date.now();
    while (genActive && Date.now() - t0 < maxMs) await new Promise(r => setTimeout(r, 1500));
    if (genActive) genActive = false; // события конца не было — не ждать вечно
}

function lastAiIndex() {
    const chat = chatArr();
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i] && !chat[i].is_user && !chat[i].is_system) return i;
    return -1;
}

const controlApi = {
    settings, saveSettings, esc, toast, worldState, chapters, focusChapter, chapterCover,
    weekday, weatherWord, placeName, locTop, openHub, directorSheet, newChapterSheet, version: VERSION,
    balance: () => { const v = moneyView(); return v ? v.balanceText : ''; },
    openMoney: () => { ui.who = canonName(ctx().name1); ui.pTab = 'money'; openHub('person'); },
    sceneBg: (on) => { if (on !== undefined) { settings().sceneBg = !!on; saveSettings(); updateSceneBg(); } return settings().sceneBg; },
    detail: (on) => { if (on !== undefined) { settings().detail.on = !!on; saveSettings(); paintChips(); } return settings().detail.on; },
    moodHtml: () => (hasChat() ? moodHtml('cc') : ''),
    setMood: (v) => setMood(v),
    cycleIntim: () => cycleIntim(),
    setTone: (v) => setTone(v),
    toggleIntimOpt: (v) => toggleIntimOpt(v),
    cycleBond: () => cycleBond(),
    setBondTone: (v) => setBondTone(v),
    modesHtml: (tt) => (hasChat() && settings().enabled ? modesHtml(esc, tt) : ''),
    toggleMode: (v) => toggleMode(v),
    armOnce: (v) => { const id = armOnce(v); if (id) clearTwist(); return id; },
    wxLabel: () => wxLabel(), wxLevel: () => wxLevel(), cycleWx: () => cycleWx(),
    ambLabel: () => ambLabel(), ambLevel: () => ambLevel(), cycleAmb: () => cycleAmb(),
    emoSrc: (id) => emoSrc(id),
    twistsHtml: () => (hasChat() && settings().enabled ? twistsHtml({ at: 'data-cc', chip: 'cc-chip', wrap: 'cc-chips wrap' }) : ''),
    twistCC: (act, el, ui) => twistClick(act, el, { at: 'data-cc', busy: withBusy, ...ui }),
    duoHtml: () => (hasChat() && settings().enabled ? duoCCHtml() : ''),
    guide: () => guideSheet(),
    feel: () => feelOn(),
    toggleFeel: () => toggleFeel(),
    duoCC: (act, el) => duoClick(act, el),
    rekeyMessage: (i, oldMes) => { try { tasteSnap(i); } catch { /* */ } return rekeyChron(i, oldMes); },
};

const moodApi = { chatMeta, saveMeta, chatArr, chronOf, chapters, updatePrompt: () => updateMovePrompt() };

const simApi = {
    settings, saveSettings, chatMeta, saveMeta, ctx, esc, norm, cut, cap, plural, uid, toast, ava, avatarUrl, canonName, sameName, shortName,
    castNames, groupMembers, chatCards, cardOf, isOwn, worldState, parseDate, weekday, placeKey, locTop, locLeaf, locParts, placeName, getPlace, placeCover, knownLocations,
    fitAttr, placeIcon, sec, seg, openSheet, closeSheet, withBusy, render, askModel, askJson, extractJson, normalizeResult, drawPicture, refData, style, lightbox,
    lastAiIndex, chatArr, chronStore, chronOf, relationsState, relOf, triangles, secretsState, horaeEvents, ui, chapters, updatePrompt: () => updateMovePrompt(), isPost,
    hasChat, rekeyMessage: (i, oldMes) => { try { tasteSnap(i); } catch { /* */ } return rekeyChron(i, oldMes); }, scrollTop: () => { const b = document.querySelector('#lf-app .lf-body'); if (b) b.scrollTop = 0; },
    mindHtml: (who) => mindHtml(who),
    skipFlare: (who, w) => stonesOwns(who, w),
    emptyMeta,
};

/** Персонаж → Жизнь → Психика: триггеры, память, привычки, Камни, голос. */
function mindHtml(who) {
    const parts = [];
    for (const f of mindParts) { try { const h = f(who); if (h) parts.push(h); } catch (e) { console.warn('[Life] психика', e); } }
    return parts.join('') || '<div class="lf-empty small">Пока пусто.</div>';
}
const mindParts = [];

globalThis.LifeBridge = {
    version: VERSION,
    api: { ...simApi, icon, uploadImage, fileToJpeg, openHub, renderSoon, hasChat, decorateSoon, rekeyMessage: (i, oldMes) => { try { tasteSnap(i); } catch { /* */ } return rekeyChron(i, oldMes); } },
    register(mod) {
        if (!mod?.id || bridgeMods.some(x => x.id === mod.id)) return false;
        bridgeMods.push(mod);
        try { mod.init?.(this.api); } catch (e) { console.warn(`[Life] ${mod.id}: старт`, e); }
        try { updateMovePrompt(); } catch { /* */ }
        if (ui.open) renderSoon();
        return true;
    },
    modules: () => bridgeMods.map(m => m.id),
};

jQuery(async () => {
    // страховка Fetish Manager: его настройки живут только в браузере
    try {
        const fmSave = (b) => { settings().fmBackup = b; saveSettings(); };
        const said = fmRescue(settings().fmBackup, fmSave);
        if (said) setTimeout(() => toast('success', said, '✦ Fetish Manager', { timeOut: 6000 }), 2500);
        fmWatch(() => settings().fmBackup, fmSave);
    } catch (e) { console.warn('[Life] страховка FM', e); }
    settings();
    initSim(simApi);
    // одна карточка человека на двух алфавитах («Гельмут» и «Helmut») — склеить
    setTimeout(() => {
        try { const n = peopleDedupe(); if (n) console.info(`[Life] люди: склеила дублей ${n}`); } catch (e) { console.warn('[Life] люди: склейка', e); }
        // у кого своя карточка в ST — не NPC: из «Людей» вон
        try { const n = peopleDropCards(); if (n) console.info(`[Life] люди: убрала с карточками ${n}`); } catch (e) { console.warn('[Life] люди: карточки', e); }
    }, 3000);
    initShots({ ...simApi, chronOf, hash, plainText, sameName, wardrobeWorn, faceRef, cutMusic, repaint: () => paintChips() });
    initPress({ ...simApi, faceRef });
    // для патча телефона (phone-draw): те же лица, что в кадрах и СМИ
    globalThis.LifeFaces = { face: faceRef, canon: canonName, inText: namesInText };
    initPlates(simApi);
    platesSync().then(() => updateMovePrompt()).catch(e => console.warn('[Life] плашки', e));
    initMood(moodApi);
    initModes({ chatMeta, saveMeta, hasChat, updatePrompt: () => updateMovePrompt() });
    initTwists({ ...simApi, plainText, peopleList, onArm: () => disarmOnce() });
    initHurt(simApi);
    const extApi = { ...simApi, icon, chronOf, plainText, hash, genIdle, imgs, imagesBetween, paintSoon: () => decorateSoon(80) };
    initDays(extApi);
    initSeed(extApi);
    initCare({ ...extApi, version: VERSION, rekeySwipe: (i, cur) => rekeySwipe(i, cur) });
    hubMods.push({ pre: 'care-', click: careClick, label: 'Обслуживание' });
    hubInputs.push((el) => { if (el?.dataset?.in === 'care-file') { careInput(el); return true; } return false; });
    // копия настроек Life на сервер — раз в день, тихо
    setTimeout(() => { backupAuto().then(ok => { if (ok) console.info('[Life] копия настроек — на сервере'); }).catch(e => console.warn('[Life] копия настроек', e)); }, 30000);
    initReply({ ...extApi, onChoice: (u, c) => echoAdd(u, c) });
    initFresh(extApi);
    initFrames(extApi);
    initArcs({ ...extApi, peopleList, daysBrief, faceRef });
    initAlbum({ ...extApi, faceRef });
    initEmo({ ...extApi, faceRef, lifeKey: simLifeKey, refreshAvatars });
    initWeather(extApi);
    initZr(extApi);
    initVoice(extApi);
    initSlip(extApi);
    painters.push((el, id) => paintReply(el, id), (el, id) => paintFrame(el, id), (el, id) => paintSlip(el, id));
    chatClicks.push((act, el) => frameClick(act, el), (act, el) => slipClick(act, el), (act, el) => daysClick(act, el));
    painters.push((el, id) => paintDateGuard(el, id));
    hubMods.push({ pre: 'vo-', click: voiceClick, label: 'Голос' }, { pre: 'sl-', click: slipClick, label: 'Ляп-фикс' });
    hubInputs.push(slipInput);
    initCal({ ...extApi, horaeAgenda });
    initSkip({ ...extApi, insertMarker, daysBrief, afterSkip: () => { ui.focus = 'last'; closeHub(); decorate(); scrollChatBottom(); } });
    hubMods.push({ pre: 'cal-', click: calClick, label: 'Календарь' }, { pre: 'sk-', click: skipClick, label: 'Перемотка' });
    hubInputs.push(skipInput);
    initStage(extApi);
    initWhois({ ...extApi, peopleList });
    initPush(extApi);
    initGraph({ ...extApi, peopleList, npcImg, horaeRelationships });
    initRecap({ ...extApi, daysBrief, closeHub, chapterCover });
    initBelly({ ...extApi, faceRef });
    hubMods.push({ pre: 'bl-', click: bellyClick, label: 'Живот по сроку' });
    initStance(extApi);
    initRitual(extApi);
    hubMods.push({ pre: 'stn-', click: stanceClick, label: 'Споры' }, { pre: 'rit-', click: ritualClick, label: 'Своё' });
    initSteps(extApi);
    initSee(extApi);
    initSeason({ ...extApi, moodNow });
    initTriggers(extApi);
    initShards(extApi);
    hubMods.push({ pre: 'trg-', click: trigClick, label: 'Триггеры' }, { pre: 'shd-', click: shardsClick, label: 'Память' });
    initHabits(extApi);
    initHero(extApi);
    initCrowd(extApi);
    hubMods.push({ pre: 'hero-', click: heroClick, label: 'Кого как узнают' });
    hubInputs.push(heroInput);
    setTimeout(() => { try { fameEnsure(); } catch (e) { console.warn('[Life] кого как узнают', e); } }, 18000);
    hubMods.push({ pre: 'hab-', click: habitsClick, label: 'Привычки' }, { pre: 'crw-', click: crowdClick, label: 'Массовка' });
    initStones(extApi);
    hubMods.push({ pre: 'kmn-', click: stonesClick, label: 'Камни' });
    initEra(extApi);
    initRoute(extApi);
    initEcho({ ...extApi, openHub, agendaRun: () => agendaUpdate().then(ok => { if (ok && ui.open) render(); }) });
    initCanon(extApi);
    initDrama(extApi);
    painters.push((el, id) => paintEcho(el, id));
    chatClicks.push((act, el) => echoClick(act, el));
    hubMods.push({ pre: 'echo-', click: echoClick, label: 'Эхо решений' }, { pre: 'cn-', click: canonClick, label: 'Канон' }, { pre: 'dr-', click: dramaClick, label: 'Накал' });
    setTimeout(() => { try { canonEnsure(); } catch (e) { console.warn('[Life] канон', e); } }, 9000);
    initDuo({ ...extApi, namesInText, emoSrc: (i, w) => emoSrc(i, w) });
    initCall({ ...extApi, emoSrc: (i, w) => emoSrc(i, w) });
    painters.push((el, id) => paintDuo(el, id), (el, id) => paintCall(el, id));
    hubMods.push({ pre: 'duo-', click: duoClick, label: 'Вдвоём' });
    initRecs({ ...extApi, openHub, invalidate });
    initGuide({ ...extApi, openHub });
    initDraft(extApi);
    addRecs((i) => coreRecs(i), calRecs, stanceRecs, ritualRecs, stepsRecs, shardsRecs, trigRecs, hurtRecs, simRecs, innerRecs, replyRecs, echoRecs);
    hubMods.push({ pre: 'rec-', click: recsClick, label: 'Что записал пост' });
    initFix({ ...extApi, openHub, closeHub, queueChron: (i) => queueChron(i), shootPost: (i, kind, at) => shootShot(i, { kind, at }), recsSheet: (i) => recsSheet(i), guideSheet: (k) => guideSheet(k), coreOf: (w) => coreOf(w) });
    initLore(extApi);
    initOoc({ ...extApi, namesInText, rewriteFor: (i, q, w, why) => rewriteFor(i, q, w, why) });
    initLang(extApi);
    initFeel({ ...extApi, hurtLevel: (w) => hurtLevel(w), stonesNow: () => stonesNow() });
    initHand({ ...extApi, namesInText });
    painters.push((el, id) => paintHand(el, id));
    hubMods.push({ pre: 'hd-', click: handClick, label: 'Почерк' });
    painters.push((el, id) => paintOoc(el, id));
    chatClicks.push((act, el) => oocClick(act, el));
    hubMods.push({ pre: 'oc-', click: oocClick, label: 'Не он' }, { pre: 'lg-', click: langClick, label: 'Языки' });
    hubInputs.push(oocInput, langInput);
    setTimeout(() => { try { oocEnsure(); } catch (e) { console.warn('[Life] ядро', e); } }, 14000);
    painters.push((el, id) => paintFix(el, id), (el, id) => paintArt(el, id));
    chatClicks.push((act, el) => fixClick(act, el));
    hubMods.push({ pre: 'fx-', click: fixClick, label: 'Правка' });
    hubMods.push({ pre: 'era-', click: eraClick, label: 'Эпоха' }, { pre: 'rt-', click: routeClick, label: 'Дорога' });
    mindParts.push((who) => stonesHtml(who), (who) => trigHtml(who), (who) => shardsHtml(who), (who) => habitsHtml(who), (who) => voiceHtml(who), (who) => langHtml(who), (who) => handHtml(who), (who) => oocHtml(who));
    hubMods.push({ pre: 'sea-', click: seasonClick, label: 'Сезон' });
    painters.push((el, id) => paintSee(el, id));
    chatClicks.push((act, el) => seeClick(act, el));
    hubMods.push({ pre: 'stp-', click: stepsClick, label: 'Прожитое' });
    initAmbient({ ...extApi, musicNow: () => Music.now() });
    hubMods.push({ pre: 'am-', click: ambClick, label: 'Звук и запах' });
    setTimeout(() => { try { ambUpdate(); } catch (e) { console.warn('[Life] эмбиент', e); } }, 2500);
    hubMods.push({ pre: 'gr-', click: graphClick, label: 'Карта связей' }, { pre: 'rc-', click: recapClick, label: 'Ранее в…' });
    hubInputs.push(recapInput);
    setTimeout(() => { try { recapMaybe('load'); } catch (e) { console.warn('[Life] ранее в', e); } }, 3500);
    hubMods.push({ pre: 'st-', click: stageClick, label: 'Мизансцена' });
    initArm(extApi);
    hubMods.push({ pre: 'arm-', click: armClick, label: 'Рука' });
    initDollhouse({ ...extApi, mapLevelKey: () => mapLevel()?.key || '', goRoom: (raw, who) => goTravel(raw, { who: (who || []).map(n => horaeName(n, worldState())), chapter: false }) });
    hubMods.push({ pre: 'dh-', click: dhClick, label: 'Домик' });
    initHeroes({ ...extApi, faceRef });
    hubMods.push({ pre: 'hr-', click: heroesClick, label: 'Герои' });
    hubInputs.push(heroesInput);
    addRecs(heroesRecs);
    try {
        globalThis.LifeBridge.register({
            id: 'life-heroes',
            prompt: (type) => heroesPrompt(type),
            chron: (i) => heroesChron(i),
            afterPost: (i, j) => heroesAfterPost(i, j),
        });
    } catch (e) { console.warn('[Life] герои', e); }
    addRecs(armRecs);
    try {
        globalThis.LifeBridge.register({
            id: 'life-arm',
            prompt: (type) => armPrompt(type),
            chron: (i) => armChron(i),
            afterPost: (i, j) => armAfterPost(i, j),
            sceneHtml: () => armSceneHtml(),
        });
    } catch (e) { console.warn('[Life] рука', e); }
    try {
        globalThis.LifeBridge.register({
            id: 'life-arc',
            prompt: (type) => arcPrompt(type),
            chron: () => arcChron(),
            afterPost: (i, j) => arcAfterPost(i, j),
            sceneHtml: () => arcSceneHtml(),
        });
        globalThis.LifeBridge.register({
            id: 'life-twist',
            chron: () => twistChron(),
            afterPost: (i, j) => twistAfterPost(i, j),
            sceneHtml: () => `${sec('Твист', 'на следующий ответ')}${twistsHtml({ log: true })}`,
        });
        globalThis.LifeBridge.register({
            id: 'life-reply',
            chron: () => replyChron(),
            afterPost: (i, j) => { replyAfterPost(i, j); daysAfterPost(); freshAfterPost(); },
        });
        globalThis.LifeBridge.register({
            id: 'life-frames',
            chron: () => framesChron(),
            afterPost: (i, j) => framesAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-emo',
            chron: () => emoChron(),
            afterPost: (i, j) => emoAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-stones',
            prompt: (type) => stonesPrompt(type),
            chron: () => stonesChron(),
            afterPost: (i, j) => stonesAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-habits',
            prompt: (type) => habitsPrompt(type),
        });
        globalThis.LifeBridge.register({
            id: 'life-crowd',
            prompt: (type) => crowdPrompt(type),
            sceneHtml: () => crowdSceneHtml(),
        });
        globalThis.LifeBridge.register({
            id: 'life-trig',
            prompt: (type) => trigPrompt(type),
            chron: () => trigChron(),
            afterPost: (i, j, m) => trigAfterPost(i, j, m),
        });
        globalThis.LifeBridge.register({
            id: 'life-shards',
            prompt: (type) => shardsPrompt(type),
            chron: () => shardsChron(),
            afterPost: (i, j) => shardsAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-season',
            prompt: (type) => seasonPrompt(type),
        });
        globalThis.LifeBridge.register({
            id: 'life-see',
            prompt: (type) => seePrompt(type),
        });
        globalThis.LifeBridge.register({
            id: 'life-steps',
            prompt: (type) => stepsPrompt(type),
            chron: () => stepsChron(),
            afterPost: (i, j) => stepsAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-stance',
            prompt: (type) => stancePrompt(type),
            chron: () => stanceChron(),
            afterPost: (i, j) => stanceAfterPost(i, j),
            sceneHtml: () => stanceSceneHtml(),
        });
        globalThis.LifeBridge.register({
            id: 'life-ritual',
            prompt: (type) => ritualPrompt(type),
            chron: () => ritualChron(),
            afterPost: (i, j) => ritualAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-smell',
            prompt: (type) => smellPrompt(type),
            afterPost: () => smellAfterPost(),
            sceneHtml: () => smellSceneHtml(),
        });
        globalThis.LifeBridge.register({
            id: 'life-call',
            prompt: (type) => callPrompt(type),
            chron: (i) => callChron(i),
            afterPost: (i, j) => callAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-duo',
            sceneHtml: () => duoSceneHtml(),
        });
        globalThis.LifeBridge.register({
            id: 'life-ooc',
            chron: (i) => oocChron(i),
            afterPost: (i, j) => oocAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-lang',
            prompt: (type) => langPrompt(type),
        });
        globalThis.LifeBridge.register({
            id: 'life-drama',
            sceneHtml: () => dramaSceneHtml(),
        });
        globalThis.LifeBridge.register({
            id: 'life-stage',
            prompt: (type) => stagePrompt(type),
            chron: (i) => stageChron(i),
            afterPost: (i, j) => stageAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-cal',
            prompt: (type) => calPrompt(type),
            chron: (i) => calChron(i),
            afterPost: (i, j) => calAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-voice',
            prompt: (type) => voicePrompt(type),
        });
        globalThis.LifeBridge.register({
            id: 'life-slip',
            chron: (i) => slipChron(i),
            afterPost: (i, j) => slipAfterPost(i, j),
        });
        globalThis.LifeBridge.register({
            id: 'life-hurt',
            prompt: (type) => hurtPrompt(type),
            chron: () => hurtChron(),
            afterPost: (i, j, m) => hurtAfterPost(i, j, m),
            sceneHtml: () => hurtSceneHtml(),
        });
    } catch (e) { console.warn('[Life] твисты/раны: мост', e); }
    initCast(simApi);
    initKnock(simApi);
    initTidy(simApi);
    initMend(simApi);
    initArt({ ...simApi, icon, faceRef, namesInText, artImage: (info) => bridgeEach(m => m.artImage?.(info), 'картинка в карточке')[0] || null });
    // «Вкус» — после ляп-фикса и «не он»: их находки он применяет сам
    try {
        initTaste({ ...extApi, genActive: () => genActive, modesOn, modeList: () => MODES.map(m => [m[0], `${m[1]} ${m[2]}`]), setMesText, locate, slipAuto, oocAuto });
        painters.push((el, id) => paintTaste(el, id));
        chatClicks.push((act, el) => tasteClick(act, el));
        hubMods.push({ pre: 'ts-', click: tasteClick, label: 'Вкус' });
        globalThis.LifeBridge.register({ id: 'life-taste', prompt: (type) => tastePrompt(type), chron: (i) => tasteChron(i), afterPost: (i, j) => tasteAfterPost(i, j) });
        setTimeout(() => { try { paintOocBar(); } catch { /* */ } }, 2500);
    } catch (e) { console.warn('[Life] вкус', e); }
    setTimeout(() => { try { artTidy(); } catch (e) { console.warn('[Life] карточки', e); } }, 4000);
    try { initErrors({ settings, chatMeta, esc }); } catch (e) { console.warn('[Life] разбор ошибок', e); }
    try { initControl(controlApi); } catch (e) { console.warn('[Life] пульт не поднялся', e); }
    renderSettingsDrawer();
    registerSlash();
    syncFab();
    if (!addWandButton()) { let t = 0; const iv = setInterval(() => { if (addWandButton() || ++t > 20) clearInterval(iv); }, 500); }
    if (!hookChat()) { let t = 0; const iv = setInterval(() => { if (hookChat() || ++t > 40) { clearInterval(iv); decorateSoon(); } }, 500); }
    ui.focus = 'last';
    const { eventSource, eventTypes: E } = ctx();
    eventSource.on(E.CHAT_CHANGED, onChatChanged);
    // ядро таймлайна сменило эпоху, дату или состав — облик и правки персоны заново
    try { window.addEventListener?.('sacred-timeline:changed', () => { coreRefresh(true).catch(() => { }); }); } catch { /* */ }
    const later = () => { invalidate(); decorateSoon(450); setTimeout(() => { invalidate(); decorateSoon(); }, 1600); };
    for (const ev of [E.MESSAGE_SWIPED, E.MESSAGE_EDITED, E.MESSAGE_DELETED, E.MESSAGE_UPDATED, E.MORE_MESSAGES_LOADED, E.USER_MESSAGE_RENDERED]) if (ev) eventSource.on(ev, later);
    // свайпнула — отложенное чтение того варианта не нужно; удалили пост — номера съехали, таймеры по старым номерам снять
    if (E.MESSAGE_SWIPED) eventSource.on(E.MESSAGE_SWIPED, (id) => { cancelChron(Number(id)); paintChips(); });
    // поправила пост модели руками — «Вкус» учится на правке
    if (E.MESSAGE_EDITED) eventSource.on(E.MESSAGE_EDITED, (id) => { try { tasteEdited(Number(id)); } catch (e) { console.warn('[Life] вкус: правка', e); } });
    if (E.MESSAGE_DELETED) eventSource.on(E.MESSAGE_DELETED, () => { cancelChronAll(); chronForget(); setTimeout(() => { try { if (shotsHeal()) paintChips(); } catch (e) { console.warn('[Life] кадры после удаления', e); } }, 600); });
    const onAi = (id, type) => {
        later();
        const i = Number(id);
        // оборванный пост (Gemini рвёт хвост) — дописать; Летописец — уже по целому посту
        const mending = Number.isFinite(i) && i === lastAiIndex() && mendWanted(i, type);
        // сперва редактор «Вкуса» (чинит мелочи; грубый провал — прицельный реролл), потом Летописец читает уже причёсанное
        const read = (j) => {
            try { tasteSnap(j); } catch { /* */ }
            polishing.add(j);
            polish(j, type).catch(() => null).then((r) => {
                polishing.delete(j);
                if (r?.rerolled) return;                                   // вариант отвергнут — читать нечего
                if (chatArr()[chatArr().length - 1]?.is_user) queueChron(j); else scheduleChron(j);   // она уже ответила — без паузы
            });
        };
        if (mending) mendPost(i, { auto: true, after: (j) => { later(); if (j === lastAiIndex()) read(j); } });
        // огрызок <details> в конце поста (упёрлись в лимит) — срезать, пока ExtBlocks дописывает свои блоки (кроме того, что дописываем)
        // только этот новый пост — старые не трогаем (см. onChatChanged)
        if (Number.isFinite(i)) for (const ms of [1200, 6000]) setTimeout(() => { try { if (tidyMessage(i)) later(); } catch { /* */ } }, ms);
        if (type === 'impersonate') return;
        if (!mending && Number.isFinite(i) && i === lastAiIndex()) read(i);
        setTimeout(() => { updateSceneBg(); runAutopay(); try { ambUpdate(); } catch { /* */ } }, 2200);
    };
    // карточке-«артефакту» своя картинка модуля (снимок УЗИ из Зёрнышка) — до того, как SLAY начнёт рисовать другую
    if (E.MESSAGE_RECEIVED) eventSource.on(E.MESSAGE_RECEIVED, (id) => { try { artOnReceived(Number(id)); } catch (e) { console.warn('[Life] карточки', e); } });
    if (E.CHARACTER_MESSAGE_RENDERED) eventSource.on(E.CHARACTER_MESSAGE_RENDERED, onAi);
    else if (E.MESSAGE_RECEIVED) eventSource.on(E.MESSAGE_RECEIVED, onAi);
    if (E.MESSAGE_SENT) eventSource.on(E.MESSAGE_SENT, (id) => {
        ui.focus = 'last'; later();
        // она ответила — последний ответ точно остаётся: Летописцу читать его сейчас, не ждать паузу
        try { flushChron(); } catch { /* */ }
        try { recapSeen(); } catch { /* */ }
        // «не пропусти»: разбирать пост сразу, пока таверна собирает генерацию
        try { if (settings().enabled) replyWarm(Number(id)); } catch (e) { console.warn('[Life] не пропусти', e); }
        try { if (settings().enabled) seeWarm(Number(id)); } catch (e) { console.warn('[Life] покажи им', e); }
        setTimeout(() => { try { paintDraft(); } catch { /* */ } }, 120);
    });
    if (E.GENERATION_STARTED) eventSource.on(E.GENERATION_STARTED, (type, _o, dry) => {
        if (!dry && type !== 'quiet') genActive = true;
        if (!dry && (type === 'swipe' || type === 'regenerate')) { try { cancelChron(lastAiIndex()); } catch { /* */ } }
    });
    const endGen = () => {
        genActive = false;
        const cm = chatMeta();
        if (cm.director?.once && lastAiIndex() > (cm.director.after ?? -1)) { cm.director = null; saveMeta(); }
        try { tasteGenEnd(); } catch (e) { console.warn('[Life] вкус', e); }
        updateMovePrompt();
    };
    for (const ev of [E.GENERATION_ENDED, E.GENERATION_STOPPED]) if (ev) eventSource.on(ev, endGen);
    if (E.APP_READY) eventSource.on(E.APP_READY, () => { addWandButton(); hookChat(); decorateSoon(); updateMovePrompt(); syncBody(); });
    decorateSoon(300);
    updateMovePrompt();
    setTimeout(updateSceneBg, 1500);
    bank().then(() => setTimeout(runAutopay, 3000));
    console.log(`[Life] загружен ${VERSION}`);
});
