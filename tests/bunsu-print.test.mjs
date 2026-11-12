import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../kids-app/bunsu-print.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../kids-app/bunsu-print.js", import.meta.url), "utf8");

function startPage() {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [
    id, { dataset: {}, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } }
  ]));
  for (const [id, value] of Object.entries({ mode: "mix", level: "easy", order: "grouped", count: "12" })) {
    elements[id].value = value;
  }
  elements["answer-sheet"].hidden = true;
  let printCalls = 0;
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    window: { print: () => printCalls++ }
  });
  vm.runInContext(source, context);
  const helpers = vm.runInContext("({ makeProblems, answerFor, fraction, renderProblems })", context);
  return { ...helpers, elements, printCalls: () => printCalls };
}

const modes = ["mix", "unit", "kind", "toMixed", "toImproper"];
const orders = ["grouped", "random"];
const rules = {
  easy: { denominator: 6, whole: 2, reduced: true },
  normal: { denominator: 9, whole: 3, reduced: true },
  challenge: { denominator: 12, whole: 4, reduced: false }
};

function rng(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

for (const [level, limits] of Object.entries(rules)) {
  test(`${level}: all modes, counts and orderings stay within range and preserve the quotas`, () => {
    const { makeProblems, answerFor } = startPage();
    for (const mode of modes) for (const count of [8, 12, 16]) for (const order of orders) {
      for (let seed = 1; seed <= 32; seed++) {
        const problems = makeProblems({ mode, count, level, order }, rng(seed));
        assert.equal(problems.length, count);
        assert.equal(new Set(problems.map(p => p.numerator + "/" + p.denominator)).size, count);
        assert.ok(new Set(problems.map(p => p.denominator)).size >= 3);

        const wanted = mode === "mix" ? modes.slice(1) : [mode];
        const perType = count / wanted.length;
        for (const type of wanted) {
          const group = problems.filter(p => p.type === type);
          assert.equal(group.length, perType);
          if (type === "unit" || type === "kind") {
            assert.equal(group.filter(p => p.numerator < p.denominator).length, Math.ceil(perType / 2));
          }
          if (type === "kind") assert.equal(group.filter(p => p.numerator === p.denominator).length, 1);
          if (type === "toMixed") {
            assert.equal(group.filter(p => p.numerator % p.denominator === 0).length, Math.max(1, Math.round(perType / 4)));
          }
        }

        for (const p of problems) {
          const { numerator: n, denominator: d, type } = p;
          assert.ok(d >= 2 && d <= limits.denominator && n > 0);
          assert.ok(Math.floor(n / d) <= limits.whole);
          if (limits.reduced && n % d) {
            for (let factor = 2; factor <= d; factor++) assert.ok(n % factor || d % factor);
          }
          const a = answerFor(p);
          if (type === "unit") assert.equal(a.value, n);
          if (type === "kind") assert.equal(a.value, n < d ? "真分数" : "仮分数");
          if (type === "toImproper") {
            assert.ok(p.whole > 0 && p.remainder > 0);
            assert.equal(a.numerator, p.whole * d + p.remainder);
            assert.equal(a.denominator, d);
          }
          if (type === "toMixed") {
            assert.ok(n >= d);
            if (n % d === 0) assert.equal(a.value, n / d);
            else {
              assert.equal(a.denominator, d);
              assert.ok(a.numerator > 0 && a.numerator < d);
              assert.equal(a.whole * d + a.numerator, n);
            }
          }
        }
        if (order === "grouped") {
          const actual = Array.from(new Set(problems.map(p => p.type)));
          assert.deepEqual(actual, wanted);
          for (const type of wanted) {
            const scores = Array.from(problems.filter(p => p.type === type), p => p.whole * 30 + 2*p.denominator + p.remainder);
            assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
          }
        }
      }
    }
  });
}

test("numerator above denominator, number, word and stacked answer spaces, and matching numbered answers", () => {
  const { fraction, renderProblems } = startPage();
  assert.match(fraction(7, 4), /aria-label="4分の7"><span>7<\/span><span>4<\/span>/);
  const problems = [
    { type: "unit", numerator: 7, denominator: 4 },
    { type: "kind", numerator: 4, denominator: 4 },
    { type: "toMixed", numerator: 26, denominator: 8 },
    { type: "toMixed", numerator: 8, denominator: 4 },
    { type: "toImproper", numerator: 11, denominator: 4, whole: 2, remainder: 3 }
  ];
  const questions = renderProblems(problems, false, "mix", "grouped").split("</li>");
  const answers = renderProblems(problems, true, "mix", "grouped").split("</li>");
  assert.match(questions[0], /class="answer-box"/);
  assert.match(questions[1], /class="answer-box answer-word"/);
  for (const line of questions.slice(2, 4)) assert.match(line, /class="answer-mixed".*class="answer-stack"/);
  assert.match(questions[4], /class="answer-stack"/);
  assert.match(answers[0], /class="answer-value">7</);
  assert.match(answers[1], /class="answer-value">仮分数</);
  assert.match(answers[2], /class="answer-value"><span class="mixed"><span>3<\/span>.*<span>2<\/span><span>8<\/span>/);
  assert.match(answers[3], /class="answer-value">2</);
  assert.match(answers[4], /class="answer-value"><span class="frac".*<span>11<\/span><span>4<\/span>/);
  for (let i = 0; i < problems.length; i++) {
    const number = '<span class="num">' + (i+1) + '.</span>';
    assert.ok(questions[i].includes(number) && answers[i].includes(number));
  }
});

test("page controls regenerate both sheets together and print with optional answers", () => {
  const { elements: el, printCalls } = startPage();
  assert.match(el.status.textContent, /12問/);
  assert.ok(el["answer-sheet"].hidden);
  el.count.value = "16";
  el.count.listeners.change();
  assert.equal(el["problem-sheet"].dataset.count, 16);
  assert.equal(el["answer-sheet"].dataset.count, 16);
  assert.equal((el.problems.innerHTML.match(/<li /g) || []).length, 16);
  assert.equal((el.answers.innerHTML.match(/<li /g) || []).length, 16);
  const original = el.problems.innerHTML;
  el.include.listeners.change({ target: { checked: true } });
  assert.equal(el["answer-sheet"].hidden, false);
  assert.equal(el.problems.innerHTML, original);
  assert.match(el.marking.textContent, /もとの分母/);
  el.print.listeners.click();
  assert.equal(printCalls(), 1);
  el.include.listeners.change({ target: { checked: false } });
  assert.equal(el["answer-sheet"].hidden, true);
});
