const state = {
  title: "M3-2025秋 アレンジ案",
  bpm: 128,
  meter: "4/4",
  bars: 64,
  barWidthPx: 40, // 1小節の横幅（px）
  tracks: [
    { id: "t1", name: "Drums" },
    { id: "t2", name: "Bass" },
    { id: "t3", name: "Synth" },
    { id: "t4", name: "Vox" }
  ],
  regions: []
};

const $timeline = document.getElementById("timeline");
const $bpm = document.getElementById("bpm");
const $meter = document.getElementById("meter");
const $bars = document.getElementById("bars");
const $applyGrid = document.getElementById("applyGrid");
const $export = document.getElementById("exportJson");
const $import = document.getElementById("importJson");
const $dialog = document.getElementById("regionDialog");
const $form = document.getElementById("regionForm");
const $addTrack = document.getElementById("addTrack");
const $cancelAdd = document.getElementById("cancelAdd");

// 追加：キャンセルは何もせず閉じる
$cancelAdd.addEventListener("click", () => {
  $dialog.close("cancel");
});

function render() {
  $timeline.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "timeline-grid";
  wrap.style.setProperty("--bars", state.bars);
  wrap.style.setProperty("--barWidth", state.barWidthPx + "px");

  // Ruler head
  const head = document.createElement("div");
  head.style.width = "180px";
  wrap.appendChild(head);

  // Ruler
  const ruler = document.createElement("div");
  ruler.className = "ruler";
  ruler.style.setProperty("--bars", state.bars);
  ruler.style.setProperty("--barWidth", state.barWidthPx + "px");
  for (let i = 1; i <= state.bars; i++) {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.textContent = i;
    ruler.appendChild(bar);
  }
  wrap.appendChild(ruler);

  // Tracks
  state.tracks.forEach((t) => {
    const track = document.createElement("div");
    track.className = "track";

    const name = document.createElement("div");
    name.className = "name";

    const no = document.createElement("div");
    no.className = "no";
    no.textContent = (state.tracks.indexOf(t) + 1); // 1始まり

    const span = document.createElement("span");
    span.textContent = t.name;
    span.title = "ダブルクリックでリネーム";
    span.addEventListener("dblclick", () => {
      const next = prompt("トラック名を変更", t.name);
      if (next && next.trim()) { t.name = next.trim(); render(); }
    });

    const plus = document.createElement("button");
    plus.className = "icon-btn";
    plus.textContent = "+";
    plus.title = "このトラックにリージョン追加";
    plus.addEventListener("click", () => openAddDialog(t.id));

    name.appendChild(no);
    name.appendChild(span);
    name.appendChild(plus);

    const lane = document.createElement("div");
    lane.className = "lane";
    lane.dataset.trackId = t.id;
    lane.style.setProperty("--bars", state.bars);
    lane.style.setProperty("--barWidth", state.barWidthPx + "px");

    // background bar cells (for snap feel)
    for (let i = 1; i <= state.bars; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.addEventListener("click", (e) => {
        const rect = lane.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const startBar = Math.max(1, Math.floor(x / state.barWidthPx) + 1);
        openAddDialog(t.id, startBar);
      });
      lane.appendChild(cell);
    }

    // regions for this track
    state.regions.filter(r => r.trackId === t.id).forEach(r => {
      const el = document.createElement("div");
      el.className = "region";
      el.dataset.id = r.id;
      el.style.left = ((r.startBar - 1) * state.barWidthPx) + "px";
      el.style.width = (r.lengthBars * state.barWidthPx) + "px";
      el.style.background = r.color || "#88c0d0";

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = r.label || "Region";
      el.appendChild(label);

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `@${r.startBar} +${r.lengthBars}`;
      el.appendChild(meta);

      // resize handles
      const hLeft = document.createElement("div");
      hLeft.className = "handle left";
      const hRight = document.createElement("div");
      hRight.className = "handle right";
      el.appendChild(hLeft); el.appendChild(hRight);

      makeDraggable(el, lane, r);
      lane.appendChild(el);
    });

    track.appendChild(name);
    track.appendChild(lane);
    $timeline.appendChild(track);
  });

  // Palette bindings (templates)
  document.querySelectorAll(".palette button[data-template]").forEach(btn => {
    btn.onclick = () => {
      const label = btn.dataset.template;
      const color = btn.dataset.color;
      // 直近のトラック先頭に4小節で置く
      const targetTrackId = state.tracks[0]?.id;
      if (!targetTrackId) return;
      addRegion({ trackId: targetTrackId, label, startBar: 1, lengthBars: 4, color });
    };
  });
}
function guid() { return Math.random().toString(36).slice(2, 10); }

