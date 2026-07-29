/* Motor financiero puro (Cap. 9/12/15/48): cuota amortizada, base del deal,
   TIR apalancada, IRR por bisección y TIR real neta de costos/impuestos/margen.
   Sin estado ni DOM — recibe todo por argumentos. */

  /* amortized monthly payment for a principal P, annual rate %, term in years */
export function cuotaCredito(P, tasaAnual, plazoAnios) {
    var n = plazoAnios * 12;
    if (n <= 0) return 0;
    var r = (tasaAnual / 100) / 12;
    if (r === 0) return P / n;
    return P * r / (1 - Math.pow(1 + r, -n));
  }

  /* Deal basis from the business-model levers: entry premium (Vc = cost basis),
     hold period and closing derived from the exit strategy (Cap. 12/15). */
export function dealBasis(pr, H) {
    var V = pr.valor;
    var entryPrem = pr.entryModel === 'marcha' ? (pr.entradaPremium || 0) : 0;
    var Vc = V * (1 + entryPrem / 100);
    var buildYears = (pr.planMeses || 12) / 12;
    var hold, effClosing;
    if (pr.exitStrategy === 'cesion') { hold = buildYears; effClosing = 0; }        // sell before deed → no closing
    else if (pr.exitStrategy === 'renta') { hold = H; effClosing = pr.costoCierre || 0; } // hold to horizon
    else { hold = buildYears + 0.5; effClosing = pr.costoCierre || 0; }              // flip
    return { V: V, Vc: Vc, hold: Math.max(1, hold), effClosing: effClosing, buildYears: buildYears };
  }

  /* leveraged equity metrics (undiscounted) — cost basis Vc, exit value from Vx. */
export function tirApalancada(Vc, Vx, d, H, g) {
    var equityInicial = Vc * d;
    if (equityInicial <= 0) return { tir: 0, multiple: 0, equityFinal: 0, ganancia: 0 };
    var equityFinal = Vx * Math.pow(1 + g, H) - Vc * (1 - d);
    var multiple = equityFinal / equityInicial;
    var tir = multiple > 0 ? Math.pow(multiple, 1 / H) - 1 : 0;
    return { tir: tir, multiple: multiple, equityFinal: equityFinal, ganancia: equityFinal - equityInicial };
  }

  /* IRR of a monthly cash-flow series, by bisection. Returns monthly rate or null. */
export function irr(cfs) {
    function npv(r) { var s = 0; for (var t = 0; t < cfs.length; t++) s += cfs[t] / Math.pow(1 + r, t); return s; }
    var lo = -0.95, hi = 1.0, fLo = npv(lo), fHi = npv(hi);
    if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2, f = npv(mid);
      if (Math.abs(f) < 1e-7) return mid;
      if (fLo * f < 0) { hi = mid; fHi = f; } else { lo = mid; fLo = f; }
    }
    return (lo + hi) / 2;
  }

  /* Real IRR on equity (Cap. 9/48): the down payment is paid as monthly
     installments over the plan (timing raises IRR); at exit you net out the
     financed balance, closing costs, capital-gains tax (0 if deferred) and an
     error margin applied to the projected gain. Returns annualized IRR + ROI. */
export function tirReal(o) {
    var Vc = o.Vcost, Vx = o.Vexit, d = o.d, H = o.H, g = o.g, m = o.m;
    var T = Math.max(1, Math.round(H * 12));
    var equityInicial = Vc * d;
    if (equityInicial <= 0) return { tir: 0, roi: 0, net: 0 };
    var cuota = m > 0 ? equityInicial / m : equityInicial;
    var cfs = []; for (var i = 0; i <= T; i++) cfs.push(0);
    var paid = 0;
    for (var t = 1; t <= T; t++) { if (t <= m) { cfs[t] -= cuota; paid += cuota; } }
    var remaining = equityInicial - paid;            // plan longer than the hold → pay the rest at exit
    if (remaining > 0.01) cfs[T] -= remaining;
    var saleValue = Vx * Math.pow(1 + g, H);
    var saleAdj = Vc + (saleValue - Vc) * (1 - (o.margen || 0) / 100);   // error margin on projected gain
    var financed = Vc * (1 - d);
    var closing = Vc * (o.closing || 0) / 100;
    var tax = o.diferimiento ? 0 : Math.max(0, (saleValue - financed) - equityInicial) * ((o.taxRate || 0) / 100);
    // prepayment penalty (Cap. 30/50): only the flip takes the deed + mortgage and
    // pays it off early; cesión has no mortgage and renta holds to term.
    var prepago = o.exitStrategy === 'flip' ? financed * ((o.prepago || 0) / 100) : 0;
    var net = saleAdj - financed - closing - tax - prepago;
    cfs[T] += net;
    var rM = irr(cfs);
    var annual = rM == null ? 0 : Math.pow(1 + rM, 12) - 1;
    var roi = (net - equityInicial) / equityInicial;
    return { tir: annual, roi: roi, net: net };
  }
