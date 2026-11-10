const BOY_COLORS = [
  ["#E6F1FB", "#185FA5"],
  ["#EAF3DE", "#3B6D11"],
  ["#E1F5EE", "#0F6E56"],
  ["#E6F1FB", "#0C447C"],
];
const GIRL_COLORS = [
  ["#FBEAF0", "#993556"],
  ["#EEEDFE", "#534AB7"],
  ["#FAECE7", "#993C1D"],
  ["#FBEAF0", "#712B13"],
];
const NEUTRAL_COLORS = [
  ["#EEEDFE", "#534AB7"],
  ["#E1F5EE", "#0F6E56"],
  ["#FAECE7", "#993C1D"],
  ["#FBEAF0", "#993556"],
  ["#E6F1FB", "#185FA5"],
  ["#EAF3DE", "#3B6D11"],
  ["#FAEEDA", "#854F0B"],
  ["#FCEBEB", "#A32D2D"],
];

const PREBUILT = [
  {
    name: "Math 101",
    students: [
      { n: "Alice", g: "girl" },
      { n: "Bob", g: "boy" },
      { n: "Carlos", g: "boy" },
      { n: "Diana", g: "girl" },
      { n: "Ethan", g: "boy" },
      { n: "Fatima", g: "girl" },
      { n: "George", g: "boy" },
      { n: "Hannah", g: "girl" },
    ],
  },
  {
    name: "Science 5A",
    students: [
      { n: "Ivan", g: "boy" },
      { n: "Jasmine", g: "girl" },
      { n: "Kevin", g: "boy" },
      { n: "Laura", g: "girl" },
      { n: "Mike", g: "boy" },
      { n: "Nina", g: "girl" },
      { n: "Oscar", g: "boy" },
      { n: "Priya", g: "girl" },
    ],
  },
  {
    name: "English B",
    students: [
      { n: "Quinn", g: "girl" },
      { n: "Rosa", g: "girl" },
      { n: "Sam", g: "boy" },
      { n: "Tina", g: "girl" },
      { n: "Uma", g: "girl" },
      { n: "Victor", g: "boy" },
      { n: "Wendy", g: "girl" },
      { n: "Xander", g: "boy" },
      { n: "Yara", g: "girl" },
      { n: "Zoe", g: "girl" },
    ],
  },
];

const TAU = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;
const CX = 150,
  CY = 150,
  R = 145;

let classes = {},
  activeId = null;
let allNames = [],
  absent = new Set(),
  sessionRemoved = new Set(),
  lastWinner = null;
let spinning = false,
  angle = 0,
  animId = null;
let turnMode = "all"; // 'all' | 'gender' (boys vs girls) | 'group' (group vs group)
let alternateMode = false,
  nextTurn = "boy"; // alternateMode is derived from turnMode
let addGender = "boy",
  bulkGender = "boy";
let groups = []; // [{name, members:[{n,g}]}]
let currentGroupIdx = 0; // which group's turn it is
let groupRemovedMap = {}; // {groupIdx: Set of removed names}
let groupLastWinner = {}; // {groupIdx: name}
let groupMode = false; // true when groups exist and group-spin is active
let genderFilter = ""; // "" | "boy" | "girl" — limits the wheel in Everyone / Group modes
let editingName = null;
let dragName = null,
  dragFromGroup = null;

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");

// ── Storage ──
function save() {
  try {
    localStorage.setItem("wheelClasses", JSON.stringify(classes));
    localStorage.setItem("wheelActive", activeId || "");
  } catch (e) {}
}

function saveGroupState() {
  if (!activeId) return;
  try {
    // Convert Sets to arrays for JSON serialisation
    const grpRemovedArr = {};
    Object.entries(groupRemovedMap).forEach(([k, v]) => {
      grpRemovedArr[k] = [...v];
    });
    const state = {
      groups,
      groupMode,
      genderFilter,
      turnMode,
      nextTurn,
      currentGroupIdx,
      groupRemovedMap: grpRemovedArr,
      groupLastWinner,
      absent: [...absent],
    };
    localStorage.setItem(
      "wheelGroupState_" + activeId,
      JSON.stringify(state),
    );
  } catch (e) {}
}

function loadGroupState() {
  if (!activeId) return;
  try {
    const raw = localStorage.getItem("wheelGroupState_" + activeId);
    if (!raw) return;
    const state = JSON.parse(raw);
    groups = state.groups || [];
    currentGroupIdx = state.currentGroupIdx || 0;
    if (currentGroupIdx >= groups.length) currentGroupIdx = 0;
    nextTurn = state.nextTurn === "girl" ? "girl" : "boy";
    genderFilter =
      state.genderFilter === "boy" || state.genderFilter === "girl"
        ? state.genderFilter
        : "";
    applyMode(state.turnMode || (state.groupMode ? "group" : "all"));
    absent = new Set(state.absent || []);
    groupLastWinner = state.groupLastWinner || {};
    // Convert arrays back to Sets
    groupRemovedMap = {};
    Object.entries(state.groupRemovedMap || {}).forEach(([k, v]) => {
      groupRemovedMap[k] = new Set(v);
    });
  } catch (e) {}
}

