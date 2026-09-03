/**********************************************************************
 * ANÁLISIS DE MEZCLA ESPECTRAL
 * Aplicación didáctica de posgrado — Quillota, Chile
 * ------------------------------------------------------------------
 * Módulo 1 : Biblioteca de endmembers  (N muestras por componente)
 * Módulo 2 : Mezcla directa            (construir la mezcla a mano)
 * Módulo 3 : Espacio de atributos      (nubes por clase y simplex)
 * Módulo 4 : Inversión — mapas de fracción
 * Módulo 5 : Residuo, clasificación dura y efecto de la escala
 *
 * Dos decisiones de diseño:
 *  - Primero se MEZCLA y solo después se DESMEZCLA.
 *  - Un endmember no es un espectro, es una NUBE de espectros. Por eso
 *    se recolectan varias muestras por componente y se muestra su
 *    envolvente junto a la media.
 *
 * Autor: Lucas Vituri Santarosa
 * Escuela de Agronomía, PUCV
 * Laboratorio de Recursos Hídricos y Geotecnologías
 *
 * Pegar en el Code Editor de Google Earth Engine y presionar Run.
 *********************************************************************/

// ====================================================================
// 1. ESTADO GLOBAL
// ====================================================================
var estado = {
  centro: [-71.247, -32.880],
  radio:  3000,
  mesIni: 1,
  duracion: 3
};

var LUGARES = {
  'Quillota — huertos de paltos':  [-71.247, -32.880],
  'La Cruz — mosaico agrícola':    [-71.230, -32.830],
  'Quillota — franja periurbana':  [-71.255, -32.895],
  'Embalse Los Aromos — agua':     [-71.365, -32.975],
  'Dunas de Concón — suelo':       [-71.520, -32.925],
  'Matorral seco — sector este':   [-71.100, -32.850]
};

var BANDAS = ['B2','B3','B4','B8','B11','B12'];
var NM     = [492, 560, 665, 833, 1614, 2202];

// --------------------------------------------------------------------
// CONJUNTOS DE COMPONENTES
// La elección del conjunto es una decisión del analista, no un dato del
// problema: cambiarla cambia el significado de cada fracción.
// --------------------------------------------------------------------
var CONJUNTOS = {
  // Con 6 bandas se pueden invertir hasta 6 componentes. Con 4 el mapa
  // RGB de fracciones ya no alcanza: se muestra una fracción a la vez.
  'Vegetación / Suelo / Sombra / Agua': [
    {nombre: 'Vegetación', color: '#2e8b57',
     ref: [0.028, 0.055, 0.035, 0.360, 0.160, 0.075]},
    {nombre: 'Suelo', color: '#c0752a',
     ref: [0.120, 0.160, 0.220, 0.300, 0.360, 0.310]},
    {nombre: 'Sombra', color: '#444444', sombra: true,
     ref: [0.008, 0.012, 0.010, 0.020, 0.012, 0.008]},
    {nombre: 'Agua', color: '#1f6fb4',
     ref: [0.030, 0.025, 0.015, 0.008, 0.004, 0.003]}
  ],
  'Vegetación / Suelo / Sombra': [
    {nombre: 'Vegetación', color: '#2e8b57',
     ref: [0.028, 0.055, 0.035, 0.360, 0.160, 0.075]},
    {nombre: 'Suelo', color: '#c0752a',
     ref: [0.120, 0.160, 0.220, 0.300, 0.360, 0.310]},
    {nombre: 'Sombra', color: '#444444', sombra: true,
     ref: [0.008, 0.012, 0.010, 0.020, 0.012, 0.008]}
  ],
  'Vegetación verde / Senescente / Suelo': [
    {nombre: 'Vegetación verde', color: '#2e8b57',
     ref: [0.028, 0.055, 0.035, 0.360, 0.160, 0.075]},
    {nombre: 'Vegetación senescente', color: '#d4a017',
     ref: [0.075, 0.105, 0.140, 0.280, 0.330, 0.270]},
    {nombre: 'Suelo', color: '#c0752a',
     ref: [0.120, 0.160, 0.220, 0.300, 0.360, 0.310]}
  ],
  'Vegetación / Suelo / Agua': [
    {nombre: 'Vegetación', color: '#2e8b57',
     ref: [0.028, 0.055, 0.035, 0.360, 0.160, 0.075]},
    {nombre: 'Suelo', color: '#c0752a',
     ref: [0.120, 0.160, 0.220, 0.300, 0.360, 0.310]},
    {nombre: 'Agua', color: '#1f6fb4',
     ref: [0.030, 0.025, 0.015, 0.008, 0.004, 0.003]}
  ],
  'Cultivo / Suelo / Superficie impermeable': [
    {nombre: 'Cultivo', color: '#2e8b57',
     ref: [0.028, 0.055, 0.035, 0.360, 0.160, 0.075]},
    {nombre: 'Suelo', color: '#c0752a',
     ref: [0.120, 0.160, 0.220, 0.300, 0.360, 0.310]},
    {nombre: 'Superficie impermeable', color: '#8e44ad',
     ref: [0.130, 0.140, 0.150, 0.170, 0.180, 0.160]}
  ]
};

