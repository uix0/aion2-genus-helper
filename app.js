// Genus Helper (https://github.com/uix0/aion2-genus-helper). PolyForm Noncommercial License 1.0.0, see LICENSE.md.
// Everything the page does: the lock rules, the screen reading and the rendering. Data lives in data/*.js.

const OPTIONS = window.GENUS_OPTIONS;
// grade odds per Insight level (identical on all 5 boards, aion2.gg)
const ODDS = {
  1: [90, 10, 0, 0, 0],
  2: [70, 30, 0, 0, 0],
  3: [55, 45, 0, 0, 0],
  4: [50, 45, 5, 0, 0],
  5: [45, 45, 10, 0, 0],
  6: [40, 40, 20, 0, 0],
  7: [35, 34, 30, 1, 0],
  8: [30, 30, 35, 5, 0],
  9: [25, 25, 39, 10, 1],
  10: [20, 30, 30, 15, 5],
};
const GRADES = ["Common", "Rare", "Epic", "Unique", "Heroic"];
const GENERA = Object.keys(OPTIONS);
// Soul Crystals for one roll by number of locked lines (9 open slots); kinah is 250 per crystal. 8 locks is an estimate.
const ROLL_COST = [36, 40, 44, 60, 96, 172, 248, 324, 400],
  COST_EST = [0, 0, 0, 0, 0, 0, 0, 0, 1];
const rollCost = (L, n) => Math.max(1, ROLL_COST[Math.min(8, L)] - 4 * (9 - n));
const CLASSES = window.GENUS_CLASSES;
const GROUPS = [
  [
    "Attack",
    [
      "Attack Bonus",
      "Max Attack",
      "Boss Attack",
      "PvE Attack",
      "Damage Boost",
      "PvE Damage Boost",
      "Weapon Damage Boost",
      "Penetration",
      "Accuracy Bonus",
      "PvE Accuracy",
      "Power Shard Damage Bonus",
    ],
  ],
  [
    "Crit and procs",
    [
      "Critical Hit",
      "Critical Attack",
      "Critical Damage Boost",
      "Double Chance",
      "Multi-hit Chance",
      "Perfect Chance",
      "Status Effect Chance",
      "Endurance Penetration",
      "Regeneration Penetration",
    ],
  ],
  [
    "Positional",
    [
      "Back Attack",
      "Back Attack Critical Hit",
      "Back Attack Damage Boost",
      "Front Attack",
      "Front Attack Critical Hit",
      "Front Attack Damage Boost",
    ],
  ],
  [
    "Survival",
    [
      "HP",
      "HP increase",
      "MP",
      "Defense Bonus",
      "Evasion Bonus",
      "Block",
      "Damage Tolerance",
      "Weapon Damage Tolerance",
      "Critical Hit Resist",
      "Critical Damage Defense",
      "Critical Damage Tolerance",
      "Endurance",
      "Regeneration",
      "Status Effect Resist",
      "Double Resist",
      "Multi-hit Resist",
      "Perfect Resist",
    ],
  ],
  [
    "PvE and positional defence",
    [
      "PvE Defense",
      "PvE Evasion",
      "PvE Damage Tolerance",
      "Boss Defense",
      "Back Defense",
      "Front Defense",
      "Back Attack Critical Hit Resist",
      "Front Attack Critical Hit Resist",
      "Back Attack Damage Tolerance",
      "Front Attack Damage Tolerance",
    ],
  ],
  [
    "Only against that board's monster family (Cogni / Fera / Natura / Varian lines)",
    [
      "Genus Attack",
      "Genus Damage Boost",
      "Genus Critical Hit",
      "Genus Accuracy",
      "Genus Defense",
      "Genus Evasion",
      "Genus Block",
      "Genus Critical Hit Resist",
      "Genus Damage Tolerance",
    ],
  ],
];

const $ = (id) => document.getElementById(id);
const num = (s) => parseFloat(String(s).replace(/[+%,]/g, ""));
const gkey = (s) => s.replace(/^(Cogni|Fera|Natura|Varian) /, "Genus ");
const label = (k) => k.replace(/^Genus /, "[Board] ");
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem("genus2:" + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("genus2:" + k, JSON.stringify(v));
    } catch (e) {}
  },
};

// per stat: highest value it can roll anywhere, and whether it is a % stat
const STAT = {};
for (const g of GENERA)
  for (const s of OPTIONS[g].slots)
    for (const o of s.options) {
      const k = gkey(o.stat),
        e = STAT[k] || (STAT[k] = { max: 0, pct: String(o.max).includes("%") });
      e.max = Math.max(e.max, num(o.max));
    }
{
  const listed = new Set(GROUPS.flatMap((g) => g[1]));
  const rest = Object.keys(STAT)
    .filter((k) => !listed.has(k))
    .sort();
  for (const g of GROUPS) g[1] = g[1].filter((k) => STAT[k]);
  if (rest.length) GROUPS.push(["Other", rest]);
}

const S = {
  cls: store.get("cls", null),
  want: store.get("want", {}),
  genus: store.get("genus", GENERA[0]),
  level: store.get("level", 10),
  s4a: store.get("s4a", 90),
  s4b: store.get("s4b", 85),
  s4c: store.get("s4c", 80),
  pre: store.get("pre", 90),
  near: store.get("near", 10),
  rolls: store.get("rolls", {}),
  minRoll: store.get("minRoll", 60),
  minGrade: store.get("minGrade", "Unique"),
  auto: store.get("auto", true),
  lines: [],
};
const save = () => {
  for (const k of [
    "rolls",
    "s4a",
    "s4b",
    "s4c",
    "pre",
    "near",
    "minRoll",
    "minGrade",
    "cls",
    "want",
    "genus",
    "level",
    "auto",
  ])
    store.set(k, S[k]);
};

/* ---------- worth of a line ---------- */
const openSlots = () => OPTIONS[S.genus].slots.filter((s) => s.index <= S.level);
const slotOpts = (slot) => slot.options.filter((o) => ODDS[S.level][GRADES.indexOf(o.gradeLabel)] > 0);
// stats that roll in exactly one slot of a board (slot 4's damage boosts, slot 7's tolerances)
const EXCL = {};
for (const g of GENERA) {
  const c = {};
  for (const s of OPTIONS[g].slots)
    for (const st of new Set(s.options.map((o) => o.stat))) (c[st] = c[st] || []).push(s.index);
  EXCL[g] = {};
  for (const st in c) if (c[st].length === 1) EXCL[g][st] = c[st][0];
}
// never worth taking on that board even when picked: Special slot 4 is for Double Chance or a positional damage boost
const SKIP = { Special: ["Damage Boost", "Critical Damage Boost"] };
const HIGH_ANYWAY = 90; // a ruled-out pick that rolled at least this % of its maximum is still shown as "decent, your call"
// the stats that count as good in a slot: your picks, narrowed to the slot-only ones when the slot has any
function accepted(slot) {
  const skip = SKIP[S.genus] || [],
    w = [...new Set(slotOpts(slot).map((o) => o.stat))].filter((st) => S.want[gkey(st)] && !skip.includes(st));
  const ex = w.filter((st) => EXCL[S.genus][st] === slot.index);
  return new Set(ex.length ? ex : w);
}
const quality = (stat, v) => {
  const e = STAT[gkey(stat || "")];
  return e && v > 0 ? Math.min(1, v / e.max) : 0;
};
const GI = (g) => GRADES.indexOf(g);
// a line only counts when its stat is good for the slot AND it clears the grade floor and the slot's current lock-at %
function lineState(slot, acc, l, floor) {
  if (!l || !l.stat) return "none";
  if (!acc.has(l.stat)) return "unwanted";
  const g = l.value != null ? gradeOf(slot, l.stat, l.value, l.grade) : null;
  if (g && GI(g) < GI(S.minGrade)) return "lowgrade";
  return quality(l.stat, l.value) * 100 < floor - 1e-6 ? "lowroll" : "ok";
}
const fmtV = (stat, v) => (v == null || isNaN(v) ? "" : STAT[gkey(stat)]?.pct ? v + "%" : String(v));

/* ---------- what to lock ---------- */
// chance that one roll of a slot lands a line you would lock (your stats, at or above your grade and that slot's lock-at %)
function slotOdds(slot, acc, floor) {
  let tot = 0,
    hit = 0;
  const fl = floor / 100;
  for (const o of slotOpts(slot)) {
    const q = ODDS[S.level][GI(o.gradeLabel)] * o.p;
    tot += q;
    if (!acc.has(o.stat) || GI(o.gradeLabel) < GI(S.minGrade)) continue;
    const e = STAT[gkey(o.stat)],
      lo = num(o.min),
      hi = num(o.max),
      step = e.pct ? 0.1 : 1,
      n = Math.round((hi - lo) / step) + 1;
    let k = 0;
    for (let j = 0; j < n; j++) if ((lo + j * step) / e.max >= fl - 1e-9) k++;
    hit += (q * k) / n;
  }
  return tot ? hit / tot : 0;
}
// The rule. Before slot 4 has a line worth locking, other slots only lock at S.pre % or better, and slot 4 itself
// locks at S.s4a / S.s4b / S.s4c % depending on whether 0 / 1 / 2+ such locks exist. Once slot 4 is locked
// (or nothing you picked can roll there), the other slots lock at S.minRoll %.
function decide() {
  const slots = openSlots(),
    accs = slots.map(accepted),
    i4 = slots.findIndex((s, i) => s.index === 4 && accs[i].size);
  const q0 = slots.map((s, i) =>
    lineState(s, accs[i], S.lines[i], 0) === "ok" ? quality(S.lines[i].stat, S.lines[i].value) : 0,
  ); // good stat and grade, any roll
  // a line already locked in game that is within S.near points of its bar is left alone, and counts as a lock
  const held = (i, bar) => !!S.lines[i]?.locked && q0[i] > 0 && q0[i] * 100 >= bar - S.near - 1e-6;
  const high = q0.filter((v, i) => i !== i4 && (v * 100 >= S.pre - 1e-6 || held(i, S.pre))).length;
  const f4 = [S.s4a, S.s4b, S.s4c][Math.min(2, high)],
    has4 = i4 < 0 || q0[i4] * 100 >= f4 - 1e-6 || held(i4, f4);
  const floors = slots.map((s, i) => (i === i4 ? f4 : has4 ? S.minRoll : S.pre));
  const st = slots.map((s, i) => lineState(s, accs[i], S.lines[i], floors[i])),
    lock = st.map((x) => x === "ok");
  const okay = slots.map((s, i) => !lock[i] && held(i, floors[i]));
  return {
    slots,
    accs,
    st,
    lock,
    okay,
    i4,
    has4,
    high,
    f4,
    floors,
    odds: slots.map((s, i) => slotOdds(s, accs[i], floors[i])),
  };
}

