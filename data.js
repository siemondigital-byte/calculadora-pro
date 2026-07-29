/* Datos y constantes del método (libro): defaults de proyectos/módulos,
   vehículos fiscales por país, las 5 P y el checklist ponderado.
   Módulo puro: sin estado mutable ni DOM. */

export var LS_KEY = 'crd-calc-v2';
export function uid() { return 'p' + Math.random().toString(36).slice(2, 9); }

  /* ---- Módulos registrables del Excel (Shopping / Portafolio / Checklist) ---- */
export function defaultShopping() {
    return [
      { id: uid(), name: 'Torre A', m2: 65, precio: 130000, inicialPct: 30, meses: 30, valoriz: 1 },
      { id: uid(), name: 'Torre B', m2: 72, precio: 138000, inicialPct: 30, meses: 30, valoriz: 1 }
    ];
  }
export function defaultPortafolio() {
    return [
      { id: uid(), name: 'El Poblado 1204', precioCompra: 90000, cuotaInicial: 27000, mesesObra: 30, mesActual: 12, valoriz: 1, valorReal: 0, pagado: 0 }
    ];
  }
  // Checklist de selección (Cap. 13 / hoja "Checklist y Scoring"): 8 criterios ponderados.
export var CHECKLIST_CRIT = [
    { peso: 0.20, name: { es: 'Trayectoria y reputación de la constructora', en: 'Developer track record & reputation' } },
    { peso: 0.20, name: { es: 'Ubicación y zona de valorización', en: 'Location & appreciation zone' } },
    { peso: 0.15, name: { es: 'Demanda habitacional documentada en la zona', en: 'Documented housing demand in the area' } },
    { peso: 0.15, name: { es: 'Respaldo fiduciario / garantías legales', en: 'Trust backing / legal guarantees' } },
    { peso: 0.10, name: { es: 'Calidad del diseño y especificaciones', en: 'Design quality & specifications' } },
    { peso: 0.10, name: { es: 'Transparencia y comunicación del desarrollador', en: 'Developer transparency & communication' } },
    { peso: 0.05, name: { es: 'Acceso a servicios, vías e infraestructura', en: 'Access to services, roads & infrastructure' } },
    { peso: 0.05, name: { es: 'Potencial de renta si decides no vender', en: 'Rental potential if you decide to hold' } }
  ];
export function defaultChecklist() {
    return { nombre: '', scores: CHECKLIST_CRIT.map(function () { return 3; }) };
  }