var conjuntoActivo = 'Vegetación / Suelo / Sombra / Agua';

var muestras = {};        // muestras[nombre] = [espectro1, espectro2, ...]
var pixelMedido = null;
var peticion = 0;

function comps() { return CONJUNTOS[conjuntoActivo]; }
function nombres() { return comps().map(function(c) { return c.nombre; }); }

function compDe(n) {
  var r = null;
  comps().forEach(function(c) { if (c.nombre === n) { r = c; } });
  return r;
}

function colorDe(n) { return compDe(n).color; }
function hex(n) { return colorDe(n).replace('#', ''); }

function reiniciarMuestras() {
  muestras = {};
  nombres().forEach(function(n) { muestras[n] = []; });
  pixelMedido = null;
}

// La media de las muestras es el endmember que usa el modelo
function media(n) {
  var ms = muestras[n];
  if (!ms || ms.length === 0) { return null; }
  return NM.map(function(_, i) {
    var s = 0;
    ms.forEach(function(m) { s += m[i]; });
    return s / ms.length;
  });
}

function envolvente(n) {
  var ms = muestras[n];
  if (!ms || ms.length < 2) { return null; }
  return {
    min: NM.map(function(_, i) {
      return Math.min.apply(null, ms.map(function(m) { return m[i]; }));
    }),
    max: NM.map(function(_, i) {
      return Math.max.apply(null, ms.map(function(m) { return m[i]; }));
    })
  };
}

function completa() {
  return nombres().every(function(n) { return media(n) !== null; });
}

reiniciarMuestras();

// ====================================================================
// 2. DATOS
// ====================================================================
function areaActual() {
  return ee.Geometry.Point(estado.centro).buffer(estado.radio).bounds();
}

function periodoActual() {
  var ini = ee.Date.fromYMD(2025, estado.mesIni, 1);
  return {ini: ini, fin: ini.advance(estado.duracion, 'month')};
}

function enmascararS2(img) {
  var scl = img.select('SCL');
  var buena = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  return img.select(BANDAS).divide(10000).updateMask(buena)
            .copyProperties(img, ['system:time_start']);
}

function imagen() {
  var p = periodoActual();
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(areaActual()).filterDate(p.ini, p.fin)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80))
    .map(enmascararS2)
    .median();
}

var VIS_RGB = {bands: ['B4','B3','B2'], min: 0, max: 0.3};

// ====================================================================
// 3. CONTROLES
// ====================================================================
var E_TITULO = {fontWeight: 'bold', fontSize: '18px', margin: '10px 4px 0'};
var E_ETIQ   = {fontWeight: 'bold', fontSize: '12px', margin: '10px 4px 2px'};
var E_TEXTO  = {fontSize: '12px', color: '#333', margin: '2px 4px',
                whiteSpace: 'pre-wrap'};
var E_NOTA   = {fontSize: '11px', color: '#666', margin: '4px',
                whiteSpace: 'pre-wrap'};

var titulo = ui.Label('Análisis de Mezcla Espectral', E_TITULO);

var tituloModulo  = ui.Label('', {fontWeight: 'bold', fontSize: '14px',
                                  margin: '10px 4px 4px', color: '#1a5490'});
var objetivo      = ui.Label('', E_TEXTO);
var instrucciones = ui.Label('', E_TEXTO);
var preguntas     = ui.Label('', {fontSize: '12px', color: '#555',
                                  margin: '8px 4px', whiteSpace: 'pre-wrap',
                                  backgroundColor: '#f2f6fa', padding: '6px'});

function describir(nombre, obj, pasos, preg) {
  tituloModulo.setValue(nombre);
  objetivo.setValue('OBJETIVO\n' + obj);
  instrucciones.setValue('\nINSTRUCCIONES\n' + pasos);
  preguntas.setValue('PARA DISCUTIR EN CLASE\n' + preg);
}

var selectorModulo = ui.Select({
  items: ['1 — Biblioteca de endmembers',
          '2 — Mezcla directa',
          '3 — Espacio de atributos',
          '4 — Inversión y mapas de fracción',
          '5 — Residuo, clasificación y escala'],
  value: '1 — Biblioteca de endmembers',
  style: {stretch: 'horizontal'},
  onChange: function(v) { abrirModulo(v.charAt(0)); }
});