function clearGroupState() {
  if (!activeId) return;
  try {
    localStorage.removeItem("wheelGroupState_" + activeId);
  } catch (e) {}
}

function loadStorage() {
  try {
    const d = localStorage.getItem("wheelClasses");
    if (d) classes = JSON.parse(d);
    const a = localStorage.getItem("wheelActive");
    if (a && classes[a]) activeId = a;
  } catch (e) {}
}
loadStorage();
Object.values(classes).forEach((c) => {
  c.students = c.students.map((s) =>
    typeof s === "string" ? { n: s, g: "" } : s,
  );
});
if (!Object.keys(classes).length) {
  PREBUILT.forEach((p) => {
    const id = uid();
    classes[id] = {
      name: p.name,
      students: p.students.map((s) => ({ ...s })),
    };
  });
  save();
}

function uid() {
  return "c" + Date.now() + Math.random().toString(36).slice(2, 6);
}
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function normaliseAngle(a) {
  return ((a % TAU) + TAU) % TAU;
}
function getRemaining(gf) {
  // Always exclude absent students from everything
  if (groupMode && groups.length > 0) {
    const grp = groups[currentGroupIdx];
    if (!grp) return [];
    const grpRemoved = groupRemovedMap[currentGroupIdx] || new Set();
    return grp.members.filter(
      (s) =>
        !absent.has(s.n) &&
        !grpRemoved.has(s.n) &&
        (!genderFilter || s.g === genderFilter),
    );
  }
  const base = allNames.filter(
    (s) => !absent.has(s.n) && !sessionRemoved.has(s.n),
  );
  if (!gf) return genderFilter ? base.filter((s) => s.g === genderFilter) : base;
  const f = base.filter((s) => s.g === gf);
  return f.length > 0 ? f : base;
}

// ── Gender toggles ──
function setAddGender(g) {
  addGender = g;
  document.getElementById("addGenderBoy").className =
    g === "boy" ? "active-boy" : "";
  document.getElementById("addGenderGirl").className =
    g === "girl" ? "active-girl" : "";
}
function setBulkGender(g) {
  bulkGender = g;
  document.getElementById("bulkGenderBoy").className =
    g === "boy" ? "active-boy" : "";
  document.getElementById("bulkGenderGirl").className =
    g === "girl" ? "active-girl" : "";
}

// ── Turn mode: Everyone / ♂ vs ♀ / Group vs Group ──
function applyMode(mode) {
  turnMode = mode;
  alternateMode = mode === "gender";
  groupMode = mode === "group" && groups.length > 0;
}

function setTurnMode(mode) {
  if (!activeId || spinning || mode === turnMode) return;
  if (mode === "group" && !groups.length) {
    // No groups yet: split the class first (autoSplit switches to group mode itself)
    if (!allNames.length) {
      document.getElementById("resultBox").textContent =
        "Add students first, then split into groups.";
      return;
    }
    autoSplit();
    return;
  }
  applyMode(mode);
  nextTurn = "boy";
  pendingRemove = null;
  lastWinner =
    mode === "group" ? groupLastWinner[currentGroupIdx] || null : null;
  saveGroupState();
  document.getElementById("resultBox").textContent =
    mode === "gender"
      ? "♂ vs ♀ mode — boys go first."
      : mode === "group"
        ? `Group vs Group mode — ${groups[currentGroupIdx].name} goes first.`
        : "Everyone mode — picks randomly from all students.";
  updateGroupBanner();
  renderGroups();
  renderNameList();
  drawWheel();
  updateUI();
}

// Jump straight to a team's turn (tap a chip). Un-removed winner on the old team is simply un-picked.
function setGenderFilter(f) {
  if (spinning || turnMode === "gender" || f === genderFilter) return;
  genderFilter = f;
  pendingRemove = null;
  // Drop a highlighted winner who no longer belongs on the wheel
  if (lastWinner) {
    const w = allNames.find((s) => s.n === lastWinner);
    if (f && w && w.g !== f) {
      lastWinner = null;
      if (groupMode) groupLastWinner[currentGroupIdx] = null;
    }
  }
  saveGroupState();
  document.getElementById("resultBox").textContent =
    f === "boy"
      ? "♂ Boys only on the wheel."
      : f === "girl"
        ? "♀ Girls only on the wheel."
        : "Everyone is back on the wheel.";
  updateGroupBanner();
  renderGroups();
  renderNameList();
  drawWheel();
  updateUI();
}

function setGenderTurn(g) {
  if (spinning || !alternateMode || g === nextTurn) return;
  nextTurn = g;
  lastWinner = null;
  document.getElementById("resultBox").textContent =
    (g === "boy" ? "♂ Boys" : "♀ Girls") + "' turn — hit Spin!";
  renderNameList();
  drawWheel();
  updateUI();
}
function setGroupTurn(i) {
  if (spinning || !groupMode || i === currentGroupIdx || !groups[i])
    return;
  groupLastWinner[currentGroupIdx] = null;
  currentGroupIdx = i;
  lastWinner = groupLastWinner[i] || null;
  saveGroupState();
  document.getElementById("resultBox").textContent =
    `${groups[i].name}'s turn — hit Spin!`;
  updateGroupBanner();
  renderGroups();
  renderNameList();
  drawWheel();
  updateUI();
}

