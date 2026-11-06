/* Civil AI concrete mix material estimator — estimation only, SSD basis.
   Absolute-volume model per 1 m3 of fresh concrete, not a structural mix design.
   Densities and default mix inputs are illustrative and editable. */
(function (root) {
  "use strict";
  const C = (id, ar, en, why, whyEn) => ({ id, ar, en, why, whyEn, density: 1.05 });
  const M = (id, ar, en, why, whyEn, density, binder = true) => ({ id, ar, en, why, whyEn, density, binder });
  const F = (id, ar, en, why, whyEn, density) => ({ id, ar, en, why, whyEn, density });
  const catalog = {
    chemical: [
      C("plasticizer","ملدن","Plasticizer","تحسين التشغيلية وتقليل ماء الخلط","Improves workability and reduces mixing water"),
      C("superplasticizer","ملدن فائق","Superplasticizer","زيادة السيولة أو خفض الماء بشكل كبير","High-range water reduction or improved flow"),
      C("retarder","مبطئ شك","Set retarder","تأخير الشك عند النقل والصب في الحر","Delays setting in hot weather or long transport"),
      C("set-accelerator","مسرع شك","Set accelerator","تقصير زمن الشك","Shortens setting time"),
      C("strength-accelerator","مسرع مقاومة مبكرة","Early-strength accelerator","تسريع اكتساب المقاومة المبكرة","Accelerates early strength gain"),
      C("air-entrainer","حابس هواء","Air entrainer","تحسين مقاومة دورات التجمد والذوبان","Improves freeze–thaw resistance"),
      C("defoamer","مزيل هواء","Defoamer","تقليل الهواء غير المرغوب","Reduces unwanted air"),
      C("shrinkage-reducer","مخفض انكماش","Shrinkage reducer","تقليل انكماش الجفاف","Reduces drying shrinkage"),
      C("shrinkage-compensator","معوض انكماش","Shrinkage compensator","تقليل تأثير الانكماش بتمدد محسوب","Offsets shrinkage through controlled expansion"),
      C("corrosion-inhibitor","مثبط تآكل","Corrosion inhibitor","تقليل خطر تآكل التسليح","Helps reduce reinforcement corrosion risk"),
      C("permeability-reducer","مخفض نفاذية","Permeability reducer","تقليل انتقال الماء إلى الخرسانة","Reduces water ingress"),
      C("crystalline","إضافة بلورية","Crystalline admixture","تقليل النفاذية عبر نواتج بلورية","Helps block capillary water pathways"),
      C("vma","معدل لزوجة","Viscosity modifier","تحسين ثبات الخلطة وتقليل الانفصال","Improves stability and limits segregation"),
      C("anti-washout","مانع غسل","Anti-washout admixture","تقليل فقد المواد الناعمة تحت الماء","Limits washout during underwater placement"),
      C("hydration-stabilizer","مثبت إماهة","Hydration stabilizer","التحكم في استمرار تفاعل الأسمنت","Controls hydration during holding periods"),
      C("slump-retainer","محافظ على الهبوط","Slump retainer","الحفاظ على التشغيلية أثناء النقل","Retains workability in transit"),
      C("pumping-aid","مساعد ضخ","Pumping aid","تسهيل الضخ وتقليل الانسداد","Improves pumpability"),
      C("asr-inhibitor","مثبط التفاعل القلوي السيليكي","ASR inhibitor","تقليل تمدد التفاعل القلوي السيليكي","Reduces alkali–silica reaction expansion"),
      C("cold-weather","إضافة للطقس البارد","Cold-weather admixture","المساعدة على اكتساب المقاومة في البرد","Supports strength gain in cold conditions"),
      C("bonding","محسن التصاق","Bonding admixture","تحسين التصاق الخرسانة بالأسطح","Improves adhesion to suitable substrates"),
      C("bleed-reducer","مخفض نزف","Bleeding reducer","تقليل صعود الماء إلى السطح","Reduces surface bleeding"),
      C("water-repellent","طارد للماء","Water repellent","تقليل امتصاص الماء","Reduces water absorption"),
      C("foam-agent","عامل رغوي","Foaming agent","إنتاج خرسانة رغوية","Produces foamed concrete"),
      C("pigment","صبغة خرسانية","Concrete pigment","تلوين الخرسانة","Colors architectural concrete")
    ],
    mineral: [
      M("fly-ash","الرماد المتطاير","Fly ash","تحسين التشغيلية والمتانة في الخلطات المناسبة","Can improve workability and durability",2300),
      M("silica-fume","غبار السيليكا","Silica fume","زيادة المقاومة وتقليل النفاذية","Can increase strength and reduce permeability",2200),
      M("ggbfs","خبث الأفران المطحون","GGBFS","إحلال الأسمنت وتحسين المتانة","Replaces cement and improves durability",2900),
      M("metakaolin","الميتاكاؤولين","Metakaolin","تحسين البنية المجهرية وتقليل النفاذية","Refines microstructure and permeability",2600),
      M("natural-pozzolan","بوزولانا طبيعية","Natural pozzolan","إحلال جزء من الأسمنت وتحسين المتانة","Partial cement replacement and durability",2600),
      M("volcanic-ash","رماد بركاني","Volcanic ash","نشاط بوزولاني بعد اختبار الجودة","Pozzolanic replacement when quality is proven",2500),
      M("calcined-clay","طين مكلسن","Calcined clay","إحلال جزئي للأسمنت","Partial cement replacement",2600),
      M("limestone","مسحوق حجر جيري","Limestone powder","تحسين التعبئة الحبيبية","Improves particle packing",2700,false),
      M("quartz","مسحوق كوارتز","Quartz powder","ملء الفراغات الدقيقة","Fine particle packing",2650,false),
      M("nano-silica","نانو سيليكا","Nano silica","تحسين البنية المجهرية","Refines the cement paste microstructure",2200),
      M("rice-husk-ash","رماد قش الأرز","Rice husk ash","سيليكا بوزولانية بعد المعالجة","Pozzolanic silica when processed properly",2200),
      M("glass-powder","مسحوق زجاج","Ground glass powder","إحلال جزئي بعد فحص التفاعل القلوي","Potential replacement after ASR assessment",2500),
      M("marble-powder","مسحوق رخام","Marble powder","حشوة لتحسين التدرج","Fine mineral filler",2700,false),
      M("granite-powder","مسحوق جرانيت","Granite powder","حشوة دقيقة","Fine mineral filler",2700,false),
      M("expansive-mgo","أكسيد مغنيسيوم تمددي","Expansive MgO","تعويض انكماش بتمدد مضبوط","Controlled expansion to offset shrinkage",3500,false)
    ],
    fiber: [
      F("steel","ألياف فولاذية","Steel fibers","تحسين المتانة ومقاومة الصدمات وما بعد التشقق","Improves toughness, impact and post-cracking performance",7850),
      F("micro-pp","ألياف بولي بروبيلين دقيقة","Micro polypropylene fibers","تقليل تشققات الانكماش اللدن","Reduces plastic shrinkage cracking",910),
      F("macro-pp","ألياف بولي بروبيلين كبيرة","Macro polypropylene fibers","تحسين المتانة والتحكم في التشققات","Improves toughness and crack control",910),
      F("ar-glass","ألياف زجاج مقاومة للقلويات","AR glass fibers","تقوية العناصر الرقيقة","Reinforces thin elements",2700),
      F("basalt","ألياف بازلتية","Basalt fibers","تحسين الشد والانحناء في خلطات مناسبة","Can improve tensile and flexural behavior",2700),
      F("carbon","ألياف كربونية","Carbon fibers","تعزيز الخصائص الميكانيكية","Enhances specialty mechanical behavior",1800),
      F("pva","ألياف PVA","PVA fibers","التحكم في التشقق وزيادة المطيلية","Crack control and ductility",1300),
      F("natural","ألياف طبيعية معالجة","Treated natural fibers","تسليح موزع بعد معالجة الألياف","Distributed reinforcement when fibers are treated",1400)
    ]
  };
  const byGroup = Object.fromEntries(Object.entries(catalog).map(([group, values]) => [group, new Map(values.map(x => [x.id, x]))]));
  function requireRange(x, name, lo, hi, inclusiveZero = false) {
    if (!Number.isFinite(x) || (inclusiveZero ? x < lo : x <= lo) || x > hi) {
      throw Error(name + ": قيمة خارج النطاق المقبول");
    }
    return x;
  }
  function calculate(args) {
    const volume = requireRange(Number(args.volume), "الحجم", 0, 1e9);
    const binder = requireRange(Number(args.binder), "المواد الأسمنتية kg/m³", 0, 2000);
    const wb = requireRange(Number(args.wb), "نسبة الماء/الرابط", 0, 1.5);
    const gravel = requireRange(Number(args.gravel), "الحصى kg/m³", 0, 3500, true);
    const air = requireRange(Number(args.air), "الهواء %", 0, 40, true);
    const cementDensity = requireRange(Number(args.cementDensity), "كثافة الأسمنت", 100, 6000);
    const sandDensity = requireRange(Number(args.sandDensity), "كثافة حبيبات الرمل", 100, 6000);
    const gravelDensity = requireRange(Number(args.gravelDensity), "كثافة حبيبات الحصى", 100, 6000);
    const bulkSand = requireRange(Number(args.bulkSand), "الكثافة الحجمية للرمل", 100, 4000);
    const bulkGravel = requireRange(Number(args.bulkGravel), "الكثافة الحجمية للحصى", 100, 4000);
    const bagKg = requireRange(Number(args.bagKg), "وزن الكيس", 0, 200);
    const selected = args.enabled ? args.additives || [] : [];
    if (!Array.isArray(selected) || selected.length > 30) throw Error("الحد الأقصى 30 مادة إضافية");
    const additions = [];
    const ids = new Set();
    let replacement = 0, extraBinder = 0;
    for (const a of selected) {
      const item = byGroup[a.group]?.get(a.id);
      if (!item || ids.has(a.group + ":" + a.id)) throw Error("مادة مكررة أو غير معروفة");
      ids.add(a.group + ":" + a.id);
      const dose = requireRange(Number(a.dose), "جرعة " + item.ar, 0, 10000);
      let mass = 0, vol = 0;
      const density = requireRange(Number(a.density ?? item.density), "كثافة " + item.ar, 0, 15000);
      if (a.group === "mineral") {
        if (a.unit === "replace_pct") {
          if (!item.binder || dose > 100) throw Error("لا يمكن استبدال الأسمنت بهذه المادة أو بهذه النسبة");
          mass = binder * dose / 100;
          replacement += mass;
        } else if (a.unit === "kg_m3") {
          mass = dose;
          if (item.binder) extraBinder += mass;
        } else throw Error("وحدة غير صالحة للمادة المعدنية");
        vol = mass / density;
      } else if (a.group === "chemical") {
        if (a.unit === "pct_binder" && dose > 100) throw Error("جرعة كيميائية غير مقبولة");
        // Delayed until total binder is known, including mineral additions.
        if (!["pct_binder","kg_m3","l_m3"].includes(a.unit)) throw Error("وحدة كيميائية غير صحيحة");
      } else if (a.group === "fiber") {
        if (a.unit === "kg_m3") { mass = dose; vol = mass / density; }
        else if (a.unit === "vol_pct" && dose <= 100) { vol = dose / 100; mass = vol * density; }
        else throw Error("وحدة ألياف غير صحيحة");
      }
      additions.push({ group: a.group, id: a.id, ar: item.ar, en: item.en,
        why: item.why, whyEn: item.whyEn, dose, unit: a.unit, density, mass, vol,
        lengthMm: a.group === "fiber" ? Number(a.lengthMm) || 0 : 0,
        diameterMm: a.group === "fiber" ? Number(a.diameterMm) || 0 : 0 });
    }
    if (replacement > binder + 1e-9) throw Error("مجموع نسب استبدال الأسمنت تجاوز 100%");
    const cement = binder - replacement;
    const finalBinder = binder + extraBinder;
    for (const a of additions.filter(x => x.group === "chemical")) {
      if (a.unit === "pct_binder") a.mass = finalBinder * a.dose / 100;
      if (a.unit === "kg_m3") a.mass = a.dose;
      if (a.unit === "l_m3") a.mass = a.dose * a.density;
      a.vol = a.mass / (a.density * 1000); // density of liquid chemical, kg/L
    }
    const water = wb * finalBinder;
    const occupied = cement / cementDensity + water / 1000 + gravel / gravelDensity +
      air / 100 + additions.reduce((sum, x) => sum + x.vol, 0);
    const sandVol = 1 - occupied;
    if (sandVol <= 0.000001) throw Error("لا توجد مساحة حجمية كافية للرمل. راجع نسب الخلطة وكثافات المواد.");
    const sand = sandVol * sandDensity;
    const base = [
      { id: "cement", ar: "الأسمنت", en: "Cement", why: "المادة الرابطة", whyEn: "Hydraulic binder", mass: cement, vol: cement / cementDensity, unit: "kg" },
      { id: "sand", ar: "الرمل", en: "Fine aggregate", why: "ملء الفراغات وتكوين الهيكل الحبيبي", whyEn: "Fills voids and forms aggregate skeleton", mass: sand, vol: sandVol, unit: "kg", looseM3: sand / bulkSand },
      { id: "gravel", ar: "الحصى", en: "Coarse aggregate", why: "تكوين الهيكل الحجمي", whyEn: "Bulk aggregate skeleton", mass: gravel, vol: gravel / gravelDensity, unit: "kg", looseM3: gravel / bulkGravel },
      { id: "water", ar: "الماء", en: "Water", why: "إماهة الأسمنت والتشغيلية", whyEn: "Hydration and workability", mass: water, vol: water / 1000, unit: "L" }
    ];
    return { volume, binder: finalBinder, cement, water, sand, gravel, air, bagKg,
      bags: cement * volume / bagKg, occupied, sandVol, base, additions,
      estimatedDensity: cement + water + sand + gravel + additions.reduce((s, x) => s + x.mass, 0) };
  }
  const api = { catalog, calculate };
  root.CivilMixCore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