var selectorConjunto = ui.Select({
  items: Object.keys(CONJUNTOS), value: conjuntoActivo,
  style: {stretch: 'horizontal'},
  onChange: function(v) {
    conjuntoActivo = v;
    reiniciarMuestras();      // las muestras no son transferibles
    selectorModulo.setValue('1 — Biblioteca de endmembers', false);
    abrirModulo('1');
  }
});

var selectorLugar = ui.Select({
  items: Object.keys(LUGARES), value: 'Quillota — huertos de paltos',
  style: {stretch: 'horizontal'},
  onChange: function(n) { estado.centro = LUGARES[n]; recargar(); }
});

var sliderRadio = ui.Slider({
  min: 1, max: 10, value: 3, step: 1, style: {stretch: 'horizontal'},
  onChange: function(km) { estado.radio = km * 1000; recargar(); }
});

var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

var selectorMes = ui.Select({
  items: MESES, value: 'Enero', style: {stretch: 'horizontal'},
  onChange: function(m) { estado.mesIni = MESES.indexOf(m) + 1; recargar(); }
});

var selectorDuracion = ui.Select({
  items: ['1 mes','2 meses','3 meses'], value: '3 meses',
  style: {stretch: 'horizontal'},
  onChange: function(d) { estado.duracion = parseInt(d, 10); recargar(); }
});

var estadoBiblioteca = ui.Label('', E_NOTA);

function refrescarEstado() {
  estadoBiblioteca.setValue('Muestras: ' + nombres().map(function(n) {
    return n + ' (' + (muestras[n] ? muestras[n].length : 0) + ')';
  }).join('   ·   '));
}

var panelModulo = ui.Panel();

var pie = ui.Label(
  '─────────────────────────────\n' +
  'Lucas Vituri Santarosa\n' +
  'Escuela de Agronomía, PUCV\n' +
  'Laboratorio de Recursos Hídricos y Geotecnologías',
  {fontSize: '11px', color: '#777', margin: '16px 4px 10px',
   whiteSpace: 'pre-wrap'});

var controles = ui.Panel({
  style: {width: '360px', padding: '6px'},
  widgets: [
    titulo,
    ui.Label('Módulo', E_ETIQ), selectorModulo,
    ui.Label('Conjunto de componentes', E_ETIQ), selectorConjunto,
    tituloModulo, objetivo, instrucciones,
    estadoBiblioteca,
    ui.Label('Área de estudio', E_ETIQ), selectorLugar,
    ui.Label('Radio del área (km)', {fontSize: '12px', margin: '8px 4px 0'}),
    sliderRadio,
    ui.Label('Período dentro de 2025', E_ETIQ), selectorMes, selectorDuracion,
    panelModulo, preguntas, pie
  ]
});

// ====================================================================
// 4. MAPAS
// ====================================================================
var mapaSolo = ui.Map();
var mapaIzq  = ui.Map();
var mapaDer  = ui.Map();
[mapaSolo, mapaIzq, mapaDer].forEach(function(m) { m.setOptions('SATELLITE'); });
mapaSolo.style().set('cursor', 'crosshair');

var enlazador = ui.Map.Linker([mapaIzq, mapaDer]);

var cortina = ui.SplitPanel({
  firstPanel: mapaIzq, secondPanel: mapaDer,
  wipe: true, orientation: 'horizontal', style: {stretch: 'both'}
});

var usandoCortina = false;

function mostrarEscenario(conCortina) {
  var nuevo = conCortina ? cortina : mapaSolo;
  var lista = ui.root.widgets();
  var actual = lista.length() > 1 ? lista.get(1) : null;
  if (actual !== nuevo) {
    if (actual) { lista.remove(actual); }
    lista.add(nuevo);
  }
  usandoCortina = conCortina;
}

function limpiarMapas() {
  mapaSolo.layers().reset();
  mapaIzq.layers().reset();
  mapaDer.layers().reset();
}

function encuadrar(area) {
  if (usandoCortina) { mapaIzq.centerObject(area); }
  else { mapaSolo.centerObject(area); }
}

function avisar(texto) {
  panelModulo.widgets().reset([
    ui.Label(texto, {color: '#a00', fontSize: '12px', margin: '8px 4px',
                     whiteSpace: 'pre-wrap'})
  ]);
}

function faltaBiblioteca() {
  avisar('Faltan muestras para algún componente del conjunto activo.\n' +
         'Vuelva al Módulo 1 y complete la biblioteca.');
}