function groupRemainingCount(gi) {
  const g = groups[gi];
  if (!g) return 0;
  const gr = groupRemovedMap[gi] || new Set();
  return g.members.filter(
    (s) =>
      !absent.has(s.n) &&
      !gr.has(s.n) &&
      (!genderFilter || s.g === genderFilter),
  ).length;
}

// Skip to the next team without picking anyone (e.g. the wheel was spun by accident).
// Nobody is removed — an un-removed winner just goes back to being a normal slice.
function skipTurn() {
  if (!activeId || spinning) return;
  pendingRemove = null;
  const box = document.getElementById("resultBox");
  if (groupMode && groups.length) {
    const was = groups[currentGroupIdx].name;
    groupLastWinner[currentGroupIdx] = null;
    lastWinner = null;
    advanceGroup();
    box.textContent = `Skipped ${was}. ${box.textContent}`;
    return;
  }
  if (alternateMode) {
    if (lastWinner) {
      // A spin just happened and the turn already moved to the other team: cancel the pick.
      lastWinner = null;
      box.textContent = `Pick cancelled — ${nextTurn === "boy" ? "♂ Boys" : "♀ Girls"}' turn.`;
    } else {
      nextTurn = nextTurn === "boy" ? "girl" : "boy";
      box.textContent = `Skipped — ${nextTurn === "boy" ? "♂ Boys" : "♀ Girls"}' turn.`;
    }
    renderNameList();
    drawWheel();
    updateUI();
    return;
  }
  if (lastWinner) {
    lastWinner = null;
    box.textContent = "Pick cancelled — spin again!";
    renderNameList();
    drawWheel();
    updateUI();
  } else {
    box.textContent = "Nothing to skip — just spin!";
  }
}

// Mode switch buttons + the clickable "whose turn" chips
function updateModeBar() {
  document
    .querySelectorAll("#modeSeg button")
    .forEach((b) =>
      b.classList.toggle("on", b.dataset.mode === turnMode),
    );
  const fr = document.getElementById("filterRow");
  if (fr) {
    fr.style.display = turnMode === "gender" ? "none" : "flex";
    fr.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("on", b.dataset.f === genderFilter),
    );
  }
  const el = document.getElementById("turnChips");
  if (!el) return;
  if (turnMode === "gender") {
    const cnt = (g) =>
      allNames.filter(
        (s) => s.g === g && !absent.has(s.n) && !sessionRemoved.has(s.n),
      ).length;
    el.innerHTML =
      `<button class="turn-chip boy${nextTurn === "boy" ? " current" : ""}" onclick="setGenderTurn('boy')">♂ Boys · ${cnt("boy")} left</button>` +
      `<button class="turn-chip girl${nextTurn === "girl" ? " current" : ""}" onclick="setGenderTurn('girl')">♀ Girls · ${cnt("girl")} left</button>`;
  } else if (turnMode === "group" && groups.length) {
    el.innerHTML = groups
      .map((g, i) => {
        const left = groupRemainingCount(i);
        return `<button class="turn-chip grp${i === currentGroupIdx ? " current" : ""}${left === 0 ? " done" : ""}" onclick="setGroupTurn(${i})">${esc(g.name)} · ${left} left</button>`;
      })
      .join("");
  } else {
    el.innerHTML =
      '<span class="mode-hint">Picks randomly from everyone present</span>';
  }
}

function toggleStudentGender(name) {
  if (!activeId) return;
  const s = classes[activeId].students.find((s) => s.n === name);
  if (!s) return;
  s.g = s.g === "boy" ? "girl" : s.g === "girl" ? "" : "boy";
  const loc = allNames.find((s) => s.n === name);
  if (loc) loc.g = s.g;
  save();
  renderNameList();
  drawWheel();
}

// ── Edit name ──
function openEdit(name) {
  editingName = name;
  document.getElementById("editNameInput").value = name;
  document.getElementById("editModal").classList.add("open");
  setTimeout(() => document.getElementById("editNameInput").select(), 50);
}
function closeEdit() {
  document.getElementById("editModal").classList.remove("open");
  editingName = null;
}
function confirmEdit() {
  const newName = document.getElementById("editNameInput").value.trim();
  if (!newName || !editingName || !activeId) {
    closeEdit();
    return;
  }
  if (
    newName !== editingName &&
    classes[activeId].students.find((s) => s.n === newName)
  ) {
    alert("That name already exists in this class.");
    return;
  }
  // Update everywhere
  const cs = classes[activeId].students.find((s) => s.n === editingName);
  if (cs) cs.n = newName;
  const al = allNames.find((s) => s.n === editingName);
  if (al) al.n = newName;
  if (absent.has(editingName)) {
    absent.delete(editingName);
    absent.add(newName);
  }
  if (lastWinner === editingName) lastWinner = newName;
  // Update groups
  groups.forEach((g) => {
    const m = g.members.find((s) => s.n === editingName);
    if (m) m.n = newName;
  });
  save();
  renderNameList();
  drawWheel();
  renderGroups();
  closeEdit();
}

