const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const DIR = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const js = fs.readFileSync(path.join(DIR, "app.js"), "utf8");

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  url: "http://localhost/",
  pretendToBeVisual: true,
});
dom.window.eval(js);

const { window } = dom;
const { document } = window;

function fire(el, type, props = {}) {
  const ev = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, props);
  el.dispatchEvent(ev);
}

function addTask(text) {
  const input = document.getElementById("capture-input");
  input.value = text;
  fire(document.getElementById("capture-form"), "submit");
}

function rows() {
  return Array.from(document.querySelectorAll("#task-list .task"));
}
function rowText(r) {
  return r.querySelector(".task__text").textContent;
}
function storedLines() {
  const raw = window.localStorage.getItem("todo-txt.tasks") || "";
  return raw ? raw.split("\n") : [];
}

let n = 0;
function ok(name, fn) {
  n += 1;
  try {
    fn();
    console.log("PASS " + n + " " + name);
  } catch (e) {
    console.log("FAIL " + n + " " + name + " -> " + e.message);
    process.exitCode = 1;
  }
}

ok("starts empty", () => {
  assert.strictEqual(rows().length, 0);
  assert.strictEqual(document.getElementById("empty-state").hidden, false);
});

ok("add task renders + persists", () => {
  addTask("buy milk");
  assert.strictEqual(rows().length, 1);
  assert.strictEqual(rowText(rows()[0]), "buy milk");
  assert.deepStrictEqual(storedLines(), ["buy milk"]);
});

ok("capture parses (A) priority into todo.txt form", () => {
  addTask("(A) call mum +family @phone");
  const r = rows()[1];
  assert.strictEqual(r.querySelector(".task__priority").value, "A");
  assert.strictEqual(rowText(r), "call mum +family @phone");
  assert.deepStrictEqual(storedLines()[1], "(A) call mum +family @phone");
});

ok("blank submit ignored", () => {
  addTask("   ");
  assert.strictEqual(rows().length, 2);
});

ok("priority change persists", () => {
  const sel = rows()[0].querySelector(".task__priority");
  sel.value = "C";
  fire(sel, "change");
  assert.strictEqual(storedLines()[0], "(C) buy milk");
});

ok("complete adds x + date, strips priority", () => {
  const cb = rows()[0].querySelector(".task__checkbox");
  cb.checked = true;
  fire(cb, "change");
  const line = storedLines()[0];
  assert.match(line, /^x \d{4}-\d{2}-\d{2} buy milk$/);
  assert.ok(rows()[0].classList.contains("is-done"));
});

ok("reopen removes x marker", () => {
  const cb = rows()[0].querySelector(".task__checkbox");
  cb.checked = false;
  fire(cb, "change");
  assert.strictEqual(storedLines()[0], "buy milk");
});

ok("inline edit via dblclick + Enter", () => {
  fire(rows()[0].querySelector(".task__text"), "dblclick");
  const inp = rows()[0].querySelector(".task__edit-input");
  assert.ok(inp, "edit input appeared");
  inp.value = "buy oat milk";
  fire(inp, "keydown", { key: "Enter" });
  assert.strictEqual(rowText(rows()[0]), "buy oat milk");
  assert.strictEqual(storedLines()[0], "buy oat milk");
});

ok("edit Escape cancels", () => {
  fire(rows()[0].querySelector(".task__text"), "dblclick");
  const inp = rows()[0].querySelector(".task__edit-input");
  inp.value = "SHOULD NOT SAVE";
  fire(inp, "keydown", { key: "Escape" });
  assert.strictEqual(rowText(rows()[0]), "buy oat milk");
});

ok("delete removes row + line", () => {
  const before = rows().length;
  fire(rows()[1].querySelector(".task__delete"), "click");
  assert.strictEqual(rows().length, before - 1);
  assert.strictEqual(storedLines().length, before - 1);
  assert.ok(storedLines().indexOf("(A) call mum +family @phone") === -1);
});

ok("drag reorder moves item and persists order", () => {
  addTask("third");
  addTask("fourth");
  const items = rows();
  const firstId = items[0].dataset.id;
  const target = items[2];
  const fake = { effectAllowed: "", dropEffect: "", setData() {}, getData() { return firstId; } };
  fire(items[0], "dragstart", { dataTransfer: fake });
  fire(target, "dragover", { dataTransfer: fake, clientY: 0 });
  fire(target, "drop", { dataTransfer: fake, clientY: 0 });
  fire(items[0], "dragend", { dataTransfer: fake });
  assert.strictEqual(rows()[0].dataset.id === firstId, false, "first item moved away");
  assert.deepStrictEqual(storedLines(), ["third", "buy oat milk", "fourth"]);
});

ok("completed item persists x marker across reload", () => {
  const cb = rows()[0].querySelector(".task__checkbox");
  cb.checked = true;
  fire(cb, "change");
  const raw = window.localStorage.getItem("todo-txt.tasks");
  const dom2 = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
  dom2.window.localStorage.setItem("todo-txt.tasks", raw);
  dom2.window.eval(js);
  const d2 = dom2.window.document;
  const done = d2.querySelector("#task-list .task.is-done");
  assert.ok(done, "completed task re-rendered after reload");
});

ok("count label reports done/total", () => {
  assert.match(document.getElementById("task-count").textContent, /\d+ of \d+ done/);
});

ok("defaults to Light theme", () => {
  assert.strictEqual(document.documentElement.getAttribute("data-theme"), "light");
  const light = document.querySelector('[data-theme-value="light"]');
  assert.strictEqual(light.getAttribute("aria-pressed"), "true");
});

ok("switching to Dark applies + persists", () => {
  fire(document.querySelector('[data-theme-value="dark"]'), "click");
  assert.strictEqual(document.documentElement.getAttribute("data-theme"), "dark");
  assert.strictEqual(window.localStorage.getItem("todo-txt.theme"), "dark");
  const dark = document.querySelector('[data-theme-value="dark"]');
  assert.strictEqual(dark.getAttribute("aria-pressed"), "true");
});

ok("Night theme supported", () => {
  fire(document.querySelector('[data-theme-value="night"]'), "click");
  assert.strictEqual(document.documentElement.getAttribute("data-theme"), "night");
  assert.strictEqual(window.localStorage.getItem("todo-txt.theme"), "night");
});

ok("saved theme applies on reload", () => {
  const dom2 = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
  dom2.window.localStorage.setItem("todo-txt.theme", "night");
  dom2.window.eval(js);
  const d2 = dom2.window.document;
  assert.strictEqual(d2.documentElement.getAttribute("data-theme"), "night");
  assert.strictEqual(
    d2.querySelector('[data-theme-value="night"]').getAttribute("aria-pressed"),
    "true"
  );
});

ok("unknown stored theme falls back to Light", () => {
  const dom3 = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
  dom3.window.localStorage.setItem("todo-txt.theme", "neon");
  dom3.window.eval(js);
  assert.strictEqual(dom3.window.document.documentElement.getAttribute("data-theme"), "light");
});

console.log(process.exitCode ? "\nSOME TESTS FAILED" : "\nALL TESTS PASSED");