export function defaultProjects() {
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

export var PROJECT_FIELDS = ['id', 'name', 'location', 'moneda', 'valor', 'inicialPct', 'planMeses',
    'valorizacion', 'entryModel', 'entradaPremium', 'exitStrategy', 'rentaBruta', 'ocupacion',
    'costoCierre', 'margenError', 'vehiculo', 'taxRate', 'diferimiento', 'devaluacion',
    'finType', 'finTasa', 'finPlazo', 'ltvMax', 'prepagoPct', 'p5'];

  /* Vehículos fiscales / jurisdicciones (Cap. 25/26/41-47). Al elegir uno se
     fija la tasa de ganancia y se activa el diferimiento donde aplica. */
export var VEHICULOS = [
    { id: 'otro',      name: { es: 'Otro / manual', en: 'Other / manual' }, note: { es: 'Fija la tasa a mano.', en: 'Set the rate manually.' } },
    { id: 'dubai',     name: { es: 'Dubái · 0%', en: 'Dubai · 0%' }, taxRate: 0, dif: true, ltv: 70, prepago: 1, note: { es: '0% a la ganancia de capital y a la renta.', en: '0% capital gains and income.' } },
    { id: 'colombia',  name: { es: 'Colombia · AFC', en: 'Colombia · AFC' }, taxRate: 10, dif: true, ltv: 60, prepago: 0, note: { es: 'AFC: exención hasta 30% del ingreso / 3.800 UVT.', en: 'AFC: exemption up to 30% of income / 3,800 UVT.' } },
    { id: 'usa',       name: { es: 'EE.UU. · 1031', en: 'USA · 1031' }, taxRate: 20, dif: true, ltv: 75, prepago: 4, note: { es: '1031 Exchange: difieres reinvirtiendo en 180 días.', en: '1031 Exchange: defer by reinvesting within 180 days.' } },
    { id: 'rd',        name: { es: 'Rep. Dominicana · CONFOTUR', en: 'Dominican Rep. · CONFOTUR' }, taxRate: 0, dif: true, ltv: 70, prepago: 2, note: { es: 'CONFOTUR: 0% transferencia + IPI por 10–15 años.', en: 'CONFOTUR: 0% transfer + IPI for 10–15 years.' } },
    { id: 'panama',    name: { es: 'Panamá · 1ª venta', en: 'Panama · 1st sale' }, taxRate: 10, dif: true, ltv: 70, prepago: 1, note: { es: 'Exención en la primera venta de inmueble nuevo.', en: 'Exemption on the first sale of a new property.' } },
    { id: 'mexico',    name: { es: 'México · FIBRA', en: 'Mexico · FIBRA' }, taxRate: 25, dif: true, ltv: 50, prepago: 0, note: { es: 'Persona moral / FIBRA: difieren hasta la distribución.', en: 'Corporation / FIBRA: defer until distribution.' } },
    { id: 'costarica', name: { es: 'Costa Rica · territorial', en: 'Costa Rica · territorial' }, taxRate: 15, dif: false, ltv: 70, prepago: 1, note: { es: 'Renta territorial: grava solo ingresos locales.', en: 'Territorial: taxes local income only.' } }
  ];
export function fxRisk(moneda) { var m = (moneda || '').toUpperCase().trim(); return m !== '' && m !== 'USD' && m !== 'AED'; }

  /* Método de las 5 P (Cap. 13) — checklist puntuable de calidad del deal.
     Cada P: 2=Cumple, 1=Parcial, 0=Falla. Regla del libro: una P en 0 lo descarta. */
export var P5KEYS = ['punto', 'precio', 'producto', 'proceso', 'personas', 'proposito'];
export var P5_DEFS = [
    { key: 'punto',     name: { es: 'Punto',     en: 'Point' },     hint: { es: 'Ubicación con infraestructura en marcha y demanda de salida.', en: 'Location with infrastructure underway and exit demand.' } },
    { key: 'precio',    name: { es: 'Precio',    en: 'Price' },     hint: { es: 'Entrada temprana / Lista Cero (ventaja de 8–15%).', en: 'Early entry / Zero List (8–15% edge).' } },
    { key: 'producto',  name: { es: 'Producto',  en: 'Product' },   hint: { es: 'Diseño para renta intensiva y reventa fácil.', en: 'Built for intensive rental and easy resale.' } },
    { key: 'proceso',   name: { es: 'Proceso',   en: 'Process' },   hint: { es: 'Fiducia + cláusula de cesión de derechos (salida antes de entrega).', en: 'Trust + assignment clause (exit before handover).' } },
    { key: 'personas',  name: { es: 'Personas',  en: 'People' },    hint: { es: 'Constructora con historial (5+ proyectos entregados).', en: 'Developer with a track record (5+ delivered).' } },
    { key: 'proposito', name: { es: 'Propósito', en: 'Purpose' },   hint: { es: 'Alineado con tu meta, horizonte y Número de Seguridad Económica.', en: 'Aligned with your goal, horizon and Economic Security Number.' } }
  ];
export function defaultP5() { return { punto: 2, precio: 2, producto: 2, proceso: 2, personas: 2, proposito: 2 }; }
export function p5Eval(pr) {
    var pv = pr.p5 || {}, sum = 0, red = false;
    P5KEYS.forEach(function (k) { var v = pv[k] == null ? 2 : pv[k]; sum += v; if (v === 0) red = true; });
    return { sum: sum, score: sum / (P5KEYS.length * 2), red: red, max: P5KEYS.length * 2 };
  }