// --------------------------------------------------------------------
// Curvas: media por componente y, con 2 o más muestras, la envolvente
// mínimo–máximo en línea fina discontinua del mismo color.
// --------------------------------------------------------------------
function graficoCurvas(titulo_, verEnvolvente, extras) {
  var cab = ['Longitud de onda (nm)'];
  var columnas = [];

  nombres().forEach(function(n) {
    var m = media(n);
    if (!m) { return; }
    cab.push(n);
    columnas.push({valores: m,
                   estilo: {color: colorDe(n), lineWidth: 3, pointSize: 5}});
    var env = envolvente(n);
    if (verEnvolvente && env) {
      cab.push(n + ' mín');
      columnas.push({valores: env.min, estilo: {color: colorDe(n),
        lineWidth: 1, pointSize: 0, lineDashStyle: [3, 3]}});
      cab.push(n + ' máx');
      columnas.push({valores: env.max, estilo: {color: colorDe(n),
        lineWidth: 1, pointSize: 0, lineDashStyle: [3, 3]}});
    }
  });

  if (extras) {
    extras.forEach(function(e) {
      cab.push(e.nombre);
      columnas.push({valores: e.valores, estilo: e.estilo});
    });
  }

  var filas = NM.map(function(nm, i) {
    return [nm].concat(columnas.map(function(c) { return c.valores[i]; }));
  });

  var series = {};
  columnas.forEach(function(c, i) { series[i] = c.estilo; });

  return ui.Chart([cab].concat(filas), 'LineChart', {
    title: titulo_,
    hAxis: {title: 'Longitud de onda (nm)', viewWindow: {min: 400, max: 2400}},
    vAxis: {title: 'Reflectancia', viewWindow: {min: 0, max: 0.6}},
    interpolateNulls: true, legend: {position: 'top'}, height: 320,
    series: series
  });
}

// ====================================================================
// MÓDULO 1 — BIBLIOTECA DE ENDMEMBERS
// ====================================================================
function modulo1() {
  mostrarEscenario(false);
  limpiarMapas();

  describir(
    'Módulo 1 — Biblioteca de endmembers',
    'Construir la referencia del análisis. Un endmember no es un espectro\n' +
    'único: es una nube de espectros con variabilidad propia. Se recolectan\n' +
    'varias muestras por componente y el modelo usa la media.',
    '1. Elegir arriba el conjunto de componentes que se va a analizar.\n' +
    '2. Elegir el componente y hacer clic sobre píxeles puros de ese tipo.\n' +
    '3. Empezar por los componentes escasos (agua, sombra): basta 1 o 2\n' +
    '   muestras bien elegidas. Si no existe ninguna en el área, usar el\n' +
    '   botón "Conceptual" de ese componente y seguir adelante.\n' +
    '4. Dedicar el resto del tiempo a suelo y vegetación, que son\n' +
    '   abundantes y variables: recolectar de 4 a 8 muestras de cada uno.\n' +
    '5. Activar la envolvente para ver la dispersión de cada clase.',
    '• ¿Qué componente tiene la envolvente más ancha? ¿Por qué?\n' +
    '• Si dos envolventes se solapan, ¿puede el modelo separarlas?\n' +
    '• ¿La media de varios espectros puros sigue siendo un espectro puro?'
  );

  var selEM = ui.Select({
    items: nombres(), value: nombres()[0], style: {stretch: 'horizontal'}
  });

  var panelGrafico = ui.Panel();

  var chkEnv = ui.Checkbox({
    label: 'Mostrar envolvente mín–máx', value: true,
    onChange: function() { pintar(); }
  });

  function pintar() {
    refrescarEstado();
    var hay = nombres().some(function(n) { return media(n); });
    if (hay) {
      panelGrafico.widgets().reset([
        graficoCurvas('Biblioteca del conjunto activo', chkEnv.getValue()),
        ui.Label('Línea gruesa: media, la que usa el modelo.\n' +
                 'Líneas finas: mínimo y máximo de las muestras.', E_NOTA)
      ]);
    } else {
      panelGrafico.widgets().reset([
        ui.Label('Aún no hay muestras recolectadas.', E_TEXTO)]);
    }
  }

  var mensaje = ui.Label('', E_NOTA);

  // Un botón por componente. Sustituye SUS muestras por el espectro
  // conceptual de referencia, para el caso en que no exista un píxel
  // puro de ese componente dentro del área (agua fuera del embalse,
  // sombra a 10 m). No borra las muestras de los demás componentes.
  var conceptuales = [ui.Label('Sustituir por valores conceptuales', E_ETIQ)];
  comps().forEach(function(c) {
    conceptuales.push(ui.Button({
      label: 'Conceptual: ' + c.nombre,
      style: {stretch: 'horizontal'},
      onClick: function() {
        muestras[c.nombre] = [c.ref.slice()];
        mensaje.setValue('"' + c.nombre + '" quedó sustituido por su ' +
                         'espectro conceptual de referencia.');
        pintar();
      }
    }));
  });

  var btnReset = ui.Button({
    label: 'Vaciar la biblioteca', style: {stretch: 'horizontal'},
    onClick: function() {
      reiniciarMuestras();
      mensaje.setValue('');
      pintar();
    }
  });

  panelModulo.widgets().reset(
    [ui.Label('Componente a recolectar', E_ETIQ), selEM,
     ui.Label('Haga clic en píxeles puros del mapa.', E_TEXTO),
     chkEnv]
    .concat(conceptuales)
    .concat([btnReset, mensaje, panelGrafico]));

  pintar();

  var area = areaActual();
  mapaSolo.addLayer(imagen().clip(area), VIS_RGB, 'Sentinel-2');
  encuadrar(area);

  mapaSolo.onClick(function(coords) {
    var mia = ++peticion;
    var nombre = selEM.getValue();
    var pt = ee.Geometry.Point([coords.lon, coords.lat]);

    imagen().reduceRegion({reducer: ee.Reducer.first(), geometry: pt, scale: 10})
      .evaluate(function(res, err) {
        if (mia !== peticion) { return; }
        if (err || !res) { return; }
        var v = BANDAS.map(function(b) { return res[b]; });
        if (v.some(function(z) { return z === null || z === undefined; })) {
          return;
        }
        muestras[nombre].push(v);
        mapaSolo.layers().add(ui.Map.Layer(
          pt, {color: hex(nombre)},
          nombre + ' ' + muestras[nombre].length));
        pintar();
      });
  });
}