// ── Sidebar ──
function renderSidebar() {
  const el = document.getElementById("classList"),
    ids = Object.keys(classes);
  if (!ids.length) {
    el.innerHTML =
      '<p style="font-size:12px;color:#888;padding:4px 0;">No classes yet</p>';
    return;
  }
  el.innerHTML = ids
    .map((id) => {
      const c = classes[id];
      return `<div class="class-item${id === activeId ? " active" : ""}" onclick="selectClass('${id}')">
  <span class="ci-name">${esc(c.name)}</span><span class="ci-count">${c.students.length}</span>
  <button class="ci-del" onclick="deleteClass(event,'${id}')" title="Delete"><i class="ti ti-trash" style="font-size:13px;"></i></button>
</div>`;
    })
    .join("");
}
function createClass() {
  const inp = document.getElementById("newClassName"),
    name = inp.value.trim();
  if (!name) return;
  const id = uid();
  classes[id] = { name, students: [] };
  inp.value = "";
  save();
  selectClass(id);
}
function deleteClass(e, id) {
  e.stopPropagation();
  if (!confirm('Delete "' + classes[id].name + '"?')) return;
  delete classes[id];
  try {
    localStorage.removeItem("wheelGroupState_" + id);
  } catch (e) {}
  if (activeId === id) {
    activeId = null;
    showEmpty();
  }
  save();
  renderSidebar();
}
function selectClass(id) {
  activeId = id;
  allNames = classes[id].students.map((s) => ({ ...s }));
  absent = new Set();
  sessionRemoved = new Set();
  lastWinner = null;
  angle = 0;
  spinning = false;
  nextTurn = "boy";
  groups = [];
  currentGroupIdx = 0;
  groupRemovedMap = {};
  groupLastWinner = {};
  applyMode("all");
  genderFilter = "";
  if (animId) cancelAnimationFrame(animId);
  loadGroupState(); // restore saved group state for this class
  save();
  renderSidebar();
  showEditor();
}
function showEmpty() {
  document.getElementById("emptyState").style.display = "";
  document.getElementById("classEditor").style.display = "none";
  document.getElementById("groupsSection").style.display = "none";
}
function showEditor() {
  const c = classes[activeId];
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("classEditor").style.display = "";
  document.getElementById("classTitle").textContent = c.name;
  document.getElementById("resultBox").textContent = c.students.length
    ? "Ready to spin!"
    : "Add students to spin!";
  // Restore the lastWinner highlight for the active group after a reload
  if (groupMode && groups.length)
    lastWinner = groupLastWinner[currentGroupIdx] || null;
  updateModeBar();
  renderNameList();
  drawWheel();
  updateUI();
  renderGroups();
  updateGroupBanner();
}
function startRename() {
  const c = classes[activeId],
    t = document.getElementById("classTitle");
  t.outerHTML = `<input class="edit-name-input" id="classTitle" value="${esc(c.name)}" onblur="finishRename()" onkeydown="if(event.key==='Enter')this.blur()" />`;
  document.getElementById("classTitle").focus();
}
function finishRename() {
  const inp = document.getElementById("classTitle"),
    val = inp.value.trim() || classes[activeId].name;
  classes[activeId].name = val;
  save();
  renderSidebar();
  inp.outerHTML = `<span class="panel-title" id="classTitle">${esc(val)}</span>`;
}

// ── Add / bulk ──
function addName() {
  const inp = document.getElementById("nameInput"),
    val = inp.value.trim();
  if (!val || !activeId) return;
  if (!classes[activeId].students.find((s) => s.n === val)) {
    const st = { n: val, g: addGender };
    classes[activeId].students.push(st);
    allNames.push({ ...st });
    save();
  }
  inp.value = "";
  renderNameList();
  drawWheel();
  updateUI();
  renderSidebar();
}
function openBulk() {
  document.getElementById("bulkText").value = "";
  document.getElementById("bulkModal").classList.add("open");
  document.getElementById("bulkText").focus();
}
function closeBulk() {
  document.getElementById("bulkModal").classList.remove("open");
}
function confirmBulk() {
  const names = document
    .getElementById("bulkText")
    .value.split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 30);
  let added = 0;
  names.forEach((n) => {
    if (!classes[activeId].students.find((s) => s.n === n)) {
      const st = { n, g: bulkGender };
      classes[activeId].students.push(st);
      allNames.push({ ...st });
      added++;
    }
  });
  save();
  renderNameList();
  drawWheel();
  updateUI();
  renderSidebar();
  closeBulk();
  if (added > 0)
    document.getElementById("resultBox").textContent =
      `Added ${added} student${added > 1 ? "s" : ""}!`;
}

