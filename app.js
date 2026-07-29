/* =============================================================================
   Calculadora de Viabilidad Inmobiliaria Pro — application logic

   Follows the method of the book "Ciclo de Riqueza Inmobiliaria": Cap. 54 (the
   calculator's modules), Cap. 7 (Número de Seguridad Económica), Cap. 9 (the
   valuation scenarios, the "Regla de Oro" and the IRR benchmarks / "Atlantis
   Standard"), Cap. 30 (debt capacity: 35% of gross income minus existing debts;
   30% down in installments + the rest financed at handover) and Cap. 4/45/47
   (markets). Where the book supersedes the original prototype, the book wins.

   Projects: the user manages a portfolio of projects (any location/currency),
   each evaluated for viability; the personal situation (income, expenses, debts,
   capital, horizon) is shared across them. Projects persist in localStorage.
   ========================================================================== */

import { T } from './i18n.js';
import { LS_KEY, uid, defaultShopping, defaultPortafolio, CHECKLIST_CRIT, defaultChecklist,
  defaultProjects, PROJECT_FIELDS, VEHICULOS, fxRisk, P5KEYS, P5_DEFS, defaultP5, p5Eval } from './data.js';
import { cuotaCredito, dealBasis, tirApalancada, irr, tirReal } from './finance.js';