// ====================================================================
// MÓDULO 2 — MEZCLA DIRECTA
// ====================================================================
function modulo2() {
  mostrarEscenario(false);
  limpiarMapas();

  describir(
    'Módulo 2 — Mezcla directa',
    'Comprobar que el espectro de un píxel mixto es la combinación lineal\n' +
    'de los espectros puros, ponderada por la fracción de área que ocupa\n' +
    'cada componente. Se construye la mezcla, todavía no se invierte.',
    '1. Hacer clic sobre un píxel MIXTO (borde de huerto, hilera, orilla).\n' +
    '2. Mover los deslizadores hasta que la curva modelada (discontinua)\n' +
    '   se superponga a la curva medida.\n' +
    '3. Observar el RMSE: cuanto menor, mejor el ajuste.\n' +
    '4. Cambiar de conjunto de componentes y comparar el mejor RMSE.',
    '• ¿La suma de las fracciones dio 1? ¿Debe darlo siempre?\n' +
    '• ¿Qué conjunto de componentes ajusta mejor este píxel?\n' +
    '• ¿En qué banda falla primero el modelo? ¿Qué indica eso?'
  );

  if (!completa()) { faltaBiblioteca(); return; }

  var sliders = {};
  var etiqueta = ui.Label('', {fontSize: '12px', margin: '4px',
                               whiteSpace: 'pre-wrap'});
  var panelGrafico = ui.Panel();

  var widgets = [ui.Label('Haga clic en un píxel mixto del mapa.', E_TEXTO)];
  nombres().forEach(function(n) {
    widgets.push(ui.Label('Fracción de ' + n,
      {fontSize: '12px', margin: '8px 4px 0', color: colorDe(n)}));
    sliders[n] = ui.Slider({
      min: 0, max: 1, value: 0.33, step: 0.01,
      style: {stretch: 'horizontal'}, onChange: function() { dibujar(); }
    });
    widgets.push(sliders[n]);
  });
  widgets.push(etiqueta);
  widgets.push(panelGrafico);
  panelModulo.widgets().reset(widgets);

  function dibujar() {
    var suma = 0;
    var modelado = NM.map(function() { return 0; });
    nombres().forEach(function(n) {
      var f = sliders[n].getValue();
      suma += f;
      var m = media(n);
      NM.forEach(function(_, i) { modelado[i] += f * m[i]; });
    });

    var texto = 'Suma de fracciones: ' + suma.toFixed(2);
    if (Math.abs(suma - 1) > 0.02) {
      texto += '   (no se cumple la restricción de suma unitaria)';
    }

    var extras = [{nombre: 'Modelado', valores: modelado,
                   estilo: {color: '#000000', lineDashStyle: [6, 4],
                            pointSize: 0, lineWidth: 2}}];

    if (pixelMedido) {
      var sse = 0;
      NM.forEach(function(_, i) {
        var d = pixelMedido[i] - modelado[i];
        sse += d * d;
      });
      texto += '\nRMSE del ajuste: ' + Math.sqrt(sse / NM.length).toFixed(4);
      extras.unshift({nombre: 'Medido', valores: pixelMedido,
                      estilo: {color: '#d62728', lineWidth: 3, pointSize: 7}});
    } else {
      texto += '\nFalta elegir el píxel mixto en el mapa.';
    }

    etiqueta.setValue(texto);
    panelGrafico.widgets().reset([
      graficoCurvas('Píxel mixto: medido frente a modelado', false, extras)
    ]);
  }

  var area = areaActual();
  mapaSolo.addLayer(imagen().clip(area), VIS_RGB, 'Sentinel-2');
  encuadrar(area);
  dibujar();

  mapaSolo.onClick(function(coords) {
    var mia = ++peticion;
    var pt = ee.Geometry.Point([coords.lon, coords.lat]);
    mapaSolo.layers().set(1, ui.Map.Layer(pt, {color: 'yellow'}, 'píxel mixto'));
    imagen().reduceRegion({reducer: ee.Reducer.first(), geometry: pt, scale: 10})
      .evaluate(function(res, err) {
        if (mia !== peticion) { return; }
        if (err || !res) { return; }
        var v = BANDAS.map(function(b) { return res[b]; });
        if (v.some(function(z) { return z === null || z === undefined; })) {
          return;
        }
        pixelMedido = v;
        dibujar();
      });
  });
}

