(function () {
  "use strict";

  var STORAGE_KEY = "todo-txt.tasks";
  var THEME_KEY = "todo-txt.theme";
  var PRIORITIES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  var THEMES = ["light", "dark", "night"];
  var DEFAULT_THEME = "light";

  var listEl = document.getElementById("task-list");
  var formEl = document.getElementById("capture-form");
  var inputEl = document.getElementById("capture-input");
  var emptyEl = document.getElementById("empty-state");
  var countEl = document.getElementById("task-count");
  var themeButtons = document.querySelectorAll(".theme-switcher__button");

  var tasks = [];
  var dragId = null;
  var idSeq = 0;

  function uid() {
    idSeq += 1;
    return "t" + Date.now().toString(36) + "-" + idSeq;
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  // --- todo.txt parsing / serialising -------------------------------------

  function parseLine(line) {
    var rest = line;
    var task = {
      completed: false,
      completedDate: null,
      priority: null,
      createdDate: null,
      text: ""
    };

    if (rest.slice(0, 2) === "x ") {
      task.completed = true;
      rest = rest.slice(2);

      var cd = rest.match(/^(\d{4}-\d{2}-\d{2})\s+/);
      if (cd) {
        task.completedDate = cd[1];
        rest = rest.slice(cd[0].length);
      }
    } else {
      var pm = rest.match(/^\(([A-Z])\)\s+/);
      if (pm) {
        task.priority = pm[1];
        rest = rest.slice(pm[0].length);
      }

      var dm = rest.match(/^(\d{4}-\d{2}-\d{2})\s+/);
      if (dm) {
        task.createdDate = dm[1];
        rest = rest.slice(dm[0].length);
      }
    }

    task.text = rest.trim();
    return task;
  }

  function composeLine(task) {
    if (task.completed) {
      var done = ["x"];
      if (task.completedDate) done.push(task.completedDate);
      if (task.createdDate) done.push(task.createdDate);
      done.push(task.text);
      return done.join(" ");
    }

    var parts = [];
    if (task.priority) parts.push("(" + task.priority + ")");
    if (task.createdDate) parts.push(task.createdDate);
    parts.push(task.text);
    return parts.join(" ");
  }

  // --- persistence --------------------------------------------------------

  function save() {
    try {
      var text = tasks.map(composeLine).join("\n");
      localStorage.setItem(STORAGE_KEY, text);
    } catch (err) {
      console.error("Could not save tasks:", err);
    }
  }

  function load() {
    var raw = "";
    try {
      raw = localStorage.getItem(STORAGE_KEY) || "";
    } catch (err) {
      console.error("Could not read tasks:", err);
      return;
    }

    tasks = raw
      .split("\n")
      .filter(function (line) {
        return line.trim() !== "";
      })
      .map(function (line) {
        var task = parseLine(line);
        task.id = uid();
        return task;
      });
  }

  // --- theme ---------------------------------------------------------------

  function readTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (err) {
      return DEFAULT_THEME;
    }
    return THEMES.indexOf(saved) !== -1 ? saved : DEFAULT_THEME;
  }

  function applyTheme(name) {
    document.documentElement.setAttribute("data-theme", name);
    themeButtons.forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.dataset.themeValue === name ? "true" : "false"
      );
    });
  }

  function setTheme(name) {
    if (THEMES.indexOf(name) === -1) name = DEFAULT_THEME;
    try {
      localStorage.setItem(THEME_KEY, name);
    } catch (err) {
      console.error("Could not save theme:", err);
    }
    applyTheme(name);
  }

  function initTheme() {
    themeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(btn.dataset.themeValue);
      });
    });
    applyTheme(readTheme());
  }

  // --- rendering ----------------------------------------------------------

  function priorityBadge(task) {
    var select = document.createElement("select");
    select.className = "task__priority";
    select.dataset.priority = task.priority || "";
    select.title = "Set priority";

    var none = document.createElement("option");
    none.value = "";
    none.textContent = "–";
    select.appendChild(none);

    PRIORITIES.forEach(function (letter) {
      var opt = document.createElement("option");
      opt.value = letter;
      opt.textContent = "(" + letter + ")";
      select.appendChild(opt);
    });

    select.value = task.priority || "";
    select.setAttribute("aria-label", "Priority for " + task.text);

    select.addEventListener("change", function () {
      task.priority = select.value || null;
      save();
      render();
    });

    return select;
  }

  function renderTask(task) {
    var li = document.createElement("li");
    li.className = "task" + (task.completed ? " is-done" : "");
    li.dataset.id = task.id;
    li.draggable = true;

    var handle = document.createElement("button");
    handle.type = "button";
    handle.className = "task__handle";
    handle.textContent = "⠿";
    handle.title = "Drag to reorder";
    handle.setAttribute("aria-label", "Drag to reorder " + task.text);
    handle.tabIndex = -1;

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task__checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", "Mark " + task.text + " complete");
    checkbox.addEventListener("change", function () {
      task.completed = checkbox.checked;
      task.completedDate = task.completed ? todayISO() : null;
      if (task.completed) task.priority = null;
      save();
      render();
    });

    var text = document.createElement("span");
    text.className = "task__text";
    text.textContent = task.text;
    text.title = "Double-click to edit";
    text.tabIndex = 0;
    text.addEventListener("dblclick", function () {
      beginEdit(li, task, text);
    });
    text.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        beginEdit(li, task, text);
      }
    });

    var del = document.createElement("button");
    del.type = "button";
    del.className = "task__delete";
    del.textContent = "\u00d7";
    del.title = "Delete task";
    del.setAttribute("aria-label", "Delete " + task.text);
    del.addEventListener("click", function () {
      tasks = tasks.filter(function (t) {
        return t.id !== task.id;
      });
      save();
      render();
    });

    li.appendChild(handle);
    li.appendChild(checkbox);
    li.appendChild(priorityBadge(task));
    li.appendChild(text);
    li.appendChild(del);

    attachDrag(li);
    return li;
  }

  function beginEdit(li, task, textEl) {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "task__edit-input";
    input.value = task.text;
    input.maxLength = 500;

    var finished = false;

    function commit() {
      if (finished) return;
      finished = true;
      var value = input.value.trim();
      if (value === "") {
        tasks = tasks.filter(function (t) {
          return t.id !== task.id;
        });
      } else {
        task.text = value;
      }
      save();
      render();
    }

    function cancel() {
      if (finished) return;
      finished = true;
      render();
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", commit);

    li.replaceChild(input, textEl);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function render() {
    listEl.innerHTML = "";
    tasks.forEach(function (task) {
      listEl.appendChild(renderTask(task));
    });

    var done = tasks.reduce(function (n, t) {
      return n + (t.completed ? 1 : 0);
    }, 0);

    countEl.textContent =
      tasks.length === 0
        ? "0 tasks"
        : done + " of " + tasks.length + " done";

    emptyEl.hidden = tasks.length !== 0;
  }

  // --- drag to reorder ----------------------------------------------------

  function clearDropTargets() {
    listEl.querySelectorAll(".task.drop-target").forEach(function (el) {
      el.classList.remove("drop-target");
    });
  }

  function attachDrag(li) {
    li.addEventListener("dragstart", function (e) {
      dragId = li.dataset.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", dragId);
      } catch (err) {
        /* ignore */
      }
    });

    li.addEventListener("dragover", function (e) {
      if (!dragId || li.dataset.id === dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDropTargets();
      li.classList.add("drop-target");
    });

    li.addEventListener("drop", function (e) {
      if (!dragId || li.dataset.id === dragId) return;
      e.preventDefault();
      clearDropTargets();

      var from = tasks.findIndex(function (t) {
        return t.id === dragId;
      });
      if (from === -1) return;

      var moved = tasks.splice(from, 1)[0];
      var targetIndex = tasks.findIndex(function (t) {
        return t.id === li.dataset.id;
      });
      if (targetIndex === -1) {
        tasks.splice(from, 0, moved);
        save();
        render();
        return;
      }

      var rect = li.getBoundingClientRect();
      var after = e.clientY > rect.top + rect.height / 2;
      tasks.splice(after ? targetIndex + 1 : targetIndex, 0, moved);

      save();
      render();
    });

    li.addEventListener("dragend", function () {
      dragId = null;
      li.classList.remove("dragging");
      clearDropTargets();
    });
  }

  // --- capture ------------------------------------------------------------

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = inputEl.value.trim();
    if (value === "") return;

    var task = parseLine(value);
    task.id = uid();
    if (task.text === "") return;

    tasks.push(task);
    inputEl.value = "";
    save();
    render();
    inputEl.focus();
  });

  // --- boot ---------------------------------------------------------------

  initTheme();
  load();
  render();
})();