// ── Mark/unmark absent (× button) — hides from ALL games until toggled back ──
function toggleAbsent(name) {
  if (absent.has(name)) {
    absent.delete(name); // un-mark: student is back
  } else {
    absent.add(name);
    if (lastWinner === name) lastWinner = null;
  }
  renderNameList();
  drawWheel();
  updateUI();
  if (groups.length) {
    renderGroups();
    updateGroupBanner();
  }
  saveGroupState();
}

// ── Name list ──
function renderNameList() {
  const el = document.getElementById("nameList"),
    label = document.getElementById("nameListLabel");
  if (!activeId || !allNames.length) {
    el.innerHTML =
      '<p class="hint">No students yet — add names above</p>';
    label.textContent = "";
    return;
  }
  const boys = allNames.filter(
    (s) => s.g === "boy" && !absent.has(s.n),
  ).length;
  const girls = allNames.filter(
    (s) => s.g === "girl" && !absent.has(s.n),
  ).length;
  const absentCount = absent.size;
  let info = `${boys} ♂ · ${girls} ♀`;
  if (absentCount) info += ` · ${absentCount} absent`;
  label.textContent =
    info + " — ♂/♀ gender · ✏ edit · × absent (click again to restore)";
  el.innerHTML = allNames
    .map((s) => {
      const isWinner = s.n === lastWinner;
      const isAbsent = absent.has(s.n);
      const gCls = s.g === "boy" ? "boy" : s.g === "girl" ? "girl" : "";
      const cls = [
        "name-tag",
        gCls,
        isWinner ? "winner" : "",
        isAbsent ? "absent" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const gLabel = s.g === "boy" ? "♂" : s.g === "girl" ? "♀" : "?";
      return `<div class="${cls}" data-name="${esc(s.n)}" style="${isAbsent ? "opacity:0.4;text-decoration:line-through;" : ""}">
  <span>${esc(s.n)}</span>
  <button class="tag-btn" onclick="toggleStudentGender('${s.n.replace(/'/g, "\\'")}') " title="Change gender">${gLabel}</button>
  <button class="tag-btn" onclick="openEdit('${s.n.replace(/'/g, "\\'")}') " title="Edit name">✏</button>
  <button class="tag-btn tag-remove-btn" onclick="toggleAbsent('${s.n.replace(/'/g, "\\'")}') " title="${isAbsent ? "Restore (mark present)" : "Mark absent — removes from all games"}">
    ${isAbsent ? "↩" : "×"}
  </button>
</div>`;
    })
    .join("");
}

function updateUI() {
  const rem = getRemaining(alternateMode ? nextTurn : null),
    btn = document.getElementById("spinBtn");
  btn.disabled = rem.length < 1 || spinning;
  updateModeBar();
  document.getElementById("skipBtn").disabled = spinning || !activeId;
  if (
    !groupMode &&
    getRemaining().length === 0 &&
    allNames.length > 0 &&
    !spinning
  )
    document.getElementById("resultBox").textContent =
      "Everyone picked! Hit reset.";
}

// ── Draw wheel ──
function drawWheel() {
  const spinPool = getRemaining(alternateMode ? nextTurn : null),
    n = spinPool.length;
  ctx.clearRect(0, 0, 300, 300);
  if (n === 0) {
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, TAU);
    ctx.fillStyle = "#E1F5EE";
    ctx.fill();
    ctx.strokeStyle = "#9FE1CB";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#0F6E56";
    ctx.font = "500 14px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("All done!", CX, CY + 5);
    drawCenterButtons(false);
    return;
  }
  const slice = TAU / n;
  spinPool.forEach((student, i) => {
    const isWinner = student.n === lastWinner;
    let bg, fg;
    if (isWinner) {
      bg = "#FFF3CD";
      fg = "#7A4F01";
    } else if (student.g === "boy") {
      const c = BOY_COLORS[i % BOY_COLORS.length];
      bg = c[0];
      fg = c[1];
    } else if (student.g === "girl") {
      const c = GIRL_COLORS[i % GIRL_COLORS.length];
      bg = c[0];
      fg = c[1];
    } else {
      const c = NEUTRAL_COLORS[i % NEUTRAL_COLORS.length];
      bg = c[0];
      fg = c[1];
    }
    const start = angle + i * slice,
      end = start + slice;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, start, end);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = isWinner ? "#F0B429" : fg;
    ctx.lineWidth = isWinner ? 3 : 2;
    ctx.stroke();
    const mid = start + slice / 2;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(mid);
    ctx.textAlign = "right";
    const fs = n > 8 ? 11 : n > 5 ? 13 : 14;
    ctx.font = `${isWinner ? "700" : "500"} ${fs}px system-ui,sans-serif`;
    ctx.fillStyle = isWinner ? "#7A4F01" : fg;
    ctx.fillText(
      student.n.length > 14 ? student.n.slice(0, 13) + "…" : student.n,
      R - 8,
      5,
    );
    ctx.restore();
  });
  drawCenterButtons(true);
}

