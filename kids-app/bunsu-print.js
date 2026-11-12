"use strict";

const modes = {
  unit: {
    title: "単位分数がいくつ分？",
    directions: "右の単位分数が何こ分か、□に数を書きましょう。",
    tag: "単位分数の何こ分",
    marking: "何こ分かを整数で書きます。"
  },
  kind: {
    title: "真分数・仮分数の見分け",
    directions: "「真分数」か「仮分数」かを、□に書きましょう。",
    tag: "真分数か仮分数か",
    marking: "「しんぶんすう」「かぶんすう」とひらがなで書いても正解です。"
  },
  toMixed: {
    title: "仮分数を帯分数・整数に",
    directions: "仮分数を帯分数か整数に直しましょう。",
    tag: "帯分数・整数に直す",
    marking: "帯分数は整数部分と分数部分を答えます。整数になるときは整数だけで正解です。"
  },
  toImproper: {
    title: "帯分数を仮分数に",
    directions: "帯分数を仮分数に直しましょう。",
    tag: "仮分数に直す",
    marking: "仮分数の形で、もとの分母と変換した分子を書きます。"
  },
  mix: {
    title: "分数のまとめ",
    directions: "問題ごとの指示を読んで、□に答えを書きましょう。",
    marking: "真分数・仮分数はひらがなでも正解です。整数になるときは整数だけを書きます。"
  }
};

const levels = {
  easy: { maxDenominator: 6, maxWhole: 2, reducedOnly: true, description: "分母2〜6。整数部分は2まで。" },
  normal: { maxDenominator: 9, maxWhole: 3, reducedOnly: true, description: "分母2〜9。整数部分は3まで。" },
  challenge: { maxDenominator: 12, maxWhole: 4, reducedOnly: false, description: "分母2〜12。整数部分は4まで。分母はそのまま使います。" }
};

const counts = [8, 12, 16];
const types = ["unit", "kind", "toMixed", "toImproper"];
const sameDenominator = "分数を書くときは、もとの分母のまま書きましょう。";
const wholeOnly = "整数になるときは、左の□だけに書きましょう。";

function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function fractionPools(level) {
  const pools = { proper: [], equal: [], whole: [], mixed: [] };
  for (let denominator = 2; denominator <= level.maxDenominator; denominator++) {
    const last = denominator * (level.maxWhole + 1) - 1;
    for (let numerator = 1; numerator <= last; numerator++) {
      const divisor = gcd(numerator, denominator);
      const whole = Math.floor(numerator / denominator);
      const remainder = numerator % denominator;
      if (level.reducedOnly && remainder && divisor !== 1) continue;
      const bucket = whole === 0 ? "proper" : remainder ? "mixed" : whole === 1 ? "equal" : "whole";
      pools[bucket].push({
        numerator, denominator, whole, remainder,
        key: numerator + "/" + denominator,
        valueKey: numerator / divisor + "/" + denominator / divisor
      });
    }
  }
  return pools;
}

function makeRequests(mode, count, pools) {
  const selectedTypes = mode === "mix" ? types : [mode];
  const amount = count / selectedTypes.length;
  const improper = [...pools.equal, ...pools.whole, ...pools.mixed];
  const integers = [...pools.equal, ...pools.whole];
  const requests = [];
  const properCount = Math.ceil(amount / 2);
  const improperCount = amount - properCount;
  for (const type of selectedTypes) {
    const add = (pool, quantity) => requests.push(...Array.from({ length: quantity }, () => ({ type, pool })));
    switch (type) {
      case "unit":
        add(pools.proper, properCount);
        add(improper, improperCount);
        break;
      case "kind":
        add(pools.proper, properCount);
        add(pools.equal, 1);
        add([...pools.whole, ...pools.mixed], improperCount - 1);
        break;
      case "toMixed": {
        const integerCount = Math.max(1, Math.round(amount / 4));
        add(integers, integerCount);
        add(pools.mixed, amount - integerCount);
        break;
      }
      case "toImproper":
        add(pools.mixed, amount);
        break;
    }
  }
  return requests.sort((a, b) => a.pool.length - b.pool.length);
}

function difficulty(problem) {
  return problem.whole * 30 + problem.denominator * 2 + problem.remainder;
}

function makeProblems({ mode, count, level, order }, random = Math.random) {
  if (!Object.hasOwn(modes, mode) || !counts.includes(count) ||
      !Object.hasOwn(levels, level) || !["grouped", "random"].includes(order)) {
    throw new RangeError("プリントの設定を確認してください。");
  }

  const requests = makeRequests(mode, count, fractionPools(levels[level]));
  const used = new Set();
  const denominators = new Map();
  const numerators = new Map();
  const values = new Map();
  const selected = [];

  for (const { type, pool } of requests) {
    const score = item =>
      (denominators.get(item.denominator) || 0) * 5 +
      (numerators.get(item.numerator) || 0) * 2 +
      (values.get(item.valueKey) || 0) * 3;
    const candidates = shuffle(pool, random).filter(item => !used.has(item.key));
    const item = candidates.reduce((best, next) => !best || score(next) < score(best) ? next : best, null);
    // Scarcer pools are filled first. Even at the smallest level every supported sheet has enough distinct candidates.
    if (!item) throw new Error("指定した問題数を作れませんでした。");
    used.add(item.key);
    denominators.set(item.denominator, (denominators.get(item.denominator) || 0) + 1);
    numerators.set(item.numerator, (numerators.get(item.numerator) || 0) + 1);
    values.set(item.valueKey, (values.get(item.valueKey) || 0) + 1);
    selected.push({ ...item, type });
  }

  if (order === "random") return shuffle(selected, random);
  return selected.sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type) || difficulty(a) - difficulty(b));
}