// ====================================================================
// MÓDULO 3 — ESPACIO DE ATRIBUTOS
// Cada componente se dibuja como NUBE de sus muestras, no como vértice.
// ====================================================================
function modulo3() {
  mostrarEscenario(false);
  limpiarMapas();

  describir(
    'Módulo 3 — Espacio de atributos',
    'Ver que los píxeles de la escena quedan contenidos en el polígono\n' +
    'cuyos vértices son los componentes. Como cada componente es una nube\n' +
    'y no un punto, los vértices son difusos: el simplex no es exacto.',
    '1. Observar la nube gris: son píxeles muestreados de la escena.\n' +
    '2. Localizar las muestras de cada componente, en color.\n' +
    '3. Comprobar si las nubes de color quedan en los extremos.\n' +
    '4. Cambiar el conjunto de componentes y repetir la lectura.',
    '• ¿Qué significa un píxel que cae FUERA del polígono?\n' +
    '• Si dos nubes de color se tocan, ¿qué le ocurre a la inversión?\n' +
    '• ¿El plano rojo–NIR basta, o hay componentes que solo se separan\n' +
    '  usando el SWIR?'
  );

  if (!completa()) { faltaBiblioteca(); return; }

  panelModulo.widgets().reset([ui.Label('Muestreando la escena…', E_TEXTO)]);

  var area = areaActual();
  var img = imagen().clip(area);
  mapaSolo.addLayer(img, VIS_RGB, 'Sentinel-2');
  encuadrar(area);

  var mia = ++peticion;
  var m = img.select(['B4','B8']).sample(
    {region: area, scale: 20, numPixels: 400, dropNulls: true});

  ee.List([m.aggregate_array('B4'), m.aggregate_array('B8')])
    .evaluate(function(res, err) {
      if (mia !== peticion) { return; }
      if (err || !res) { avisar('No fue posible muestrear la escena.'); return; }
      var rojo = res[0], nir = res[1];
      if (!rojo || rojo.length === 0) {
        avisar('Sin píxeles válidos en el área y período elegidos.');
        return;
      }

      var iR = BANDAS.indexOf('B4'), iN = BANDAS.indexOf('B8');
      var ns = nombres();
      var cab = ['Rojo (B4)', 'Píxeles de la escena'].concat(ns);
      var ancho = 2 + ns.length;

      function filaVacia() {
        var f = [];
        for (var k = 0; k < ancho; k++) { f.push(null); }
        return f;
      }

      var filas = [];
      rojo.forEach(function(r, i) {
        var f = filaVacia();
        f[0] = r; f[1] = nir[i];
        filas.push(f);
      });
      ns.forEach(function(n, k) {
        muestras[n].forEach(function(esp) {
          var f = filaVacia();
          f[0] = esp[iR];
          f[2 + k] = esp[iN];
          filas.push(f);
        });
      });

      var series = {0: {color: '#c8d8e4', pointSize: 3}};
      ns.forEach(function(n, k) {
        series[1 + k] = {color: colorDe(n), pointSize: 12};
      });

      panelModulo.widgets().reset([
        ui.Chart([cab].concat(filas), 'ScatterChart', {
          title: 'Espacio de atributos: nubes por componente',
          hAxis: {title: 'Reflectancia en el rojo (B4)'},
          vAxis: {title: 'Reflectancia en el NIR (B8)'},
          legend: {position: 'top'}, height: 340, series: series
        }),
        ui.Label('Cuanto más dispersa la nube de un componente, menos ' +
                 'fiable resulta tratarlo como un único endmember.', E_NOTA)
      ]);
    });
}

