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
(function () {
  'use strict';

  /* ------------------------------------------------------------ i18n ------ */
  var T = {
    es: {
      appName: 'Calculadora de Viabilidad Inmobiliaria Pro',
      loginEyebrow: 'Acceso · App',
      loginTitle: 'Calculadora de Viabilidad Inmobiliaria Pro',
      loginSub: 'Tu instrumento de criterio. Entra con las credenciales que recibiste por correo.',
      emailLabel: 'Correo', pwLabel: 'Contraseña', loginBtn: 'Iniciar sesión', loginHelp: '¿Olvidaste tu contraseña?',
      forgotEyebrow: 'Recuperar · Acceso',
      forgotTitle: 'Recupera tu acceso',
      forgotSub: 'Escribe tu correo y te enviamos un enlace para restablecer tu contraseña.',
      forgotBtn: 'Enviar enlace',
      forgotBack: '← Volver a iniciar sesión',
      forgotSending: 'Enviando…',
      forgotPlaceholder: 'tu@correo.com',
      allianceLabel: 'En alianza con', demoNote: 'Demo de revisión · cualquier dato te deja entrar',
      headerSub: 'Sesión de ejemplo', logout: 'Salir',
      projectsTitle: 'Proyectos', addProject: 'Nuevo proyecto', deleteProject: 'Eliminar proyecto', duplicateProject: 'Duplicar',
      secProyecto: 'El proyecto', lblProyNombre: 'Nombre del proyecto', lblUbicacion: 'Ubicación (ciudad, país)', lblMoneda: 'Moneda',
      secSituacion: 'Tu situación', secOportunidad: 'La oportunidad', secFinanciacion: 'Financiación al entregar',
      situacionNota: 'Tu situación aplica a todos los proyectos.',
      lblIngreso: 'Ingreso mensual', lblGasto: 'Gasto mensual', lblDeudas: 'Deudas mensuales actuales', lblCapital: 'Capital disponible',
      lblHorizonte: 'Horizonte de inversión', lblValor: 'Valor del inmueble', lblInicial: 'Cuota inicial',
      lblPlan: 'Plan de pagos sin intereses', lblValoriz: 'Valorización anual esperada',
      lblCierre: 'Costos de cierre / escrituración', lblMargen: 'Margen de error (prudencia)',
      secModelo: 'Modelo de negocio', lblEntrada: 'Modelo de entrada', entListaCero: 'Lista Cero', entMarcha: 'En Marcha',
      lblEntPremium: 'Sobreprecio de entrada', lblSalida: 'Estrategia de salida', exitCesion: 'Cesión', exitFlip: 'Flip', exitRenta: 'Renta',
      entradaNotaCero: 'Precio de lanzamiento, máximo recorrido de valorización. TIR típica 30–45%.',
      entradaNotaMarcha: 'Entras más tarde con más certeza, pagando un sobreprecio. TIR típica 18–28%.',
      salidaNotaCesion: 'Vendes el contrato antes de escriturar: sin costos de cierre, tenencia corta, TIR máxima.',
      salidaNotaFlip: 'Escrituras y revendes poco después de la entrega. Aplican costos de cierre.',
      salidaNotaRenta: 'Conservas para vivir del flujo: mantienes hasta tu horizonte.',
      secRenta: 'Renta (si conservas)', lblRentaBruta: 'Renta bruta anual', lblOcupacion: 'Ocupación',
      modRenta: 'Renta y flujo · ¿conservar?', modRentaHelp: 'Si estabilizas el activo para vivir del flujo (Fase C).',
      rentaCoC: 'Cash-on-Cash', rentaNetaLbl: 'Renta neta anual', rentaFlujoLbl: 'Flujo tras hipoteca', perYear: 'USD/año',
      rentaConservar: 'Conservar · renta intensiva (bruta ≥ 12% y ocupación ≥ 70%).',
      rentaVender: 'Vender · rota el capital. La renta no justifica conservar el activo.',
      lblVehiculo: 'Vehículo fiscal / jurisdicción', lblDevaluacion: 'Devaluación anual esperada',
      tirUsdLbl: 'TIR real en USD', tirUsdNota: 'Tu TIR local, ajustada por la devaluación de la moneda.',
      refiLbl: 'Cash-out refi (sin vender)', refiNota: '~55% del valor, cada 3–5 años, sin evento fiscal.',
      divPaises: 'países', divMonedas: 'monedas', divUsd: 'en USD',
      divReglaOk: 'cumple la regla 40–50% en moneda dura', divReglaNo: 'por debajo del 40% en moneda dura',
      holdingRec: 'Portafolio grande: evalúa una estructura Holding (5+ proyectos, utilidad > $47k o > $300k).',
      lblTax: 'Impuesto a la ganancia', lblDiferimiento: 'Diferimiento fiscal', difOn: 'Activo (AFC / 1031)', difOff: 'Sin diferir',
      lblFinTipo: 'Tipo de crédito', finBanco: 'Banco', finConstructora: 'Constructora',
      lblFinTasa: 'Tasa de interés anual', lblFinPlazo: 'Plazo del crédito',
      finConstructoraNota: 'Plan directo con la constructora (a menudo 0% de interés, como en Dubái).',
      finBancoNota: 'Hipoteca bancaria sobre el saldo al momento de la entrega.',
      unitMonths: 'meses', unitYears: 'años', perMonth: 'USD/mes', yr: 'Año',
      tabDatos: 'Datos', tabResultados: 'Resultados',
      modCapacidad: 'Capacidad de endeudamiento', modCapacidadHelp: 'Lo que tu flujo soporta, y si accedes a la hipoteca al entregar.',
      capMensual: 'Capacidad mensual sana (35% del ingreso − deudas)',
      capConstruccion: 'Cuota en construcción', capHipoteca: 'Hipoteca al entregar', capPctUsado: 'de tu capacidad',
      capSaldo: 'Saldo a financiar', capFitsSano: 'Accedes a la hipoteca con holgura', capFitsAjustado: 'Accedes, pero ajustado',
      capFitsExcede: 'La hipoteca supera tu capacidad', capConstrOk: 'La cuota de obra cabe en tu flujo', capConstrExcede: 'La cuota de obra supera tu flujo',
      modTir: 'TIR sobre capital propio', modTirHelp: 'Retorno real: cuotas en el tiempo, costos de cierre, impuestos y margen incluidos.',
      tirCon: 'Con apalancamiento', tirSin: 'Sin apalancar', tirMultiple: 'Multiplicas tu capital',
      tirRoi: 'ROI total', tirCostosNota: 'TIR neta de costos de cierre, impuestos y margen de error.',
      modImpuestos: 'Impuestos y diferimiento', modImpuestosHelp: 'Lo que reinviertes con y sin diferir el impuesto.',
      impConDiferir: 'Con diferimiento', impSinDiferir: 'Pagando impuesto', impVentaja: 'Capital que sigue trabajando',
      modNse: 'Número de Seguridad Económica', modNseHelp: 'El ingreso mensual que te hace libre, ajustado por inflación.',
      nseObjetivo: 'Ingreso mensual objetivo', nseCapital: 'Capital que lo genera (margen ×1,25)', nseCiclos: 'Ciclos como este para llegar',
      modProyeccion: 'Proyección de tu capital', modProyeccionHelp: 'Valor de tu capital propio año a año.', proyEnd: 'Capital al final',
      lblPoder: 'Poder de inversión', modCiclo: 'Patrimonio por ciclos',
      modCicloHelp: 'Si rotas y reinviertes el 100% de cada ciclo.', cicloFinal: 'Patrimonio al final', cicloLabel: 'Ciclo',
      cicloLibertadPost: 'años a la libertad económica', cicloLibertadNo: 'Con estos supuestos el patrimonio no compone lo suficiente para la libertad.',
      modEscenarios: 'Escenarios de valorización', modEscenariosHelp: 'Conservador, base y optimista. Nunca decidas por el mejor caso.',
      scenCons: 'Conservador', scenBase: 'Base', scenOpt: 'Optimista',
      reglaOroOk: 'Cumple la Regla de Oro Atlantis: el escenario conservador supera el 15%.',
      reglaOroNo: 'Bajo la Regla de Oro Atlantis: el conservador no llega al 15%. Reevalúa el proyecto.',
      verdictAlpha: 'Nivel Alpha · velocidad máxima', verdictStandard: 'Atlantis Standard · alto desempeño',
      verdictMarket: 'Estándar de mercado · conservador', verdictAlert: 'Zona de alerta · rendimiento ineficiente',
      modComparativa: 'Comparativa de proyectos', modComparativaHelp: 'La viabilidad de cada proyecto. TIR sobre tu capital propio.',
      mod5p: 'Viabilidad · Las 5 P', mod5pHelp: 'La calidad del proyecto, punto por punto. Una P en rojo lo descarta.', p5Score: 'Calidad',
      p5Alta: 'Deal de alta calidad · las cinco P cumplen.', p5Media: 'Aceptable · refuerza las P en amarillo antes de entrar.',
      p5Roja: 'Bandera roja · una P falla. El método dice: descarta o corrige antes de invertir.',
      viable: 'Viable', revisar: 'Revisar', fxRisk: 'riesgo cambiario', fxRule: 'Mantén 40–50% del patrimonio en moneda dura (USD).',
      lblInflacion: 'Inflación anual esperada', lblLtv: 'LTV máximo (banco)',
      capFaltante: 'Aporte extra al entregar (sobre el LTV)',
      capLtvNota: 'El banco financia hasta el LTV del valor; el resto lo aportas tú al entregar.',
      rentaDepr: 'Escudo fiscal por depreciación', perYearShort: 'USD/año',
      nseLibParcial: 'Libertad parcial', nseLibTotal: 'Libertad total',
      nseLibCubre: 'cubre 70% del gasto', nseLibCubreT: '125% del gasto',
      // ---- Panel (dashboard) ----
      navPanel: 'Panel', navProyecto: 'Proyectos',
      pnEyebrow: 'Panel de control', pnTitulo: 'Tu resumen financiero',
      pnSub: 'Carga tu información y descubre tu capacidad de inversión y cuándo alcanzas la libertad.',
      pnPerfil: 'Tu información', pnPerfilNota: 'Estos datos alimentan todo el panel y tus proyectos.',
      pnNombre: 'Tu nombre', pnValoriz: 'Valorización anual esperada', pnLibertad: 'Gasto mensual en libertad',
      pnResumen: 'Resumen', pnFlujoLibre: 'Flujo libre mensual', pnPoder: 'Poder de inversión total',
      pnPropMax: 'Propiedad máxima accesible', pnNse: 'Número de Seguridad Económica',
      pnAnios: 'Años para la libertad', pnPatY5: 'Patrimonio año 5', pnPatY10: 'Patrimonio año 10',
      pnProyeccion: 'Proyección de patrimonio', pnProyeccionHelp: 'Tu capital y aporte mensual, compuestos año a año hasta tu horizonte.',
      pnMeta: 'Meta de libertad', pnProgreso: 'Progreso a la libertad',
      pnEndeuda: 'Capacidad de endeudamiento', pnEndeudaHelp: 'Cuánto crédito puedes servir con salud (regla del 35% del ingreso menos deudas).',
      pnCuotaMax: 'Cuota mensual máxima sana', pnHipMax: 'Hipoteca máxima (20 años)',
      pnDti: 'Endeudamiento actual (DTI)', pnDtiSano: 'Saludable · por debajo del 35%',
      pnDtiAjustado: 'Ajustado · cerca del límite del 35%', pnDtiExcede: 'Excedido · por encima del 35%, libera deuda antes de invertir',
      pnProyectos: 'En cuántos y qué proyectos puedes invertir',
      pnProyectosHelp: 'Según tu capital y flujo, cuántos proyectos simultáneos y en qué mercados puedes entrar hoy.',
      pnSimultaneos: 'Proyectos simultáneos que puedes asumir',
      pnRangoTipo: 'Rango de precio objetivo', pnEntrada: 'Entrada mínima', pnCuotaMes: 'cuota/mes aprox.',
      pnAlcanza: 'Alcanza', pnNoAlcanza: 'Aún no', pnProyMercado: 'proyecto(s)',
      pnStEntrada: 'Entrada', pnStCuota: 'Cuota/mes', pnStProys: 'Proyectos',
      pnVerdictAccel: '🟢 Perfil acelerado — la libertad financiera está a 5 años o menos. Ejecuta con disciplina.',
      pnVerdictSolido: '🟡 Perfil sólido — el ciclo funciona para ti. Optimiza tu flujo mensual para acelerar.',
      pnVerdictConstru: '🔴 Perfil en construcción — sube tu capital inicial o tu flujo mensual, o monetiza activos inactivos.',
      pnTabInfo: 'Información', pnTabResumen: 'Resumen', pnTabProy: 'Proyección', pnTabDeuda: 'Endeudamiento', pnTabProys: 'Proyectos', pnTabConcl: 'Conclusiones',
      pnConclEyebrow: 'Conclusiones de viabilidad', pnConclHelp: 'Síntesis de tu viabilidad y análisis predictivo de tu patrimonio.',
      pnPredic: 'Análisis predictivo · escenarios', pnPredicHelp: 'Patrimonio y libertad según la valorización que se materialice.',
      pnEscLibertad: 'Libertad', pnEscPat: 'Patrimonio', pnAnioLib: 'Libertad estimada',
      pnPalancas: 'Palancas para acelerar', pnPalancasHelp: 'Qué mueve más la aguja desde tu situación actual.',
      pnLevAporte: '+500/mes de aporte', pnLevCapital: '+20.000 de capital', pnLevValoriz: '+1 punto de valorización',
      pnLevAdelanta: 'adelanta', pnLevMasPat: 'de patrimonio', pnLevNada: 'sin cambio material',
      pnCartera: 'Tu cartera de proyectos', pnMejorProy: 'Mejor proyecto', pnViablesN: 'Proyectos viables', pnSinProy: 'Aún no has añadido proyectos.',
      pnConclVeredicto: 'Veredicto', pnDe: 'de',
      pnRecomienda: 'Recomendación', pnAbrirProyecto: 'Analizar un proyecto →',
      pnMercados: { colombia: 'Colombia', rd: 'Rep. Dominicana', mexico: 'México', dubai: 'Dubái' },
      pnResumenNota: 'Para vivir de tu patrimonio: rinde ~1%/mes con un margen de seguridad de 1,25×.',
      disclaimer: 'Interfaz y valores ilustrativos. No constituye proyección de retorno ni asesoría financiera, legal o tributaria.'
    },
    en: {
      appName: 'Real Estate Viability Pro Calculator',
      loginEyebrow: 'Access · App',
      loginTitle: 'Real Estate Viability Pro Calculator',
      loginSub: 'Your instrument of judgment. Sign in with the credentials we emailed you.',
      emailLabel: 'Email', pwLabel: 'Password', loginBtn: 'Sign in', loginHelp: 'Forgot your password?',
      forgotEyebrow: 'Recover · Access',
      forgotTitle: 'Recover your access',
      forgotSub: "Enter your email and we'll send you a link to reset your password.",
      forgotBtn: 'Send link',
      forgotBack: '← Back to sign in',
      forgotSending: 'Sending…',
      forgotPlaceholder: 'your@email.com',
      allianceLabel: 'In partnership with', demoNote: 'Review demo · any input lets you in',
      headerSub: 'Sample session', logout: 'Log out',
      projectsTitle: 'Projects', addProject: 'New project', deleteProject: 'Delete project', duplicateProject: 'Duplicate',
      secProyecto: 'The project', lblProyNombre: 'Project name', lblUbicacion: 'Location (city, country)', lblMoneda: 'Currency',
      secSituacion: 'Your situation', secOportunidad: 'The opportunity', secFinanciacion: 'Financing at handover',
      situacionNota: 'Your situation applies to every project.',
      lblIngreso: 'Monthly income', lblGasto: 'Monthly expenses', lblDeudas: 'Current monthly debt payments', lblCapital: 'Available capital',
      lblHorizonte: 'Investment horizon', lblValor: 'Property value', lblInicial: 'Down payment',
      lblPlan: 'Interest-free payment plan', lblValoriz: 'Expected annual appreciation',
      lblCierre: 'Closing costs', lblMargen: 'Error margin (prudence)',
      secModelo: 'Business model', lblEntrada: 'Entry model', entListaCero: 'Zero List', entMarcha: 'Under way',
      lblEntPremium: 'Entry premium', lblSalida: 'Exit strategy', exitCesion: 'Assignment', exitFlip: 'Flip', exitRenta: 'Rent',
      entradaNotaCero: 'Launch price, full appreciation runway. Typical IRR 30–45%.',
      entradaNotaMarcha: 'You enter later with more certainty, paying a premium. Typical IRR 18–28%.',
      salidaNotaCesion: 'Sell the contract before deed transfer: no closing costs, short hold, top IRR.',
      salidaNotaFlip: 'Take the deed and resell shortly after handover. Closing costs apply.',
      salidaNotaRenta: 'Hold to live off the cash flow: keep it to your horizon.',
      secRenta: 'Rent (if you hold)', lblRentaBruta: 'Gross annual yield', lblOcupacion: 'Occupancy',
      modRenta: 'Rent & cash flow · hold?', modRentaHelp: 'If you stabilize the asset to live off the cash flow (Phase C).',
      rentaCoC: 'Cash-on-Cash', rentaNetaLbl: 'Net annual rent', rentaFlujoLbl: 'Cash flow after mortgage', perYear: 'USD/yr',
      rentaConservar: 'Hold · income asset (yield ≥ 12% and occupancy ≥ 70%).',
      rentaVender: 'Sell · rotate the capital. The rent doesn’t justify holding the asset.',
      lblVehiculo: 'Tax vehicle / jurisdiction', lblDevaluacion: 'Expected annual devaluation',
      tirUsdLbl: 'Real IRR in USD', tirUsdNota: 'Your local IRR, adjusted for the currency’s devaluation.',
      refiLbl: 'Cash-out refi (without selling)', refiNota: '~55% of value, every 3–5 years, no tax event.',
      divPaises: 'countries', divMonedas: 'currencies', divUsd: 'in USD',
      divReglaOk: 'meets the 40–50% hard-currency rule', divReglaNo: 'below 40% in hard currency',
      holdingRec: 'Large portfolio: consider a Holding structure (5+ projects, gain > $47k or > $300k).',
      lblTax: 'Capital gains tax', lblDiferimiento: 'Tax deferral', difOn: 'On (AFC / 1031)', difOff: 'No deferral',
      lblFinTipo: 'Loan type', finBanco: 'Bank', finConstructora: 'Developer',
      lblFinTasa: 'Annual interest rate', lblFinPlazo: 'Loan term',
      finConstructoraNota: 'Financed directly by the developer (often 0% interest, as in Dubai).',
      finBancoNota: 'Bank mortgage on the balance owed at handover.',
      unitMonths: 'months', unitYears: 'years', perMonth: 'USD/mo', yr: 'Yr',
      tabDatos: 'Inputs', tabResultados: 'Results',
      modCapacidad: 'Debt capacity', modCapacidadHelp: 'What your cash flow supports, and whether you can get the mortgage at handover.',
      capMensual: 'Healthy monthly capacity (35% of income − debts)',
      capConstruccion: 'Installment during construction', capHipoteca: 'Mortgage at handover', capPctUsado: 'of your capacity',
      capSaldo: 'Balance to finance', capFitsSano: 'Mortgage well within reach', capFitsAjustado: 'Within reach, but tight',
      capFitsExcede: 'The mortgage exceeds your capacity', capConstrOk: 'The construction installment fits your cash flow', capConstrExcede: 'The construction installment exceeds your cash flow',
      modTir: 'IRR on your equity', modTirHelp: 'Real return: installment timing, closing costs, taxes and margin included.',
      tirCon: 'With leverage', tirSin: 'Unleveraged', tirMultiple: 'You multiply your capital',
      tirRoi: 'Total ROI', tirCostosNota: 'IRR net of closing costs, taxes and error margin.',
      modImpuestos: 'Taxes & deferral', modImpuestosHelp: 'What you reinvest with and without deferring tax.',
      impConDiferir: 'With deferral', impSinDiferir: 'Paying tax', impVentaja: 'Capital still working for you',
      modNse: 'Economic Security Number', modNseHelp: 'The monthly income that sets you free, inflation-adjusted.',
      nseObjetivo: 'Target monthly income', nseCapital: 'Capital that generates it (×1.25 margin)', nseCiclos: 'Cycles like this to get there',
      modProyeccion: 'Your capital projection', modProyeccionHelp: 'Value of your equity year by year.', proyEnd: 'Capital at the end',
      lblPoder: 'Investment power', modCiclo: 'Wealth by cycles',
      modCicloHelp: 'If you rotate and reinvest 100% of each cycle.', cicloFinal: 'Wealth at the end', cicloLabel: 'Cycle',
      cicloLibertadPost: 'years to economic freedom', cicloLibertadNo: 'With these assumptions wealth doesn’t compound enough for freedom.',
      modEscenarios: 'Appreciation scenarios', modEscenariosHelp: 'Conservative, base and optimistic. Never decide on the best case.',
      scenCons: 'Conservative', scenBase: 'Base', scenOpt: 'Optimistic',
      reglaOroOk: 'Meets the Atlantis Golden Rule: the conservative scenario clears 15%.',
      reglaOroNo: 'Below the Atlantis Golden Rule: the conservative case is under 15%. Reassess the project.',
      verdictAlpha: 'Alpha level · maximum velocity', verdictStandard: 'Atlantis Standard · high performance',
      verdictMarket: 'Market standard · conservative', verdictAlert: 'Alert zone · inefficient return',
      modComparativa: 'Project comparison', modComparativaHelp: 'How viable each project is. IRR on your equity.',
      mod5p: 'Viability · The 5 P’s', mod5pHelp: 'The quality of the deal, point by point. One red P kills it.', p5Score: 'Quality',
      p5Alta: 'High-quality deal · all five P’s clear.', p5Media: 'Acceptable · shore up the amber P’s before you enter.',
      p5Roja: 'Red flag · a P fails. The method says: drop it or fix it before investing.',
      viable: 'Viable', revisar: 'Review', fxRisk: 'currency risk', fxRule: 'Keep 40–50% of your wealth in hard currency (USD).',
      lblInflacion: 'Expected annual inflation', lblLtv: 'Max LTV (bank)',
      capFaltante: 'Extra cash at handover (above LTV)',
      capLtvNota: 'The bank lends up to the LTV of value; you cover the rest at handover.',
      rentaDepr: 'Depreciation tax shield', perYearShort: 'USD/yr',
      nseLibParcial: 'Partial freedom', nseLibTotal: 'Full freedom',
      nseLibCubre: 'covers 70% of expenses', nseLibCubreT: '125% of expenses',
      // ---- Panel (dashboard) ----
      navPanel: 'Dashboard', navProyecto: 'Projects',
      pnEyebrow: 'Control panel', pnTitulo: 'Your financial summary',
      pnSub: 'Load your information and discover your investing capacity and when you reach freedom.',
      pnPerfil: 'Your information', pnPerfilNota: 'This data feeds the whole dashboard and your projects.',
      pnNombre: 'Your name', pnValoriz: 'Expected annual appreciation', pnLibertad: 'Monthly freedom spend',
      pnResumen: 'Summary', pnFlujoLibre: 'Free monthly cash flow', pnPoder: 'Total investing power',
      pnPropMax: 'Max accessible property', pnNse: 'Economic Security Number',
      pnAnios: 'Years to freedom', pnPatY5: 'Net worth year 5', pnPatY10: 'Net worth year 10',
      pnProyeccion: 'Net worth projection', pnProyeccionHelp: 'Your capital and monthly contribution, compounded year by year to your horizon.',
      pnMeta: 'Freedom target', pnProgreso: 'Progress to freedom',
      pnEndeuda: 'Borrowing capacity', pnEndeudaHelp: 'How much credit you can service healthily (35% of income minus debts rule).',
      pnCuotaMax: 'Max healthy monthly payment', pnHipMax: 'Max mortgage (20 years)',
      pnDti: 'Current debt load (DTI)', pnDtiSano: 'Healthy · below 35%',
      pnDtiAjustado: 'Tight · near the 35% limit', pnDtiExcede: 'Exceeded · above 35%, free up debt before investing',
      pnProyectos: 'How many and which projects you can invest in',
      pnProyectosHelp: 'Based on your capital and cash flow, how many simultaneous projects and which markets you can enter today.',
      pnSimultaneos: 'Simultaneous projects you can take on',
      pnRangoTipo: 'Target price range', pnEntrada: 'Min. entry', pnCuotaMes: 'approx. payment/mo',
      pnAlcanza: 'Within reach', pnNoAlcanza: 'Not yet', pnProyMercado: 'project(s)',
      pnStEntrada: 'Entry', pnStCuota: 'Payment/mo', pnStProys: 'Projects',
      pnVerdictAccel: '🟢 Accelerated profile — financial freedom is 5 years away or less. Execute with discipline.',
      pnVerdictSolido: '🟡 Solid profile — the cycle works for you. Optimize your monthly flow to accelerate.',
      pnVerdictConstru: '🔴 Building profile — raise your starting capital or monthly flow, or monetize idle assets.',
      pnTabInfo: 'Information', pnTabResumen: 'Summary', pnTabProy: 'Projection', pnTabDeuda: 'Borrowing', pnTabProys: 'Projects', pnTabConcl: 'Conclusions',
      pnConclEyebrow: 'Viability conclusions', pnConclHelp: 'A synthesis of your viability and a predictive analysis of your net worth.',
      pnPredic: 'Predictive analysis · scenarios', pnPredicHelp: 'Net worth and freedom depending on the appreciation that materializes.',
      pnEscLibertad: 'Freedom', pnEscPat: 'Net worth', pnAnioLib: 'Estimated freedom',
      pnPalancas: 'Levers to accelerate', pnPalancasHelp: 'What moves the needle most from where you are today.',
      pnLevAporte: '+500/mo contribution', pnLevCapital: '+20,000 capital', pnLevValoriz: '+1 pt appreciation',
      pnLevAdelanta: 'sooner by', pnLevMasPat: 'net worth', pnLevNada: 'no material change',
      pnCartera: 'Your project portfolio', pnMejorProy: 'Best project', pnViablesN: 'Viable projects', pnSinProy: 'You haven\'t added any projects yet.',
      pnConclVeredicto: 'Verdict', pnDe: 'of',
      pnRecomienda: 'Recommendation', pnAbrirProyecto: 'Analyze a project →',
      pnMercados: { colombia: 'Colombia', rd: 'Dominican Rep.', mexico: 'Mexico', dubai: 'Dubai' },
      pnResumenNota: 'To live off your net worth: it yields ~1%/mo with a 1.25× safety margin.',
      disclaimer: 'Illustrative interface and values. Not a return projection or financial, legal or tax advice.'
    }
  };

  /* --------------------------------------------------------- persistence -- */
  var LS_KEY = 'crd-calc-v2';
  function uid() { return 'p' + Math.random().toString(36).slice(2, 9); }

  function defaultProjects() {
    return [
      { id: uid(), name: 'Torre Marina', location: 'Dubái, EAU', moneda: 'USD',
        valor: 160000, inicialPct: 20, planMeses: 36, valorizacion: 15,
        entryModel: 'cero', entradaPremium: 12, exitStrategy: 'flip', rentaBruta: 9, ocupacion: 75,
        costoCierre: 4, margenError: 15, vehiculo: 'dubai', taxRate: 0, diferimiento: true, devaluacion: 0,
        finType: 'constructora', finTasa: 0, finPlazo: 6, ltvMax: 70, prepagoPct: 1,
        p5: { punto: 2, precio: 2, producto: 2, proceso: 1, personas: 2, proposito: 2 } },
      { id: uid(), name: 'El Poblado', location: 'Medellín, Colombia', moneda: 'COP',
        valor: 90000, inicialPct: 30, planMeses: 30, valorizacion: 9,
        entryModel: 'cero', entradaPremium: 12, exitStrategy: 'cesion', rentaBruta: 11, ocupacion: 70,
        costoCierre: 3, margenError: 15, vehiculo: 'colombia', taxRate: 10, diferimiento: true, devaluacion: 8,
        finType: 'banco', finTasa: 12, finPlazo: 20, ltvMax: 60, prepagoPct: 0,
        p5: { punto: 2, precio: 1, producto: 2, proceso: 2, personas: 2, proposito: 2 } },
      { id: uid(), name: 'Punta Cana', location: 'Rep. Dominicana', moneda: 'USD',
        valor: 150000, inicialPct: 20, planMeses: 24, valorizacion: 10,
        entryModel: 'marcha', entradaPremium: 12, exitStrategy: 'renta', rentaBruta: 14, ocupacion: 82,
        costoCierre: 3, margenError: 15, vehiculo: 'rd', taxRate: 0, diferimiento: true, devaluacion: 0,
        finType: 'banco', finTasa: 8, finPlazo: 20, ltvMax: 70, prepagoPct: 2,
        p5: { punto: 2, precio: 2, producto: 2, proceso: 2, personas: 2, proposito: 2 } }
    ];
  }

  var PROJECT_FIELDS = ['id', 'name', 'location', 'moneda', 'valor', 'inicialPct', 'planMeses',
    'valorizacion', 'entryModel', 'entradaPremium', 'exitStrategy', 'rentaBruta', 'ocupacion',
    'costoCierre', 'margenError', 'vehiculo', 'taxRate', 'diferimiento', 'devaluacion',
    'finType', 'finTasa', 'finPlazo', 'ltvMax', 'prepagoPct', 'p5'];

  /* Vehículos fiscales / jurisdicciones (Cap. 25/26/41-47). Al elegir uno se
     fija la tasa de ganancia y se activa el diferimiento donde aplica. */
  var VEHICULOS = [
    { id: 'otro',      name: { es: 'Otro / manual', en: 'Other / manual' }, note: { es: 'Fija la tasa a mano.', en: 'Set the rate manually.' } },
    { id: 'dubai',     name: { es: 'Dubái · 0%', en: 'Dubai · 0%' }, taxRate: 0, dif: true, ltv: 70, prepago: 1, note: { es: '0% a la ganancia de capital y a la renta.', en: '0% capital gains and income.' } },
    { id: 'colombia',  name: { es: 'Colombia · AFC', en: 'Colombia · AFC' }, taxRate: 10, dif: true, ltv: 60, prepago: 0, note: { es: 'AFC: exención hasta 30% del ingreso / 3.800 UVT.', en: 'AFC: exemption up to 30% of income / 3,800 UVT.' } },
    { id: 'usa',       name: { es: 'EE.UU. · 1031', en: 'USA · 1031' }, taxRate: 20, dif: true, ltv: 75, prepago: 4, note: { es: '1031 Exchange: difieres reinvirtiendo en 180 días.', en: '1031 Exchange: defer by reinvesting within 180 days.' } },
    { id: 'rd',        name: { es: 'Rep. Dominicana · CONFOTUR', en: 'Dominican Rep. · CONFOTUR' }, taxRate: 0, dif: true, ltv: 70, prepago: 2, note: { es: 'CONFOTUR: 0% transferencia + IPI por 10–15 años.', en: 'CONFOTUR: 0% transfer + IPI for 10–15 years.' } },
    { id: 'panama',    name: { es: 'Panamá · 1ª venta', en: 'Panama · 1st sale' }, taxRate: 10, dif: true, ltv: 70, prepago: 1, note: { es: 'Exención en la primera venta de inmueble nuevo.', en: 'Exemption on the first sale of a new property.' } },
    { id: 'mexico',    name: { es: 'México · FIBRA', en: 'Mexico · FIBRA' }, taxRate: 25, dif: true, ltv: 50, prepago: 0, note: { es: 'Persona moral / FIBRA: difieren hasta la distribución.', en: 'Corporation / FIBRA: defer until distribution.' } },
    { id: 'costarica', name: { es: 'Costa Rica · territorial', en: 'Costa Rica · territorial' }, taxRate: 15, dif: false, ltv: 70, prepago: 1, note: { es: 'Renta territorial: grava solo ingresos locales.', en: 'Territorial: taxes local income only.' } }
  ];
  function fxRisk(moneda) { var m = (moneda || '').toUpperCase().trim(); return m !== '' && m !== 'USD' && m !== 'AED'; }

  /* Método de las 5 P (Cap. 13) — checklist puntuable de calidad del deal.
     Cada P: 2=Cumple, 1=Parcial, 0=Falla. Regla del libro: una P en 0 lo descarta. */
  var P5KEYS = ['punto', 'precio', 'producto', 'proceso', 'personas', 'proposito'];
  var P5_DEFS = [
    { key: 'punto',     name: { es: 'Punto',     en: 'Point' },     hint: { es: 'Ubicación con infraestructura en marcha y demanda de salida.', en: 'Location with infrastructure underway and exit demand.' } },
    { key: 'precio',    name: { es: 'Precio',    en: 'Price' },     hint: { es: 'Entrada temprana / Lista Cero (ventaja de 8–15%).', en: 'Early entry / Zero List (8–15% edge).' } },
    { key: 'producto',  name: { es: 'Producto',  en: 'Product' },   hint: { es: 'Diseño para renta intensiva y reventa fácil.', en: 'Built for intensive rental and easy resale.' } },
    { key: 'proceso',   name: { es: 'Proceso',   en: 'Process' },   hint: { es: 'Fiducia + cláusula de cesión de derechos (salida antes de entrega).', en: 'Trust + assignment clause (exit before handover).' } },
    { key: 'personas',  name: { es: 'Personas',  en: 'People' },    hint: { es: 'Constructora con historial (5+ proyectos entregados).', en: 'Developer with a track record (5+ delivered).' } },
    { key: 'proposito', name: { es: 'Propósito', en: 'Purpose' },   hint: { es: 'Alineado con tu meta, horizonte y Número de Seguridad Económica.', en: 'Aligned with your goal, horizon and Economic Security Number.' } }
  ];
  function defaultP5() { return { punto: 2, precio: 2, producto: 2, proceso: 2, personas: 2, proposito: 2 }; }
  function p5Eval(pr) {
    var pv = pr.p5 || {}, sum = 0, red = false;
    P5KEYS.forEach(function (k) { var v = pv[k] == null ? 2 : pv[k]; sum += v; if (v === 0) red = true; });
    return { sum: sum, score: sum / (P5KEYS.length * 2), red: red, max: P5KEYS.length * 2 };
  }

  function loadState() {
    var base = {
      lang: (function () { try { return /^en/i.test(navigator.language || navigator.userLanguage || '') ? 'en' : 'es'; } catch (e) { return 'es'; } })(),
      screen: 'login', mobileTab: 'datos', view: 'panel', panelTab: 'resumen',
      perfilNombre: '', ingreso: 6000, gasto: 2800, deudas: 400, capital: 35000,
      horizonte: 10, inflacion: 3, valorizacionEsp: 10, gastoLibertad: 4000,
      projects: null, activeId: null
    };
    try {
      var raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        ['perfilNombre', 'ingreso', 'gasto', 'deudas', 'capital', 'horizonte', 'inflacion',
         'valorizacionEsp', 'gastoLibertad', 'lang', 'view', 'panelTab'].forEach(function (k) {
          if (saved[k] != null) base[k] = saved[k];
        });
        if (Array.isArray(saved.projects) && saved.projects.length) base.projects = saved.projects;
        if (saved.activeId) base.activeId = saved.activeId;
      }
    } catch (e) { /* ignore storage errors */ }
    if (!base.projects) base.projects = defaultProjects();
    if (!base.activeId || !base.projects.some(function (p) { return p.id === base.activeId; })) {
      base.activeId = base.projects[0].id;
    }
    return base;
  }

  function saveState() {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        lang: state.lang, view: state.view, panelTab: state.panelTab, perfilNombre: state.perfilNombre,
        ingreso: state.ingreso, gasto: state.gasto, deudas: state.deudas,
        capital: state.capital, horizonte: state.horizonte, inflacion: state.inflacion,
        valorizacionEsp: state.valorizacionEsp, gastoLibertad: state.gastoLibertad,
        projects: state.projects, activeId: state.activeId
      }));
    } catch (e) { /* ignore */ }
    // sincronización en la nube (debounced) si hay sesión Supabase
    if (SB() && _authUser) {
      clearTimeout(_syncTimer);
      _syncTimer = setTimeout(function () {
        try {
          window.CRDSupabase.saveProfile(_authUser.id, state);
          window.CRDSupabase.saveAllProjects(_authUser.id, state.projects);
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

  /* amortized monthly payment for a principal P, annual rate %, term in years */
  function cuotaCredito(P, tasaAnual, plazoAnios) {
    var n = plazoAnios * 12;
    if (n <= 0) return 0;
    var r = (tasaAnual / 100) / 12;
    if (r === 0) return P / n;
    return P * r / (1 - Math.pow(1 + r, -n));
  }

  /* Deal basis from the business-model levers: entry premium (Vc = cost basis),
     hold period and closing derived from the exit strategy (Cap. 12/15). */
  function dealBasis(pr, H) {
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
  function tirApalancada(Vc, Vx, d, H, g) {
    var equityInicial = Vc * d;
    if (equityInicial <= 0) return { tir: 0, multiple: 0, equityFinal: 0, ganancia: 0 };
    var equityFinal = Vx * Math.pow(1 + g, H) - Vc * (1 - d);
    var multiple = equityFinal / equityInicial;
    var tir = multiple > 0 ? Math.pow(multiple, 1 / H) - 1 : 0;
    return { tir: tir, multiple: multiple, equityFinal: equityFinal, ganancia: equityFinal - equityInicial };
  }

  /* IRR of a monthly cash-flow series, by bisection. Returns monthly rate or null. */
  function irr(cfs) {
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
  function tirReal(o) {
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

    // --- rent & hold decision (Cap. 15/16, Fase C) ---
    var rentaAnualBruta = V * ((p.rentaBruta || 0) / 100);
    var rentaEfectiva = rentaAnualBruta * ((p.ocupacion || 0) / 100);
    var rentaNeta = rentaEfectiva * 0.70;                 // ~30% de gastos operativos
    // depreciation shield (Cap. 3/39): 2,22%/año sobre el 80% del valor, deducible de la renta
    var deprAnual = 0.0222 * 0.80 * V;
    var escudoDepr = Math.min(deprAnual, Math.max(0, rentaNeta)) * ((p.taxRate || 0) / 100);
    var annualMortgage = cuotaHipotecaMes * 12;
    var flujoRenta = rentaNeta - annualMortgage;
    var cashOnCash = (Vc * d) > 0 ? flujoRenta / (Vc * d) : 0;
    var conservar = (p.rentaBruta || 0) >= 12 && (p.ocupacion || 0) >= 70;

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
      refiExtraible: refiExtraible, nPaises: nPaises, nMonedas: nMonedas, pctUsd: pctUsd, duraOk: duraOk, holdingRec: holdingRec,
      tir: tirDisplay, tirUsd: tirUsd, esFx: esFx, roi: real.roi, tirSin: tirSin, multiple: lev.multiple, verdict: verdict,
      reinvNeto: reinvNeto, reinvDiferido: reinvDiferido, ventaja: ventaja, maxReinv: maxReinv,
      nseMensual: nseMensual, capitalLibertad: capitalLibertad, ciclos: ciclos,
      capitalParcial: capitalParcial, capitalTotal: capitalTotal,
      chartPts: pts, chartArea: chartArea, axisYears: axisYears,
      chartStart: { x: X(0), y: Y(vals[0]) }, chartEnd: { x: X(Hp), y: Y(vals[Hp]) }, endVal: vals[Hp],
      scenarios: scenarios, maxScenTir: maxScenTir, reglaOro: reglaOro,
      p5: p5, p5Verdict: p5Verdict,
      projView: projView, maxTir: maxTir
    };
  }

  /* ------------------------------------------------- panel (dashboard) ---- */
  /* Modelo personal (hoja "Panel de Control" del Excel): perfil → poder de
     inversión, NSE, años a la libertad, proyección año a año, capacidad de
     endeudamiento y cuántos/qué proyectos puedes asumir (entradas por mercado
     de la hoja "Comparativa de Mercados"). */
  var PN_MERCADOS = [
    { key: 'colombia', min: 15000, planM: 30 },
    { key: 'rd',       min: 20000, planM: 24 },
    { key: 'mexico',   min: 25000, planM: 36 },
    { key: 'dubai',    min: 80000, planM: 36 }
  ];

  function computePanel() {
    var s = state, L = T[s.lang], f = makeFmt(s.lang);
    var I = s.ingreso || 0, G = s.gasto || 0, Dm = s.deudas || 0, C = s.capital || 0;
    var H = s.horizonte || 10;
    var g = (s.valorizacionEsp != null ? s.valorizacionEsp : 10) / 100;
    var libertad = s.gastoLibertad || 0;

    var flujoLibre = Math.max(0, I - G - Dm);       // ingreso − gasto − deudas
    var flujoAnual = flujoLibre * 12;
    var poderInversion = C + flujoLibre * 36;        // capital + 36 meses de flujo
    var propiedadMax = poderInversion / 0.3;         // con 30% de cuota inicial
    var NSE = g > 0 ? (libertad * 12) / g : 0;        // Número de Seguridad Económica

    var aniosLibertad = null;
    if (g > 0 && flujoAnual > 0) aniosLibertad = Math.log((NSE * g) / flujoAnual + 1) / Math.log(1 + g);

    function pat(t) { return g === 0 ? C + flujoAnual * t : C * Math.pow(1 + g, t) + flujoAnual * (Math.pow(1 + g, t) - 1) / g; }
    var serie = [];
    for (var t = 0; t <= H; t++) { var v = pat(t); serie.push({ t: t, val: v, pasivo: v * g / 12, prog: NSE > 0 ? Math.min(v / NSE, 1) : 0 }); }
    var patFinal = serie[serie.length - 1].val;
    var patY5 = pat(5), patY10 = pat(10);
    var progreso = NSE > 0 ? Math.min(patFinal / NSE, 1) : 0;

    // capacidad de endeudamiento (regla del 35% del ingreso − deudas)
    var maxCuota = Math.max(0, 0.35 * I - Dm);
    var dti = I > 0 ? Dm / I : 0;
    var rTyp = 0.10 / 12, nTyp = 20 * 12;             // hipoteca típica 20 años ~10%
    var maxHipoteca = maxCuota > 0 ? maxCuota * (1 - Math.pow(1 + rTyp, -nTyp)) / rTyp : 0;
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
      return { key: mk.key, min: mk.min, cuotaMes: cuotaMes, afford: C >= mk.min && flujoLibre >= cuotaMes, n: n };
    });
    var afford = mkView.filter(function (m) { return m.afford; });
    var nSimult = afford.length ? Math.max.apply(null, afford.map(function (m) { return m.n; })) : 0;

    var verdict;
    if (aniosLibertad != null && aniosLibertad <= 5) verdict = { text: L.pnVerdictAccel, cls: '' };
    else if (aniosLibertad != null && aniosLibertad <= 8) verdict = { text: L.pnVerdictSolido, cls: 'mid' };
    else verdict = { text: L.pnVerdictConstru, cls: 'warn' };

    return { f: f, L: L, H: H, g: g, flujoLibre: flujoLibre, poderInversion: poderInversion,
      propiedadMax: propiedadMax, NSE: NSE, aniosLibertad: aniosLibertad, serie: serie,
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
      var tiles =
        tile(L.pnFlujoLibre, f.fmt(c.flujoLibre), 'USD') +
        tile(L.pnPoder, f.fmt(c.poderInversion), 'USD') +
        tile(L.pnPropMax, f.fmt(c.propiedadMax), 'USD') +
        tile(L.pnNse, f.fmt(c.NSE), 'USD') +
        tile(L.pnAnios, anios, L.unitYears) +
        tile(L.pnPatY10, f.fmt(c.patY10), 'USD');
      html =
        '<div class="panel card card-accent card-span pn-hero">' +
          '<div class="eyebrow">' + escapeHtml(L.pnResumen) + '</div>' +
          '<div class="pn-tiles">' + tiles + '</div>' +
          '<p class="card-help pn-hero-note">' + escapeHtml(L.pnResumenNota) + '</p>' +
          '<div class="verdict ' + c.verdict.cls + '">' + escapeHtml(c.verdict.text) + '</div>' +
        '</div>';

    } else if (tab === 'proyeccion') {
      html =
        '<div class="panel card card-span">' +
          '<div class="proj-head"><div><div class="eyebrow">' + escapeHtml(L.pnProyeccion) + '</div>' +
          '<p class="card-help">' + escapeHtml(L.pnProyeccionHelp) + '</p></div>' +
          '<div class="proj-end"><div class="proj-end-num">' + f.fmt(c.patFinal) + ' <span class="foot-unit">USD</span></div>' +
          '<div class="foot-cap">' + escapeHtml(L.yr) + ' ' + c.H + '</div></div></div>' +
          '<div class="pn-chart">' + panelChartSVG(c) + '</div>' +
          '<div class="usage"><div class="usage-head"><span class="usage-label">' + escapeHtml(L.pnProgreso) + '</span>' +
          '<span class="usage-pct">' + f.pct(c.progreso, 0) + '%</span></div>' +
          '<div class="bar-track bar-track-8"><div class="bar-fill bar-fill-gold" style="width:' + (c.progreso * 100).toFixed(0) + '%"></div></div></div>' +
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

    } else if (tab === 'proyectos') {
      var stat = function (val, unit, label) {
        return '<div class="pn-stat"><div class="pn-stat-v">' + val +
          (unit ? '<span> ' + unit + '</span>' : '') + '</div>' +
          '<div class="pn-stat-l">' + escapeHtml(label) + '</div></div>';
      };
      var mkRows = c.mkView.map(function (m) {
        var name = (L.pnMercados && L.pnMercados[m.key]) || m.key;
        var badge = '<span class="viab-badge ' + (m.afford ? 'ok' : 'no') + '">' + escapeHtml(m.afford ? L.pnAlcanza : L.pnNoAlcanza) + '</span>';
        return '<div class="pn-mk-row">' +
          '<div class="pn-mk-head"><span class="pn-mk-name">' + escapeHtml(name) + '</span>' + badge + '</div>' +
          '<div class="pn-mk-stats">' +
            stat(f.fmt(m.min), 'USD', L.pnStEntrada) +
            stat(f.fmt(m.cuotaMes), 'USD', L.pnStCuota) +
            stat(m.afford ? String(m.n) : '—', '', L.pnStProys) +
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
          '<button type="button" class="pn-cta" id="pn-goto-proyecto">' + escapeHtml(L.pnAbrirProyecto) + '</button>' +
        '</div>';

    } else if (tab === 'conclusiones') {
      var C = s.capital || 0, flujoAnual = c.flujoLibre * 12, gBase = c.g, libertad = s.gastoLibertad || 0, H = c.H;

      // --- escenarios predictivos (conservador / base / optimista) ---
      var scen = [
        { key: 'cons', label: L.scenCons, g: gBase * 0.6 },
        { key: 'base', label: L.scenBase, g: gBase },
        { key: 'opt',  label: L.scenOpt,  g: gBase * 1.4 }
      ].map(function (sc) {
        var NSEs = sc.g > 0 ? (libertad * 12) / sc.g : 0;
        return { key: sc.key, label: sc.label, g: sc.g, patH: pnPatAt(C, flujoAnual, sc.g, H), fy: pnFreedomYears(flujoAnual, sc.g, NSEs) };
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
        var fy2 = pnFreedomYears((c.flujoLibre + 500) * 12, gBase, c.NSE);
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
          '</div>'
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
        finType: 'banco', finTasa: 10, finPlazo: 20, ltvMax: 70, prepagoPct: 0, p5: defaultP5() };
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
    setText('veh-nota', vObj.note[s.lang]);
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
    setText('renta-depr', f.fmt(c.escudoDepr) + ' ' + L.perYearShort);
    setText('renta-refi', f.fmt(c.refiExtraible) + ' USD');

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
     ['in-rentabruta', 'rentaBruta'], ['in-ocupacion', 'ocupacion'], ['in-devaluacion', 'devaluacion'],
     ['in-tax', 'taxRate'], ['in-fintasa', 'finTasa'], ['in-finplazo', 'finPlazo'], ['in-ltv', 'ltvMax']]
      .forEach(function (pair) {
        $(pair[0]).addEventListener('input', function (e) { activeProject()[pair[1]] = parseFloat(e.target.value); commit(); });
      });

    $('dif-toggle').addEventListener('click', function () { var p = activeProject(); p.diferimiento = !p.diferimiento; commit(); });

    // tax vehicle preset (sets tax rate + deferral for the chosen jurisdiction)
    $('sel-vehiculo').addEventListener('change', function (e) {
      var p = activeProject(); p.vehiculo = e.target.value;
      var v = VEHICULOS.filter(function (x) { return x.id === e.target.value; })[0];
      if (v && v.id !== 'otro') {
        if (v.taxRate != null) p.taxRate = v.taxRate; if (v.dif != null) p.diferimiento = v.dif;
        if (v.ltv != null) p.ltvMax = v.ltv; if (v.prepago != null) p.prepagoPct = v.prepago;
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

    // panel — personal profile inputs (shared global state)
    $('pn-nombre').addEventListener('input', function (e) { state.perfilNombre = e.target.value; saveState(); });
    [['pn-ingreso', 'ingreso'], ['pn-gasto', 'gasto'], ['pn-deudas', 'deudas'],
     ['pn-capital', 'capital'], ['pn-libertad', 'gastoLibertad']].forEach(function (pair) {
      $(pair[0]).addEventListener('input', function (e) { state[pair[1]] = parseNum(e.target.value); commit(); });
    });
    $('pn-valoriz').addEventListener('input', function (e) { state.valorizacionEsp = parseFloat(e.target.value); commit(); });
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
})();