// Draw the two centre hub buttons
function drawCenterButtons(hasStudents) {
  const hubR = 28;
  // Outer ring
  ctx.beginPath();
  ctx.arc(CX, CY, hubR, 0, TAU);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!hasStudents) return;
  // Top half = Spin button (▶)
  ctx.beginPath();
  ctx.moveTo(CX, CY);
  ctx.arc(CX, CY, hubR, -Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#534AB7";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("▶", CX, CY - 6);
  // Bottom half = Remove winner (✕)
  ctx.beginPath();
  ctx.moveTo(CX, CY);
  ctx.arc(CX, CY, hubR, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = lastWinner ? "#E5534B" : "#ccc";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✕", CX, CY + 14);
  // Divider line
  ctx.beginPath();
  ctx.moveTo(CX - hubR, CY);
  ctx.lineTo(CX + hubR, CY);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ── Canvas click: detect slice click OR centre button ──
canvas.addEventListener("click", function (e) {
  if (spinning) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left,
    my = e.clientY - rect.top;
  const dx = mx - CX,
    dy = my - CY,
    dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= 28) {
    // Centre hub
    if (my < CY) {
      spin();
    } // top half = spin
    else {
      removeWinner();
    } // bottom half = remove winner
    return;
  }
  if (dist > R) return;
  // Which slice?
  const spinPool = getRemaining(alternateMode ? nextTurn : null),
    n = spinPool.length;
  if (!n) return;
  const slice = TAU / n;
  let clickAngle = Math.atan2(dy, dx);
  clickAngle = normaliseAngle(clickAngle - angle);
  const idx = Math.floor(clickAngle / slice) % n;
  const student = spinPool[idx];
  if (student) confirmRemoveFromWheel(student.n);
});

// Tooltip on hover
canvas.addEventListener("mousemove", function (e) {
  if (spinning) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left,
    my = e.clientY - rect.top;
  const dx = mx - CX,
    dy = my - CY,
    dist = Math.sqrt(dx * dx + dy * dy);
  const tip = document.getElementById("wheelTooltip");
  if (dist <= 28) {
    tip.style.display = "block";
    tip.style.left = mx + "px";
    tip.style.top = my + "px";
    tip.textContent =
      my < CY ? "Click to spin" : "Click to remove winner";
    return;
  }
  if (dist > R) {
    tip.style.display = "none";
    return;
  }
  const spinPool = getRemaining(alternateMode ? nextTurn : null),
    n = spinPool.length;
  if (!n) {
    tip.style.display = "none";
    return;
  }
  const slice = TAU / n;
  let clickAngle = normaliseAngle(Math.atan2(dy, dx) - angle);
  const idx = Math.floor(clickAngle / slice) % n;
  const student = spinPool[idx];
  if (student) {
    tip.style.display = "block";
    tip.style.left = mx + "px";
    tip.style.top = my + "px";
    tip.textContent = "Click to remove " + student.n;
  } else {
    tip.style.display = "none";
  }
});
canvas.addEventListener("mouseleave", () => {
  document.getElementById("wheelTooltip").style.display = "none";
});

let pendingRemove = null;
function confirmRemoveFromWheel(name) {
  if (pendingRemove === name) {
    if (groupMode && groups.length) {
      if (!groupRemovedMap[currentGroupIdx])
        groupRemovedMap[currentGroupIdx] = new Set();
      groupRemovedMap[currentGroupIdx].add(name);
      if (groupLastWinner[currentGroupIdx] === name)
        groupLastWinner[currentGroupIdx] = null;
      saveGroupState();
      renderGroups();
    } else sessionRemoved.add(name);
    if (lastWinner === name) lastWinner = null;
    pendingRemove = null;
    renderNameList();
    drawWheel();
    updateUI();
  } else {
    pendingRemove = name;
    document.getElementById("resultBox").textContent =
      `Remove ${name}? Click again to confirm.`;
    setTimeout(() => {
      if (pendingRemove === name) {
        pendingRemove = null;
        document.getElementById("resultBox").textContent = lastWinner
          ? `🎉 ${lastWinner}! (click their name to remove)`
          : "Ready to spin!";
      }
    }, 2500);
  }
}

function removeWinner() {
  if (!lastWinner) {
    document.getElementById("resultBox").textContent =
      "No winner to remove yet.";
    return;
  }
  if (groupMode && groups.length > 0) {
    if (!groupRemovedMap[currentGroupIdx])
      groupRemovedMap[currentGroupIdx] = new Set();
    groupRemovedMap[currentGroupIdx].add(lastWinner);
    groupLastWinner[currentGroupIdx] = null;
    lastWinner = null;
    saveGroupState();
    renderNameList();
    drawWheel();
    updateUI();
    advanceGroup();
  } else {
    sessionRemoved.add(lastWinner);
    lastWinner = null;
    renderNameList();
    drawWheel();
    updateUI();
    document.getElementById("resultBox").textContent =
      "Removed! Ready to spin again.";
  }
}

// ── Spin ──
function spin() {
  if (groupMode && groups.length > 0) {
    spinGroup();
    return;
  }
  const spinPool = getRemaining(alternateMode ? nextTurn : null);
  if (spinning || spinPool.length === 0) return;
  doSpin(spinPool, (winner) => {
    lastWinner = winner.n;
    drawWheel();
    if (alternateMode) nextTurn = nextTurn === "boy" ? "girl" : "boy";
    const tl =
      winner.g === "boy" ? "♂ " : winner.g === "girl" ? "♀ " : "";
    document.getElementById("resultBox").textContent =
      `🎉 ${tl}${winner.n}! (click name or ✕ to remove)`;
    renderNameList();
    updateUI();
  });
}

function spinGroup() {
  const spinPool = getRemaining();
  if (spinning) return;
  if (spinPool.length === 0) {
    // This group is exhausted, skip to next
    advanceGroup();
    return;
  }
  doSpin(spinPool, (winner) => {
    lastWinner = winner.n;
    groupLastWinner[currentGroupIdx] = winner.n;
    saveGroupState();
    drawWheel();
    const grpName = groups[currentGroupIdx].name;
    const tl =
      winner.g === "boy" ? "♂ " : winner.g === "girl" ? "♀ " : "";
    document.getElementById("resultBox").textContent =
      `🎉 ${grpName}: ${tl}${winner.n}! (hit ✕ to remove & next group)`;
    renderNameList();
    updateUI();
  });
}

function advanceGroup() {
  const n = groups.length;
  // Find the next group (after the current one) that still has someone present and not removed
  let next = -1;
  for (let k = 1; k <= n; k++) {
    const gi = (currentGroupIdx + k) % n;
    if (groupRemainingCount(gi) > 0) {
      next = gi;
      break;
    }
  }
  if (next === -1) {
    lastWinner = null;
    saveGroupState();
    updateGroupBanner();
    renderGroups();
    renderNameList();
    drawWheel();
    updateUI();
    document.getElementById("resultBox").textContent =
      genderFilter
        ? `No ${genderFilter === "boy" ? "boys" : "girls"} left in any group — switch the filter or Reset.`
        : "All groups are done! Hit Reset.";
    return;
  }
  currentGroupIdx = next;
  lastWinner = groupLastWinner[next] || null;
  saveGroupState();
  updateGroupBanner();
  renderGroups();
  renderNameList();
  drawWheel();
  updateUI();
  document.getElementById("resultBox").textContent =
    `${groups[next].name}'s turn — hit Spin!`;
}

function doSpin(spinPool, onDone) {
  spinning = true;
  document.getElementById("spinBtn").disabled = true;
  document.getElementById("skipBtn").disabled = true;
  document.getElementById("resultBox").textContent = "🎲 Spinning…";
  const n = spinPool.length,
    sliceSize = TAU / n,
    winnerIdx = Math.floor(Math.random() * n);
  const targetAngle =
    POINTER_ANGLE - winnerIdx * sliceSize - sliceSize / 2;
  const curNorm = normaliseAngle(angle),
    tgtNorm = normaliseAngle(targetAngle);
  let fwd = tgtNorm - curNorm;
  if (fwd < 0.001) fwd += TAU;
  const extraSpins = TAU * (5 + Math.floor(Math.random() * 4)),
    totalRotation = extraSpins + fwd,
    startAngle = angle;
  let startTime = null;
  const duration = 3500 + Math.random() * 1000;
  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function frame(ts) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    angle = startAngle + ease(progress) * totalRotation;
    if (progress < 1) {
      drawWheel();
      animId = requestAnimationFrame(frame);
    } else {
      angle = normaliseAngle(startAngle + totalRotation);
      spinning = false;
      onDone(spinPool[winnerIdx]);
    }
  }
  animId = requestAnimationFrame(frame);
}

