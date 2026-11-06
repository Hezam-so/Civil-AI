/* UI for the Civil AI concrete material estimator. Depends on concrete-mix-core.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const core = window.CivilMixCore;
  const rows = [];
  let lastResult = null;
  const isEnglish = () => document.documentElement.lang === "en";
  const tr = (ar, en) => isEnglish() ? en : ar;
  const n = x => Number(x).toLocaleString("en-US", { maximumFractionDigits: 3 });
  const val = id => Number($(id).value);
  const units = {
    chemical: [["pct_binder","% من وزن الرابط","% of binder mass"],["kg_m3","كجم/م³","kg/m³"],["l_m3","لتر/م³","L/m³"]],
    mineral: [["replace_pct","% استبدال من الرابط الأصلي","% original binder replacement"],["kg_m3","كجم/م³ مضافة","kg/m³ added"]],
    fiber: [["kg_m3","كجم/م³","kg/m³"],["vol_pct","% من حجم الخرسانة","% concrete volume"]]
  };
  const textInput = (label, value, min, max, step, onChange, cls = "") => {
    const outer = document.createElement("label");
    outer.className = "cm-inline " + cls;
    const title = document.createElement("span"); title.textContent = label;
    const inp = document.createElement("input");
    inp.type = "number"; inp.min = String(min); inp.max = String(max); inp.step = String(step); inp.value = value;
    inp.addEventListener("input", () => onChange(inp.value));
    outer.append(title, inp);
    return outer;
  };
  function redrawCatalog() {
    const category = $("cmCategory").value;
    const current = $("cmMaterial").value;
    $("cmCategory").querySelectorAll("option").forEach(op => {
      op.textContent = op.dataset[isEnglish() ? "en" : "ar"];
    });
    $("cmMaterial").replaceChildren(...core.catalog[category].map(item => {
      const opt = document.createElement("option"); opt.value = item.id; opt.textContent = isEnglish() ? item.en : item.ar; return opt;
    }));
    if (core.catalog[category].some(x => x.id === current)) $("cmMaterial").value = current;
    const currentItem = core.catalog[category].find(x => x.id === $("cmMaterial").value);
    $("cmPurpose").textContent = currentItem ? tr(currentItem.why, currentItem.whyEn) : "";
  }
  function drawRows() {
    const host = $("cmItems");
    host.replaceChildren();
    for (const row of rows) {
      const item = core.catalog[row.group].find(x => x.id === row.id);
      const wrap = document.createElement("div"); wrap.className = "cm-item";
      const head = document.createElement("div"); head.className = "cm-item-head";
      const info = document.createElement("div");
      const strong = document.createElement("strong"); strong.textContent = tr(item.ar, item.en);
      const desc = document.createElement("small"); desc.textContent = tr(item.why, item.whyEn);
      info.append(strong, desc);
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "outline small cm-remove";
      remove.textContent = tr("حذف", "Remove");
      remove.onclick = () => { rows.splice(rows.indexOf(row), 1); drawRows(); };
      head.append(info, remove); wrap.append(head);
      const controls = document.createElement("div"); controls.className = "cm-row-controls";
      controls.append(textInput(tr("الجرعة", "Dosage"), row.dose, 0, 10000, "any", v => { row.dose = v; }));
      const unitField = document.createElement("label"); unitField.className = "cm-inline";
      const unitTitle = document.createElement("span"); unitTitle.textContent = tr("وحدة الجرعة", "Dosage unit");
      const unitSelect = document.createElement("select");
      units[row.group].filter(u => !(u[0] === "replace_pct" && !item.binder)).forEach(([value, ar, en]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = tr(ar, en);
        unitSelect.append(option);
      });
      unitSelect.value = row.unit; unitSelect.onchange = () => { row.unit = unitSelect.value; };
      unitField.append(unitTitle, unitSelect); controls.append(unitField);
      controls.append(textInput(tr(row.group === "chemical" ? "كثافة المنتج (كجم/لتر)" : "كثافة المادة (كجم/م³)", row.group === "chemical" ? "Product density (kg/L)" : "Material density (kg/m³)"), row.density, 0.01, 15000, "any", v => { row.density = v; }));
      if (row.group === "fiber") {
        controls.append(textInput(tr("طول الليف (مم) اختياري", "Fiber length (mm) optional"), row.lengthMm, 0, 1000, "any", v => { row.lengthMm = v; }));
        controls.append(textInput(tr("قطر الليف (مم) اختياري", "Fiber diameter (mm) optional"), row.diameterMm, 0, 100, "any", v => { row.diameterMm = v; }));
      }
      wrap.append(controls);
      host.append(wrap);
    }
    $("cmNoAdditions").hidden = !!rows.length;
    $("cmAddedCount").textContent = String(rows.length);
  }
  function addRow() {
    if (rows.length >= 30) { alert(tr("الحد الأقصى 30 إضافة", "Maximum 30 admixtures")); return; }
    const group = $("cmCategory").value, id = $("cmMaterial").value;
    if (rows.some(r => r.group === group && r.id === id)) {
      alert(tr("المادة موجودة بالفعل، عدّل جرعتها من القائمة", "Already selected; edit its dosage instead")); return;
    }
    const item = core.catalog[group].find(x => x.id === id); if (!item) return;
    rows.push({ group, id, dose: "", unit: group === "chemical" ? "pct_binder" : group === "fiber" ? "kg_m3" : item.binder ? "replace_pct" : "kg_m3", density: item.density, lengthMm: "", diameterMm: "" });
    drawRows();
  }
  function makeCell(text, tag = "td") {
    const c = document.createElement(tag); c.textContent = text; return c;
  }
  function makeMetricRow(item, r) {
    const line = document.createElement("tr");
    const m3 = item.mass, grossMass = m3 * r.volume;
    let name = tr(item.ar, item.en);
    if (item.group === "fiber" && (item.lengthMm || item.diameterMm)) {
      name += " (" + [item.lengthMm ? n(item.lengthMm) + " mm L" : "", item.diameterMm ? n(item.diameterMm) + " mm Ø" : ""].filter(Boolean).join(", ") + ")";
    }
    const nameEl = document.createElement("td");
    const title = document.createElement("strong"); title.textContent = name;
    const small = document.createElement("small"); small.textContent = tr(item.why, item.whyEn);
    nameEl.append(title, small);
    const unit = item.id === "water" ? "L" : "kg";
    line.append(nameEl, makeCell(n(item.id === "water" ? m3 : m3) + " " + unit),
      makeCell(n(grossMass) + " " + unit));
    const extra = [];
    if (item.id === "cement") extra.push(tr("أكياس", "bags") + " " + n(r.bags));
    if (item.looseM3 !== undefined) extra.push(tr("حجم شراء تقريبي", "approx. bulk volume") + ": " + n(item.looseM3 * r.volume) + " m³");
    if (item.group) extra.push(tr("الحجم المطلق", "absolute volume") + ": " + n(item.vol * r.volume * 1000) + " L");
    if (extra.length) {
      const bottom = document.createElement("small"); bottom.className = "cm-line-extra"; bottom.textContent = extra.join(" · ");
      nameEl.append(bottom);
    }
    return line;
  }
  function render(r) {
    lastResult = r;
    const host = $("cmResults"); host.replaceChildren();
    const table = document.createElement("table"); table.className = "cm-table";
    const thead = document.createElement("thead"); const header = document.createElement("tr");
    [tr("المادة ووظيفتها", "Material & purpose"),tr("لكل 1 م³", "Per 1 m³"),tr("الإجمالي مع الهدر", "Total incl. waste")].forEach(s => header.append(makeCell(s,"th")));
    thead.append(header); table.append(thead);
    const body = document.createElement("tbody");
    [...r.base, ...r.additions].forEach(item => body.append(makeMetricRow(item, r)));
    table.append(body); host.append(table);
    $("cmMixNote").textContent =
      tr("إجمالي الحجم المطلوب: ", "Required concrete: ") + n(r.volume) + " m³ · " +
      tr("كثافة الخرسانة التقديرية: ", "Estimated fresh concrete density: ") + n(r.estimatedDensity) + " kg/m³ · " +
      tr("الهواء المفترض: ", "Assumed air: ") + n(r.air) + "%";
    $("cmError").hidden = true;
  }
  function error(message) {
    $("cmResults").replaceChildren();
    $("cmError").hidden = false;
    $("cmError").textContent = message;
    $("cmMixNote").textContent = "";
    lastResult = null;
  }
  function calculate(volume) {
    try {
      const r = core.calculate({
        volume, binder: val("cmBinder"), wb: val("cmWB"), gravel: val("cmGravel"),
        air: val("cmAir"), cementDensity: val("cmCementDensity"),
        sandDensity: val("cmSandDensity"), gravelDensity: val("cmGravelDensity"),
        bulkSand: val("cmBulkSand"), bulkGravel: val("cmBulkGravel"),
        bagKg: val("cmBagKg"), enabled: $("cmEnabled").checked,
        additives: rows.map(x => ({ ...x }))
      });
      render(r);
      return { method: "absolute-volume-ssd", binderKgM3: r.binder, waterBinderRatio: val("cmWB"),
        approximateConcreteDensity: r.estimatedDensity, bagKg: r.bagKg,
        materials: [...r.base,...r.additions].map(x => ({
          name: x.ar, en: x.en, purpose: x.why, massKgM3: x.mass,
          totalKg: x.mass * r.volume, absoluteVolumeM3: x.vol * r.volume,
          ...((x.looseM3 !== undefined) ? { bulkVolumeM3: x.looseM3 * r.volume } : {}),
          ...((x.group) ? { category: x.group, dosage: x.dose, dosageUnit: x.unit, density: x.density, lengthMm: x.lengthMm, diameterMm: x.diameterMm } : {})
        })) };
    } catch (e) {
      error(e.message);
      return null;
    }
  }
  function syncLanguage() {
    document.querySelectorAll("[data-mix-ar]").forEach(el => {
      el.textContent = el.getAttribute("data-mix-" + (isEnglish() ? "en" : "ar"));
    });
    redrawCatalog(); drawRows(); if (lastResult) render(lastResult);
  }
  function toggleInputs() {
    const manual = $("cAreaMode").value === "direct";
    $("cmDirectArea").hidden = !manual;
    for (const id of ["cLength","cWidth"]) {
      const input = $(id); input.hidden = manual; if (input.previousElementSibling) input.previousElementSibling.hidden = manual;
    }
  }
  $("cAreaMode").addEventListener("change", toggleInputs);
  $("cmEnabled").addEventListener("change", () => { $("cmOptional").hidden = !$("cmEnabled").checked; });
  $("cmCategory").addEventListener("change", redrawCatalog);
  $("cmMaterial").addEventListener("change", redrawCatalog);
  $("cmAdd").addEventListener("click", addRow);
  toggleInputs(); redrawCatalog(); drawRows();
  $("cmOptional").hidden = true;
  window.CivilConcreteMix = { calculate, syncLanguage };
})();