// ====================================================================
// MÓDULO 4 — INVERSIÓN Y MAPAS DE FRACCIÓN
// ====================================================================
function fracciones(sumToOne, nonNegative) {
  var lista = nombres().map(function(n) { return media(n); });
  var ids = nombres().map(function(_, i) { return 'c' + i; });
  return imagen().select(BANDAS)
    .unmix(lista, sumToOne, nonNegative)
    .rename(ids);
}

function leyendaRGB() {
  var ns = nombres();
  if (ns.length !== 3) {
    return 'Con ' + ns.length + ' componentes el mapa RGB ya no alcanza: ' +
           'se muestra una fracción a la vez.';
  }
  return 'Rojo = ' + ns[0] + '   ·   Verde = ' + ns[1] +
         '   ·   Azul = ' + ns[2];
}

function modulo4() {
  mostrarEscenario(true);
  limpiarMapas();

  describir(
    'Módulo 4 — Inversión y mapas de fracción',
    'Invertir el problema del Módulo 2: en vez de proponer las fracciones,\n' +
    'se resuelven para cada píxel. El resultado no es una clase por píxel,\n' +
    'sino una proporción continua de cada componente.',
    '1. Arrastrar la cortina entre la imagen real y el mapa de fracciones.\n' +
    '2. Leer el mapa con la leyenda de colores de abajo.\n' +
    '3. Activar y desactivar las restricciones y observar el cambio.\n' +
    '4. Cambiar el conjunto de componentes y comparar los dos mapas.',
    '• Sin la restricción de no negatividad aparecen fracciones negativas:\n' +
    '  ¿qué está diciendo el modelo cuando eso ocurre?\n' +
    '• ¿Qué información aporta una fracción que una clase no aporta?\n' +
    '• ¿Cómo se validaría en terreno un mapa de fracciones?'
  );

  if (!completa()) { faltaBiblioteca(); return; }

  var ns = nombres();

  var chkSuma = ui.Checkbox({label: 'Suma de fracciones igual a 1',
                             value: true, onChange: function() { dibujar(); }});
  var chkNoNeg = ui.Checkbox({label: 'Prohibir fracciones negativas',
                              value: true, onChange: function() { dibujar(); }});

  var widgets = [ui.Label('Restricciones del modelo', E_ETIQ),
                 chkSuma, chkNoNeg];

  var selFrac = null;
  if (ns.length !== 3) {
    selFrac = ui.Select({items: ns, value: ns[0],
                         style: {stretch: 'horizontal'},
                         onChange: function() { dibujar(); }});
    widgets.push(ui.Label('Fracción a mostrar', E_ETIQ));
    widgets.push(selFrac);
  }
  widgets.push(ui.Label(leyendaRGB(), E_NOTA));
  panelModulo.widgets().reset(widgets);

  function dibujar() {
    limpiarMapas();
    var area = areaActual();
    var f = fracciones(chkSuma.getValue(), chkNoNeg.getValue()).clip(area);
    mapaIzq.addLayer(imagen().clip(area), VIS_RGB, 'Sentinel-2');
    if (ns.length === 3) {
      mapaDer.addLayer(f, {min: 0, max: 1}, 'Fracciones (R,G,B)');
    } else {
      var k = ns.indexOf(selFrac.getValue());
      mapaDer.addLayer(f.select('c' + k),
        {min: 0, max: 1, palette: ['ffffff', hex(ns[k])]},
        'Fracción de ' + ns[k]);
    }
    encuadrar(area);
  }
  dibujar();
}

// ====================================================================
// MÓDULO 5 — RESIDUO, CLASIFICACIÓN DURA Y ESCALA
// ====================================================================
var OPCIONES5 = [
  'Residuo del modelo (RMSE)',
  'Fracción frente a clasificación dura',
  'Efecto de la escala: 10 m y 500 m'
];