function resetWheel() {
  if (animId) cancelAnimationFrame(animId);
  spinning = false;
  angle = 0;
  sessionRemoved = new Set();
  lastWinner = null;
  nextTurn = "boy";
  pendingRemove = null;
  if (groupMode && groups.length) saveGroupState();
  // absent stays — they are still absent regardless of reset
  if (groupMode && groups.length > 0) {
    currentGroupIdx = 0;
    groupRemovedMap = {};
    groupLastWinner = {};
    saveGroupState();
    updateGroupBanner();
    renderGroups();
    document.getElementById("resultBox").textContent =
      `Group spin reset! ${groups[0].name} goes first.`;
  } else {
    document.getElementById("resultBox").textContent = allNames.length
      ? "Ready to spin!"
      : "Add students to spin!";
  }
  updateModeBar();
  renderNameList();
  drawWheel();
  updateUI();
}

// ── Groups ──
function autoSplit() {
  if (!activeId || !allNames.length) return;
  const count = Math.max(
    2,
    Math.min(
      10,
      parseInt(document.getElementById("groupCount").value) || 2,
    ),
  );
  const shuffled = [...allNames].sort(() => Math.random() - 0.5);
  groups = [];
  for (let i = 0; i < count; i++)
    groups.push({ name: `Group ${i + 1}`, members: [] });
  shuffled.forEach((s, i) => groups[i % count].members.push({ ...s }));
  // Enable group mode
  currentGroupIdx = 0;
  groupRemovedMap = {};
  groupLastWinner = {};
  applyMode("group");
  nextTurn = "boy";
  lastWinner = null;
  saveGroupState();
  renderGroups();
  updateGroupBanner();
  drawWheel();
  updateUI();
  document.getElementById("resultBox").textContent =
    `Group spin mode on! ${groups[0].name} goes first.`;
}
function clearGroups() {
  groups = [];
  currentGroupIdx = 0;
  groupRemovedMap = {};
  groupLastWinner = {};
  applyMode(turnMode === "group" ? "all" : turnMode);
  lastWinner = null;
  clearGroupState();
  renderGroups();
  updateGroupBanner();
  drawWheel();
  updateUI();
  document.getElementById("resultBox").textContent = allNames.length
    ? "Ready to spin!"
    : "Add students to spin!";
}