'use strict';

  function loadState() {
    var base = {
      lang: (function () { try { return /^en/i.test(navigator.language || navigator.userLanguage || '') ? 'en' : 'es'; } catch (e) { return 'es'; } })(),
      screen: 'login', mobileTab: 'datos', view: 'panel', panelTab: 'resumen', projTab: 'analizar',
      perfilNombre: '', ingreso: 6000, gasto: 2800, deudas: 400, capital: 35000,
      horizonte: 10, inflacion: 3, valorizacionEsp: 10, gastoLibertad: 4000, rendRenta: 6,
      projects: null, activeId: null, shopping: null, portafolio: null, checklist: null
    };
    try {
      var raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        ['perfilNombre', 'ingreso', 'gasto', 'deudas', 'capital', 'horizonte', 'inflacion',
         'valorizacionEsp', 'gastoLibertad', 'rendRenta', 'lang', 'view', 'panelTab', 'projTab'].forEach(function (k) {
          if (saved[k] != null) base[k] = saved[k];
        });
        if (Array.isArray(saved.projects) && saved.projects.length) base.projects = saved.projects;
        if (saved.activeId) base.activeId = saved.activeId;
        if (Array.isArray(saved.shopping)) base.shopping = saved.shopping;
        if (Array.isArray(saved.portafolio)) base.portafolio = saved.portafolio;
        if (saved.checklist) base.checklist = saved.checklist;
      }
    } catch (e) { /* ignore storage errors */ }
    if (!base.projects) base.projects = defaultProjects();
    if (!base.activeId || !base.projects.some(function (p) { return p.id === base.activeId; })) {
      base.activeId = base.projects[0].id;
    }
    if (!base.shopping) base.shopping = defaultShopping();
    if (!base.portafolio) base.portafolio = defaultPortafolio();
    if (!base.checklist) base.checklist = defaultChecklist();
    return base;
  }

  function saveState() {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        lang: state.lang, view: state.view, panelTab: state.panelTab, projTab: state.projTab, perfilNombre: state.perfilNombre,
        ingreso: state.ingreso, gasto: state.gasto, deudas: state.deudas,
        capital: state.capital, horizonte: state.horizonte, inflacion: state.inflacion,
        valorizacionEsp: state.valorizacionEsp, gastoLibertad: state.gastoLibertad, rendRenta: state.rendRenta,
        projects: state.projects, activeId: state.activeId,
        shopping: state.shopping, portafolio: state.portafolio, checklist: state.checklist
      }));
    } catch (e) { /* ignore */ }
    // sincronización en la nube (debounced) si hay sesión Supabase
    if (SB() && _authUser) {
      clearTimeout(_syncTimer);
      _syncTimer = setTimeout(function () {
        try {
          window.CRDSupabase.saveProfile(_authUser.id, state);
          window.CRDSupabase.saveAllProjects(_authUser.id, state.projects);
          if (window.CRDSupabase.saveSnapshot) window.CRDSupabase.saveSnapshot(_authUser.id, state);   // sync total
        } catch (e) { /* ignore */ }
      }, 800);
    }
  }

  var state = loadState();
  var _authUser = null, _syncTimer = null;   // Supabase session (null en modo demo)

  var SB = function () { return typeof window !== 'undefined' && window.CRDSupabase && window.CRDSupabase.enabled(); };

  function setLoginError(msg) {
    var el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  // Tras autenticar: gating + cargar situación y proyectos de la nube.
  function afterAuth(user) {
    _authUser = user;
    return window.CRDSupabase.loadProfile(user.id).then(function (profile) {
      var acc = window.CRDSupabase.checkAccess(profile);
      if (!acc.allowed) { setLoginError('Tu acceso fue revocado (reembolso). / Access revoked (refund).'); window.CRDSupabase.signOut(); _authUser = null; return; }
      if (profile) {
        ['ingreso', 'gasto', 'deudas', 'capital', 'horizonte'].forEach(function (f) { if (profile[f] != null) state[f] = profile[f]; });
        if (profile.idioma) state.lang = profile.idioma;
        // sync total: aplica el snapshot (supuestos, shopping, portafolio, checklist…)
        var snap = profile.snapshot;
        if (snap && typeof snap === 'object') {
          ['perfilNombre', 'valorizacionEsp', 'gastoLibertad', 'rendRenta', 'inflacion', 'view', 'panelTab', 'projTab'].forEach(function (k) { if (snap[k] != null) state[k] = snap[k]; });
          if (Array.isArray(snap.shopping)) state.shopping = snap.shopping;
          if (Array.isArray(snap.portafolio)) state.portafolio = snap.portafolio;
          if (snap.checklist) state.checklist = snap.checklist;
        }
      }
      return window.CRDSupabase.loadProjects(user.id).then(function (projs) {
        if (projs && projs.length) { state.projects = projs; state.activeId = projs[0].id; }
        else { window.CRDSupabase.saveAllProjects(user.id, state.projects); }   // primer login: sube los de ejemplo
        setLoginError('');
        state.screen = 'app'; render(); window.scrollTo(0, 0);
      });
    }).catch(function (err) { setLoginError((err && err.message) || 'Error al cargar tus datos.'); });
  }

  function activeProject() {
    return state.projects.filter(function (p) { return p.id === state.activeId; })[0] || state.projects[0];
  }

  var $ = function (id) { return document.getElementById(id); };
  var mqMobile = window.matchMedia('(max-width: 899px)');

  /* --------------------------------------------------------- formatting --- */
  function makeFmt(lang) {
    var locale = lang === 'es' ? 'de-DE' : 'en-US';
    return {
      fmt: function (n) { return Math.round(n).toLocaleString(locale); },
      pct: function (f, d) { var v = (f * 100).toFixed(d == null ? 1 : d); return lang === 'es' ? v.replace('.', ',') : v; },
      dec: function (n, d) { var v = n.toFixed(d == null ? 1 : d); return lang === 'es' ? v.replace('.', ',') : v; }
    };
  }

  /* -------------------------------------------------- calculation engine -- */
  function compute() {
    var s = state, L = T[s.lang], f = makeFmt(s.lang);
    var p = activeProject();

    var I = s.ingreso, G = s.gasto, Dm = s.deudas, H = s.horizonte;
    var V = p.valor, d = p.inicialPct / 100, m = p.planMeses, g = p.valorizacion / 100;
    var basis = dealBasis(p, H);
    var Vc = basis.Vc, hold = basis.hold, effClosing = basis.effClosing;

    // --- debt capacity (Cap. 30): 35% of gross income minus existing debts ---
    var capHipoteca = Math.max(0, 0.35 * I - Dm);        // headroom for the new mortgage
    var flujoLibre = Math.max(0, I - G - Dm);            // free monthly cash flow
    var cuotaInicialTotal = Vc * d;
    var cuotaConstruccion = cuotaInicialTotal / m;        // paid during construction
    var saldoAdeudado = Vc * (1 - d);                     // balance owed at handover
    // LTV cap (Cap. 28/30/53): a bank lends up to its max LTV of the property value;
    // developer financing (constructora) carries the whole balance directly.
    var ltvMax = (p.ltvMax != null ? p.ltvMax : 70) / 100;
    var maxFinanciable = p.finType === 'banco' ? V * ltvMax : saldoAdeudado;
    var saldoHipoteca = Math.min(saldoAdeudado, maxFinanciable);        // the actual loan
    var faltanteHandover = Math.max(0, saldoAdeudado - saldoHipoteca);  // extra cash you bring
    var cuotaHipotecaMes = cuotaCredito(saldoHipoteca, p.finTasa, p.finPlazo);

    var pctHipoteca = capHipoteca > 0 ? cuotaHipotecaMes / capHipoteca : 2;
    var mortgageFits = pctHipoteca <= 1;

    // Poder de inversión real (Cap. 19/22/48): capital + flujo×meses de obra +
    // crédito máximo que tu capacidad sana puede servir (amortización inversa).
    var nCred = p.finPlazo * 12, rCred = (p.finTasa / 100) / 12;
    var creditoMax = rCred === 0 ? capHipoteca * nCred : capHipoteca * (1 - Math.pow(1 + rCred, -nCred)) / rCred;
    var poderInversion = s.capital + flujoLibre * m + creditoMax;
    var constrFits = flujoLibre > 0 && cuotaConstruccion <= flujoLibre;
    var capEstado, capColor;
    if (pctHipoteca <= 0.85) { capEstado = L.capFitsSano; capColor = '#E6C788'; }
    else if (pctHipoteca <= 1) { capEstado = L.capFitsAjustado; capColor = '#E6C788'; }
    else { capEstado = L.capFitsExcede; capColor = '#d98b6a'; }

    // --- IRR with leverage (over the exit-strategy hold, on the cost basis Vc) ---
    var lev = tirApalancada(Vc, V, d, hold, g);       // undiscounted metrics (multiple, gain)
    var real = tirReal({ Vcost: Vc, Vexit: V, d: d, H: hold, g: g, m: m, closing: effClosing,
      margen: p.margenError, taxRate: p.taxRate, diferimiento: p.diferimiento,
      exitStrategy: p.exitStrategy, prepago: p.prepagoPct });
    var tirDisplay = real.tir;                 // real cash-flow IRR (timing + costs + margin), local currency
    var tirSin = g;
    var gananciaTotal = lev.ganancia;
    var equityFinal = lev.equityFinal;

    // currency risk (Cap. 10/51): convert the local IRR to a real IRR in USD
    var deval = (p.devaluacion || 0) / 100;
    var esFx = fxRisk(p.moneda) && deval > 0;
    var tirUsd = esFx ? (1 + tirDisplay) / (1 + deval) - 1 : tirDisplay;

    // IRR verdict (Cap. 9) — on the real IRR in hard currency
    var verdict;
    if (tirUsd >= 0.35)      verdict = { text: L.verdictAlpha, cls: '' };
    else if (tirUsd >= 0.20) verdict = { text: L.verdictStandard, cls: '' };
    else if (tirUsd >= 0.12) verdict = { text: L.verdictMarket, cls: 'mid' };
    else                     verdict = { text: L.verdictAlert, cls: 'warn' };

    // --- taxes & deferral ---
    var taxFull = p.taxRate / 100;
    var impuesto = Math.max(0, gananciaTotal) * taxFull;
    var reinvNeto = equityFinal - impuesto;
    var reinvDiferido = equityFinal;
    var ventaja = impuesto;
    var maxReinv = Math.max(reinvDiferido, 1);

    // --- NSE (Cap. 7): user-set inflation + Libertad parcial (70%) / total (125%) ---
    var inflacion = (s.inflacion != null ? s.inflacion : 3) / 100, rendMensual = 0.01, margenSeg = 1.25;
    var gastoProyectado = G * Math.pow(1 + inflacion, H);
    var nseMensual = gastoProyectado;
    var capitalLibertad = (gastoProyectado / rendMensual) * margenSeg;
    var capitalParcial = (gastoProyectado * 0.70 / rendMensual) * margenSeg;   // cubre 70% del gasto
    var capitalTotal = (gastoProyectado * 1.25 / rendMensual) * margenSeg;     // 125% del gasto
    var ciclos = Math.max(1, Math.ceil(capitalLibertad / Math.max(gananciaTotal, 1)));

    // --- multi-cycle wealth (Cap. 18/32): rotate and reinvest each cycle ---
    var cicloAnios = Math.max(1, Math.round(hold));
    var eqIni = Vc * d;
    var gainCycle = (V * Math.pow(1 + g, cicloAnios) - Vc * (1 - d) - eqIni) * (1 - (p.margenError || 0) / 100);
    var taxCycle = p.diferimiento ? 0 : Math.max(0, gainCycle) * (p.taxRate / 100);
    var factorCiclo = eqIni > 0 ? (eqIni + gainCycle - taxCycle) / eqIni : 1;
    var nCiclos = Math.max(1, Math.floor(H / cicloAnios));
    var wealthCiclos = [];
    for (var k = 1; k <= nCiclos; k++) wealthCiclos.push({ n: k, anio: k * cicloAnios, val: eqIni * Math.pow(factorCiclo, k) });
    var patrimonioFinal = wealthCiclos[wealthCiclos.length - 1].val;
    var maxWealth = Math.max(patrimonioFinal, 1);
    var aniosLibertad = null;
    if (factorCiclo > 1) {
      var wk = eqIni, kk = 0;
      while (wk < capitalLibertad && kk < 60) { wk *= factorCiclo; kk++; }
      aniosLibertad = kk * cicloAnios;
    }

    // --- rent & hold decision (Cap. 15/16, Fase C) — economía real (Punto 7) ---
    var opexPct = (p.opexPct != null ? p.opexPct : 30) / 100;      // gastos operativos: admin, HOA, mantenimiento, seguro
    var rentaTaxPct = (p.rentaTaxPct != null ? p.rentaTaxPct : 0) / 100; // impuesto a la renta
    var rentaAnualBruta = V * ((p.rentaBruta || 0) / 100);
    var rentaEfectiva = rentaAnualBruta * ((p.ocupacion || 0) / 100);   // ocupación = anti-vacancia
    var rentaOperativa = rentaEfectiva * (1 - opexPct);                 // tras gastos operativos (NOI)
    var deprAnual = 0.0222 * 0.80 * V;                                  // depreciación deducible
    var rentaImpuesto = Math.max(0, rentaOperativa - deprAnual) * rentaTaxPct;
    var escudoDepr = Math.min(deprAnual, Math.max(0, rentaOperativa)) * rentaTaxPct; // ahorro fiscal por depreciación
    var rentaNeta = rentaOperativa - rentaImpuesto;
    var annualMortgage = cuotaHipotecaMes * 12;
    var flujoRenta = rentaNeta - annualMortgage;
    var equityBase = Vc * d;
    var cashOnCash = equityBase > 0 ? flujoRenta / equityBase : 0;
    var dscr = annualMortgage > 0 ? rentaOperativa / annualMortgage : null;  // cobertura del servicio de deuda
    // ocupación de equilibrio: la ocupación mínima para que el flujo tras hipoteca sea 0
    var rentaNeta100 = V * ((p.rentaBruta || 0) / 100) * (1 - opexPct) * (1 - rentaTaxPct);
    var ocupEquilibrio = rentaNeta100 > 0 ? Math.min(100, annualMortgage / rentaNeta100 * 100) : null;
    // stress de tasa: la hipoteca a +2 puntos
    var flujoStress2 = rentaNeta - cuotaCredito(saldoHipoteca, p.finTasa + 2, p.finPlazo) * 12;
    // riesgo cambiario en renta: la renta es local pero la deuda puede ser dura (o al revés)
    var rentaFxRiesgo = fxRisk(p.moneda) && (p.devaluacion || 0) > 0;
    var conservar = dscr != null && dscr >= 1.2 && (p.ocupacion || 0) >= 70;

    // --- cash-out refi (Cap. 39/40): extract equity without selling ---
    var currentValueRefi = V * Math.pow(1 + g, hold);
    var refiExtraible = Math.max(0, 0.55 * currentValueRefi - Vc * (1 - d));

    // --- portfolio-level (Cap. 10/34/47): Holding trigger + hard-currency rule ---
    var totalValor = 0, usdValor = 0, paisesSet = {}, monedasSet = {}, maxGain = 0;
    s.projects.forEach(function (pr) {
      totalValor += pr.valor || 0;
      if (!fxRisk(pr.moneda)) usdValor += pr.valor || 0;
      if (pr.location) paisesSet[pr.location.split(',').pop().trim().toLowerCase()] = 1;
      var mUp = (pr.moneda || '').toUpperCase().trim(); if (mUp) monedasSet[mUp] = 1;
      var bz2 = dealBasis(pr, H);
      var g2 = tirApalancada(bz2.Vc, bz2.V, pr.inicialPct / 100, bz2.hold, pr.valorizacion / 100).ganancia;
      if (g2 > maxGain) maxGain = g2;
    });
    var nPaises = Object.keys(paisesSet).length, nMonedas = Object.keys(monedasSet).length;
    var pctUsd = totalValor > 0 ? usdValor / totalValor : 0;
    var duraOk = pctUsd >= 0.40;
    var holdingRec = s.projects.length >= 5 || totalValor > 300000 || maxGain > 47000;

    // --- projection chart (over the deal's hold to exit) ---
    var Wsvg = 600, Hsvg = 230, padL = 6, padR = 6, padT = 16, padB = 8;
    var Hp = Math.max(1, Math.round(hold));
    var eq = function (t) { return V * Math.pow(1 + g, t) - Vc * (1 - d); };
    var vals = []; for (var t = 0; t <= Hp; t++) vals.push(eq(t));
    var yMax = Math.max.apply(null, vals), yMin = 0;
    var X = function (t) { return padL + (t / Hp) * (Wsvg - padL - padR); };
    var Y = function (v) { return Hsvg - padB - ((v - yMin) / (yMax - yMin || 1)) * (Hsvg - padT - padB); };
    var pts = '', areaMid = '';
    for (var t2 = 0; t2 <= Hp; t2++) { var seg = X(t2) + ',' + Y(vals[t2]); pts += (t2 ? ' ' : '') + seg; areaMid += (t2 ? ' L ' : '') + seg; }
    var chartArea = 'M ' + X(0) + ',' + (Hsvg - padB) + ' L ' + areaMid + ' L ' + X(Hp) + ',' + (Hsvg - padB) + ' Z';
    var mids = [0, Math.round(Hp / 2), Hp].filter(function (v, i, a) { return a.indexOf(v) === i; });
    var axisYears = mids.map(function (t) { return L.yr + ' ' + t; });

    // --- valuation scenarios (Cap. 9) ---
    var scenDefs = [
      { key: 'cons', label: L.scenCons, g: g * 0.6 },
      { key: 'base', label: L.scenBase, g: g },
      { key: 'opt',  label: L.scenOpt,  g: g * 1.4 }
    ];
    var scenarios = scenDefs.map(function (sc) {
      return { key: sc.key, label: sc.label, g: sc.g,
        tir: tirReal({ Vcost: Vc, Vexit: V, d: d, H: hold, g: sc.g, m: m, closing: effClosing, margen: p.margenError, taxRate: p.taxRate, diferimiento: p.diferimiento, exitStrategy: p.exitStrategy, prepago: p.prepagoPct }).tir };
    });
    var maxScenTir = Math.max.apply(null, scenarios.map(function (x) { return x.tir; }).concat([0.0001]));
    var reglaOro = scenarios[0].tir >= 0.15;

    // 5 P — calidad del deal (Cap. 13). Una P en rojo descarta el proyecto.
    var p5 = p5Eval(p);
    var p5Verdict = p5.red ? { text: L.p5Roja, cls: 'warn' }
      : (p5.sum === p5.max ? { text: L.p5Alta, cls: '' } : { text: L.p5Media, cls: 'mid' });

    // Triángulo de Inversiones Inteligentes (Cap. 2): tres vértices que deben
    // cumplirse a la vez — rentabilidad (TIR real en USD > 20%), gestión pasiva
    // (< 2 h/mes) y respaldo verificado (fiduciaria + constructora). Los dos
    // últimos son confirmaciones de due-diligence del usuario.
    var triC1 = tirUsd >= 0.20, triC2 = !!p.gestionPasiva, triC3 = !!p.respaldoVerificado;
    var triAll = triC1 && triC2 && triC3;
    var triVerdict = triAll ? { text: L.triOk, cls: '' }
      : { text: (!triC1 ? L.triNoRent : !triC3 ? L.triNoResp : L.triNoGest), cls: 'warn' };
    var triangulo = { c1: triC1, c2: triC2, c3: triC3, all: triAll, verdict: triVerdict };

    // --- project comparison (viability of each project the user added) ---
    var projView = s.projects.map(function (pr) {
      var bz = dealBasis(pr, H);
      var lv = tirReal({ Vcost: bz.Vc, Vexit: bz.V, d: pr.inicialPct / 100, H: bz.hold, g: pr.valorizacion / 100, m: pr.planMeses,
        closing: bz.effClosing, margen: pr.margenError, taxRate: pr.taxRate, diferimiento: pr.diferimiento,
        exitStrategy: pr.exitStrategy, prepago: pr.prepagoPct });
      var prDeval = (pr.devaluacion || 0) / 100;
      var prFx = fxRisk(pr.moneda) && prDeval > 0;
      var prTir = prFx ? (1 + lv.tir) / (1 + prDeval) - 1 : lv.tir;   // real IRR in USD
      var saldoAd = bz.Vc * (1 - pr.inicialPct / 100);
      var prLtv = (pr.ltvMax != null ? pr.ltvMax : 70) / 100;
      var prLoan = pr.finType === 'banco' ? Math.min(saldoAd, bz.V * prLtv) : saldoAd;
      var cuota = cuotaCredito(prLoan, pr.finTasa, pr.finPlazo);
      var fits = capHipoteca > 0 ? cuota <= capHipoteca : false;
      var pr5 = p5Eval(pr);
      return {
        id: pr.id, name: pr.name || (L.addProject), location: pr.location, moneda: pr.moneda,
        active: pr.id === s.activeId, tir: prTir, fits: fits,
        fx: fxRisk(pr.moneda),
        viable: prTir >= 0.20 && fits && !pr5.red
      };
    });
    var maxTir = Math.max.apply(null, projView.map(function (x) { return x.tir; }).concat([0.0001]));

    return {
      f: f, L: L, p: p,
      capHipoteca: capHipoteca, flujoLibre: flujoLibre, saldoHipoteca: saldoHipoteca,
      faltanteHandover: faltanteHandover, ltvMax: p.ltvMax != null ? p.ltvMax : 70, finBanco: p.finType === 'banco',
      cuotaConstruccion: cuotaConstruccion, cuotaHipotecaMes: cuotaHipotecaMes,
      pctHipoteca: pctHipoteca, mortgageFits: mortgageFits, constrFits: constrFits,
      capEstado: capEstado, capColor: capColor, poderInversion: poderInversion,
      cicloAnios: cicloAnios, wealthCiclos: wealthCiclos, patrimonioFinal: patrimonioFinal,
      maxWealth: maxWealth, aniosLibertad: aniosLibertad, nCiclos: nCiclos,
      rentaNeta: rentaNeta, flujoRenta: flujoRenta, cashOnCash: cashOnCash, conservar: conservar, escudoDepr: escudoDepr,
      rentaOperativa: rentaOperativa, dscr: dscr, ocupEquilibrio: ocupEquilibrio, flujoStress2: flujoStress2, rentaFxRiesgo: rentaFxRiesgo,
      opexPct: p.opexPct != null ? p.opexPct : 30, rentaTaxPct: p.rentaTaxPct != null ? p.rentaTaxPct : 0,
      refiExtraible: refiExtraible, nPaises: nPaises, nMonedas: nMonedas, pctUsd: pctUsd, duraOk: duraOk, holdingRec: holdingRec,
      tir: tirDisplay, tirUsd: tirUsd, esFx: esFx, roi: real.roi, tirSin: tirSin, multiple: lev.multiple, verdict: verdict,
      reinvNeto: reinvNeto, reinvDiferido: reinvDiferido, ventaja: ventaja, maxReinv: maxReinv,
      nseMensual: nseMensual, capitalLibertad: capitalLibertad, ciclos: ciclos,
      capitalParcial: capitalParcial, capitalTotal: capitalTotal,
      chartPts: pts, chartArea: chartArea, axisYears: axisYears,
      chartStart: { x: X(0), y: Y(vals[0]) }, chartEnd: { x: X(Hp), y: Y(vals[Hp]) }, endVal: vals[Hp],
      scenarios: scenarios, maxScenTir: maxScenTir, reglaOro: reglaOro,
      p5: p5, p5Verdict: p5Verdict, triangulo: triangulo,
      projView: projView, maxTir: maxTir
    };
  }

  /* ------------------------------------------------- panel (dashboard) ---- */
  /* Modelo personal (hoja "Panel de Control" del Excel): perfil → poder de
     inversión, NSE, años a la libertad, proyección año a año, capacidad de
     endeudamiento y cuántos/qué proyectos puedes asumir (entradas por mercado
     de la hoja "Comparativa de Mercados"). */
  /* Datos de referencia por mercado (hoja "Comparativa de Mercados", 2024-2025).
     valoriz = valorización vivienda nueva/año · renta = rentabilidad renta corta/año
     tax = impuesto a la ganancia · difer = mecanismo de diferimiento fiscal. */
  var PN_MERCADOS = [
    { key: 'colombia', min: 15000, planM: 30, valoriz: '6–14%', renta: '5–10%', tax: '15%',  difer: 'AFC' },
    { key: 'rd',       min: 20000, planM: 24, valoriz: '7–12%', renta: '8–15%', tax: '27%',  difer: 'CONFOTUR' },
    { key: 'mexico',   min: 25000, planM: 36, valoriz: '8–12%', renta: '7–12%', tax: 'Var.', difer: 'FIBRA' },
    { key: 'dubai',    min: 80000, planM: 36, valoriz: '15–40%', renta: '7–12%', tax: '0%',  difer: '—' }
  ];

  function computePanel() {
    var s = state, L = T[s.lang], f = makeFmt(s.lang);
    var I = s.ingreso || 0, G = s.gasto || 0, Dm = s.deudas || 0, C = s.capital || 0;
    var H = s.horizonte || 10;
    var g = (s.valorizacionEsp != null ? s.valorizacionEsp : 10) / 100;   // plusvalía: crecimiento del patrimonio
    var rr = (s.rendRenta != null ? s.rendRenta : 6) / 100;               // renta neta anual (caja gastable) — input
    var libertad = s.gastoLibertad || 0;

    var flujoLibre = Math.max(0, I - G - Dm);       // ingreso − gasto − deudas
    var flujoAnual = flujoLibre * 12;

    // Punto 4 (conexión de módulos): el patrimonio de partida incluye el equity
    // ya comprometido en tus propiedades activas (Portafolio) + su plusvalía.
    var portfolioEquity = 0;
    (s.portafolio || []).forEach(function (r) {
      if (r.precioCompra > 0) {
        var valorAc = r.precioCompra * Math.pow(1 + (r.valoriz != null ? r.valoriz : 1) / 100, r.mesActual || 0);
        portfolioEquity += (r.cuotaInicial || 0) + Math.max(0, valorAc - r.precioCompra);
      }
    });
    var patInicial = C + portfolioEquity;
    // impulso potencial (aún no comprometido) de los proyectos que estás analizando
    var dealsGain = 0;
    (s.projects || []).forEach(function (pr) {
      var bz = dealBasis(pr, H);
      var lv = tirApalancada(bz.Vc, bz.V, pr.inicialPct / 100, bz.hold, pr.valorizacion / 100);
      if (lv.ganancia > 0) dealsGain += lv.ganancia;
    });

    // Punto 1/2: el Número de Seguridad se mide contra la RENTA NETA (lo gastable),
    // NO contra la plusvalía. El patrimonio CRECE por valorización + ahorro (g);
    // eres libre cuando su renta neta (rr) cubre tu gasto de libertad.
    var NSE = rr > 0 ? (libertad * 12) / rr : 0;
    var aniosLibertad = pnFreedomYears2(patInicial, flujoAnual, g, NSE);

    function pat(t) { return g === 0 ? patInicial + flujoAnual * t : patInicial * Math.pow(1 + g, t) + flujoAnual * (Math.pow(1 + g, t) - 1) / g; }
    var serie = [];
    for (var t = 0; t <= H; t++) { var v = pat(t); serie.push({ t: t, val: v, pasivo: v * rr / 12, prog: NSE > 0 ? Math.min(v / NSE, 1) : 0 }); }
    var patFinal = serie[serie.length - 1].val;
    var patY5 = pat(5), patY10 = pat(10);
    var progreso = NSE > 0 ? Math.min(patFinal / NSE, 1) : 0;

    // Punto 2: renta recurrente (gastable) y liquidez por refinanciación, SEPARADAS
    var ingresoRentaMes = patFinal * rr / 12;
    var refiLiquidez = 0.55 * patFinal;              // extraíble por refi, cada 3–5 años, sin evento fiscal

    // capacidad de endeudamiento (regla del 35% del ingreso − deudas)
    var maxCuota = Math.max(0, 0.35 * I - Dm);
    var dti = I > 0 ? Dm / I : 0;
    var rTyp = 0.10 / 12, nTyp = 20 * 12;             // hipoteca típica 20 años ~10%
    var maxHipoteca = maxCuota > 0 ? maxCuota * (1 - Math.pow(1 + rTyp, -nTyp)) / rTyp : 0;
    // Punto 5: NUNCA un número único que mezcle equity y deuda. Se separan:
    var capitalPropio = C;                            // tu efectivo (lo que pones tú)
    var capacidadCredito = maxHipoteca;               // lo que el banco financia y tú puedes servir
    var propiedadMaxReal = C + maxHipoteca;           // alcance real: tu efectivo + crédito servible
    var dtiCls, dtiTxt;
    if (dti < 0.30) { dtiCls = ''; dtiTxt = L.pnDtiSano; }
    else if (dti <= 0.35) { dtiCls = 'mid'; dtiTxt = L.pnDtiAjustado; }
    else { dtiCls = 'warn'; dtiTxt = L.pnDtiExcede; }

    // cuántos / qué proyectos (entradas por mercado)
    var mkView = PN_MERCADOS.map(function (mk) {
      var cuotaMes = mk.min / mk.planM;               // cuota de obra aprox. (entrada repartida en el plan)
      var nCap = Math.floor(C / mk.min);
      var nFlow = cuotaMes > 0 ? Math.floor(flujoLibre / cuotaMes) : 0;
      var n = Math.max(0, Math.min(nCap, nFlow));
      return { key: mk.key, min: mk.min, cuotaMes: cuotaMes, afford: C >= mk.min && flujoLibre >= cuotaMes, n: n,
        valoriz: mk.valoriz, renta: mk.renta, tax: mk.tax, difer: mk.difer };
    });
    var afford = mkView.filter(function (m) { return m.afford; });
    var nSimult = afford.length ? Math.max.apply(null, afford.map(function (m) { return m.n; })) : 0;

    var verdict;
    if (aniosLibertad != null && aniosLibertad <= 5) verdict = { text: L.pnVerdictAccel, cls: '' };
    else if (aniosLibertad != null && aniosLibertad <= 8) verdict = { text: L.pnVerdictSolido, cls: 'mid' };
    else verdict = { text: L.pnVerdictConstru, cls: 'warn' };

    var infl = (s.inflacion != null ? s.inflacion : 3) / 100;
    return { f: f, L: L, H: H, g: g, rr: rr, infl: infl, capital: C, flujoLibre: flujoLibre,
      patInicial: patInicial, portfolioEquity: portfolioEquity, dealsGain: dealsGain,
      capitalPropio: capitalPropio, capacidadCredito: capacidadCredito, propiedadMaxReal: propiedadMaxReal,
      propiedadMax: propiedadMaxReal, ingresoRentaMes: ingresoRentaMes, refiLiquidez: refiLiquidez,
      NSE: NSE, aniosLibertad: aniosLibertad, serie: serie,
      patFinal: patFinal, patY5: patY5, patY10: patY10, progreso: progreso,
      maxCuota: maxCuota, dti: dti, maxHipoteca: maxHipoteca, dtiCls: dtiCls, dtiTxt: dtiTxt,
      mkView: mkView, nSimult: nSimult, verdict: verdict };
  }

  /* Análisis predictivo: patrimonio compuesto y años a la libertad para una
     tasa de valorización dada (permite simular escenarios y palancas). */
  function pnPatAt(C, flujoAnual, g, t) {
    return g === 0 ? C + flujoAnual * t : C * Math.pow(1 + g, t) + flujoAnual * (Math.pow(1 + g, t) - 1) / g;
  }
  function pnFreedomYears(flujoAnual, g, NSE) {
    if (!(g > 0 && flujoAnual > 0 && NSE > 0)) return null;
    return Math.log((NSE * g) / flujoAnual + 1) / Math.log(1 + g);
  }
  // años a la libertad partiendo de un patrimonio inicial W0 (no de cero)
  function pnFreedomYears2(W0, flujoAnual, g, NSE) {
    if (!(g > 0 && NSE > 0)) return null;
    var k = flujoAnual / g, ratio = (NSE + k) / ((W0 || 0) + k);
    if (ratio <= 1) return 0;
    return Math.log(ratio) / Math.log(1 + g);
  }

  // Punto 3: calendario de caja — cuotas de obra de las propiedades activas
  // (Portafolio) mes a mes vs. tu flujo libre. Semáforo de liquidez por mes.
  function computeCashCalendar(flujoLibre, capital) {
    var props = (state.portafolio || []).filter(function (r) { return r.precioCompra > 0 && r.mesesObra > 0; });
    var horizon = 0;
    props.forEach(function (r) { var rem = Math.max(0, r.mesesObra - (r.mesActual || 0)); if (rem > horizon) horizon = rem; });
    horizon = Math.min(horizon, 36);
    var months = [], cumDeficit = 0, firstRed = null, peak = 0;
    for (var m = 1; m <= horizon; m++) {
      var total = 0;
      props.forEach(function (r) {
        var cur = (r.mesActual || 0) + m;
        if (cur <= r.mesesObra) total += (r.cuotaInicial || 0) / r.mesesObra;
      });
      cumDeficit += Math.max(0, total - flujoLibre);
      var estado;
      if (total <= flujoLibre) estado = 'ok';
      else if (cumDeficit <= capital) estado = 'mid';
      else { estado = 'red'; if (firstRed == null) firstRed = m; }
      if (total > peak) peak = total;
      months.push({ m: m, total: total, estado: estado });
    }
    return { months: months, peak: peak, firstRed: firstRed, active: props.length };
  }

  function panelChartSVG(c) {
    // área de patrimonio año a año + línea de meta (NSE)
    var W = 600, Hh = 210, padL = 6, padR = 6, padT = 18, padB = 8;
    var serie = c.serie, n = serie.length - 1;
    var yMax = Math.max(c.NSE * 1.05, serie[n].val, 1);
    var X = function (t) { return padL + (t / Math.max(1, n)) * (W - padL - padR); };
    var Y = function (v) { return Hh - padB - (v / yMax) * (Hh - padT - padB); };
    var pts = '', area = '';
    serie.forEach(function (d, i) { var seg = X(d.t).toFixed(1) + ',' + Y(d.val).toFixed(1); pts += (i ? ' ' : '') + seg; area += (i ? ' L ' : '') + seg; });
    var areaPath = 'M ' + X(0).toFixed(1) + ',' + (Hh - padB) + ' L ' + area + ' L ' + X(n).toFixed(1) + ',' + (Hh - padB) + ' Z';
    var nseY = Y(c.NSE);
    var nseLine = (c.NSE > 0 && c.NSE <= yMax) ?
      '<line x1="' + padL + '" y1="' + nseY.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + nseY.toFixed(1) +
      '" stroke="#9DA1A8" stroke-width="1" stroke-dasharray="4 4"></line>' +
      '<text x="' + (W - padR) + '" y="' + (nseY - 5).toFixed(1) + '" text-anchor="end" fill="#9DA1A8" font-size="11">' +
      escapeHtml(c.L.pnMeta) + '</text>' : '';
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" preserveAspectRatio="none" class="pn-chart-svg">' +
      '<defs><linearGradient id="pngrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="rgba(230,199,136,0.30)"></stop>' +
      '<stop offset="100%" stop-color="rgba(230,199,136,0)"></stop></linearGradient></defs>' +
      '<path d="' + areaPath + '" fill="url(#pngrad)"></path>' +
      '<polyline points="' + pts + '" fill="none" stroke="#E6C788" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
      nseLine +
      '<circle cx="' + X(n).toFixed(1) + '" cy="' + Y(serie[n].val).toFixed(1) + '" r="4.5" fill="#E6C788"></circle>' +
      '</svg>';
  }

  function tile(label, value, unit) {
    return '<div class="pn-tile"><div class="pn-tile-val">' + value +
      (unit ? '<span class="pn-tile-unit"> ' + unit + '</span>' : '') + '</div>' +
      '<div class="pn-tile-lbl">' + escapeHtml(label) + '</div></div>';
  }
  function pnStat(val, unit, label) {
    return '<div class="pn-stat"><div class="pn-stat-v">' + val +
      (unit ? '<span> ' + unit + '</span>' : '') + '</div>' +
      '<div class="pn-stat-l">' + escapeHtml(label) + '</div></div>';
  }

  function renderPanel() {
    var c = computePanel(), f = c.f, L = c.L, s = state;

    // inputs (perfil)
    setNumIfIdle('pn-nombre', s.perfilNombre, true);
    setNumIfIdle('pn-ingreso', s.ingreso);
    setNumIfIdle('pn-gasto', s.gasto);
    setNumIfIdle('pn-deudas', s.deudas);
    setNumIfIdle('pn-capital', s.capital);
    setNumIfIdle('pn-libertad', s.gastoLibertad);
    $('pn-valoriz').value = s.valorizacionEsp;
    setText('pn-val-valoriz', f.dec(s.valorizacionEsp, 1) + '%');
    $('pn-inflacion').value = s.inflacion;
    setText('pn-val-inflacion', f.dec(s.inflacion, s.inflacion % 1 ? 1 : 0) + '%');
    if ($('pn-rendrenta')) {
      $('pn-rendrenta').value = s.rendRenta;
      setText('pn-val-rendrenta', f.dec(s.rendRenta, s.rendRenta % 1 ? 1 : 0) + '%');
    }

    // horizon segmented
    var segH = $('pn-seg-horizonte');
    if (segH) {
      segH.innerHTML = '';
      [5, 10, 15].forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'seg-btn' + (s.horizonte === v ? ' active' : '');
        b.innerHTML = String(v) + '<span class="unit"> ' + L.unitYears + '</span>';
        b.addEventListener('click', function () { state.horizonte = v; commit(); });
        segH.appendChild(b);
      });
    }

    var anios = c.aniosLibertad == null ? '—' : f.dec(c.aniosLibertad, 1);
    var tab = s.panelTab || 'resumen';

    // sub-pestañas activas
    var subs = document.querySelectorAll('.pn-subtab');
    for (var st = 0; st < subs.length; st++) subs[st].classList.toggle('active', subs[st].getAttribute('data-ptab') === tab);

    // 'info' = módulo de perfil (HTML estático); el resto se pinta en #panel-results
    var infoSec = $('pn-section-info');
    if (infoSec) infoSec.hidden = tab !== 'info';
    var res = $('panel-results');
    if (tab === 'info') { res.innerHTML = ''; res.hidden = true; return; }
    res.hidden = false;

    var html = '';

    if (tab === 'resumen') {
      // Punto 5: capital propio / crédito / alcance real — nunca un número que los mezcle.
      var tiles =
        tile(L.pnCapitalPropio, f.fmt(c.capitalPropio), 'USD') +
        tile(L.pnCapCredito, f.fmt(c.capacidadCredito), 'USD') +
        tile(L.pnPropMaxReal, f.fmt(c.propiedadMaxReal), 'USD') +
        tile(L.pnFlujoLibre, f.fmt(c.flujoLibre), 'USD') +
        tile(L.pnNse, f.fmt(c.NSE), 'USD') +
        tile(L.pnAnios, anios, L.unitYears);
      html =
        '<div class="panel card card-accent card-span pn-hero">' +
          '<div class="eyebrow">' + escapeHtml(L.pnResumen) + '</div>' +
          '<div class="pn-tiles">' + tiles + '</div>' +
          '<div class="pn-chart">' + panelChartSVG(c) + '</div>' +
          '<div class="usage"><div class="usage-head"><span class="usage-label">' + escapeHtml(L.pnProgreso) + '</span>' +
          '<span class="usage-pct">' + f.pct(c.progreso, 0) + '%</span></div>' +
          '<div class="bar-track bar-track-8"><div class="bar-fill bar-fill-gold" style="width:' + (c.progreso * 100).toFixed(0) + '%"></div></div></div>' +
          // Punto 2: renta recurrente (gastable) y liquidez por refi, SEPARADAS
          '<div class="pn-two-lines">' +
            '<div class="pn-line"><span class="pn-line-lbl">' + escapeHtml(L.pnIngresoRecurrente) + '</span>' +
              '<span class="pn-line-val">' + f.fmt(c.ingresoRentaMes) + ' <small>' + escapeHtml(L.perMonth) + '</small></span></div>' +
            '<div class="pn-line"><span class="pn-line-lbl">' + escapeHtml(L.pnRefiLiquidez) + ' <small>· ' + escapeHtml(L.pnRefiNota) + '</small></span>' +
              '<span class="pn-line-val pn-line-soft">' + f.fmt(c.refiLiquidez) + ' USD</span></div>' +
            (c.portfolioEquity > 0 ? '<div class="pn-line"><span class="pn-line-lbl">' + escapeHtml(L.pnPatActivas) + '</span>' +
              '<span class="pn-line-val pn-line-soft">' + f.fmt(c.portfolioEquity) + ' USD</span></div>' : '') +
          '</div>' +
          '<p class="card-help pn-hero-note">' + escapeHtml(L.pnResumenNota) + '</p>' +
          '<div class="verdict ' + c.verdict.cls + '">' + escapeHtml(c.verdict.text) + '</div>' +
        '</div>';

    } else if (tab === 'proyeccion') {
      // tabla año a año (hoja "Panel de Control"): nominal, real (infl.), pasivo/mes, progreso
      var yrRows = c.serie.filter(function (d) { return d.t > 0; }).map(function (d) {
        var real = d.val / Math.pow(1 + c.infl, d.t);
        var libre = d.prog >= 1;
        return '<div class="pn-mk-row">' +
          '<div class="pn-mk-head"><span class="pn-mk-name">' + L.yr + ' ' + d.t + '</span>' +
            '<span class="pn-yr-total">' + f.fmt(d.val) + ' USD' + (libre ? ' <span class="pn-libre">' + escapeHtml(L.pnEscLibertad) + '</span>' : '') + '</span></div>' +
          '<div class="pn-mk-stats">' +
            pnStat(f.fmt(real), 'USD', L.pnReal) +
            pnStat(f.fmt(d.pasivo), L.perMonth, L.pnPasivo) +
            pnStat(f.pct(d.prog, 0) + '%', '', L.pnStProgreso) +
          '</div>' +
        '</div>';
      }).join('');
      html =
        '<div class="panel card card-span pn-solo">' +
          '<div class="proj-head"><div><div class="eyebrow">' + escapeHtml(L.pnProyeccion) + '</div>' +
          '<p class="card-help">' + escapeHtml(L.pnProyTablaHelp) + '</p></div>' +
          '<div class="proj-end"><div class="proj-end-num">' + f.fmt(c.patFinal) + ' <span class="foot-unit">USD</span></div>' +
          '<div class="foot-cap">' + escapeHtml(L.yr) + ' ' + c.H + '</div></div></div>' +
          '<div class="pn-mk-list pn-yr-list">' + yrRows + '</div>' +
        '</div>';

    } else if (tab === 'endeuda') {
      var dtiPct = f.pct(c.dti, 0);
      html =
        '<div class="panel card card-span pn-solo">' +
          '<div class="eyebrow">' + escapeHtml(L.pnEndeuda) + '</div>' +
          '<p class="card-help">' + escapeHtml(L.pnEndeudaHelp) + '</p>' +
          '<div class="big-num-row"><span class="big-num">' + f.fmt(c.maxCuota) + '</span><span class="big-num-unit">' + escapeHtml(L.perMonth) + '</span></div>' +
          '<div class="sub-line">' + escapeHtml(L.pnCuotaMax) + '</div>' +
          '<div class="cap-line"><span class="cap-line-lbl">' + escapeHtml(L.pnHipMax) + '</span><span class="cap-line-val">' + f.fmt(c.maxHipoteca) + ' USD</span></div>' +
          '<div class="usage"><div class="usage-head"><span class="usage-label">' + escapeHtml(L.pnDti) + ': <span class="usage-strong">' + dtiPct + '%</span></span></div>' +
          '<div class="bar-track bar-track-6"><div class="bar-fill" style="width:' + Math.min(c.dti / 0.35 * 100, 100).toFixed(0) + '%;background:' + (c.dti > 0.35 ? '#d98b6a' : '#E6C788') + '"></div></div>' +
          '<div class="usage-status ' + c.dtiCls + '">' + escapeHtml(c.dtiTxt) + '</div></div>' +
        '</div>';

    } else if (tab === 'liquidez') {
      var cal = computeCashCalendar(c.flujoLibre, c.capital);
      if (!cal.active) {
        html = '<div class="panel card card-span pn-solo"><div class="eyebrow">' + escapeHtml(L.pnLiqEyebrow) + '</div>' +
          '<p class="card-help">' + escapeHtml(L.pnLiqVacio) + '</p></div>';
      } else {
        var maxBar = Math.max(cal.peak, c.flujoLibre, 1);
        var flowPct = (c.flujoLibre / maxBar * 100);
        var bars = cal.months.map(function (mo) {
          var h = (mo.total / maxBar * 100).toFixed(1);
          var cls = mo.estado === 'ok' ? 'ok' : mo.estado === 'mid' ? 'mid' : 'red';
          var tip = L.pnLiqMesLbl + ' ' + mo.m + ': ' + f.fmt(mo.total) + ' USD';
          return '<div class="pn-liq-col" title="' + escapeHtml(tip) + '"><div class="pn-liq-bar ' + cls + '" style="height:' + h + '%"></div>' +
            (mo.m % 6 === 0 ? '<div class="pn-liq-tick">' + mo.m + '</div>' : '<div class="pn-liq-tick"></div>') + '</div>';
        }).join('');
        var riesgoTxt = cal.firstRed == null
          ? '<span class="pn-liq-safe">' + escapeHtml(L.pnLiqSinRiesgo) + '</span>'
          : '<span class="pn-liq-warn">' + escapeHtml(L.pnLiqMesLbl) + ' ' + cal.firstRed + '</span>';
        html =
          '<div class="panel card card-span pn-solo">' +
            '<div class="eyebrow">' + escapeHtml(L.pnLiqEyebrow) + '</div>' +
            '<p class="card-help card-help-mb">' + escapeHtml(L.pnLiqHelp) + '</p>' +
            '<div class="pn-tiles pn-tiles-3">' +
              tile(L.pnFlujoLibre, f.fmt(c.flujoLibre), 'USD') +
              tile(L.pnLiqPico, f.fmt(cal.peak), 'USD') +
              '<div class="pn-tile"><div class="pn-tile-val">' + riesgoTxt + '</div><div class="pn-tile-lbl">' + escapeHtml(L.pnLiqRiesgo) + '</div></div>' +
            '</div>' +
            '<div class="pn-liq-chart"><div class="pn-liq-flow" style="bottom:' + flowPct.toFixed(1) + '%"><span>' + escapeHtml(L.pnLiqFlujoRef) + '</span></div>' +
              '<div class="pn-liq-cols">' + bars + '</div></div>' +
            '<div class="pn-liq-legend">' +
              '<span><i class="dot ok"></i>' + escapeHtml(L.pnLiqOk) + '</span>' +
              '<span><i class="dot mid"></i>' + escapeHtml(L.pnLiqMid) + '</span>' +
              '<span><i class="dot red"></i>' + escapeHtml(L.pnLiqRed) + '</span>' +
            '</div>' +
          '</div>';
      }

    } else if (tab === 'proyectos') {
      var mkRows = c.mkView.map(function (m) {
        var name = (L.pnMercados && L.pnMercados[m.key]) || m.key;
        var badge = '<span class="viab-badge ' + (m.afford ? 'ok' : 'no') + '">' + escapeHtml(m.afford ? L.pnAlcanza : L.pnNoAlcanza) + '</span>';
        return '<div class="pn-mk-row">' +
          '<div class="pn-mk-head"><span class="pn-mk-name">' + escapeHtml(name) + '</span>' + badge + '</div>' +
          '<div class="pn-mk-stats">' +
            pnStat(f.fmt(m.min), 'USD', L.pnStEntrada) +
            pnStat(f.fmt(m.cuotaMes), 'USD', L.pnStCuota) +
            pnStat(m.afford ? String(m.n) : '—', '', L.pnStProys) +
          '</div>' +
          '<div class="pn-mk-ref">' +
            '<span>' + escapeHtml(L.pnRefValoriz) + ' <b>' + m.valoriz + '</b></span>' +
            '<span>' + escapeHtml(L.pnRefRenta) + ' <b>' + m.renta + '</b></span>' +
            '<span>' + escapeHtml(L.pnRefTax) + ' <b>' + m.tax + '</b></span>' +
            '<span>' + escapeHtml(L.pnRefDifer) + ' <b>' + escapeHtml(m.difer) + '</b></span>' +
          '</div>' +
        '</div>';
      }).join('');
      html =
        '<div class="panel card card-span pn-solo">' +
          '<div class="eyebrow">' + escapeHtml(L.pnProyectos) + '</div>' +
          '<p class="card-help card-help-mb">' + escapeHtml(L.pnProyectosHelp) + '</p>' +
          '<div class="pn-simult"><span class="pn-simult-n">' + c.nSimult + '</span>' +
          '<span class="pn-simult-lbl">' + escapeHtml(L.pnSimultaneos) + '</span></div>' +
          '<div class="pn-mk-list">' + mkRows + '</div>' +
          '<div class="cap-poder-line sub-line"><span>' + escapeHtml(L.pnRangoTipo) + '</span>: <span>' + f.fmt(c.propiedadMax * 0.6) + ' – ' + f.fmt(c.propiedadMax) + ' USD</span></div>' +
          '<p class="card-help market-fx-note" style="margin-top:12px">' + escapeHtml(L.pnMercadosFuente) + '</p>' +
          '<button type="button" class="pn-cta" id="pn-goto-proyecto">' + escapeHtml(L.pnAbrirProyecto) + '</button>' +
        '</div>';

    } else if (tab === 'fiscal') {
      // impacto del diferimiento fiscal en 5 ciclos (hoja "Fiscal y Diferimiento")
      var cap0 = c.capital || 0, gc = 0.35, taxSin = 0.20, gastos = 0.025;
      var cs = cap0, cc = cap0, fdata = [];
      for (var fk = 1; fk <= 5; fk++) {
        cs = cs * (1 + gc) * (1 - taxSin) * (1 - gastos);
        cc = cc * (1 + gc) * (1 - gastos);
        fdata.push({ k: fk, sin: cs, con: cc });
      }
      var fisRows = fdata.map(function (d) {
        return '<div class="pn-mk-row">' +
          '<div class="pn-mk-head"><span class="pn-mk-name">' + escapeHtml(L.cicloLabel) + ' ' + d.k + '</span>' +
            '<span class="pn-yr-total">×' + f.dec(cap0 > 0 ? d.con / cap0 : 1, 2) + '</span></div>' +
          '<div class="pn-mk-stats">' +
            pnStat(f.fmt(d.con), 'USD', L.pnFisCon) +
            pnStat(f.fmt(d.sin), 'USD', L.pnFisSin) +
            pnStat('+' + f.fmt(d.con - d.sin), 'USD', L.pnFisDif) +
          '</div>' +
        '</div>';
      }).join('');
      var extra = fdata[4].con - fdata[4].sin;
      html =
        '<div class="panel card card-span pn-solo">' +
          '<div class="eyebrow">' + escapeHtml(L.pnFiscal) + '</div>' +
          '<p class="card-help card-help-mb">' + escapeHtml(L.pnFiscalHelp) + '</p>' +
          '<div class="pn-mk-list">' + fisRows + '</div>' +
          '<div class="highlight"><span class="highlight-label">' + escapeHtml(L.pnFisExtra) + '</span>: <span class="highlight-val">+' + f.fmt(extra) + ' USD</span></div>' +
          '<p class="card-help market-fx-note" style="margin-top:12px">' + escapeHtml(L.pnFisNota) + '</p>' +
        '</div>';

    } else if (tab === 'conclusiones') {
      var C = c.patInicial, flujoAnual = c.flujoLibre * 12, gBase = c.g, libertad = s.gastoLibertad || 0, H = c.H;

      // --- escenarios predictivos (conservador / base / optimista) ---
      var scen = [
        { key: 'cons', label: L.scenCons, g: gBase * 0.6 },
        { key: 'base', label: L.scenBase, g: gBase },
        { key: 'opt',  label: L.scenOpt,  g: gBase * 1.4 }
      ].map(function (sc) {
        // El Número de Seguridad se mide contra la renta neta (rr), constante entre escenarios;
        // lo que cambia por escenario es la VELOCIDAD de crecimiento del patrimonio (sc.g).
        return { key: sc.key, label: sc.label, g: sc.g, patH: pnPatAt(C, flujoAnual, sc.g, H), fy: pnFreedomYears2(C, flujoAnual, sc.g, c.NSE) };
      });
      var maxPat = Math.max.apply(null, scen.map(function (x) { return x.patH; }).concat([1]));
      var scenRows = scen.map(function (sc) {
        var fyTxt = sc.fy == null ? '—' : f.dec(sc.fy, 1) + ' ' + L.unitYears;
        return '<div class="pn-scn">' +
          '<div class="pn-scn-head"><span class="pn-scn-lbl">' + escapeHtml(sc.label) + ' · ' + f.dec(sc.g * 100, (sc.g * 100) % 1 ? 1 : 0) + '%</span>' +
          '<span class="pn-scn-val">' + f.fmt(sc.patH) + ' USD</span></div>' +
          '<div class="bar-track bar-track-6"><div class="bar-fill" style="width:' + (sc.patH / maxPat * 100).toFixed(0) + '%;background:' + (sc.key === 'base' ? '#E6C788' : 'rgba(230,199,136,0.45)') + '"></div></div>' +
          '<div class="pn-scn-sub">' + escapeHtml(L.pnEscLibertad) + ': ' + fyTxt + '</div>' +
        '</div>';
      }).join('');

      // --- palancas (sensibilidad desde la situación actual) ---
      var baseFy = c.aniosLibertad, basePatH = pnPatAt(C, flujoAnual, gBase, H);
      function levAporte() {
        var fy2 = pnFreedomYears2(C, (c.flujoLibre + 500) * 12, gBase, c.NSE);
        if (fy2 == null || baseFy == null) return L.pnLevNada;
        var d = baseFy - fy2;
        return d > 0.05 ? L.pnLevAdelanta + ' ' + f.dec(d, 1) + ' ' + L.unitYears : L.pnLevNada;
      }
      function levCapital() {
        var d = pnPatAt(C + 20000, flujoAnual, gBase, H) - basePatH;
        return '+' + f.fmt(d) + ' USD ' + L.pnLevMasPat;
      }
      function levValoriz() {
        var d = pnPatAt(C, flujoAnual, gBase + 0.01, H) - basePatH;
        return '+' + f.fmt(d) + ' USD ' + L.pnLevMasPat;
      }
      var levRow = function (label, effect) {
        return '<div class="pn-lev"><span class="pn-lev-act">' + escapeHtml(label) + '</span>' +
          '<span class="pn-lev-arrow">→</span><span class="pn-lev-eff">' + escapeHtml(effect) + '</span></div>';
      };
      var palancas = levRow(L.pnLevAporte, levAporte()) + levRow(L.pnLevCapital, levCapital()) + levRow(L.pnLevValoriz, levValoriz());

      // --- cartera (viabilidad de los proyectos añadidos) ---
      var cc = compute();
      var pv = cc.projView.slice().sort(function (a, b) { return b.tir - a.tir; });
      var nViables = pv.filter(function (x) { return x.viable; }).length;
      var best = pv[0];
      var carteraHtml = best
        ? '<div class="pn-tiles pn-tiles-2">' +
            tile(L.pnMejorProy, escapeHtml(best.name) + ' · ' + f.pct(best.tir, 0) + '%', '') +
            tile(L.pnViablesN, nViables + ' ' + escapeHtml(L.pnDe) + ' ' + pv.length, '') +
          '</div>' +
          (c.dealsGain > 0 ? '<div class="cap-poder-line sub-line" style="margin-top:12px"><span>' + escapeHtml(L.pnImpulsoDeals) + '</span>: <span>+' + f.fmt(c.dealsGain) + ' USD</span></div>' : '')
        : '<p class="card-help">' + escapeHtml(L.pnSinProy) + '</p>';

      html =
        '<div class="panel card card-accent card-span pn-hero">' +
          '<div class="eyebrow">' + escapeHtml(L.pnConclEyebrow) + '</div>' +
          '<p class="card-help">' + escapeHtml(L.pnConclHelp) + '</p>' +
          '<div class="verdict ' + c.verdict.cls + '" style="margin-top:14px">' + escapeHtml(c.verdict.text) + '</div>' +
          '<div class="pn-concl-grid">' +
            '<div class="pn-concl-block">' +
              '<div class="eyebrow eyebrow-tight">' + escapeHtml(L.pnPredic) + '</div>' +
              '<p class="card-help card-help-mb">' + escapeHtml(L.pnPredicHelp) + '</p>' +
              '<div class="pn-scn-list">' + scenRows + '</div>' +
            '</div>' +
            '<div class="pn-concl-block">' +
              '<div class="eyebrow eyebrow-tight">' + escapeHtml(L.pnPalancas) + '</div>' +
              '<p class="card-help card-help-mb">' + escapeHtml(L.pnPalancasHelp) + '</p>' +
              '<div class="pn-lev-list">' + palancas + '</div>' +
              '<div class="eyebrow eyebrow-tight" style="margin-top:22px">' + escapeHtml(L.pnCartera) + '</div>' +
              carteraHtml +
              '<button type="button" class="pn-cta" id="pn-goto-proyecto">' + escapeHtml(L.pnAbrirProyecto) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    res.innerHTML = html;
    var goto = $('pn-goto-proyecto');
    if (goto) goto.addEventListener('click', function () { state.view = 'proyecto'; commit(); });
  }

  /* --------------------------------------------------------- rendering ---- */
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }

  /* ============ Módulos registrables: Shopping / Portafolio / Checklist ==== */
  function regNumInput(mod, id, field, step, val) {
    return '<input class="num-input" type="number" step="' + step + '" inputmode="decimal" data-mod="' + mod +
      '" data-id="' + id + '" data-field="' + field + '" value="' + (val != null ? val : '') + '">';
  }
  function regField(mod, id, field, label, step, val) {
    return '<div class="input-group"><span class="input-label">' + escapeHtml(label) + '</span>' + regNumInput(mod, id, field, step, val) + '</div>';
  }

  // ---- Shopping inmobiliario ----
  function computeShopping() {
    var rows = state.shopping.map(function (r) {
      var m2p = r.m2 > 0 ? r.precio / r.m2 : 0;
      var d = (r.inicialPct || 0) / 100, g = (r.valoriz || 0) / 100;
      var tir = (r.precio > 0 && r.meses > 0 && d > 0)
        ? Math.pow(1 + ((r.precio * Math.pow(1 + g, r.meses) - r.precio) / (r.precio * d)), 12 / r.meses) - 1 : 0;
      return { id: r.id, m2p: m2p, tir: tir, valid: r.precio > 0 && r.m2 > 0 };
    });
    var valids = rows.filter(function (x) { return x.valid; });
    var avgP = valids.length ? valids.reduce(function (a, b) { return a + b.m2p; }, 0) / valids.length : 0;
    var avgT = valids.length ? valids.reduce(function (a, b) { return a + b.tir; }, 0) / valids.length : 0;
    rows.forEach(function (x) {
      if (!x.valid || avgP <= 0) x.rank = null;
      else if (x.m2p < avgP * 0.92) x.rank = 'mejor';
      else if (x.m2p > avgP * 1.08) x.rank = 'sobre';
      else x.rank = 'justo';
    });
    return { rows: rows, avgP: avgP, avgT: avgT, n: valids.length };
  }
  function paintShopping() {
    var c = computeShopping(), f = makeFmt(state.lang), L = T[state.lang];
    c.rows.forEach(function (x) {
      setText('shd-price-' + x.id, x.valid ? f.fmt(x.m2p) : '—');
      setText('shd-tir-' + x.id, x.valid ? f.pct(x.tir, 0) + '%' : '—');
      var rk = $('shd-rank-' + x.id);
      if (rk) {
        rk.textContent = x.rank === 'mejor' ? L.shopMejor : x.rank === 'sobre' ? L.shopSobre : x.rank === 'justo' ? L.shopJusto : '—';
        rk.className = 'viab-badge ' + (x.rank === 'mejor' ? 'ok' : x.rank === 'sobre' ? 'no' : 'mid');
      }
    });
    setText('sh-sum-price', c.avgP > 0 ? f.fmt(c.avgP) + ' USD' : '—');
    setText('sh-sum-tir', c.n ? f.pct(c.avgT, 0) + '%' : '—');
    setText('sh-sum-n', String(c.n));
  }
  function renderComparar() {
    var L = T[state.lang];
    var cards = state.shopping.map(function (r) {
      return '<div class="reg-card">' +
        '<div class="reg-head"><input class="num-input plain reg-name" type="text" data-mod="shop" data-id="' + r.id + '" data-field="name" value="' + escapeHtml(r.name || '') + '" placeholder="' + escapeHtml(L.shopNombre) + '">' +
          '<button class="reg-del" type="button" data-del="shop:' + r.id + '" aria-label="' + escapeHtml(L.pjRemove) + '">×</button></div>' +
        '<div class="reg-grid">' +
          regField('shop', r.id, 'm2', L.shopM2, '1', r.m2) +
          regField('shop', r.id, 'precio', L.shopPrecio, '1000', r.precio) +
          regField('shop', r.id, 'inicialPct', L.shopInicial, '1', r.inicialPct) +
          regField('shop', r.id, 'meses', L.shopMeses, '1', r.meses) +
          regField('shop', r.id, 'valoriz', L.shopValoriz, '0.1', r.valoriz) +
        '</div>' +
        '<div class="pn-mk-stats reg-out">' +
          '<div class="pn-stat"><div class="pn-stat-v" id="shd-price-' + r.id + '"></div><div class="pn-stat-l">' + escapeHtml(L.shopM2Price) + '</div></div>' +
          '<div class="pn-stat"><div class="pn-stat-v" id="shd-tir-' + r.id + '"></div><div class="pn-stat-l">' + escapeHtml(L.shopTir) + '</div></div>' +
          '<div class="pn-stat pn-stat-badge"><span class="viab-badge" id="shd-rank-' + r.id + '"></span></div>' +
        '</div>' +
      '</div>';
    }).join('');
    if (!state.shopping.length) cards = '<p class="card-help">' + escapeHtml(L.shopVacio) + '</p>';
    $('proj-comparar').innerHTML =
      '<div class="panel card card-span pn-solo">' +
        '<div class="eyebrow">' + escapeHtml(L.shopTitulo) + '</div>' +
        '<p class="card-help card-help-mb">' + escapeHtml(L.shopHelp) + '</p>' +
        '<div class="pn-mk-stats reg-summary">' +
          '<div class="pn-stat"><div class="pn-stat-v" id="sh-sum-price"></div><div class="pn-stat-l">' + escapeHtml(L.shopProm) + '</div></div>' +
          '<div class="pn-stat"><div class="pn-stat-v" id="sh-sum-tir"></div><div class="pn-stat-l">' + escapeHtml(L.shopTirProm) + '</div></div>' +
          '<div class="pn-stat"><div class="pn-stat-v" id="sh-sum-n"></div><div class="pn-stat-l">' + escapeHtml(L.shopN) + '</div></div>' +
        '</div>' +
        '<div class="reg-list">' + cards + '</div>' +
        '<button class="pn-cta" type="button" data-add="shop">' + escapeHtml(L.shopAdd) + '</button>' +
      '</div>';
    wireRegSection('proj-comparar', paintShopping);
    paintShopping();
  }

  // ---- Portafolio mensual ----
  function computePortafolio() {
    // Punto 6: reales vs. plan. Si registras avalúo real o pagado real, se usan
    // esos y se muestra la desviación contra la proyección del plan.
    var rows = state.portafolio.map(function (r) {
      var avance = r.mesesObra > 0 ? Math.min(r.mesActual / r.mesesObra, 1) : 0;
      var valorPlan = r.precioCompra > 0 ? r.precioCompra * Math.pow(1 + (r.valoriz != null ? r.valoriz : 1) / 100, r.mesActual || 0) : 0;
      var valorReal = r.valorReal > 0 ? r.valorReal : 0;
      var valor = valorReal > 0 ? valorReal : valorPlan;              // real-preferido
      var gan = r.precioCompra > 0 ? valor - r.precioCompra : 0;
      var desv = valorReal > 0 ? valorReal - valorPlan : null;        // real vs plan
      var pagadoPlan = (r.cuotaInicial || 0) * avance;
      var pagado = r.pagado > 0 ? r.pagado : pagadoPlan;
      var accion = r.precioCompra <= 0 ? '' : (avance >= 0.9 ? 'salida' : avance >= 0.6 ? 'monitor' : 'obra');
      return { id: r.id, avance: avance, valor: valor, valorReal: valorReal, gan: gan, desv: desv,
        pagado: pagado, pagadoPlan: pagadoPlan, accion: accion, valid: r.precioCompra > 0 };
    });
    var valids = rows.filter(function (x) { return x.valid; });
    return { rows: rows, activos: valids.length,
      invertido: valids.reduce(function (a, b) { return a + b.pagado; }, 0),   // pagado real (o plan)
      valorTotal: valids.reduce(function (a, b) { return a + b.valor; }, 0),
      ganTotal: valids.reduce(function (a, b) { return a + b.gan; }, 0),
      desvTotal: valids.reduce(function (a, b) { return a + (b.desv || 0); }, 0) };
  }
  function paintPortafolio() {
    var c = computePortafolio(), f = makeFmt(state.lang), L = T[state.lang];
    c.rows.forEach(function (x) {
      setText('pod-avance-' + x.id, x.valid ? f.pct(x.avance, 0) + '%' : '—');
      setText('pod-valor-' + x.id, x.valid ? f.fmt(x.valor) + (x.valorReal > 0 ? ' ●' : '') : '—');
      setText('pod-gan-' + x.id, x.valid ? '+' + f.fmt(x.gan) : '—');
      var dv = $('pod-desv-' + x.id);
      if (dv) {
        if (!x.valid || x.desv == null) { dv.textContent = '—'; dv.className = ''; }
        else { dv.textContent = (x.desv >= 0 ? '+' : '') + f.fmt(x.desv) + ' USD'; dv.className = x.desv >= 0 ? 'pod-ok' : 'pod-bad'; }
      }
      setText('pod-pago-' + x.id, x.valid ? f.fmt(x.pagado) + ' / ' + f.fmt(x.pagadoPlan) + ' USD' : '—');
      var ac = $('pod-accion-' + x.id);
      if (ac) {
        ac.textContent = x.accion === 'salida' ? L.portSalida : x.accion === 'monitor' ? L.portMonitor : x.accion === 'obra' ? L.portObra : '—';
        ac.className = 'scen-verdict pod-accion ' + (x.accion === 'salida' ? '' : x.accion === 'monitor' ? 'mid' : '');
      }
    });
    setText('po-sum-act', String(c.activos));
    setText('po-sum-inv', f.fmt(c.invertido) + ' USD');
    setText('po-sum-val', f.fmt(c.valorTotal) + ' USD');
    setText('po-sum-gan', '+' + f.fmt(c.ganTotal) + ' USD');
  }
  function renderPortafolio() {
    var L = T[state.lang];
    var cards = state.portafolio.map(function (r) {
      return '<div class="reg-card">' +
        '<div class="reg-head"><input class="num-input plain reg-name" type="text" data-mod="port" data-id="' + r.id + '" data-field="name" value="' + escapeHtml(r.name || '') + '" placeholder="' + escapeHtml(L.portNombre) + '">' +
          '<button class="reg-del" type="button" data-del="port:' + r.id + '" aria-label="' + escapeHtml(L.pjRemove) + '">×</button></div>' +
        '<div class="reg-grid">' +
          regField('port', r.id, 'precioCompra', L.portPrecio, '1000', r.precioCompra) +
          regField('port', r.id, 'cuotaInicial', L.portCuota, '500', r.cuotaInicial) +
          regField('port', r.id, 'mesesObra', L.portMeses, '1', r.mesesObra) +
          regField('port', r.id, 'mesActual', L.portMesActual, '1', r.mesActual) +
          regField('port', r.id, 'valoriz', L.portValoriz, '0.1', r.valoriz) +
          regField('port', r.id, 'valorReal', L.portValorReal, '1000', r.valorReal) +
          regField('port', r.id, 'pagado', L.portPagado, '500', r.pagado) +
        '</div>' +
        '<div class="pn-mk-stats reg-out">' +
          '<div class="pn-stat"><div class="pn-stat-v" id="pod-avance-' + r.id + '"></div><div class="pn-stat-l">' + escapeHtml(L.portAvance) + '</div></div>' +
          '<div class="pn-stat"><div class="pn-stat-v" id="pod-valor-' + r.id + '"></div><div class="pn-stat-l">' + escapeHtml(L.portValor) + '</div></div>' +
          '<div class="pn-stat"><div class="pn-stat-v" id="pod-gan-' + r.id + '"></div><div class="pn-stat-l">' + escapeHtml(L.portGanancia) + '</div></div>' +
        '</div>' +
        '<div class="pod-lines">' +
          '<div class="pod-line"><span>' + escapeHtml(L.portDesv) + '</span><span id="pod-desv-' + r.id + '"></span></div>' +
          '<div class="pod-line"><span>' + escapeHtml(L.portPagoPlan) + '</span><span id="pod-pago-' + r.id + '"></span></div>' +
        '</div>' +
        '<div class="scen-verdict pod-accion" id="pod-accion-' + r.id + '"></div>' +
      '</div>';
    }).join('');
    if (!state.portafolio.length) cards = '<p class="card-help">' + escapeHtml(L.portVacio) + '</p>';
    $('proj-portafolio').innerHTML =
      '<div class="panel card card-span pn-solo">' +
        '<div class="eyebrow">' + escapeHtml(L.portTitulo) + '</div>' +
        '<p class="card-help card-help-mb">' + escapeHtml(L.portHelp) + '</p>' +
        '<div class="pn-tiles pn-tiles-2 reg-summary">' +
          '<div class="pn-tile"><div class="pn-tile-val" id="po-sum-val"></div><div class="pn-tile-lbl">' + escapeHtml(L.portValorTotal) + '</div></div>' +
          '<div class="pn-tile"><div class="pn-tile-val" id="po-sum-gan"></div><div class="pn-tile-lbl">' + escapeHtml(L.portGananciaTotal) + '</div></div>' +
          '<div class="pn-tile"><div class="pn-tile-val" id="po-sum-inv"></div><div class="pn-tile-lbl">' + escapeHtml(L.portInvertido) + '</div></div>' +
          '<div class="pn-tile"><div class="pn-tile-val" id="po-sum-act"></div><div class="pn-tile-lbl">' + escapeHtml(L.portActivos) + '</div></div>' +
        '</div>' +
        '<div class="reg-list">' + cards + '</div>' +
        '<button class="pn-cta" type="button" data-add="port">' + escapeHtml(L.portAdd) + '</button>' +
      '</div>';
    wireRegSection('proj-portafolio', paintPortafolio);
    paintPortafolio();
  }

  // ---- Checklist y scoring ----
  function paintChecklist() {
    var f = makeFmt(state.lang), L = T[state.lang], ch = state.checklist, total = 0, wsum = 0;
    CHECKLIST_CRIT.forEach(function (cr, i) { total += cr.peso * (ch.scores[i] || 0); wsum += cr.peso; });
    var score = wsum > 0 ? total / wsum : 0;
    setText('chk-total', f.dec(score, 1));
    var v = $('chk-verdict');
    if (v) {
      var t, cls;
      if (score >= 4) { t = L.chkExcelente; cls = ''; }
      else if (score >= 3) { t = L.chkAceptable; cls = 'mid'; }
      else { t = L.chkDebil; cls = 'warn'; }
      v.textContent = t; v.className = 'verdict ' + cls;
    }
  }
  function renderChecklist() {
    var L = T[state.lang], ch = state.checklist;
    var rows = CHECKLIST_CRIT.map(function (cr, i) {
      var val = ch.scores[i] != null ? ch.scores[i] : 3;
      return '<div class="chk-row">' +
        '<div class="chk-crit"><span class="chk-name">' + escapeHtml(cr.name[state.lang]) + '</span>' +
          '<span class="chk-peso">' + escapeHtml(L.chkPeso) + ' ' + Math.round(cr.peso * 100) + '%</span></div>' +
        '<div class="chk-ctrl"><input type="range" class="rng" min="0" max="5" step="1" data-chk="' + i + '" value="' + val + '">' +
          '<span class="chk-val" id="chk-val-' + i + '">' + val + '</span></div>' +
      '</div>';
    }).join('');
    $('proj-checklist').innerHTML =
      '<div class="panel card card-span pn-solo">' +
        '<div class="eyebrow">' + escapeHtml(L.chkTitulo) + '</div>' +
        '<p class="card-help card-help-mb">' + escapeHtml(L.chkHelp) + '</p>' +
        '<div class="input-group"><span class="input-label">' + escapeHtml(L.chkNombre) + '</span>' +
          '<input class="num-input plain" id="chk-nombre" type="text" value="' + escapeHtml(ch.nombre || '') + '"></div>' +
        '<div class="chk-list">' + rows + '</div>' +
        '<div class="big-num-row"><span class="big-num" id="chk-total"></span><span class="big-num-unit">/ 5</span></div>' +
        '<div class="sub-line">' + escapeHtml(L.chkTotal) + '</div>' +
        '<div class="verdict" id="chk-verdict"></div>' +
      '</div>';
    $('chk-nombre').addEventListener('input', function (e) { state.checklist.nombre = e.target.value; saveState(); });
    $('proj-checklist').querySelectorAll('input[data-chk]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = +inp.getAttribute('data-chk');
        state.checklist.scores[i] = +inp.value;
        setText('chk-val-' + i, inp.value);
        saveState(); paintChecklist();
      });
    });
    paintChecklist();
  }

  // wiring compartido para las secciones registrables (inputs, borrar, añadir)
  function wireRegSection(containerId, paint) {
    var cont = $(containerId);
    cont.querySelectorAll('input[data-mod]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var mod = inp.getAttribute('data-mod'), id = inp.getAttribute('data-id'), field = inp.getAttribute('data-field');
        var arr = mod === 'shop' ? state.shopping : state.portafolio;
        var r = arr.filter(function (x) { return x.id === id; })[0];
        if (!r) return;
        r[field] = field === 'name' ? inp.value : parseNum(inp.value);
        saveState(); paint();
      });
    });
    cont.querySelectorAll('.reg-del').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-del').split(':'), mod = parts[0], id = parts[1];
        if (mod === 'shop') { state.shopping = state.shopping.filter(function (x) { return x.id !== id; }); saveState(); renderComparar(); }
        else { state.portafolio = state.portafolio.filter(function (x) { return x.id !== id; }); saveState(); renderPortafolio(); }
      });
    });
    cont.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('data-add') === 'shop') { state.shopping.push({ id: uid(), name: '', m2: 0, precio: 0, inicialPct: 30, meses: 30, valoriz: 1 }); saveState(); renderComparar(); }
        else { state.portafolio.push({ id: uid(), name: '', precioCompra: 0, cuotaInicial: 0, mesesObra: 30, mesActual: 0, valoriz: 1, valorReal: 0, pagado: 0 }); saveState(); renderPortafolio(); }
      });
    });
  }

  /* Punto 8: respaldo — exportar/importar todo el estado como JSON (un clic). */
  var BACKUP_KEYS = ['lang', 'view', 'panelTab', 'projTab', 'perfilNombre', 'ingreso', 'gasto', 'deudas',
    'capital', 'horizonte', 'inflacion', 'valorizacionEsp', 'gastoLibertad', 'rendRenta',
    'projects', 'activeId', 'shopping', 'portafolio', 'checklist'];
  function exportData() {
    try {
      var data = { _app: 'crd-calc', _v: 2, _ts: new Date().toISOString() };
      BACKUP_KEYS.forEach(function (k) { data[k] = state[k]; });
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'calculadora-viabilidad-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { /* ignore */ }
  }
  function importData(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var msg = $('pn-import-msg');
      try {
        var data = JSON.parse(e.target.result);
        BACKUP_KEYS.forEach(function (k) {
          if (data[k] == null) return;
          if (k === 'projects' || k === 'shopping' || k === 'portafolio') { if (Array.isArray(data[k])) state[k] = data[k]; }
          else state[k] = data[k];
        });
        if (!state.projects || !state.projects.length) state.projects = defaultProjects();
        if (!state.activeId || !state.projects.some(function (p) { return p.id === state.activeId; })) state.activeId = state.projects[0].id;
        saveState(); render();
        if (msg) { msg.textContent = T[state.lang].pnImportOk; msg.className = 'sec-note pn-import-ok'; }
      } catch (err) {
        if (msg) { msg.textContent = T[state.lang].pnImportErr; msg.className = 'sec-note pn-import-err'; }
      }
    };
    reader.readAsText(file);
  }

  /* Punto 8: exportar CSV (portafolio + shopping) para socios/asesores/Excel. */
  function csvCell(v) {
    if (v == null) v = '';
    v = String(v);
    return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function csvRow(arr) { return arr.map(csvCell).join(';'); }
  function exportCSV() {
    try {
      var L = T[state.lang], lines = [];
      var cp = computePortafolio();
      // --- Portafolio en marcha ---
      lines.push(csvRow([L.projPortafolio || 'Portafolio']));
      lines.push(csvRow([L.portNombre, L.portPrecio, L.portCuota, 'Avance %',
        'Valor', 'Ganancia', 'Desv. vs plan', L.portPagado || 'Pagado', 'Plan']));
      state.portafolio.forEach(function (r, i) {
        var x = cp.rows[i] || {};
        lines.push(csvRow([r.name, r.precioCompra, r.cuotaInicial,
          x.valid ? Math.round((x.avance || 0) * 100) : '',
          x.valid ? Math.round(x.valor) : '', x.valid ? Math.round(x.gan) : '',
          (x.desv == null ? '' : Math.round(x.desv)),
          x.valid ? Math.round(x.pagado) : '', x.valid ? Math.round(x.pagadoPlan) : '']));
      });
      lines.push(csvRow([L.portTotal || 'Total', '', '', '', Math.round(cp.valorTotal),
        Math.round(cp.ganTotal), Math.round(cp.desvTotal), Math.round(cp.invertido), '']));
      lines.push('');
      // --- Shopping inmobiliario ---
      lines.push(csvRow([L.projComparar || 'Shopping']));
      lines.push(csvRow([L.shopNombre || 'Proyecto', 'm²', L.shopPrecio || 'Precio',
        'Inicial %', L.shopMeses || 'Meses', L.shopValoriz || 'Valoriz %/mes', 'USD/m²']));
      (state.shopping || []).forEach(function (s) {
        lines.push(csvRow([s.name, s.m2, s.precio, s.inicialPct, s.meses, s.valoriz,
          (s.m2 > 0 ? Math.round(s.precio / s.m2) : '')]));
      });
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'viabilidad-portafolio-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { /* ignore */ }
  }

  /* Punto 8: informe PDF — abre el Resumen y usa el diálogo de impresión del
     navegador (Guardar como PDF). El CSS @media print limpia la vista. */
  function printReport() {
    state.view = 'panel'; state.panelTab = 'resumen';
    saveState(); render();
    setTimeout(function () { window.print(); }, 250);
  }

  function renderStaticText() {
    var L = T[state.lang];
    document.documentElement.lang = state.lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (L[key] != null) nodes[i].textContent = L[key];
    }
    var langBtns = document.querySelectorAll('.lang-btn');
    for (var j = 0; j < langBtns.length; j++) {
      langBtns[j].classList.toggle('active', langBtns[j].getAttribute('data-lang') === state.lang);
    }
    window.__forgotTr = { sending: L.forgotSending, placeholder: L.forgotPlaceholder };
    var fe = document.getElementById('forgot-email');
    if (fe) fe.placeholder = L.forgotPlaceholder;
  }

  function commit() { saveState(); render(); }

  function buildProjectsBar() {
    var L = T[state.lang];
    var bar = $('projects-bar');
    bar.innerHTML = '';
    state.projects.forEach(function (pr) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'proj-chip' + (pr.id === state.activeId ? ' active' : '');
      chip.innerHTML = '<span class="proj-chip-name">' + escapeHtml(pr.name || L.addProject) + '</span>' +
        (pr.location ? '<span class="proj-chip-loc">' + escapeHtml(pr.location) + '</span>' : '');
      chip.addEventListener('click', function () { state.activeId = pr.id; commit(); });
      bar.appendChild(chip);
    });
    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'proj-chip proj-add';
    add.innerHTML = '<span>+ ' + escapeHtml(L.addProject) + '</span>';
    add.addEventListener('click', function () {
      var np = { id: uid(), name: L.addProject + ' ' + (state.projects.length + 1), location: '', moneda: 'USD',
        valor: 120000, inicialPct: 30, planMeses: 36, valorizacion: 8,
        entryModel: 'cero', entradaPremium: 12, exitStrategy: 'flip', rentaBruta: 8, ocupacion: 70,
        costoCierre: 3, margenError: 15, vehiculo: 'otro', taxRate: 30, diferimiento: true, devaluacion: 0,
        finType: 'banco', finTasa: 10, finPlazo: 20, ltvMax: 70, prepagoPct: 0,
        gestionPasiva: false, respaldoVerificado: false, p5: defaultP5() };
      state.projects.push(np);
      state.activeId = np.id;
      commit();
    });
    bar.appendChild(add);
  }

  function buildSegments() {
    var L = T[state.lang], p = activeProject();

    var segH = $('seg-horizonte');
    segH.innerHTML = '';
    [5, 10, 15].forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + (state.horizonte === v ? ' active' : '');
      b.innerHTML = String(v) + '<span class="unit"> ' + L.unitYears + '</span>';
      b.addEventListener('click', function () { state.horizonte = v; commit(); });
      segH.appendChild(b);
    });

    var segE = $('seg-entrada');
    segE.innerHTML = '';
    [['cero', L.entListaCero], ['marcha', L.entMarcha]].forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + ((p.entryModel || 'cero') === opt[0] ? ' active' : '');
      b.textContent = opt[1];
      b.addEventListener('click', function () { p.entryModel = opt[0]; commit(); });
      segE.appendChild(b);
    });

    var segS = $('seg-salida');
    segS.innerHTML = '';
    [['cesion', L.exitCesion], ['flip', L.exitFlip], ['renta', L.exitRenta]].forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + ((p.exitStrategy || 'flip') === opt[0] ? ' active' : '');
      b.textContent = opt[1];
      b.addEventListener('click', function () { p.exitStrategy = opt[0]; commit(); });
      segS.appendChild(b);
    });

    var segF = $('seg-fintipo');
    segF.innerHTML = '';
    [['banco', L.finBanco], ['constructora', L.finConstructora]].forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + (p.finType === opt[0] ? ' active' : '');
      b.textContent = opt[1];
      b.addEventListener('click', function () {
        p.finType = opt[0];
        // sensible presets when switching financing type
        if (opt[0] === 'constructora') { p.finTasa = 0; p.finPlazo = 6; }
        else { if (p.finTasa === 0) p.finTasa = 10; if (p.finPlazo < 10) p.finPlazo = 20; }
        commit();
      });
      segF.appendChild(b);
    });
  }

  function render() {
    var s = state, c = compute(), f = c.f, L = c.L, p = c.p;

    $('login').hidden = s.screen !== 'login';
    $('app').hidden = s.screen !== 'app';

    renderStaticText();
    if (s.screen !== 'app') return;

    // view switching (Panel dashboard vs. project analyzer)
    var view = s.view || 'panel';
    if ($('view-panel')) $('view-panel').hidden = view !== 'panel';
    if ($('view-proyecto')) $('view-proyecto').hidden = view !== 'proyecto';
    var navBtns = document.querySelectorAll('.nav-btn');
    for (var nb = 0; nb < navBtns.length; nb++) {
      navBtns[nb].classList.toggle('active', navBtns[nb].getAttribute('data-view') === view);
    }
    if ($('panel-results')) renderPanel();

    // project sub-tabs (Analizar / Comparar / Portafolio / Checklist)
    var pjt = s.projTab || 'analizar';
    var pjMap = { analizar: 'proj-analizar', comparar: 'proj-comparar', portafolio: 'proj-portafolio', checklist: 'proj-checklist' };
    Object.keys(pjMap).forEach(function (k) { var el = $(pjMap[k]); if (el) el.hidden = pjt !== k; });
    var pjBtns = document.querySelectorAll('.proj-subtab');
    for (var pj = 0; pj < pjBtns.length; pj++) {
      pjBtns[pj].classList.toggle('active', pjBtns[pj].getAttribute('data-ptab') === pjt);
    }
    if (view === 'proyecto') {
      if (pjt === 'comparar' && $('proj-comparar')) renderComparar();
      else if (pjt === 'portafolio' && $('proj-portafolio')) renderPortafolio();
      else if (pjt === 'checklist' && $('proj-checklist')) renderChecklist();
    }

    $('app').setAttribute('data-tab', mqMobile.matches ? s.mobileTab : 'all');
    var tabBtns = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].classList.toggle('active', tabBtns[i].getAttribute('data-tab') === s.mobileTab);
    }

    buildProjectsBar();
    buildSegments();

    // project identity
    setNumIfIdle('in-nombre', p.name, true);
    setNumIfIdle('in-ubicacion', p.location, true);
    setNumIfIdle('in-moneda', p.moneda, true);

    // personal situation (shared)
    setNumIfIdle('in-ingreso', s.ingreso);
    setNumIfIdle('in-gasto', s.gasto);
    setNumIfIdle('in-deudas', s.deudas);
    setNumIfIdle('in-capital', s.capital);
    $('in-inflacion').value = s.inflacion;
    setText('val-inflacion', f.dec(s.inflacion, s.inflacion % 1 ? 1 : 0) + '%');

    // opportunity
    setNumIfIdle('in-valor', p.valor);
    $('in-inicial').value = p.inicialPct;
    $('in-plan').value = p.planMeses;
    $('in-valoriz').value = p.valorizacion;
    $('in-cierre').value = p.costoCierre;
    $('in-margen').value = p.margenError;
    $('in-tax').value = p.taxRate;
    $('in-fintasa').value = p.finTasa;
    $('in-finplazo').value = p.finPlazo;
    setText('val-inicial', f.dec(p.inicialPct, 0) + '%');
    setText('val-plan', p.planMeses + ' ' + L.unitMonths);
    setText('val-valoriz', f.dec(p.valorizacion, 1) + '%');
    setText('val-cierre', f.dec(p.costoCierre, p.costoCierre % 1 ? 1 : 0) + '%');
    setText('val-margen', f.dec(p.margenError, 0) + '%');
    setText('val-tax', f.dec(p.taxRate, 0) + '%');
    // tax vehicle select
    var selV = $('sel-vehiculo');
    selV.innerHTML = '';
    VEHICULOS.forEach(function (v) {
      var o = document.createElement('option'); o.value = v.id; o.textContent = v.name[s.lang];
      if ((p.vehiculo || 'otro') === v.id) o.selected = true;
      selV.appendChild(o);
    });
    var vObj = VEHICULOS.filter(function (v) { return v.id === (p.vehiculo || 'otro'); })[0] || VEHICULOS[0];
    var vehNota = vObj.note[s.lang];
    if (vObj.valoriz != null) vehNota += ' · ' + L.pnRefValoriz + ' ~' + vObj.valoriz + '% · ' + L.pnRefRenta + ' ~' + vObj.renta + '%';
    setText('veh-nota', vehNota);
    // devaluation (only for local-currency projects)
    $('in-devaluacion').value = p.devaluacion || 0;
    setText('val-devaluacion', f.dec(p.devaluacion || 0, 0) + '%');
    $('grp-devaluacion').style.display = fxRisk(p.moneda) ? '' : 'none';
    $('in-entpremium').value = p.entradaPremium;
    setText('val-entpremium', f.dec(p.entradaPremium, 0) + '%');
    $('grp-entpremium').style.display = (p.entryModel === 'marcha') ? '' : 'none';
    setText('ent-nota', p.entryModel === 'marcha' ? L.entradaNotaMarcha : L.entradaNotaCero);
    setText('sal-nota', p.exitStrategy === 'cesion' ? L.salidaNotaCesion : (p.exitStrategy === 'renta' ? L.salidaNotaRenta : L.salidaNotaFlip));
    $('in-rentabruta').value = p.rentaBruta;
    $('in-ocupacion').value = p.ocupacion;
    setText('val-rentabruta', f.dec(p.rentaBruta, 0) + '%');
    setText('val-ocupacion', f.dec(p.ocupacion, 0) + '%');
    $('in-opex').value = c.opexPct;
    setText('val-opex', f.dec(c.opexPct, 0) + '%');
    $('in-rentatax').value = c.rentaTaxPct;
    setText('val-rentatax', f.dec(c.rentaTaxPct, 0) + '%');
    setText('val-fintasa', f.dec(p.finTasa, p.finTasa % 1 ? 1 : 0) + '%');
    setText('val-finplazo', p.finPlazo + ' ' + L.unitYears);
    setText('fin-nota', p.finType === 'constructora' ? L.finConstructoraNota : L.finBancoNota);
    $('in-ltv').value = p.ltvMax != null ? p.ltvMax : 70;
    setText('val-ltv', f.dec(p.ltvMax != null ? p.ltvMax : 70, 0) + '%');
    $('grp-ltv').style.display = (p.finType === 'banco') ? '' : 'none';

    var sw = $('dif-toggle');
    sw.classList.toggle('on', p.diferimiento);
    sw.setAttribute('aria-checked', p.diferimiento ? 'true' : 'false');
    setText('dif-label', p.diferimiento ? L.difOn : L.difOff);

    // IRR card + verdict
    setText('tir-ap', f.pct(c.tir));
    setText('tir-sin', f.pct(c.tirSin));
    setText('tir-multiple', f.dec(c.multiple, 1) + '×');
    setText('tir-roi', f.pct(c.roi, 0) + '%');
    var verdictEl = $('tir-verdict');
    verdictEl.textContent = c.verdict.text;
    verdictEl.className = 'verdict' + (c.verdict.cls ? ' ' + c.verdict.cls : '');
    var usdEl = $('tir-usd');
    if (c.esFx) { usdEl.style.display = ''; setText('tir-usd-val', f.pct(c.tirUsd) + '%'); }
    else { usdEl.style.display = 'none'; }

    // debt capacity (mortgage at handover)
    setText('cap-mensual', f.fmt(c.capHipoteca));
    setText('cap-poder', f.fmt(c.poderInversion) + ' USD');
    setText('cap-saldo', f.fmt(c.saldoHipoteca) + ' USD');
    var faltLine = $('cap-faltante-line');
    if (c.finBanco && c.faltanteHandover > 1) { faltLine.style.display = ''; setText('cap-faltante', f.fmt(c.faltanteHandover) + ' USD'); }
    else { faltLine.style.display = 'none'; }
    setText('cap-construccion', f.fmt(c.cuotaConstruccion) + ' ' + L.perMonth);
    setText('cap-hipoteca', f.fmt(c.cuotaHipotecaMes) + ' ' + L.perMonth);
    var pctText = f.pct(Math.min(c.pctHipoteca, 3), 0);
    setText('cap-pct-top', pctText + '%');
    $('cap-pct-top').style.color = c.capColor;
    var bar = $('cap-bar');
    bar.style.width = Math.min(c.pctHipoteca * 100, 100) + '%';
    bar.style.background = c.capColor;
    var status = $('cap-status');
    status.textContent = c.capEstado + ' · ' + pctText + '% ' + L.capPctUsado;
    status.style.color = c.capColor;
    var cstat = $('cap-constr-status');
    cstat.textContent = c.constrFits ? L.capConstrOk : L.capConstrExcede;
    cstat.style.color = c.constrFits ? '#9DA1A8' : '#d98b6a';

    // taxes
    setText('tax-diferido', f.fmt(c.reinvDiferido) + ' USD');
    setText('tax-neto', f.fmt(c.reinvNeto) + ' USD');
    setText('tax-ventaja', f.fmt(c.ventaja) + ' USD');
    $('tax-bar-diferido').style.width = (c.reinvDiferido / c.maxReinv * 100) + '%';
    $('tax-bar-neto').style.width = (c.reinvNeto / c.maxReinv * 100) + '%';

    // NSE
    setText('nse-mensual', f.fmt(c.nseMensual));
    setText('nse-capital', f.fmt(c.capitalLibertad));
    setText('nse-ciclos', c.ciclos);
    $('nse-libertad').textContent = L.nseLibParcial + ' (' + L.nseLibCubre + '): ' + f.fmt(c.capitalParcial) +
      ' USD · ' + L.nseLibTotal + ' (' + L.nseLibCubreT + '): ' + f.fmt(c.capitalTotal) + ' USD.';

    // projection chart
    $('chart-line').setAttribute('points', c.chartPts);
    $('chart-area').setAttribute('d', c.chartArea);
    $('chart-start').setAttribute('cx', c.chartStart.x);
    $('chart-start').setAttribute('cy', c.chartStart.y);
    $('chart-end').setAttribute('cx', c.chartEnd.x);
    $('chart-end').setAttribute('cy', c.chartEnd.y);
    setText('proj-end', f.fmt(c.endVal));
    var axis = $('chart-axis');
    axis.innerHTML = '';
    c.axisYears.forEach(function (label) { var span = document.createElement('span'); span.textContent = label; axis.appendChild(span); });

    // multi-cycle wealth (rotate & reinvest)
    setText('ciclo-final', f.fmt(c.patrimonioFinal));
    var cicloList = $('ciclo-list');
    cicloList.innerHTML = '';
    c.wealthCiclos.forEach(function (wc) {
      var row = document.createElement('div');
      row.innerHTML =
        '<div class="market-row-head">' +
          '<span class="market-name" style="color:#D7D7D9"><span class="market-dot" style="background:#E6C788"></span>' +
            escapeHtml(L.cicloLabel) + ' ' + wc.n + ' · ' + escapeHtml(L.yr) + ' ' + wc.anio + '</span>' +
          '<span class="market-tir">' + f.fmt(wc.val) + ' <span class="foot-unit">USD</span></span>' +
        '</div>' +
        '<div class="bar-track bar-track-8"><div class="bar-fill bar-fill-gold" style="width:' + (wc.val / c.maxWealth * 100) + '%"></div></div>';
      cicloList.appendChild(row);
    });
    var cv = $('ciclo-libertad');
    if (c.aniosLibertad != null) { cv.textContent = '≈ ' + c.aniosLibertad + ' ' + L.cicloLibertadPost + '.'; cv.className = 'scen-verdict'; }
    else { cv.textContent = L.cicloLibertadNo; cv.className = 'scen-verdict warn'; }

    // rent & hold decision
    setText('renta-coc', f.pct(c.cashOnCash, 1) + '%');
    setText('renta-neta', f.fmt(c.rentaNeta) + ' ' + L.perYear);
    setText('renta-flujo', f.fmt(c.flujoRenta) + ' ' + L.perYear);
    var rv = $('renta-verdict');
    rv.textContent = c.conservar ? L.rentaConservar : L.rentaVender;
    rv.className = 'scen-verdict' + (c.conservar ? '' : ' mid');
    setText('renta-dscr', c.dscr == null ? '—' : f.dec(c.dscr, 2) + '× ' + (c.dscr >= 1.25 ? L.rentaDscrOk : c.dscr >= 1 ? L.rentaDscrJusto : L.rentaDscrBajo));
    setText('renta-breakeven', c.ocupEquilibrio == null ? '—' : f.dec(c.ocupEquilibrio, 0) + '% ' + L.rentaBreakevenSuf);
    setText('renta-stress', f.fmt(c.flujoStress2) + ' ' + L.perYear);
    setText('renta-depr', f.fmt(c.escudoDepr) + ' ' + L.perYearShort);
    setText('renta-refi', f.fmt(c.refiExtraible) + ' USD');
    var rfx = $('renta-fx');
    if (rfx) { rfx.hidden = !c.rentaFxRiesgo; rfx.className = 'scen-verdict warn'; rfx.textContent = L.rentaFxAviso; }

    // scenarios
    var scenList = $('scen-list');
    scenList.innerHTML = '';
    c.scenarios.forEach(function (sc) {
      var isBase = sc.key === 'base';
      var barColor = isBase ? '#E6C788' : 'rgba(230,199,136,0.4)';
      var row = document.createElement('div');
      row.className = 'scen-row';
      row.innerHTML =
        '<div class="market-row-head">' +
          '<span class="market-name" style="color:' + (isBase ? '#E6C788' : '#D7D7D9') + '">' +
            '<span class="market-dot" style="background:' + barColor + '"></span>' + escapeHtml(sc.label) + ' · ' + f.pct(sc.g, 1) + '%' +
          '</span>' +
          '<span class="market-tir">' + f.pct(sc.tir) + '%</span>' +
        '</div>' +
        '<div class="bar-track bar-track-8"><div class="bar-fill" style="width:' + (sc.tir / c.maxScenTir * 100) + '%;background:' + barColor + '"></div></div>';
      scenList.appendChild(row);
    });
    var scenV = $('scen-verdict');
    scenV.textContent = c.reglaOro ? L.reglaOroOk : L.reglaOroNo;
    scenV.className = 'scen-verdict' + (c.reglaOro ? '' : ' warn');

    // 5 P — deal quality checklist (interactive)
    setText('p5-score', f.pct(c.p5.score, 0));
    var p5list = $('p5-list');
    p5list.innerHTML = '';
    var p5states = [[0, 'falla', '✗'], [1, 'parcial', '~'], [2, 'cumple', '✓']];
    P5_DEFS.forEach(function (def) {
      var val = (p.p5 && p.p5[def.key] != null) ? p.p5[def.key] : 2;
      var row = document.createElement('div');
      row.className = 'p5-row';
      var seg = '';
      p5states.forEach(function (st) {
        seg += '<button type="button" class="p5-btn ' + st[1] + (val === st[0] ? ' on' : '') +
          '" data-v="' + st[0] + '" aria-label="' + st[1] + '">' + st[2] + '</button>';
      });
      row.innerHTML =
        '<div class="p5-info"><span class="p5-name">' + escapeHtml(def.name[s.lang]) + '</span>' +
        '<span class="p5-hint">' + escapeHtml(def.hint[s.lang]) + '</span></div>' +
        '<div class="p5-seg">' + seg + '</div>';
      row.querySelectorAll('.p5-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!p.p5) p.p5 = defaultP5();
          p.p5[def.key] = parseInt(b.getAttribute('data-v'), 10);
          commit();
        });
      });
      p5list.appendChild(row);
    });
    var p5v = $('p5-verdict');
    p5v.textContent = c.p5Verdict.text;
    p5v.className = 'scen-verdict' + (c.p5Verdict.cls ? ' ' + c.p5Verdict.cls : '');

    // Triángulo de Inversiones Inteligentes
    var tri = c.triangulo;
    [['tri-c1', tri.c1], ['tri-c2', tri.c2], ['tri-c3', tri.c3]].forEach(function (pair) {
      var li = $(pair[0]); if (!li) return;
      li.className = 'tri-item ' + (pair[1] ? 'ok' : 'no');
      setText(pair[0] + '-state', pair[1] ? '✓' : '✗');
    });
    var tg = $('tri-gest-toggle');
    if (tg) { tg.classList.toggle('on', !!p.gestionPasiva); tg.setAttribute('aria-checked', p.gestionPasiva ? 'true' : 'false'); }
    var tr = $('tri-resp-toggle');
    if (tr) { tr.classList.toggle('on', !!p.respaldoVerificado); tr.setAttribute('aria-checked', p.respaldoVerificado ? 'true' : 'false'); }
    var triv = $('tri-verdict');
    if (triv) { triv.textContent = tri.verdict.text; triv.className = 'scen-verdict' + (tri.verdict.cls ? ' ' + tri.verdict.cls : ''); }

    // project comparison
    var list = $('market-list');
    list.innerHTML = '';
    c.projView.forEach(function (mk) {
      var barColor = mk.active ? '#E6C788' : 'rgba(230,199,136,0.4)';
      var fxTag = mk.fx ? '<span class="market-fx"> · ' + escapeHtml(L.fxRisk) + '</span>' : '';
      var badge = '<span class="viab-badge ' + (mk.viable ? 'ok' : 'no') + '">' + escapeHtml(mk.viable ? L.viable : L.revisar) + '</span>';
      var row = document.createElement('div');
      row.innerHTML =
        '<div class="market-row-head">' +
          '<span class="market-name" style="color:' + (mk.active ? '#E6C788' : '#D7D7D9') + '">' +
            '<span class="market-dot" style="background:' + barColor + '"></span>' + escapeHtml(mk.name) + fxTag +
          '</span>' +
          '<span class="market-right">' + badge + '<span class="market-tir">' + f.pct(mk.tir) + '%</span></span>' +
        '</div>' +
        '<div class="bar-track bar-track-8"><div class="bar-fill" style="width:' + (mk.tir / c.maxTir * 100) + '%;background:' + barColor + '"></div></div>';
      list.appendChild(row);
    });

    // portfolio-level insights (diversification + Holding trigger)
    var pdiv = $('portfolio-divers');
    pdiv.textContent = c.nPaises + ' ' + L.divPaises + ' · ' + c.nMonedas + ' ' + L.divMonedas + ' · ' +
      f.pct(c.pctUsd, 0) + '% ' + L.divUsd + ' — ' + (c.duraOk ? L.divReglaOk : L.divReglaNo) + '.';
    pdiv.className = 'scen-verdict' + (c.duraOk ? '' : ' mid');
    var phold = $('portfolio-holding');
    if (c.holdingRec) { phold.style.display = ''; phold.textContent = L.holdingRec; phold.className = 'scen-verdict warn'; }
    else { phold.style.display = 'none'; }
  }

  function setNumIfIdle(id, value, isText) {
    var el = $(id);
    if (el && document.activeElement !== el) el.value = value;
    else if (el && isText && document.activeElement !== el) el.value = value;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ----------------------------------------------------------- wiring ----- */
  function parseNum(raw) {
    var v = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    return isNaN(v) ? 0 : v;
  }

  function init() {
    // project identity (text) — save without full re-render to keep caret
    [['in-nombre', 'name'], ['in-ubicacion', 'location'], ['in-moneda', 'moneda']].forEach(function (pair) {
      $(pair[0]).addEventListener('input', function (e) {
        activeProject()[pair[1]] = e.target.value;
        saveState(); renderProjectsAndCompare();
      });
    });

    // personal situation (shared) — number inputs
    [['in-ingreso', 'ingreso'], ['in-gasto', 'gasto'], ['in-deudas', 'deudas'], ['in-capital', 'capital']]
      .forEach(function (pair) {
        $(pair[0]).addEventListener('input', function (e) { state[pair[1]] = parseNum(e.target.value); commit(); });
      });
    $('in-inflacion').addEventListener('input', function (e) { state.inflacion = parseFloat(e.target.value); commit(); });

    // opportunity value (number) + sliders
    $('in-valor').addEventListener('input', function (e) { activeProject().valor = parseNum(e.target.value); commit(); });
    [['in-inicial', 'inicialPct'], ['in-plan', 'planMeses'], ['in-valoriz', 'valorizacion'],
     ['in-cierre', 'costoCierre'], ['in-margen', 'margenError'], ['in-entpremium', 'entradaPremium'],
     ['in-rentabruta', 'rentaBruta'], ['in-ocupacion', 'ocupacion'], ['in-opex', 'opexPct'], ['in-rentatax', 'rentaTaxPct'], ['in-devaluacion', 'devaluacion'],
     ['in-tax', 'taxRate'], ['in-fintasa', 'finTasa'], ['in-finplazo', 'finPlazo'], ['in-ltv', 'ltvMax']]
      .forEach(function (pair) {
        $(pair[0]).addEventListener('input', function (e) { activeProject()[pair[1]] = parseFloat(e.target.value); commit(); });
      });

    $('dif-toggle').addEventListener('click', function () { var p = activeProject(); p.diferimiento = !p.diferimiento; commit(); });
    if ($('tri-gest-toggle')) $('tri-gest-toggle').addEventListener('click', function () { var p = activeProject(); p.gestionPasiva = !p.gestionPasiva; commit(); });
    if ($('tri-resp-toggle')) $('tri-resp-toggle').addEventListener('click', function () { var p = activeProject(); p.respaldoVerificado = !p.respaldoVerificado; commit(); });

    // tax vehicle preset (sets tax rate + deferral for the chosen jurisdiction)
    $('sel-vehiculo').addEventListener('change', function (e) {
      var p = activeProject(); p.vehiculo = e.target.value;
      var v = VEHICULOS.filter(function (x) { return x.id === e.target.value; })[0];
      if (v && v.id !== 'otro') {
        if (v.taxRate != null) p.taxRate = v.taxRate; if (v.dif != null) p.diferimiento = v.dif;
        if (v.ltv != null) p.ltvMax = v.ltv; if (v.prepago != null) p.prepagoPct = v.prepago;
        // tabla maestra de mercados (Cap. 41-47): precarga valorización y renta
        // típicas del mercado; el usuario las ajusta a su proyecto concreto.
        if (v.valoriz != null) p.valorizacion = v.valoriz;
        if (v.renta != null) p.rentaBruta = v.renta;
      }
      commit();
    });

    // delete active project
    $('del-project').addEventListener('click', function () {
      if (state.projects.length <= 1) return;
      var removedId = state.activeId;
      state.projects = state.projects.filter(function (p) { return p.id !== removedId; });
      state.activeId = state.projects[0].id;
      if (SB() && _authUser && /^[0-9a-f-]{36}$/i.test(removedId)) { try { window.CRDSupabase.deleteProject(removedId); } catch (e) {} }
      commit();
    });

    // primary nav (Panel dashboard vs. project analyzer)
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); commit(); window.scrollTo(0, 0); });
    });

    // panel sub-tabs (una sección por pestaña)
    document.querySelectorAll('.pn-subtab').forEach(function (b) {
      b.addEventListener('click', function () { state.panelTab = b.getAttribute('data-ptab'); commit(); });
    });
    // project sub-tabs (Analizar / Comparar / Portafolio / Checklist)
    document.querySelectorAll('.proj-subtab').forEach(function (b) {
      b.addEventListener('click', function () { state.projTab = b.getAttribute('data-ptab'); commit(); window.scrollTo(0, 0); });
    });

    // panel — personal profile inputs (shared global state)
    $('pn-nombre').addEventListener('input', function (e) { state.perfilNombre = e.target.value; saveState(); });
    [['pn-ingreso', 'ingreso'], ['pn-gasto', 'gasto'], ['pn-deudas', 'deudas'],
     ['pn-capital', 'capital'], ['pn-libertad', 'gastoLibertad']].forEach(function (pair) {
      $(pair[0]).addEventListener('input', function (e) { state[pair[1]] = parseNum(e.target.value); commit(); });
    });
    $('pn-valoriz').addEventListener('input', function (e) { state.valorizacionEsp = parseFloat(e.target.value); commit(); });
    $('pn-rendrenta').addEventListener('input', function (e) { state.rendRenta = parseFloat(e.target.value); commit(); });
    // respaldo (export/import JSON)
    if ($('pn-export')) $('pn-export').addEventListener('click', exportData);
    if ($('pn-csv')) $('pn-csv').addEventListener('click', exportCSV);
    if ($('pn-pdf')) $('pn-pdf').addEventListener('click', printReport);
    if ($('pn-import-btn')) $('pn-import-btn').addEventListener('click', function () { $('pn-import-file').click(); });
    if ($('pn-import-file')) $('pn-import-file').addEventListener('change', function (e) { if (e.target.files && e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
    $('pn-inflacion').addEventListener('input', function (e) { state.inflacion = parseFloat(e.target.value); commit(); });

    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () { state.lang = b.getAttribute('data-lang'); commit(); });
    });
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { state.mobileTab = b.getAttribute('data-tab'); render(); });
    });

    // login / logout. Con Supabase configurado → auth real; si no, demo (cualquier
    // dato entra). Se cablean submit y click (los iframes sandbox bloquean el submit).
    function doLogin(e) {
      if (e) e.preventDefault();
      if (SB()) {
        var email = ($('login-email') || {}).value || '', pw = ($('login-pw') || {}).value || '';
        setLoginError('');
        window.CRDSupabase.signIn(email, pw).then(afterAuth)
          .catch(function (err) { setLoginError((err && err.message) || 'No pudimos iniciar sesión.'); });
      } else {
        state.screen = 'app'; render(); window.scrollTo(0, 0);   // demo
      }
    }
    $('login-form').addEventListener('submit', doLogin);
    $('login-btn').addEventListener('click', doLogin);
    $('logout-btn').addEventListener('click', function () {
      if (SB()) { try { window.CRDSupabase.signOut(); } catch (e) {} }
      _authUser = null; state.screen = 'login'; render(); window.scrollTo(0, 0);
    });

    if (mqMobile.addEventListener) mqMobile.addEventListener('change', render);
    else if (mqMobile.addListener) mqMobile.addListener(render);

    render();

    // auto-login si ya existe una sesión de Supabase
    if (SB()) { window.CRDSupabase.currentUser().then(function (u) { if (u) afterAuth(u); }).catch(function () {}); }
  }

  // lighter refresh used while typing a project's name/location (don't rebuild inputs)
  function renderProjectsAndCompare() {
    if (state.screen !== 'app') return;
    buildProjectsBar();
    var c = compute(), f = c.f, L = c.L;
    var list = $('market-list');
    list.innerHTML = '';
    c.projView.forEach(function (mk) {
      var barColor = mk.active ? '#E6C788' : 'rgba(230,199,136,0.4)';
      var fxTag = mk.fx ? '<span class="market-fx"> · ' + escapeHtml(L.fxRisk) + '</span>' : '';
      var badge = '<span class="viab-badge ' + (mk.viable ? 'ok' : 'no') + '">' + escapeHtml(mk.viable ? L.viable : L.revisar) + '</span>';
      var row = document.createElement('div');
      row.innerHTML =
        '<div class="market-row-head">' +
          '<span class="market-name" style="color:' + (mk.active ? '#E6C788' : '#D7D7D9') + '">' +
            '<span class="market-dot" style="background:' + barColor + '"></span>' + escapeHtml(mk.name) + fxTag +
          '</span>' +
          '<span class="market-right">' + badge + '<span class="market-tir">' + f.pct(mk.tir) + '%</span></span>' +
        '</div>' +
        '<div class="bar-track bar-track-8"><div class="bar-fill" style="width:' + (mk.tir / c.maxTir * 100) + '%;background:' + barColor + '"></div></div>';
      list.appendChild(row);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