/* ---------- rendering ---------- */
function seg(el, items, cur, on) {
  el.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.textContent = it.label;
    if (it.id === cur) b.className = "on";
    b.onclick = () => on(it.id);
    el.appendChild(b);
  }
}
const MAIN_GROUPS = 3; // Attack, Crit and procs, Positional are shown; survival, defence and board-only stats sit in a folded panel
let moreStatsOpen = false;
function renderPicks() {
  seg(
    $("cls"),
    Object.keys(CLASSES).map((c) => ({ id: c, label: c })),
    S.cls,
    (c) => {
      S.cls = c;
      S.want = {};
      for (const k of CLASSES[c].stats) if (STAT[k]) S.want[k] = true;
      render();
    },
  );
  const grp = ([name, keys]) =>
    `<div class="grp"><div>${name}</div><div class="chips">${keys.map((k) => `<span class="chip${S.want[k] ? " p2" : ""}" data-k="${k}">${label(k)}</span>`).join("")}</div></div>`;
  const rest = GROUPS.slice(MAIN_GROUPS),
    on = rest.reduce((n, g) => n + g[1].filter((k) => S.want[k]).length, 0);
  $("want").innerHTML =
    GROUPS.slice(0, MAIN_GROUPS).map(grp).join("") +
    `<details class="more" id="moreStats" style="margin-top:14px"${moreStatsOpen ? " open" : ""}><summary>Survival, defence and monster-family stats${on ? ` (${on} on)` : ""}</summary>${rest.map(grp).join("")}</details>`;
  $("moreStats").ontoggle = () => {
    moreStatsOpen = $("moreStats").open;
  };
  $("want")
    .querySelectorAll(".chip")
    .forEach(
      (c) =>
        (c.onclick = () => {
          const k = c.dataset.k;
          if (S.want[k]) delete S.want[k];
          else S.want[k] = true;
          render();
        }),
    );
}
function gradeOf(slot, stat, v, hint) {
  const hits = slotOpts(slot)
    .filter((o) => o.stat === stat && v >= num(o.min) - 1e-9 && v <= num(o.max) + 1e-9)
    .map((o) => o.gradeLabel);
  if (!hits.length) return null;
  return hits.includes(hint) ? hint : hits[0];
}
function renderAdvice() {
  const slots = openSlots();
  S.lines.length = slots.length;
  for (let i = 0; i < slots.length; i++) S.lines[i] = S.lines[i] || { stat: "", value: null, locked: false };
  const anyPick = Object.keys(S.want).length > 0,
    anyLine = S.lines.some((l) => l.stat),
    D = decide(),
    accs = D.accs;
  let h = `<tr><th>Slot</th><th title="Locked in game">Lock</th><th>Stat</th><th class="n">Value</th><th>Grade</th><th>Status</th><th>Roll / needs</th><th class="n">Odds</th><th>Advice</th></tr>`;
  const toLock = [],
    toDecent = [],
    toUnlock = [];
  slots.forEach((slot, i) => {
    const l = S.lines[i],
      stats = [...new Set(slotOpts(slot).map((o) => o.stat))].sort(),
      good = accs[i].has(l.stat),
      st = D.st[i];
    const g = l.stat && l.value != null ? gradeOf(slot, l.stat, l.value, l.grade) : null;
    const bad = l.stat && (!stats.includes(l.stat) || (l.value != null && !g));
    let adv = "";
    const unsure = l.stat && l.agree === 1,
      seen = l.readers ? l.readers.map((x) => (x == null ? "?" : x)).join(" / ") : "";
    // one of your picks that this slot does not count: either the board rule (Special slot 4) or a slot with its own stats
    const qv = Math.round(quality(l.stat, l.value) * 100),
      ruledOut = anyPick && !!l.stat && st === "unwanted" && !!S.want[gkey(l.stat)],
      boardRule = ruledOut && (SKIP[S.genus] || []).includes(l.stat),
      // ...but a very high roll of it is still flagged as worth a look, whatever the lock settings say
      highAnyway = boardRule && qv >= HIGH_ANYWAY && (!g || GI(g) >= GI(S.minGrade));
    const wanted = [...accs[i]].sort().join(" or ");
    const why = !ruledOut
      ? ""
      : boardRule
        ? `${l.stat} is one of your picks, but slot ${slot.index} on the ${S.genus} board is where ${wanted || "Double Chance or a front/back attack damage boost"} rolls, which is worth far more, so ${l.stat} is normally a reroll here, unless it's a very high roll.` +
          (highAnyway
            ? ` This one rolled ${qv}% of its maximum, which is high enough that keeping it is reasonable. Your call.`
            : "")
        : `${l.stat} is one of your picks, but slot ${slot.index} can roll stats found nowhere else on this board (${wanted}), so only those count here.`;
    const whyIcon = why
      ? ` <span class="why" tabindex="0" role="button" title="${why}" data-why="${why}">?</span>`
      : "";
    if (highAnyway) adv = `<span class="badge b-okay" title="${why}">your call</span>`;
    else if (anyPick && l.stat) {
      const keep = D.lock[i];
      // clears the bar but is under the top bar (the "before slot 4" %, or slot 4's "nothing else locked" %): worth a lock, not a must
      const decent = keep && quality(l.stat, l.value) * 100 < (i === D.i4 ? S.s4a : S.pre) - 1e-6;
      if (keep && !l.locked) {
        adv = decent ? `<span class="badge b-decent">decent lock</span>` : `<span class="badge b-lock">LOCK</span>`;
        (decent ? toDecent : toLock).push(`slot ${slot.index} ${l.stat} ${fmtV(l.stat, l.value)}`);
      } else if (keep) adv = `<span class="badge b-keep">keep locked</span>`;
      else if (D.okay[i])
        adv = `<span class="badge b-okay" title="Already locked and within ${S.near} points of the ${D.floors[i]}% bar, so it is left alone">okay</span>`;
      else if (l.locked) {
        adv = `<span class="badge b-unlock">UNLOCK</span>`;
        toUnlock.push(`slot ${slot.index} ${l.stat} ${fmtV(l.stat, l.value)}`);
      } else adv = `<span class="badge b-roll">reroll</span>`;
    }
    if (unsure) adv = `<span class="badge b-unlock">CHECK VALUE</span>`;
    const bar = D.floors[i],
      fair = qv >= (i === D.i4 ? S.s4c : S.minRoll) - 1e-6;
    const stPill =
      !l.stat || !anyPick
        ? ""
        : st === "ok"
          ? `<span class="st ok">good</span>`
          : st === "lowroll"
            ? fair
              ? `<span class="st mid" title="A good stat with a fair roll, but under the ${bar}% this slot needs right now">decent</span>`
              : `<span class="st low">roll too low</span>`
            : st === "lowgrade"
              ? `<span class="st low">grade too low</span>`
              : highAnyway
                ? `<span class="st mid">decent</span>${whyIcon}`
                : ruledOut
                  ? `<span class="st low">not for slot ${slot.index}</span>${whyIcon}`
                  : `<span class="st">not wanted</span>`;
    const meter =
      l.stat && (good || highAnyway) && l.value != null
        ? `<div class="meter" title="Rolled ${qv}% of the highest possible; this slot locks at ${bar}% right now"><div class="track"><i class="${st === "ok" ? "ok" : fair || highAnyway ? "mid" : "low"}" style="width:${Math.min(100, qv)}%"></i><b style="left:${Math.min(100, bar)}%"></b></div><span>${qv}%</span><small>/ ${bar}%</small></div>`
        : anyPick && accs[i].size && (!l.stat || good)
          ? `<span class="small mute">needs ${bar}%</span>`
          : "";
    h += `<tr class="${anyPick && l.stat && D.lock[i] ? "is-keep" : ""}${anyPick && l.stat && !D.lock[i] && !D.okay[i] && !highAnyway && l.locked ? " is-unlock" : ""}"><td><span class="slotn${slot.index === 4 ? " s4" : ""}">${slot.index}</span></td>
     <td><label class="lockbox" title="Locked in game"><input type="checkbox" data-i="${i}" data-f="locked" ${l.locked ? "checked" : ""}><span></span></label></td>
     <td><select class="stat${g ? " g" + g : ""}" data-i="${i}" data-f="stat"><option value="">(not read)</option>${stats.map((s) => `<option${s === l.stat ? " selected" : ""}>${s}</option>`).join("")}${l.stat && !stats.includes(l.stat) ? `<option selected>${l.stat}</option>` : ""}</select></td>
     <td class="n"><input type="number" step="any" class="val${unsure ? " unsure" : ""}" data-i="${i}" data-f="value" value="${l.value ?? ""}">${STAT[gkey(l.stat || "")]?.pct ? "<em>%</em>" : ""}${l.stat && l.agree && l.agree < 3 ? `<span class="rd${unsure ? " bad" : ""}" title="The three readers saw: ${seen}">${unsure ? "?? " + seen : "2 of 3"}</span>` : ""}</td>
     <td>${g ? `<span class="g g${g}">${g}</span>` : bad ? `<span class="warn" title="This stat or value cannot roll in this slot at this Insight level. Check the line.">check</span>` : ""}</td>
     <td>${stPill}</td><td>${meter}</td>
     <td class="n mute">${anyPick && accs[i].size ? (D.odds[i] * 100).toFixed(1) + "%" : ""}</td><td>${adv}</td></tr>`;
  });
  $("lines").innerHTML = h;
  // the "?" explains itself on hover; a click or tap shows the same text under the table
  $("whyNote").hidden = true;
  $("lines")
    .querySelectorAll(".why")
    .forEach(
      (el) =>
        (el.onclick = () => {
          $("whyNote").textContent = el.dataset.why;
          $("whyNote").hidden = false;
        }),
    );
  $("lines")
    .querySelectorAll("[data-f]")
    .forEach(
      (el) =>
        (el.onchange = () => {
          const l = S.lines[+el.dataset.i],
            f = el.dataset.f;
          if (f === "locked") l.locked = el.checked;
          else if (f === "stat") {
            l.stat = el.value;
            l.grade = null;
          } else {
            l.value = el.value === "" ? null : +el.value;
            l.agree = 3;
            l.readers = null;
            l.manual = true;
          }
          renderAdvice();
        }),
    );
  const v = $("verdict");
  const doubt = slots.map((s, i) => ({ s, l: S.lines[i] })).filter((x) => x.l.stat && x.l.agree === 1),
    part = slots.map((s, i) => ({ s, l: S.lines[i] })).filter((x) => x.l.stat && x.l.agree === 2);
  if (!anyPick)
    v.innerHTML = `<div class="verdict idle"><b class="t">Pick your stats first</b><div class="d">Choose a class, or click the stats you want, under Class and stats.</div></div>`;
  else if (!anyLine)
    v.innerHTML = `<div class="verdict idle"><b class="t">No lines yet</b><div class="d">Share the game screen or paste a screenshot, or fill the table in by hand.</div></div>`;
  else if (doubt.length)
    v.innerHTML = `<div class="verdict bad"><b class="t">Do not act yet: check ${doubt.length > 1 ? "these values" : "this value"}</b><div class="d">${doubt.map((x) => `Slot ${x.s.index} (${x.l.stat}): the readers saw ${x.l.readers.map((r) => (r == null ? "nothing" : r)).join(", ")}`).join("<br>")}.<br>Type the real value from the game into the table; the advice appears once it is corrected.</div></div>`;
  else {
    const nLock = D.lock.filter(Boolean).length,
      s4miss = D.i4 >= 0 && !D.has4;
    const acts = [
      toLock.length ? `<b>Lock</b> ${toLock.join(", ")}` : "",
      toDecent.length ? `<b>Decent lock, your call</b> ${toDecent.join(", ")}` : "",
      toUnlock.length ? `<b>Unlock</b> ${toUnlock.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("<br>");
    const nOk = D.okay.filter(Boolean).length,
      info =
        `${nLock} of ${slots.length} lines are worth keeping locked${nOk ? `, and ${nOk} already locked ${nOk > 1 ? "are" : "is"} close enough to leave alone` : ""}.` +
        (s4miss
          ? ` Slot 4 is not locked yet, so other slots only lock at ${S.pre}% or better. With ${D.high === 0 ? "no such lock" : D.high === 1 ? "one such lock" : D.high + " such locks"}, slot 4 locks at ${D.f4}%${D.odds[D.i4] > 0 ? ` (about once in ${Math.round(1 / D.odds[D.i4])} rolls)` : ""}.`
          : "");
    v.innerHTML = acts
      ? `<div class="verdict roll"><b class="t">Change locks</b><div class="d">${acts}<br>${info}</div></div>`
      : `<div class="verdict keep"><b class="t">Locks are right</b><div class="d">Nothing to lock or unlock. ${info}</div></div>`;
    if (part.length)
      v.innerHTML += `<div class="note">Two of the three readers agreed on ${part
        .map(
          (x) =>
            `slot ${x.s.index} (${x.l.value}, the other saw ${
              x.l.readers
                .filter((r) => r !== x.l.value)
                .map((r) => (r == null ? "nothing" : r))
                .join("/") || "nothing"
            })`,
        )
        .join(", ")}. Glance at the game to confirm before unlocking anything.</div>`;
  }
  $("good").innerHTML =
    slots
      .map(
        (s, i) =>
          `<div><b>Slot ${s.index}:</b> ${accs[i].size ? [...accs[i]].sort().join(", ") : '<span class="mute">nothing you picked rolls here, so any line is a reroll</span>'}</div>`,
      )
      .join("") +
    (SKIP[S.genus]
      ? `<div class="mute" style="margin-top:4px">On this board ${SKIP[S.genus].join(" and ")} never count, even when picked.</div>`
      : "");
}
// S.rolls[board] = {n: rolls, c: Soul Crystals spent, est: rolls priced from an estimate, by: {locks: rolls}, last: [locks of recent rolls]}
function rollRec(g) {
  let r = S.rolls[g];
  if (typeof r === "number") r = S.rolls[g] = { n: r, c: 0, est: 0, by: {}, last: [], old: r }; // counts from before costs were tracked
  return r || (S.rolls[g] = { n: 0, c: 0, est: 0, by: {}, last: [] });
}
function addRoll(g, L, nSlots) {
  const r = rollRec(g);
  r.n++;
  r.c += rollCost(L, nSlots);
  if (COST_EST[Math.min(8, L)]) r.est++;
  r.by[L] = (r.by[L] || 0) + 1;
  r.last.push([L, nSlots]);
  if (r.last.length > 200) r.last.shift();
  return r;
}
function undoRoll(g) {
  const r = S.rolls[g];
  if (!r || typeof r === "number" || !r.n) return;
  const e = r.last.pop();
  if (e) {
    const [L, nS] = e;
    r.n--;
    r.c -= rollCost(L, nS);
    if (COST_EST[Math.min(8, L)]) r.est--;
    if (--r.by[L] <= 0) delete r.by[L];
  } else if (r.old) {
    r.old--;
    r.n--;
  }
}
function renderRolls() {
  const fmt = (n) => Math.round(n).toLocaleString("en-US"),
    rows = GENERA.map((g) => [g, S.rolls[g]])
      .filter(([g, r]) => r && (typeof r === "number" ? r : r.n))
      .map(([g]) => [g, rollRec(g)]);
  const cur = S.rolls[S.genus] ? rollRec(S.genus) : { n: 0, c: 0, est: 0 },
    tot = rows.reduce((a, [g, r]) => ({ n: a.n + r.n, c: a.c + r.c, est: a.est + r.est, old: a.old + (r.old || 0) }), {
      n: 0,
      c: 0,
      est: 0,
      old: 0,
    });
  const k = (r) => (r.est ? "~" : "") + fmt(r.c * 250),
    c = (r) => (r.est ? "~" : "") + fmt(r.c);
  $("rollInfo").innerHTML =
    `<div class="tiles"><div class="tile"><small>Rolls · ${S.genus}</small><b>${fmt(cur.n)}</b></div><div class="tile"><small>Kina spent</small><b>${k(cur)}</b></div><div class="tile"><small>Crystals spent</small><b>${c(cur)}</b></div>
    <div class="tile all"><small>All boards</small><b>${fmt(tot.n)} roll${tot.n === 1 ? "" : "s"}</b><span>${k(tot)} Kina · ${c(tot)} crystals</span></div></div>`;
  const by = (r) =>
    Object.keys(r.by || {})
      .sort((a, b) => a - b)
      .map((L) => `${r.by[L]} at ${L} lock${L == 1 ? "" : "s"}`)
      .join(", ") +
    (r.old ? `${Object.keys(r.by || {}).length ? ", " : ""}${r.old} counted before costs were tracked` : "");
  $("rollTab").innerHTML = !rows.length
    ? ""
    : `<tr><th>Board</th><th class="n">Rolls</th><th class="n">Kina spent</th><th class="n">Crystals spent</th><th>Rolls by locks held</th></tr>` +
      rows
        .map(
          ([g, r]) =>
            `<tr><td>${g}</td><td class="n">${r.n}</td><td class="n">${r.est ? "~" : ""}${fmt(r.c * 250)}</td><td class="n">${r.est ? "~" : ""}${fmt(r.c)}</td><td class="mute" style="white-space:normal">${by(r)}</td></tr>`,
        )
        .join("") +
      (rows.length > 1
        ? `<tr><td><b>Total</b></td><td class="n"><b>${tot.n}</b></td><td class="n"><b>${tot.est ? "~" : ""}${fmt(tot.c * 250)}</b></td><td class="n"><b>${tot.est ? "~" : ""}${fmt(tot.c)}</b></td><td></td></tr>`
        : "");
}
function render() {
  save();
  renderPicks();
  seg(
    $("genus"),
    GENERA.map((g) => ({ id: g, label: g })),
    S.genus,
    (g) => {
      if (g !== S.genus) {
        S.genus = g;
        S.lines = [];
        prevScan = null;
      }
      render();
    },
  );
  $("level").value = S.level;
  renderRolls();
  renderAdvice();
}

/* ---------- reading the panel ---------- */
const cap = {
  stream: null,
  video: document.createElement("video"),
  frame: document.createElement("canvas"),
  src: null,
  regionLive: store.get("region", { x: 0.765, y: 0.1, w: 0.225, h: 0.63 }),
  regionImg: null,
  timer: null,
  lastSig: null,
  scannedSig: null,
};
cap.video.muted = true;
cap.video.playsInline = true;
let busy = false,
  pending = false,
  worker = null,
  prevScan = null,
  rollBase = null, // the read from just before the last counted roll
  lastRollAt = 0;
const status = (t, cls) => {
  const e = $("status");
  e.textContent = t;
  e.className = cls === "warn" ? "warn" : "";
};
const region = () => (cap.src === "live" ? cap.regionLive : cap.regionImg || { x: 0, y: 0, w: 1, h: 1 });
function grab() {
  if (cap.src !== "live" || !cap.video.videoWidth) return cap.src === "image";
  cap.frame.width = cap.video.videoWidth;
  cap.frame.height = cap.video.videoHeight;
  cap.frame.getContext("2d").drawImage(cap.video, 0, 0);
  return true;
}
function cropCanvas() {
  const r = region(),
    f = cap.frame,
    c = document.createElement("canvas");
  const x = Math.round(r.x * f.width),
    y = Math.round(r.y * f.height);
  c.width = Math.max(8, Math.round(r.w * f.width));
  c.height = Math.max(8, Math.round(r.h * f.height));
  c.getContext("2d", { willReadFrequently: true }).drawImage(f, x, y, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}
function drawPreview(drag) {
  const f = cap.frame;
  if (!cap.src || !f.width) return;
  $("pvBox").style.display = "block";
  const pv = $("pv"),
    maxW = $("pvBox").clientWidth || 1000,
    sc = Math.min(maxW / f.width, ($("capCard").classList.contains("wide") ? 760 : 520) / f.height, 1);
  const w = Math.round(f.width * sc),
    h = Math.round(f.height * sc);
  if (pv.width !== w || pv.height !== h) {
    pv.width = w;
    pv.height = h;
  }
  const x = pv.getContext("2d");
  x.drawImage(f, 0, 0, w, h);
  const r = drag || region();
  x.fillStyle = "rgba(0,0,0,.55)";
  x.fillRect(0, 0, w, r.y * h);
  x.fillRect(0, (r.y + r.h) * h, w, h);
  x.fillRect(0, r.y * h, r.x * w, r.h * h);
  x.fillRect((r.x + r.w) * w, r.y * h, w, r.h * h);
  x.strokeStyle = "#e8c26a";
  x.lineWidth = 2;
  x.strokeRect(r.x * w, r.y * h, r.w * w, r.h * h);
}
{
  const pv = $("pv");
  let d = null;
  const pos = (e) => {
    const b = pv.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    };
  };
  const rect = (a, b) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });
  pv.onpointerdown = (e) => {
    d = { a: pos(e) };
    pv.setPointerCapture(e.pointerId);
  };
  pv.onpointermove = (e) => {
    if (d) {
      d.b = pos(e);
      drawPreview(rect(d.a, d.b));
    }
  };
  pv.onpointerup = (e) => {
    if (!d) return;
    const r = d.b ? rect(d.a, d.b) : null;
    d = null;
    if (!r || r.w < 0.02 || r.h < 0.02) {
      drawPreview();
      return;
    }
    if (cap.src === "live") {
      cap.regionLive = r;
      store.set("region", r);
    } else cap.regionImg = r;
    drawPreview();
    scan();
  };
}
$("whole").onclick = (e) => {
  e.preventDefault();
  const r = { x: 0, y: 0, w: 1, h: 1 };
  if (cap.src === "live") {
    cap.regionLive = r;
    store.set("region", r);
  } else cap.regionImg = null;
  drawPreview();
  scan();
};

function signature() {
  const r = region(),
    live = cap.src === "live",
    f = live ? cap.video : cap.frame,
    fw = live ? f.videoWidth : f.width,
    fh = live ? f.videoHeight : f.height;
  const c = signature.c || (signature.c = document.createElement("canvas"));
  c.width = 40;
  c.height = 60;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(f, r.x * fw, r.y * fh, r.w * fw, r.h * fh, 0, 0, 40, 60);
  const d = x.getImageData(0, 0, 40, 60).data,
    s = new Uint8Array(2400);
  for (let i = 0; i < 2400; i++) s[i] = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  return s;
}
const sigDiff = (a, b) => {
  if (!a || !b) return 255;
  let t = 0;
  for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]);
  return t / a.length;
};
// looks at a thumbnail of the panel 5 times a second; reads it once it has changed and held still for one look
let tickN = 0;
function tick() {
  if (cap.src !== "live" || !cap.video.videoWidth) return;
  if (++tickN % 5 === 0 && !busy) {
    grab();
    drawPreview();
  }
  if (!S.auto || busy) return;
  const s = signature(),
    now = performance.now();
  if (sigDiff(s, cap.scannedSig) <= 0.6) cap.changedAt = 0;
  else {
    if (!cap.changedAt) cap.changedAt = now;
    // read once it holds still, or after 0.9 s of non-stop change so a long glow or fade cannot hold the read back
    if (sigDiff(s, cap.lastSig) < 0.6 || now - cap.changedAt > 900) {
      cap.scannedSig = s;
      cap.changedAt = 0;
      scan(true);
    }
  }
  cap.lastSig = s;
}
// a worker's timer keeps firing at full speed when this tab is hidden behind the game; a page timer drops to once a second
function startTicks() {
  stopTicks();
  try {
    cap.timer = new Worker(
      URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),200)"], { type: "text/javascript" })),
    );
    cap.timer.onmessage = tick;
  } catch (e) {
    cap.timer = {
      terminate() {
        clearInterval(this.id);
      },
      id: setInterval(tick, 200),
    };
  }
}
function stopTicks() {
  cap.timer?.terminate();
  cap.timer = null;
}

async function startShare() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    status(
      "This browser cannot capture the screen from this page. Paste a screenshot instead, or open the page in Chrome or Edge.",
      "warn",
    );
    return;
  }
  try {
    cap.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false });
  } catch (e) {
    status("Screen sharing was cancelled or blocked.", "warn");
    return;
  }
  cap.video.srcObject = cap.stream;
  await cap.video.play();
  cap.src = "live";
  cap.lastSig = cap.scannedSig = null;
  prevScan = rollBase = null; // a new share starts from its own first read, not from what was on screen last time
  cap.stream.getVideoTracks()[0].onended = stopShare;
  document.body.classList.add("sharing");
  $("liveT").textContent = "Sharing";
  $("stopShare").style.display = "";
  $("scanBtn").disabled = false;
  status("Sharing. Open the Genus Insight tab in game; drag a box around the lines if the blue box is not on them.");
  startTicks();
  setTimeout(() => {
    grab();
    drawPreview();
    if (!S.auto) scan();
  }, 400);
}
function stopShare() {
  stopTicks();
  cap.stream?.getTracks().forEach((t) => t.stop());
  cap.stream = null;
  if (cap.src === "live") cap.src = cap.frame.width ? "image" : null;
  $("stopShare").style.display = "none";
  document.body.classList.remove("sharing");
  $("liveT").textContent = "Not sharing";
  status("Stopped sharing.");
}
function loadImage(blobOrUrl) {
  return new Promise((res, rej) => {
    const img = new Image(),
      url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    img.onload = () => {
      if (cap.stream) stopShare();
      cap.frame.width = img.naturalWidth;
      cap.frame.height = img.naturalHeight;
      cap.frame.getContext("2d").drawImage(img, 0, 0);
      cap.src = "image";
      cap.regionImg = img.naturalWidth > img.naturalHeight * 1.5 ? { x: 0.765, y: 0.1, w: 0.225, h: 0.63 } : null; // full-screen shot: start on the panel
      $("scanBtn").disabled = false;
      drawPreview();
      res();
    };
    img.onerror = () => rej(new Error("Could not open that image"));
    img.src = url;
  });
}

async function getWorker() {
  if (worker) return worker;
  if (!window.Tesseract) {
    status("Loading the text reader (first time only, a few MB)…");
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = res;
      s.onerror = () =>
        rej(new Error("Could not load the text reader. It needs an internet connection the first time."));
      document.head.appendChild(s);
    });
  }
  worker = await Tesseract.createWorker("eng", 1);
  await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
  return worker;
}
// a second text reader that only knows digits
let digitWorker = null;
async function getDigitWorker() {
  if (digitWorker) return digitWorker;
  await getWorker();
  const w = await Tesseract.createWorker("eng", 1);
  await w.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "0123456789.%" });
  return (digitWorker = w);
}
// where the bright value text sits inside a row's value box
function inkBox(crop, box) {
  const x0 = Math.max(0, Math.round(box[0])),
    y0 = Math.max(0, Math.round(box[1])),
    w = Math.min(crop.width, Math.round(box[2])) - x0,
    h = Math.min(crop.height, Math.round(box[3])) - y0;
  if (w < 4 || h < 4) return null;
  const d = crop.getContext("2d", { willReadFrequently: true }).getImageData(x0, y0, w, h).data;
  let mx = 0;
  for (let i = 0; i < w * h; i++) mx = Math.max(mx, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  if (mx < 120) return null;
  let a = w,
    b = -1,
    c = h,
    e = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (Math.max(d[i], d[i + 1], d[i + 2]) > mx * 0.5) {
        if (x < a) a = x;
        if (x > b) b = x;
        if (y < c) c = y;
        if (y > e) e = y;
      }
    }
  return b < 0 ? null : { x: x0 + a - 2, y: y0 + c - 2, w: b - a + 5, h: e - c + 5, th: e - c + 1, mx };
}
// All values in one picture, one per band, each cut tight to its digits and scaled to the same height, read in a single pass.
// kind "text": the general reader on a soft greyscale picture. kind "digits": the digits-only reader on a hard black-and-white one.
// Each character is drawn with a fixed gap after it (READ[kind].spread x text height): the game font tucks some pairs
// together (the 1 under the arm of a 7 in "71"), which the text readers otherwise fail on.
const BAND = 96,
  TXT = 40,
  READ = { text: { spread: 0.45 }, digits: { spread: 0.45 } };
function inkRuns(crop, k) {
  // columns of the tight box that contain ink, as [start,end) runs = one per character
  const d = crop.getContext("2d", { willReadFrequently: true }).getImageData(k.x, k.y, k.w, k.h).data,
    runs = [];
  let a = -1;
  for (let x = 0; x <= k.w; x++) {
    let on = false;
    if (x < k.w)
      for (let y = 0; y < k.h; y++) {
        const i = (y * k.w + x) * 4;
        if (Math.max(d[i], d[i + 1], d[i + 2]) > k.mx * 0.5) {
          on = true;
          break;
        }
      }
    if (on && a < 0) a = x;
    else if (!on && a >= 0) {
      runs.push([a, x]);
      a = -1;
    }
  }
  return runs;
}
async function readStack(crop, inks, kind) {
  const opt = (window.genusOpt && window.genusOpt[kind]) || READ[kind],
    gap = Math.round(opt.spread * TXT),
    pad = 28;
  const plan = inks.map((k) => {
    if (!k) return null;
    const sc = TXT / k.th,
      runs = opt.spread > 0 ? inkRuns(crop, k) : [[0, k.w]];
    const parts = runs.map(([a, b]) => ({
      sx: k.x + Math.max(0, a - 1),
      sw: Math.min(k.w, b + 1) - Math.max(0, a - 1),
    }));
    let w = 0;
    for (const p of parts) w += p.sw * sc;
    w += gap * Math.max(0, parts.length - 1);
    return { k, sc, parts, w };
  });
  const wmax = Math.max(1, ...plan.map((p) => (p ? Math.ceil(p.w) : 0)));
  const c = document.createElement("canvas");
  c.width = wmax + 2 * pad;
  c.height = BAND * inks.length;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = "high";
  plan.forEach((p, i) => {
    if (!p) return;
    let dx = pad;
    const y = i * BAND + Math.round((BAND - p.k.h * p.sc) / 2);
    for (const q of p.parts) {
      x.drawImage(crop, q.sx, p.k.y, q.sw, p.k.h, dx, y, q.sw * p.sc, p.k.h * p.sc);
      dx += q.sw * p.sc + gap;
    }
  });
  const im = x.getImageData(0, 0, c.width, c.height),
    d = im.data,
    mx = Math.max(120, ...inks.map((k) => (k ? k.mx : 0)));
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    const v = kind === "digits" ? (m > mx * 0.45 ? 0 : 255) : 255 - Math.min(255, Math.max(0, (m - 70) * 1.9));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  x.putImageData(im, 0, 0);
  const out = inks.map(() => null);
  try {
    const { data } = await recognise(c, kind === "digits" ? "digits" : "main"),
      txt = inks.map(() => []);
    for (const wd of data.words || []) {
      const b = Math.floor((wd.bbox.y0 + wd.bbox.y1) / 2 / BAND);
      if (txt[b]) txt[b].push(wd);
    }
    txt.forEach((ws, i) => {
      if (ws.length) {
        const p = parseValue(
          ws
            .sort((a, b) => a.bbox.x0 - b.bbox.x0)
            .map((w) => w.text)
            .join(""),
        );
        out[i] = p ? p.v : null;
      }
    });
  } catch (e) {
    if (kind !== "digits") throw e;
  } // a failed digits pass just means that reader has no vote this time
  return out;
}
// one read, with a watchdog: if the reader stalls it is thrown away and rebuilt instead of blocking every later scan
async function recognise(canvas, which) {
  const dig = which === "digits",
    w = dig ? await getDigitWorker() : await getWorker();
  let to;
  try {
    return await Promise.race([
      w.recognize(canvas),
      new Promise((_, rej) => {
        to = setTimeout(() => rej(new Error("stalled")), 10000);
      }),
    ]);
  } catch (e) {
    try {
      await Promise.race([w.terminate(), new Promise((r) => setTimeout(r, 500))]);
    } catch (_) {}
    if (dig) digitWorker = null;
    else worker = null;
    throw new Error(
      e.message === "stalled"
        ? "The text reader stalled, so it was restarted. Trying again."
        : "The text reader failed (" + (e.message || e) + ") and was restarted. Trying again.",
    );
  } finally {
    clearTimeout(to);
  }
}
// Third reader, independent of the other two: cut the value into characters and compare each one's shape with
// the game's own digits (GLYPHS, learned from real screenshots). Returns null when it is not sure.
let GLYPHS = window.GENUS_GLYPHS || {};
const GW = 12,
  GH = 18;
// One character-sized piece of the value strip, columns [a,b): a decimal point, a shape to match, or nothing.
function glyphPiece(ctx, a, b) {
  const { g, w, h, t, src, dst } = ctx;
  let top = h,
    bot = -1;
  for (let y = 0; y < h; y++)
    for (let x = a; x < b; x++)
      if (g[y * w + x] > t) {
        if (y < top) top = y;
        if (y > bot) bot = y;
        break;
      }
  if (bot < 0) return null;
  const sw = b - a,
    sh = bot - top + 1;
  if (ctx.H && sh < 0.4 * ctx.H)
    return sw < 0.5 * ctx.H && Math.abs(bot - ctx.base) <= 0.2 * ctx.H ? { dot: true, a, b } : null; // a small mark on the baseline is the decimal point; anything else small is noise
  src.width = sw;
  src.height = sh;
  const sx = src.getContext("2d"),
    im = sx.createImageData(sw, sh);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const v = g[(top + y) * w + a + x],
        i = (y * sw + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
  sx.putImageData(im, 0, 0);
  const dx = dst.getContext("2d", { willReadFrequently: true });
  dx.imageSmoothingQuality = "high";
  dx.drawImage(src, 0, 0, GW, GH);
  const dd = dx.getImageData(0, 0, GW, GH).data,
    v = new Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) v[i] = dd[i * 4] / 255;
  return { v, aspect: sw / sh, a, b, sh };
}
// Cut the value strip into pieces wherever there is a column with no ink.
function segmentValue(crop, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.round(x0));
  y0 = Math.max(0, Math.round(y0));
  const w = Math.min(crop.width, Math.round(x1)) - x0,
    h = Math.min(crop.height, Math.round(y1)) - y0;
  if (w < 4 || h < 4) return [];
  const d = crop.getContext("2d", { willReadFrequently: true }).getImageData(x0, y0, w, h).data,
    g = new Uint8Array(w * h);
  let mx = 0;
  for (let i = 0; i < w * h; i++) {
    const m = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    g[i] = m;
    if (m > mx) mx = m;
  }
  if (mx < 120) return [];
  const t = mx * 0.5,
    ink = new Uint8Array(w);
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (g[y * w + x] > t) {
        ink[x] = 1;
        break;
      }
  const dst = document.createElement("canvas");
  dst.width = GW;
  dst.height = GH;
  const ctx = { g, w, h, t, src: document.createElement("canvas"), dst, H: 0, base: 0 };
  const runs = [];
  for (let x = 0; x < w; ) {
    if (!ink[x]) {
      x++;
      continue;
    }
    let b = x;
    while (b < w && ink[b]) b++;
    runs.push([x, b]);
    x = b;
  }
  const raw = runs.map(([a, b]) => {
    let top = h,
      bot = -1;
    for (let y = 0; y < h; y++)
      for (let x = a; x < b; x++)
        if (g[y * w + x] > t) {
          if (y < top) top = y;
          if (y > bot) bot = y;
          break;
        }
    return { top, bot };
  });
  if (!raw.length) return [];
  ctx.H = Math.max(...raw.map((s) => s.bot - s.top + 1));
  ctx.base = Math.max(...raw.filter((s) => s.bot - s.top + 1 > 0.7 * ctx.H).map((s) => s.bot));
  const out = runs.map(([a, b]) => glyphPiece(ctx, a, b)).filter(Boolean);
  out.ctx = ctx;
  return out;
}
function glyphRead(crop, x0, y0, x1, y1) {
  const keys = Object.keys(GLYPHS);
  if (!keys.length) return null;
  const segs = segmentValue(crop, x0, y0, x1, y1),
    ctx = segs.ctx;
  // best matching character for one piece, or null when the match is not clear
  const classify = (seg) => {
    if (seg.dot) return { s: ".", sc: 1 };
    const m = seg.v.reduce((a, b) => a + b, 0) / seg.v.length;
    let sd = 0;
    for (const x of seg.v) sd += (x - m) * (x - m);
    sd = Math.sqrt(sd) || 1;
    let best = null,
      bs = -9,
      second = -9;
    for (const k of keys) {
      let ck = -9; // a character may have several learned shapes (one per screen resolution): its score is the best of them
      for (const G of [].concat(GLYPHS[k])) {
        let c = 0;
        for (let i = 0; i < seg.v.length; i++) c += (seg.v[i] - m) * (G.v[i] - G.m);
        c = c / (sd * G.sd) - 0.5 * Math.abs(Math.log(seg.aspect / G.a));
        if (c > ck) ck = c;
      }
      if (ck > bs) {
        second = bs;
        bs = ck;
        best = k;
      } else if (ck > second) second = ck;
    }
    return bs < 0.6 || bs - second < 0.06 ? null : { s: best, sc: bs };
  };
  // At small text sizes neighbouring digits can touch and arrive as one wide piece. Try every place a wide piece could be
  // cut (one character on the left, the rest on the right, which may be cut again) and keep the cut whose weakest
  // character matches best, if that is clearly better than the piece read whole.
  const solve = (seg, depth) => {
    let best = classify(seg);
    if (depth < 3 && !seg.dot && seg.aspect > 0.8) {
      let cutBest = null;
      for (let cut = seg.a + 2; cut <= seg.b - 1; cut++) {
        const L = glyphPiece(ctx, seg.a, cut),
          R = glyphPiece(ctx, cut, seg.b);
        if (!L || !R) continue;
        const l = classify(L);
        if (!l) continue;
        const r = solve(R, depth + 1);
        if (!r) continue;
        const sc = Math.min(l.sc, r.sc);
        if (!cutBest || sc > cutBest.sc) cutBest = { s: l.s + r.s, sc };
      }
      if (cutBest && (!best || cutBest.sc > best.sc + 0.05)) best = cutBest;
    }
    return best;
  };
  let s = "";
  for (const seg of segs) {
    const r = solve(seg, 0);
    if (!r) return null;
    s += r.s;
  } // any unclear piece: abstain rather than guess
  const v = parseFloat(s.replace(/%/g, ""));
  return s && /^\d+(\.\d+)?%?$/.test(s) && !isNaN(v) ? v : null;
}
// bright coloured text on dark -> dark text on white, enlarged
function prep(src, scale) {
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  const im = x.getImageData(0, 0, c.width, c.height),
    d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    const v = 255 - Math.min(255, Math.max(0, (m - 70) * 1.9));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  x.putImageData(im, 0, 0);
  return c;
}
const PANEL_SCALE = 2; // enlargement for the pass that finds the rows and reads the stat names
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
function lev(a, b) {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}
function matchStat(toks, vocab) {
  // toks: words left of the value; tolerates a junk word from the lock icon
  let best = null,
    lead = 0;
  while (lead < toks.length - 1 && !norm(toks[lead].text)) lead++; // leading words with no letters at all are never part of a name
  for (let skip = lead; skip <= Math.min(lead + 2, toks.length - 1); skip++) {
    const t = norm(
      toks
        .slice(skip)
        .map((w) => w.text)
        .join(""),
    );
    if (t.length < 2) continue;
    for (const v of vocab) {
      const sim = 1 - lev(t, v.n) / Math.max(t.length, v.n.length),
        need = v.n.length <= 3 ? 0.99 : 0.74;
      if (sim >= need && (!best || sim > best.sim + 1e-9)) best = { stat: v.name, sim, skip };
    }
  }
  return best;
}
function parseValue(txt) {
  let t = txt
    .replace(/[oO]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/,/g, ".")
    .replace(/[^0-9.%]/g, "");
  const pct = t.includes("%");
  t = t.replace(/%/g, "").replace(/^\.+|\.+$/g, "");
  const v = parseFloat(t);
  return isNaN(v) ? null : { v, pct };
}
function hsv(r, g, b) {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let h = 0;
  if (d) {
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}
function gradeFromColour(h, s) {
  if (s < 0.22) return "Common";
  if (h < 34 || h > 340) return "Heroic";
  if (h < 70) return "Unique";
  if (h < 175) return "Rare";
  return "Epic";
}

function clusterRows(words) {
  if (!words.length) return { rows: [], H: 0 };
  const hs = words.map((x) => x.y1 - x.y0).sort((a, b) => a - b),
    H = hs[hs.length >> 1];
  words.sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const rows = [];
  for (const x of words) {
    const yc = (x.y0 + x.y1) / 2,
      r = rows[rows.length - 1];
    if (r && Math.abs(yc - r.yc) < 0.7 * H) {
      r.w.push(x);
      r.yc = (r.yc * (r.w.length - 1) + yc) / r.w.length;
    } else rows.push({ yc, w: [x] });
  }
  for (const r of rows) r.w.sort((a, b) => a.x0 - b.x0);
  return { rows, H };
}
// The slow way: read the whole area to find the rows. Needed the first time, and whenever the layout cannot be trusted.
async function fullPass(crop) {
  const scale = window.genusScale || (crop.height * PANEL_SCALE > 2600 ? Math.max(1, 2600 / crop.height) : PANEL_SCALE);
  const { data } = await recognise(prep(crop, scale));
  return clusterRows(
    (data.words || [])
      .filter((x) => x.text.trim())
      .map((x) => ({
        text: x.text.trim(),
        x0: x.bbox.x0 / scale,
        x1: x.bbox.x1 / scale,
        y0: x.bbox.y0 / scale,
        y1: x.bbox.y1 / scale,
      })),
  );
}
// The quick way: the list does not move, so once its layout is known only the title and the nine name strips are cut out,
// stacked into one small picture and read. Anything unexpected (title gone, a name that will not match) falls back to the slow way.
let geom = null;
const geomKey = (crop) => cap.src + "|" + JSON.stringify(region()) + "|" + crop.width + "x" + crop.height;
const NAME = 30,
  NB = 72;
async function namePass(crop, G) {
  const bands = [G.title, ...G.rows],
    pad = 20,
    sc = bands.map((b) => NAME / b.th),
    wmax = Math.max(...bands.map((b, i) => Math.ceil((b.x1 - b.x0) * sc[i])));
  const c = document.createElement("canvas");
  c.width = wmax + 2 * pad;
  c.height = NB * bands.length;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = "high";
  bands.forEach((b, i) => {
    const h = 1.9 * b.th;
    x.drawImage(
      crop,
      b.x0,
      b.yc - h / 2,
      b.x1 - b.x0,
      h,
      pad,
      i * NB + (NB - h * sc[i]) / 2,
      (b.x1 - b.x0) * sc[i],
      h * sc[i],
    );
  });
  const im = x.getImageData(0, 0, c.width, c.height),
    d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    const v = 255 - Math.min(255, Math.max(0, (m - 70) * 1.9));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  x.putImageData(im, 0, 0);
  const { data } = await recognise(c),
    rows = bands.map((b) => ({ yc: b.yc, w: [] }));
  for (const wd of data.words || []) {
    const txt = wd.text.trim();
    if (!txt) continue;
    const i = Math.floor((wd.bbox.y0 + wd.bbox.y1) / 2 / NB),
      b = bands[i];
    if (!b) continue;
    const mid = i * NB + NB / 2;
    rows[i].w.push({
      text: txt,
      x0: b.x0 + (wd.bbox.x0 - pad) / sc[i],
      x1: b.x0 + (wd.bbox.x1 - pad) / sc[i],
      y0: b.yc + (wd.bbox.y0 - mid) / sc[i],
      y1: b.yc + (wd.bbox.y1 - mid) / sc[i],
    });
  }
  for (const r of rows) r.w.sort((a, b) => a.x0 - b.x0);
  return rows;
}
// Turn rows of words into lines: stat name, lock state, grade colour, and the value by three independent readers.
// G = the remembered layout when the rows came from the quick pass (row 0 is the title, row k is slot k).
async function interpret(crop, rows, H, G) {
  let genus = null,
    level = null,
    title = null;
  for (const r of rows) {
    const t = r.w.map((x) => x.text).join(" ");
    const g = t.match(/(cogni|fera|natura|varian|special)\s*insight/i);
    if (g) {
      genus = GENERA.find((n) => n.toLowerCase() === g[1].toLowerCase()) || genus;
      if (r.w.length) title = { yc: r.yc, th: Math.max(...r.w.map((x) => x.y1 - x.y0)) };
    }
    const l = t.match(/Lv\.?\s*(\d{1,2})/i);
    if (l && +l[1] >= 1 && +l[1] <= 10) level = +l[1];
  }
  const names = (g) => [...new Set(OPTIONS[g].slots.flatMap((s) => s.options.map((o) => o.stat)))];
  const vocab = [...new Set(genus ? names(genus) : GENERA.flatMap(names))].map((name) => ({ name, n: norm(name) }));
  const px = crop.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, crop.width, crop.height),
    P = px.data,
    W = crop.width,
    HH = crop.height;
  const out = [];
  rows.forEach((r, ri) => {
    if (G && ri === 0) return;
    // split name | value at the widest gap
    let gi = -1,
      gap = 0;
    for (let i = 1; i < r.w.length; i++) {
      const g = r.w[i].x0 - r.w[i - 1].x1;
      if (g > gap) {
        gap = g;
        gi = i;
      }
    }
    let left = r.w,
      right = [];
    if (gi > 0 && gap > 2.5 * H) {
      left = r.w.slice(0, gi);
      right = r.w.slice(gi);
    } else if (r.w.length > 1 && /\d/.test(r.w[r.w.length - 1].text) && !/[a-z]{2}/i.test(r.w[r.w.length - 1].text)) {
      left = r.w.slice(0, -1);
      right = r.w.slice(-1);
    }
    const m = left.length ? matchStat(left, vocab) : null;
    if (!m) return;
    const nm = left.slice(m.skip),
      nx0 = nm[0].x0,
      nx1 = nm[nm.length - 1].x1,
      th = G ? G.rows[ri - 1].th : Math.max(...nm.map((x) => x.y1 - x.y0)),
      yc = G ? G.rows[ri - 1].yc : r.yc;
    const odd = right.filter((x) => /\d/.test(x.text)).length >= 2 || right.some((x) => /none/i.test(x.text)); // two numbers or a "None" = some other screen
    out.push({
      slot: G ? ri : undefined,
      th,
      nx0,
      nx1,
      rx1: right.length ? right[right.length - 1].x1 : null,
      odd,
      yc,
      stat: m.stat,
      sim: m.sim,
      value: null,
    });
  });
  if (!genus) {
    const own = out.map((o) => o.stat.match(/^(Cogni|Fera|Natura|Varian) /)).find(Boolean);
    if (own) genus = own[1];
  }
  if (!G) {
    // slot number from the even row spacing, so a missed row leaves a gap instead of shifting the rest
    if (out.length > 1) {
      const gaps = [];
      for (let i = 1; i < out.length; i++) gaps.push(out[i].yc - out[i - 1].yc);
      gaps.sort((a, b) => a - b);
      const pitch = gaps[0] > 0 ? gaps[Math.min(gaps.length - 1, gaps.length >> 1)] : 1;
      const unit = Math.min(pitch, ...gaps.filter((g) => g > pitch * 0.6));
      out.forEach((o) => (o.slot = Math.round((o.yc - out[0].yc) / unit) + 1));
    } else if (out.length) out[0].slot = 1;
  }
  if (out.length) {
    // names are left-aligned: the column is where most rows start (the right-most start that at least two rows share).
    // A row that starts further left had something in front of its name (the lock icon read as a letter), so it is pulled in.
    const xs = out.map((o) => o.nx0).sort((a, b) => b - a),
      tol = 0.5 * Math.max(4, H || out[0].th);
    const col = G ? G.nameX : (xs.find((x, i) => xs.filter((y) => Math.abs(y - x) <= tol).length >= 2) ?? xs[0]);
    const pitch = G
      ? G.pitch
      : out.length > 1 && out[out.length - 1].slot > out[0].slot
        ? (out[out.length - 1].yc - out[0].yc) / (out[out.length - 1].slot - out[0].slot)
        : 3.5 * out[0].th;
    const lum = (i) => 0.3 * P[i] + 0.59 * P[i + 1] + 0.11 * P[i + 2];
    for (const o of out) {
      if (o.nx0 < col - tol) o.nx0 = col;
      // lock icon: a bright cream padlock when locked, a dim one when not. Take the 90th-percentile brightness of the icon cell.
      const x0 = Math.max(0, Math.round(col - 0.75 * pitch)),
        x1 = Math.max(1, Math.round(col - 0.1 * pitch)),
        y0 = Math.max(0, Math.round(o.yc - 0.36 * pitch)),
        y1 = Math.min(HH, Math.round(o.yc + 0.36 * pitch)),
        v = [];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) v.push(lum((y * W + x) * 4));
      v.sort((a, b) => a - b);
      o.lockLum = v.length ? v[Math.floor(v.length * 0.9)] : 0;
      o.locked = o.lockLum > 130;
      // text colour -> grade
      let R = 0,
        Gn = 0,
        B = 0,
        c = 0;
      for (let y = Math.max(0, Math.round(o.yc - 0.6 * o.th)); y < Math.min(HH, Math.round(o.yc + 0.6 * o.th)); y++)
        for (let x = Math.max(0, Math.round(o.nx0)); x < Math.min(W, Math.round(o.nx1)); x++) {
          const i = (y * W + x) * 4;
          if (Math.max(P[i], P[i + 1], P[i + 2]) > 140) {
            R += P[i];
            Gn += P[i + 1];
            B += P[i + 2];
            c++;
          }
        }
      const hc = c ? hsv(R / c, Gn / c, B / c) : { h: 0, s: 0 };
      o.hue = hc.h;
      o.sat = hc.s;
      o.grade = gradeFromColour(hc.h, hc.s);
    }
    out.col = col;
    out.pitch = pitch;
  }
  // values are right-aligned, so each one sits in a strip ending at the common right edge
  const edge = G ? G.edge : Math.max(-1, ...out.filter((o) => o.rx1 != null).map((o) => o.rx1));
  if (edge > 0 && out.filter((o) => o.odd).length < 3 && out.length <= 9) {
    const board = OPTIONS[genus || S.genus];
    for (const o of out)
      o.box = [
        Math.max(o.nx1 + 0.6 * o.th, edge - 7 * o.th),
        Math.max(0, o.yc - 0.95 * o.th),
        Math.min(W, edge + 0.6 * o.th),
        Math.min(HH, o.yc + 0.95 * o.th),
      ];
    const inks = out.map((o) => inkBox(crop, o.box));
    // three independent readings of every value: general text reader, digits-only text reader (both on tight cut-outs, run side by side), digit shapes
    const [A, Bv] = await Promise.all([readStack(crop, inks, "text"), readStack(crop, inks, "digits")]);
    out.forEach((o, i) => {
      const opts = (board.slots[o.slot - 1]?.options || []).filter((p) => p.stat === o.stat),
        ok = (v) => v != null && opts.some((p) => v >= num(p.min) - 1e-9 && v <= num(p.max) + 1e-9);
      const fix = (v) => (v == null || ok(v) || !ok(v / 10) ? v : v / 10); // a lost decimal point
      const R = [fix(A[i]), fix(Bv[i]), fix(glyphRead(crop, ...o.box))];
      o.readers = R;
      const votes = (v) => R.filter((x) => x != null && Math.abs(x - v) < 1e-9).length,
        valid = R.filter(ok);
      const top = valid.slice().sort((x, y) => votes(y) - votes(x))[0];
      if (top !== undefined && votes(top) === 3) {
        o.value = top;
        o.agree = 3;
      } else if (top !== undefined && votes(top) === 2) {
        o.value = top;
        o.agree = 2;
      } else {
        o.value = top !== undefined ? top : (R[1] ?? R[0] ?? R[2]);
        o.agree = 1;
      } // no two readers agree on a possible value
    });
  }
  return { rows: out, genus, level, edge, title, H, col: out.col, pitch: out.pitch };
}
async function readPanel(crop) {
  const t0 = performance.now(),
    key = geomKey(crop);
  if (geom && geom.key === key && !window.genusNoFast) {
    try {
      const r = await interpret(crop, await namePass(crop, geom), geom.H, geom);
      // only trusted when the title is there and every remembered row gave a stat name
      if (r.genus && r.level && r.rows.length === geom.rows.length && Math.min(9, r.level) === geom.rows.length) {
        r.mode = "quick";
        window.genusTiming = { mode: "quick", ms: Math.round(performance.now() - t0) };
        return r;
      }
    } catch (e) {}
    geom = null;
  }
  const { rows, H } = await fullPass(crop);
  if (!rows.length) return { rows: [], genus: null, level: null };
  const r = await interpret(crop, rows, H, null);
  r.mode = "full";
  // remember the layout when this was a clean, complete read of the list
  if (
    r.genus &&
    r.level &&
    r.title &&
    r.edge > 0 &&
    r.rows.length === Math.min(9, r.level) &&
    r.rows.every((o, i) => o.slot === i + 1) &&
    !r.rows.some((o) => o.odd)
  ) {
    const ths = r.rows.map((o) => o.th).sort((a, b) => a - b),
      th = ths[ths.length >> 1],
      nameX = r.col;
    geom = {
      key,
      H,
      edge: r.edge,
      nameX,
      pitch: r.pitch,
      title: { x0: 0, x1: crop.width, yc: r.title.yc, th: r.title.th },
      rows: r.rows.map((o) => ({
        yc: o.yc,
        th,
        x0: Math.max(0, nameX - 0.4 * th),
        x1: Math.min(crop.width, Math.max(nameX + 4 * th, r.edge - 5 * th)),
      })),
    };
  }
  window.genusTiming = { mode: "full", ms: Math.round(performance.now() - t0) };
  return r;
}
function applyScan(r, live) {
  if (!r.rows.length) {
    status(
      "No Genus lines found in that area. If the Genus Insight list is on screen, drag a box around the stat names and values.",
      "warn",
    );
    return;
  }
  // another screen with stat names on it (the Auto Analysis target list, a tooltip): leave the last good read alone
  if (r.rows.length > 9 || Math.max(...r.rows.map((o) => o.slot)) > 9 || r.rows.filter((o) => o.odd).length >= 3) {
    status(
      "That is not the Genus Insight list, so the last read is kept. It will read again when the list is back.",
      "warn",
    );
    return;
  }
  // slot N opens at Insight level N (9 slots); level 9 and 10 both show 9 lines, so trust the "Lv." text, else keep the current choice
  const genus = r.genus || S.genus,
    top = Math.min(9, Math.max(...r.rows.map((o) => o.slot)));
  const level = r.level ? Math.max(r.level, top) : top >= 9 ? Math.max(9, S.level) : top,
    nSlots = Math.min(9, level);
  const lines = Array.from({ length: nSlots }, () => ({ stat: "", value: null, locked: false }));
  for (const o of r.rows) {
    if (o.slot < 1 || o.slot > nSlots) continue;
    lines[o.slot - 1] = {
      stat: o.stat,
      value: o.value,
      locked: o.locked,
      grade: o.grade,
      agree: o.agree,
      readers: o.readers,
      rk: (o.readers || []).join("/"),
    };
  }
  // a value you typed in stays while the readers keep seeing exactly the same thing on that line
  if (genus === S.genus)
    lines.forEach((l, i) => {
      const p = S.lines[i];
      if (p && p.manual && p.stat === l.stat && p.rk === l.rk) {
        l.value = p.value;
        l.agree = 3;
        l.manual = true;
      }
    });
  const old = { genus: S.genus, level: S.level, lines: S.lines };
  S.genus = genus;
  S.level = level;
  S.lines = lines;
  try {
    render();
  } catch (e) {
    Object.assign(S, old);
    try {
      render();
    } catch (_) {}
    throw new Error("Could not use that read (" + (e.message || e) + "); the last one is kept.");
  }
  const miss = lines.filter((l) => !l.stat || l.value == null).length;
  // count a roll: same board, same locks, every locked line untouched, and at least one unlocked line different.
  // Reads within 1.5 s of a counted roll belong to the same roll (the game is still showing the new lines).
  // A value only counts as changed when the readers agreed on it both times, so a doubtful read that flips is not a roll.
  // A read that lands back exactly on the lines from before the last counted roll means that roll was a misread
  // (a fade, a tooltip over the list): it is taken off again.
  let rolled = "";
  if (live && !miss && prevScan && prevScan.genus === genus && prevScan.lines.length === lines.length) {
    const same = (a, b) => a.stat === b.stat && a.value === b.value,
      sure = (a) => (a.agree ?? 3) >= 2,
      changed = (a, b) => a.stat !== b.stat || (a.value !== b.value && sure(a) && sure(b)),
      P = prevScan.lines;
    if (
      rollBase &&
      rollBase.genus === genus &&
      rollBase.lines.length === lines.length &&
      rollBase.lines.every((p, i) => p.locked === lines[i].locked && same(p, lines[i]))
    ) {
      undoRoll(genus);
      rollBase = null;
      rolled = " The last counted roll was a misread, so it has been taken off.";
      render();
    } else if (
      P.every((p, i) => p.locked === lines[i].locked && (!p.locked || same(p, lines[i]))) &&
      P.some((p, i) => !p.locked && changed(p, lines[i])) &&
      performance.now() - lastRollAt > 1500
    ) {
      const L = P.filter((p) => p.locked).length,
        rec = addRoll(genus, L, P.length);
      lastRollAt = performance.now();
      rollBase = prevScan;
      rolled = ` Roll ${rec.n} counted (${L} locked, ${rollCost(L, P.length)} Soul Crystals).`;
      render();
    }
  }
  if (!miss)
    prevScan = {
      genus,
      lines: lines.map((l) => ({ stat: l.stat, value: l.value, locked: l.locked, agree: l.agree })),
    };
  status(
    `Read ${lines.length - miss} of ${lines.length} lines on the ${genus} board${r.genus ? "" : " (board not seen in the picture, so the selected one is used)"}.${miss ? " Fill in the missing ones by hand." : ""}${rolled}`,
    miss ? "warn" : "mute",
  );
}
// Look over the whole picture for the "<Board> Insight" title and put the box on the list under it.
// Sizes are taken from the width of the word "Insight", so it works at any resolution or window size.
let lastLocate = -1e9;
async function autoLocate() {
  const f = cap.frame;
  if (!f.width) return false;
  const sc = Math.min(1.25, Math.max(0.5, 2200 / f.width)),
    { data } = await recognise(prep(f, sc));
  const ws = (data.words || []).map((w) => ({
    t: w.text.trim(),
    x0: w.bbox.x0 / sc,
    x1: w.bbox.x1 / sc,
    y0: w.bbox.y0 / sc,
    y1: w.bbox.y1 / sc,
  }));
  let hit = null;
  for (const w of ws) {
    if (!/^insight/i.test(w.t)) continue;
    const g = ws.find(
      (o) =>
        /^(cogni|fera|natura|varian|special)$/i.test(o.t) &&
        o.x1 <= w.x0 + 4 &&
        w.x0 - o.x1 < w.x1 - w.x0 &&
        Math.abs(o.y0 + o.y1 - (w.y0 + w.y1)) < w.y1 - w.y0,
    );
    if (g) {
      hit = { x0: g.x0, y0: Math.min(g.y0, w.y0), u: w.x1 - w.x0 };
      break;
    }
  }
  if (!hit) return false;
  const u = hit.u,
    x0 = Math.max(0, hit.x0 - 0.2 * u),
    y0 = Math.max(0, hit.y0 - 1.7 * u),
    x1 = Math.min(f.width, hit.x0 + 6.6 * u),
    y1 = Math.min(f.height, hit.y0 + 8.5 * u);
  const r = { x: x0 / f.width, y: y0 / f.height, w: (x1 - x0) / f.width, h: (y1 - y0) / f.height };
  if (cap.src === "live") {
    cap.regionLive = r;
    store.set("region", r);
  } else cap.regionImg = r;
  geom = null;
  drawPreview();
  return true;
}
async function findList() {
  // the "Find the list" button
  if (busy || !cap.src) return;
  busy = true;
  try {
    grab();
    status("Looking for the Genus list…");
    const ok = await autoLocate();
    lastLocate = performance.now();
    if (!ok) {
      status(
        "Could not see a Genus Insight list in the picture. Open the Genus Insight tab, or drag a box around the list.",
        "warn",
      );
      return;
    }
  } catch (e) {
    status(e.message || String(e), "warn");
    return;
  } finally {
    busy = false;
  }
  scan();
}
async function scan(live) {
  if (busy) {
    pending = true;
    return;
  }
  if (!cap.src) return;
  busy = true;
  try {
    if (!grab()) return;
    const crop = cropCanvas(),
      t0 = performance.now();
    if (!worker) status("Loading the text reader (first time only)…");
    else status("Reading…");
    let r = await readPanel(crop);
    // nothing readable where the box is: look for the list once (at most every 5 s) and read it there
    if ((!r.rows.length || (!r.genus && r.rows.length < 4)) && performance.now() - lastLocate > 5000) {
      lastLocate = performance.now();
      status("Looking for the Genus list…");
      if (await autoLocate()) r = await readPanel(cropCanvas());
    }
    applyScan(r, cap.src === "live");
    if (r.rows.length) $("status").textContent += ` Read took ${((performance.now() - t0) / 1000).toFixed(1)} s.`;
    if (cap.src === "live") drawPreview();
  } catch (e) {
    status(e.message || String(e), "warn");
    cap.scannedSig = null;
  } finally {
    // forget the thumbnail so the next look tries again
    busy = false;
    if (pending) {
      pending = false;
      scan(live);
    }
  }
}
// used by automated checks: read an image URL and return what was seen
window.genusRead = async (url) => {
  await loadImage(url);
  cap.regionImg = cap.regionImg && window.genusRegion !== false ? cap.regionImg : null;
  const r = await readPanel(cropCanvas());
  applyScan(r, false);
  return r;
};

window.genusGlyphs = async (url) => {
  await loadImage(url);
  geom = null;
  const crop = cropCanvas(),
    r = await readPanel(crop);
  applyScan(r, false);
  return r.rows.map((o) => ({ slot: o.slot, segs: o.box ? segmentValue(crop, ...o.box) : [] }));
};

/* ---------- wiring ---------- */
$("clientP").textContent = "Game client " + window.GENUS_CLIENT;
$("level").innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">Lv${i + 1}</option>`).join("");
$("level").onchange = (e) => {
  S.level = +e.target.value;
  render();
};
for (const k of ["s4a", "s4b", "s4c", "pre", "near", "minRoll"]) {
  $(k).value = S[k];
  $(k).onchange = (e) => {
    S[k] = Math.min(100, Math.max(0, +e.target.value || 0));
    e.target.value = S[k];
    render();
  };
}
$("minGrade").value = S.minGrade;
$("minGrade").onchange = (e) => {
  S.minGrade = e.target.value;
  render();
};
$("auto").checked = S.auto;
$("auto").onchange = (e) => {
  S.auto = e.target.checked;
  save();
};
$("rollMinus").onclick = () => {
  undoRoll(S.genus);
  rollBase = null;
  render();
};
$("rollPlus").onclick = () => {
  addRoll(S.genus, S.lines.filter((l) => l.locked).length, openSlots().length);
  render();
};
$("rollReset").onclick = () => {
  delete S.rolls[S.genus];
  render();
};
$("rollResetAll").onclick = () => {
  S.rolls = {};
  render();
};
$("findBtn").onclick = findList;
$("pvBig").onclick = () => {
  const w = $("capCard").classList.toggle("wide");
  $("capCard").parentElement.style.display = w ? "contents" : "";
  $("pvBig").textContent = w ? "Shrink" : "Enlarge";
  drawPreview();
};
$("statsBox").open = store.get("statsOpen", true);
$("statsBox").ontoggle = () => store.set("statsOpen", $("statsBox").open);
$("clearPri").onclick = () => {
  S.want = {};
  S.cls = null;
  render();
};
$("share").onclick = startShare;
$("stopShare").onclick = stopShare;
$("scanBtn").onclick = () => scan();
$("pick").onclick = () => $("file").click();
const takeImage = (f) =>
  loadImage(f)
    .then(() => scan())
    .catch((e) => status(e.message, "warn"));
$("file").onchange = (e) => {
  if (e.target.files[0]) takeImage(e.target.files[0]);
  e.target.value = "";
};
addEventListener("paste", (e) => {
  const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (it) {
    e.preventDefault();
    takeImage(it.getAsFile());
  }
});
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => {
  e.preventDefault();
  const f = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/"));
  if (f) takeImage(f);
});
addEventListener("resize", () => drawPreview());
render();