function addRegion({ trackId, label, startBar, lengthBars, color, type="section" }) {
  state.regions.push({
    id: guid(), trackId, label, startBar, lengthBars, color, type
  });
  render();
}

function openAddDialog(trackId, startBar = 1) {
  $form.reset();
  $form.elements["startBar"].value = startBar;
  $dialog.returnValue = "";
  $dialog.showModal();

  // ここで毎回新しくハンドラを張り直す
  $form.onsubmit = (e) => {
    e.preventDefault();
    // キャンセルはここに来ないが、念のためガード
    if ($dialog.returnValue === "cancel") return;

    const label = $form.elements["label"].value || "Region";
    const startBar = parseInt($form.elements["startBar"].value, 10);
    const lengthBars = parseInt($form.elements["lengthBars"].value, 10);
    const color = $form.elements["color"].value;
    addRegion({ trackId, label, startBar, lengthBars, color });
    $dialog.close();
  };
}

function makeDraggable(el, lane, region) {
  const laneRect = () => lane.getBoundingClientRect();
  const startX = { v: 0 }, startLeft = { v: 0 }, startW = { v: 0 }, mode = { v: "move" };

  const onDown = (e) => {
    const target = e.target;
    mode.v = target.classList.contains("left") ? "resize-left"
            : target.classList.contains("right") ? "resize-right" : "move";
    startX.v = e.clientX;
    startLeft.v = parseInt(el.style.left, 10);
    startW.v = parseInt(el.style.width, 10);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  el.addEventListener("mousedown", onDown);

  function snap(px) {
    const bars = Math.round(px / state.barWidthPx);
    return bars * state.barWidthPx;
  }
  function onMove(e) {
    const dx = e.clientX - startX.v;
    if (mode.v === "move") {
      const newLeft = Math.max(0, startLeft.v + dx);
      el.style.left = snap(newLeft) + "px";
    } else if (mode.v === "resize-left") {
      const newLeft = Math.max(0, startLeft.v + dx);
      const snapped = snap(newLeft);
      const delta = startLeft.v - snapped;
      el.style.left = snapped + "px";
      el.style.width = Math.max(state.barWidthPx, startW.v + delta) + "px";
    } else {
      const newW = Math.max(state.barWidthPx, startW.v + dx);
      el.style.width = snap(newW) + "px";
    }
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    // commit to state
    const leftPx = parseInt(el.style.left, 10);
    const wPx = parseInt(el.style.width, 10);
    region.startBar = Math.floor(leftPx / state.barWidthPx) + 1;
    region.lengthBars = Math.max(1, Math.floor(wPx / state.barWidthPx));
    el.querySelector(".meta").textContent = `@${region.startBar} +${region.lengthBars}`;
  }
}

// IO
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
    e.preventDefault(); exportJson(); return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
    e.preventDefault(); document.getElementById("importJson").click(); return;
  }
  if (e.key.toLowerCase() === "a") { // quick add to first track
    const label = prompt("ラベル", "Idea");
    if (!label) return;
    addRegion({ trackId: state.tracks[0].id, label, startBar: 1, lengthBars: 4, color: "#88c0d0" });
  }
});

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vibe-music-receipt.json";
  a.click();
}

$export.addEventListener("click", exportJson);
$import.addEventListener("change", async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    Object.assign(state, data);
    $bpm.value = state.bpm; $meter.value = state.meter; $bars.value = state.bars;
    render();
  } catch { alert("JSONの読み込みに失敗しました"); }
});

$applyGrid.addEventListener("click", () => {
  state.bpm = parseInt($bpm.value, 10);
  state.meter = $meter.value;
  state.bars = parseInt($bars.value, 10);
  render();
});

document.querySelectorAll(".palette button[data-template]").forEach(()=>{}); // bound in render
$addTrack.addEventListener("click", () => {
  const name = prompt("トラック名", `Track ${state.tracks.length+1}`);
  if (!name) return;
  state.tracks.push({ id: "t" + (state.tracks.length+1), name });
  render();
});

// 初期描画
render();