function answerFor({ type, numerator, denominator }) {
  switch (type) {
    case "unit": return { form: "number", value: numerator };
    case "kind": return { form: "word", value: numerator < denominator ? "真分数" : "仮分数" };
    case "toMixed": {
      const whole = Math.floor(numerator / denominator);
      const remainder = numerator % denominator;
      return remainder ? { form: "mixed", whole, numerator: remainder, denominator } : { form: "number", value: whole };
    }
    case "toImproper": return { form: "fraction", numerator, denominator };
  }
}

function fraction(numerator, denominator) {
  return '<span class="frac" aria-label="' + denominator + '分の' + numerator + '">' +
    '<span>' + numerator + '</span><span>' + denominator + '</span></span>';
}

function mixed(whole, numerator, denominator) {
  return '<span class="mixed"><span>' + whole + '</span>' + fraction(numerator, denominator) + '</span>';
}

function renderAnswer(answer) {
  if (answer.form === "mixed") return mixed(answer.whole, answer.numerator, answer.denominator);
  if (answer.form === "fraction") return fraction(answer.numerator, answer.denominator);
  return String(answer.value);
}

const answerStack = '<span class="answer-stack" aria-label="上に分子、下に分母"><span></span><span></span></span>';
const answerNumber = '<span class="answer-box" aria-label="数を書く欄"></span>';
const answerBlanks = {
  unit: answerNumber,
  kind: '<span class="answer-box answer-word" aria-label="ことばを書く欄"></span>',
  toMixed: '<span class="answer-mixed">' + answerNumber + answerStack + '</span>',
  toImproper: answerStack
};

function problemText(problem, isAnswer) {
  const { type, numerator, denominator, whole, remainder } = problem;
  const given = type === "toImproper" ? mixed(whole, remainder, denominator) : fraction(numerator, denominator);
  const response = isAnswer ? '<span class="answer-value">' + renderAnswer(answerFor(problem)) + '</span>' : answerBlanks[type];
  if (type === "unit") return given + '<span>は</span>' + fraction(1, denominator) + '<span>の</span>' + response + '<span>こ分</span>';
  if (type === "kind") return given + '<span>は</span>' + response;
  return given + '<span>＝</span>' + response;
}

function renderProblems(items, isAnswer, mode, order) {
  return items.map((item, index) => {
    const startsGroup = mode === "mix" && order === "grouped" && index > 0 && items[index - 1].type !== item.type;
    const tag = mode === "mix" ? '<span class="tag">' + modes[item.type].tag + '</span>' : "";
    return '<li class="question' + (startsGroup ? ' group-start' : '') + '">' +
      '<span class="num">' + (index + 1) + '.</span><div class="body">' + tag +
      '<div class="expression">' + problemText(item, isAnswer) + '</div></div></li>';
  }).join("");
}

const pick = id => document.getElementById(id);
let lastSignature = "";

function generate() {
  const settings = {
    mode: pick("mode").value, count: Number(pick("count").value),
    level: pick("level").value, order: pick("order").value
  };
  const { mode, count, level, order } = settings;
  let items = makeProblems(settings);
  let signature = JSON.stringify(items);
  if (signature === lastSignature) {
    items = makeProblems(settings);
    signature = JSON.stringify(items);
  }
  lastSignature = signature;

  pick("level-help").textContent = levels[level].description;
  pick("worksheet-title").textContent = modes[mode].title;
  pick("answers-title").textContent = modes[mode].title + "　答え";
  pick("directions").textContent = modes[mode].directions;
  const conversion = ["mix", "toMixed", "toImproper"].includes(mode);
  const includesWhole = ["mix", "toMixed"].includes(mode);
  pick("problem-rule").hidden = !conversion;
  pick("problem-rule").textContent = conversion ? sameDenominator + (includesWhole ? wholeOnly : "") : "";
  pick("marking").textContent = modes[mode].marking +
    (conversion ? "分数はもとの分母で書く練習です。同じ大きさでも分母を変えた答えは、指定の形に直しましょう。" : "");
  pick("problems").innerHTML = renderProblems(items, false, mode, order);
  pick("answers").innerHTML = renderProblems(items, true, mode, order);
  pick("problem-sheet").dataset.count = count;
  pick("answer-sheet").dataset.count = count;
  pick("status").textContent = count + "問のプリントを作りました。";
}

pick("options").addEventListener("submit", event => { event.preventDefault(); generate(); });
for (const id of ["mode", "count", "level", "order"]) pick(id).addEventListener("change", generate);
pick("include").addEventListener("change", event => { pick("answer-sheet").hidden = !event.target.checked; });
pick("print").addEventListener("click", () => window.print());
generate();