function updateGroupBanner() {
  const banner = document.getElementById("groupTurnBanner");
  if (!groupMode || !groups.length) {
    banner.style.display = "none";
    return;
  }
  const grp = groups[currentGroupIdx];
  const grpRemoved = groupRemovedMap[currentGroupIdx] || new Set();
  const remaining = grp.members.filter(
    (s) => !absent.has(s.n) && !grpRemoved.has(s.n),
  ).length;
  banner.style.display = "";
  banner.className = `group-banner-${currentGroupIdx % 5}`;
  banner.textContent = `🎯 ${grp.name}'s turn — ${remaining} student${remaining !== 1 ? "s" : ""} remaining`;
}

function renderGroups() {
  const section = document.getElementById("groupsSection"),
    el = document.getElementById("groupList");
  if (!activeId) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";
  if (!groups.length) {
    el.innerHTML =
      '<p style="font-size:12px;color:#888;">No groups yet — click Auto split</p>';
    return;
  }
  el.innerHTML = groups
    .map((g, gi) => {
      const visibleMembers = g.members.filter((s) => !absent.has(s.n));
      return `
<div class="group-card${groupMode && gi === currentGroupIdx ? " active-group" : ""}">
  <div class="group-card-title">
    <span>${esc(g.name)}${groupMode && gi === currentGroupIdx ? " 🎯" : ""}</span>
    <span style="font-size:11px;color:#aaa;">${visibleMembers.length} present</span>
  </div>
  <div class="group-drop-zone" data-group="${gi}"
    ondragover="dragOver(event,${gi})" ondragleave="dragLeave(event)" ondrop="dropInto(event,${gi})">
    ${visibleMembers
      .map(
        (s) => `
      <div class="group-chip ${s.g === "boy" ? "boy" : s.g === "girl" ? "girl" : ""}"
        draggable="true"
        ondragstart="dragStart(event,'${s.n.replace(/'/g, "\\'")}',${gi})"
        ondragend="dragEnd(event)">
        ${s.g === "boy" ? "♂" : s.g === "girl" ? "♀" : ""}${esc(s.n)}
      </div>`,
      )
      .join("")}
    ${visibleMembers.length === 0 ? '<span style="font-size:11px;color:#bbb;padding:4px;">No students present</span>' : ""}
  </div>
</div>`;
    })
    .join("");
}

// Drag & drop
function dragStart(e, name, fromGroup) {
  dragName = name;
  dragFromGroup = fromGroup;
  setTimeout(() => {
    const el = e.target;
    if (el) el.classList.add("dragging");
  }, 0);
}
function dragEnd(e) {
  dragName = null;
  dragFromGroup = null;
  document
    .querySelectorAll(".group-chip.dragging")
    .forEach((el) => el.classList.remove("dragging"));
}
function dragOver(e, toGroup) {
  e.preventDefault();
  document
    .querySelectorAll(".group-drop-zone")
    .forEach((z) => z.classList.remove("drag-over"));
  e.currentTarget.classList.add("drag-over");
}
function dragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}
function dropInto(e, toGroup) {
  e.currentTarget.classList.remove("drag-over");
  if (
    dragName === null ||
    dragFromGroup === null ||
    dragFromGroup === toGroup
  )
    return;
  const fromG = groups[dragFromGroup],
    toG = groups[toGroup];
  const idx = fromG.members.findIndex((s) => s.n === dragName);
  if (idx === -1) return;
  const [student] = fromG.members.splice(idx, 1);
  toG.members.push(student);
  saveGroupState();
  renderGroups();
}

// ── Events ──
document
  .getElementById("bulkModal")
  .addEventListener("click", function (e) {
    if (e.target === this) closeBulk();
  });
document
  .getElementById("editModal")
  .addEventListener("click", function (e) {
    if (e.target === this) closeEdit();
  });
document
  .getElementById("editNameInput")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmEdit();
  });
document.getElementById("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addName();
});
document
  .getElementById("newClassName")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter") createClass();
  });
document.addEventListener("click", (e) => {
  if (!e.target.closest(".name-tag"))
    document
      .querySelectorAll(".name-tag.confirm-remove")
      .forEach((t) => t.classList.remove("confirm-remove"));
});

// ── Boot ──
renderSidebar();
if (activeId && classes[activeId]) selectClass(activeId);
else {
  const ids = Object.keys(classes);
  if (ids.length) selectClass(ids[0]);
}