function modulo5() {
  mostrarEscenario(true);
  limpiarMapas();

  describir(
    'Módulo 5 — Residuo, clasificación y escala',
    'Evaluar el modelo y confrontarlo con la alternativa clásica. El mapa\n' +
    'de residuo muestra dónde falta un componente; la comparación con la\n' +
    'clasificación dura muestra qué se pierde al forzar una clase por\n' +
    'píxel; el cambio de escala muestra por qué la mezcla es inevitable.',
    '1. Elegir la comparación en el selector.\n' +
    '2. En el residuo, buscar las zonas claras: allí el modelo no cierra.\n' +
    '3. Repetir el residuo con otro conjunto de componentes y comparar.\n' +
    '4. En el cambio de escala, observar cómo desaparecen las hileras.',
    '• Un residuo alto sobre agua o invernaderos: ¿qué componente falta?\n' +
    '• ¿En qué decisión agronómica la fracción es mejor que la clase?\n' +
    '• A 500 m, ¿queda algún píxel puro en el valle de Quillota?'
  );

  if (!completa()) { faltaBiblioteca(); return; }

  var sel = ui.Select({items: OPCIONES5, value: OPCIONES5[0],
                       style: {stretch: 'horizontal'},
                       onChange: function() { dibujar(); }});
  var leyenda = ui.Label('', E_NOTA);
  panelModulo.widgets().reset([
    ui.Label('Comparación', E_ETIQ), sel, leyenda
  ]);

  function reconstruir(f) {
    var ns = nombres();
    var terminos = BANDAS.map(function(b, i) {
      var acc = ee.Image(0);
      ns.forEach(function(n, k) {
        acc = acc.add(f.select('c' + k).multiply(media(n)[i]));
      });
      return acc.rename(b);
    });
    return ee.Image.cat(terminos);
  }

  function dibujar() {
    limpiarMapas();
    var area = areaActual();
    var img = imagen().clip(area);
    var f = fracciones(true, true).clip(area);
    var opcion = sel.getValue();
    var ns = nombres();

    if (opcion === OPCIONES5[0]) {
      leyenda.setValue('Oscuro = el modelo ajusta bien.\n' +
        'Claro = residuo alto: falta un componente en la biblioteca.');
      var dif = img.select(BANDAS).subtract(reconstruir(f));
      var rmse = dif.pow(2).reduce(ee.Reducer.mean()).sqrt();
      mapaIzq.addLayer(img, VIS_RGB, 'Sentinel-2');
      mapaDer.addLayer(rmse, {min: 0, max: 0.08,
        palette: ['000000','440154','21918c','fde725','ffffff']}, 'RMSE');

    } else if (opcion === OPCIONES5[1]) {
      leyenda.setValue('Izquierda: fracción continua de ' + ns[0] + '.\n' +
        'Derecha: la escena forzada a una clase por píxel.\n' +
        ns.join(' · '));
      mapaIzq.addLayer(f.select('c0'), {min: 0, max: 1,
        palette: ['ffffff', hex(ns[0])]}, 'Fracción de ' + ns[0]);
      var dura = f.toArray().arrayArgmax().arrayGet([0]);
      mapaDer.addLayer(dura, {min: 0, max: ns.length - 1,
        palette: ns.map(function(n) { return hex(n); })},
        'Clasificación dura');

    } else {
      leyenda.setValue('Izquierda: fracción de ' + ns[0] + ' a 10 m.\n' +
        'Derecha: la misma fracción promediada a 500 m, la escala de un\n' +
        'píxel MODIS. Cada píxel de la derecha es una mezcla forzada.');
      var f10 = f.select('c0');
      var f500 = f10
        .reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 4096})
        .reproject({crs: 'EPSG:3857', scale: 500});
      var visF = {min: 0, max: 1, palette: ['ffffff', hex(ns[0])]};
      mapaIzq.addLayer(f10, visF, 'Fracción a 10 m');
      mapaDer.addLayer(f500, visF, 'Fracción a 500 m');
    }
    encuadrar(area);
  }
  dibujar();
}

// ====================================================================
// 5. RUTEO E INICIO
// ====================================================================
var moduloActivo = '1';

function abrirModulo(n) {
  moduloActivo = n;
  peticion++;
  mapaSolo.unlisten();
  mapaIzq.unlisten();
  refrescarEstado();
  try {
    if (n === '1') { modulo1(); }
    else if (n === '2') { modulo2(); }
    else if (n === '3') { modulo3(); }
    else if (n === '4') { modulo4(); }
    else { modulo5(); }
  } catch (e) {
    panelModulo.widgets().reset([
      ui.Label('Error al abrir el módulo:\n' + e,
        {color: '#a00', fontSize: '11px', margin: '8px 4px',
         whiteSpace: 'pre-wrap'})
    ]);
  }
}

function recargar() { abrirModulo(moduloActivo); }

ui.root.widgets().reset([controles, mapaSolo]);
usandoCortina = false;
abrirModulo('1');
