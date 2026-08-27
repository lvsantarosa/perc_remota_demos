/**********************************************************************
 * INTRODUCCIÓN PERCEPCIÓN REMOTA
 * Aplicación didáctica — Región del Valparaiso, Chile
 * ------------------------------------------------------------------
 * Módulo 1 : Firma espectral        (clic en el mapa -> gráfico)
 * Módulo 2 : Resolución espacial    (cortina MODIS / Landsat / Sentinel-2)
 * Módulo 3 : Resolución radiométrica(cortina original / cuantizado)
 * Módulo 4 : Resolución temporal    (clic en el mapa -> serie anual)
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
  centro: [-71.247, -32.880],   // Quillota
  radio:  4000,                 // metros
  mesIni: 1,
  duracion: 3                   // meses
};

var LUGARES = {
  'Quillota — paltos y cítricos': [-71.247, -32.880],
  'Embalse Los Aromos — agua':    [-71.365, -32.975],
  'Dunas de Concón — suelo':      [-71.520, -32.925],
  'Matorral seco — sector este':  [-71.100, -32.850],
  'Océano Pacífico':              [-71.620, -32.900]
};

var S2_BANDAS = ['B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12'];
var S2_NM     = [492, 560, 665, 704, 740, 783, 833, 865, 1614, 2202];

var L8_BANDAS = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'];
var L8_NM     = [482, 561, 654, 865, 1609, 2201];

// Contador de peticiones: evita que una respuesta atrasada escriba
// resultados en un módulo que el usuario ya cambió
var peticion = 0;

// ====================================================================
// 2. DATOS — enmascaramiento POR PÍXEL
//    El filtro por escena completa (CLOUD_COVER) descartaba casi todo
//    Landsat en Quillota, porque la escena incluye la costa con neblina.
// ====================================================================
function areaActual() {
  return ee.Geometry.Point(estado.centro).buffer(estado.radio).bounds();
}

function periodoActual() {
  var ini = ee.Date.fromYMD(2025, estado.mesIni, 1);
  return {ini: ini, fin: ini.advance(estado.duracion, 'month')};
}

// --- Sentinel-2: máscara con la banda SCL ---
function enmascararS2(img) {
  var scl = img.select('SCL');
  var buena = scl.neq(3)      // sombra de nube
    .and(scl.neq(8))          // nube probable
    .and(scl.neq(9))          // nube alta probabilidad
    .and(scl.neq(10));        // cirros
  return img.select(S2_BANDAS).divide(10000).updateMask(buena)
            .copyProperties(img, ['system:time_start']);
}

function coleccionS2(area, ini, fin) {
  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(area).filterDate(ini, fin)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80))
    .map(enmascararS2);
}

// --- Landsat 8/9: máscara con los bits de QA_PIXEL ---
function enmascararLandsat(img) {
  var qa = img.select('QA_PIXEL');
  var buena = qa.bitwiseAnd(1 << 1).eq(0)   // nube dilatada
    .and(qa.bitwiseAnd(1 << 3).eq(0))       // nube
    .and(qa.bitwiseAnd(1 << 4).eq(0));      // sombra de nube
  return img.select(L8_BANDAS).multiply(0.0000275).add(-0.2)
            .updateMask(buena)
            .copyProperties(img, ['system:time_start']);
}

function coleccionLandsat(area, ini, fin) {
  return ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
    .filterBounds(area).filterDate(ini, fin)
    .filter(ee.Filter.lt('CLOUD_COVER', 80))
    .map(enmascararLandsat);
}

function componerS2() {
  var p = periodoActual();
  return coleccionS2(areaActual(), p.ini, p.fin).median();
}

function componerLandsat() {
  var p = periodoActual();
  return coleccionLandsat(areaActual(), p.ini, p.fin).median();
}

function componerModis() {
  var p = periodoActual();
  return ee.ImageCollection('MODIS/061/MOD09GA')
    .filterBounds(areaActual()).filterDate(p.ini, p.fin)
    .median()
    .select(['sur_refl_b01','sur_refl_b04','sur_refl_b03'])
    .multiply(0.0001);
}

// --- Sentinel-2 NIVEL TOA: reflectancia en el tope de la atmósfera.
//     Es el mismo sensor y la misma fecha que el Nivel SR, pero SIN
//     corrección atmosférica. La diferencia entre ambos ES el efecto
//     de la atmósfera. Máscara con QA60 (no existe SCL en el TOA).
function enmascararS2toa(img) {
  var qa = img.select('QA60');
  var buena = qa.bitwiseAnd(1 << 10).eq(0)    // nube opaca
         .and(qa.bitwiseAnd(1 << 11).eq(0));  // cirros
  return img.select(S2_BANDAS).divide(10000).updateMask(buena)
            .copyProperties(img, ['system:time_start']);
}

function componerS2TOA() {
  var p = periodoActual();
  return ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
    .filterBounds(areaActual()).filterDate(p.ini, p.fin)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80))
    .map(enmascararS2toa)
    .median();
}

// ====================================================================
// 3. ENCABEZADO Y CONTROLES
// ====================================================================
var ESTILO_TITULO   = {fontWeight: 'bold', fontSize: '18px', margin: '10px 4px 0'};
var ESTILO_SUB      = {fontSize: '11px', color: '#666', margin: '0 4px 8px'};
var ESTILO_ETIQUETA = {fontWeight: 'bold', fontSize: '12px', margin: '10px 4px 2px'};
var ESTILO_TEXTO    = {fontSize: '12px', color: '#333', margin: '2px 4px',
                       whiteSpace: 'pre-wrap'};

var titulo = ui.Label('Introducción al Sensoramiento Remoto', ESTILO_TITULO);

var tituloModulo  = ui.Label('', {fontWeight: 'bold', fontSize: '14px',
                                  margin: '10px 4px 4px', color: '#1a5490'});
var objetivo      = ui.Label('', ESTILO_TEXTO);
var instrucciones = ui.Label('', ESTILO_TEXTO);
var preguntas     = ui.Label('', {fontSize: '12px', color: '#555',
                                  margin: '8px 4px', whiteSpace: 'pre-wrap',
                                  backgroundColor: '#f2f6fa', padding: '6px'});

function describirModulo(nombre, obj, pasos, preg) {
  tituloModulo.setValue(nombre);
  objetivo.setValue('OBJETIVO\n' + obj);
  instrucciones.setValue('\nINSTRUCCIONES\n' + pasos);
  preguntas.setValue('PARA DISCUTIR EN CLASE\n' + preg);
}

var selectorModulo = ui.Select({
  items: ['1 — Firma espectral', '2 — Resolución espacial',
          '3 — Resolución radiométrica', '4 — Resolución temporal',
          '5 — Composiciones y corrección atmosférica'],
  value: '1 — Firma espectral',
  style: {stretch: 'horizontal'},
  onChange: function(v) { abrirModulo(v.charAt(0)); }
});

var selectorLugar = ui.Select({
  items: Object.keys(LUGARES),
  value: 'Quillota — paltos y cítricos',
  style: {stretch: 'horizontal'},
  onChange: function(nombre) { estado.centro = LUGARES[nombre]; recargar(); }
});

var sliderRadio = ui.Slider({
  min: 1, max: 15, value: 4, step: 1,
  style: {stretch: 'horizontal'},
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

var botonCentro = ui.Button({
  label: 'Usar el centro del mapa como área',
  style: {stretch: 'horizontal'},
  onClick: function() {
    // getInfo() es SÍNCRONO y puede bloquear una App publicada: usar evaluate
    mapaVista().getCenter().coordinates().evaluate(function(c) {
      if (!c) { return; }
      estado.centro = c;
      recargar();
    });
  }
});

var panelModulo = ui.Panel();

var pie = ui.Label(
  '─────────────────────────────\n' +
  'Lucas Vituri Santarosa\n' +
  'Escuela de Agronomía, PUCV\n' +
  'Laboratorio de Recursos Hídricos y Geotecnologías',
  {fontSize: '11px', color: '#777', margin: '16px 4px 10px',
   whiteSpace: 'pre-wrap'}
);

var controles = ui.Panel({
  style: {width: '350px', padding: '6px'},
  widgets: [
    titulo,
    ui.Label('Módulo', ESTILO_ETIQUETA), selectorModulo,
    tituloModulo, objetivo, instrucciones,
    ui.Label('Área de estudio', ESTILO_ETIQUETA), selectorLugar, botonCentro,
    ui.Label('Radio del área (km)', {fontSize: '12px', margin: '8px 4px 0'}),
    sliderRadio,
    ui.Label('Período dentro de 2025', ESTILO_ETIQUETA),
    selectorMes, selectorDuracion,
    panelModulo, preguntas, pie
  ]
});

// ====================================================================
// 4. MAPAS Y ESCENARIO
//    'controles' nunca se desconecta de ui.root: reconectarlo rompía
//    el render asíncrono de los gráficos.
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

function mapaVista() { return usandoCortina ? mapaIzq : mapaSolo; }

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

function marcarPunto(pt) {
  mapaSolo.layers().set(1, ui.Map.Layer(pt, {color: 'yellow'}, 'punto'));
}

function marcarPuntoEn(mapa, indice, pt) {
  mapa.layers().set(indice, ui.Map.Layer(pt, {color: 'yellow'}, 'punto'));
}

// ====================================================================
// MÓDULO 1 — FIRMA ESPECTRAL
// ====================================================================
var VIS_S2 = {bands: ['B4','B3','B2'], min: 0, max: 0.3};

function modulo1() {
  mostrarEscenario(false);
  limpiarMapas();

  describirModulo(
    'Módulo 1 — Firma espectral',
    'Comprobar que cada cubierta de la superficie refleja la energía solar\n' +
    'de manera distinta según la longitud de onda, y que un sensor mide\n' +
    'esa respuesta solo en algunas ventanas del espectro.',
    '1. Elegir un área en la lista o navegar y presionar "Usar el centro".\n' +
    '2. Ajustar el radio y el período si la imagen tiene nubes.\n' +
    '3. Hacer clic sobre un píxel de agua en el mapa: aparece el gráfico.\n' +
    '4. Repetir sobre suelo desnudo y sobre un cultivo verde.\n' +
    '5. Comparar las tres curvas obtenidas.',
    '• ¿Dónde sube bruscamente la curva de la vegetación? ¿Por qué allí?\n' +
    '• ¿Por qué el agua cae casi a cero en el infrarrojo?\n' +
    '• Sentinel-2 entrega 10 puntos y Landsat 6: ¿qué detalle se pierde?'
  );

  panelModulo.widgets().reset([
    ui.Label('Haga clic en un punto del mapa.', ESTILO_TEXTO)
  ]);

  var area = areaActual();
  mapaSolo.addLayer(componerS2().clip(area), VIS_S2, 'Sentinel-2 (color verdadero)');
  encuadrar(area);

  mapaSolo.onClick(function(coords) {
    var miPeticion = ++peticion;
    panelModulo.widgets().reset([ui.Label('Extrayendo valores…', ESTILO_TEXTO)]);
    var pt = ee.Geometry.Point([coords.lon, coords.lat]);
    marcarPunto(pt);

    var valS2 = componerS2().reduceRegion(
      {reducer: ee.Reducer.first(), geometry: pt, scale: 10});
    var valL8 = componerLandsat().reduceRegion(
      {reducer: ee.Reducer.first(), geometry: pt, scale: 30});

    ee.Dictionary({s2: valS2, l8: valL8}).evaluate(function(res, error) {
      if (miPeticion !== peticion) { return; }   // respuesta obsoleta
      if (error || !res) {
        avisar('No fue posible leer este punto.\nPruebe otro lugar o período.');
        return;
      }
      var filas = [], nS2 = 0, nL8 = 0;

      S2_BANDAS.forEach(function(b, i) {
        var v = res.s2[b];
        if (v !== null && v !== undefined) { nS2++; }
        filas.push([S2_NM[i], v, null]);
      });
      L8_BANDAS.forEach(function(b, i) {
        var v = res.l8[b];
        if (v !== null && v !== undefined) { nL8++; }
        filas.push([L8_NM[i], null, v]);
      });

      if (nS2 === 0 && nL8 === 0) {
        avisar('Sin observaciones libres de nube en este punto y período.\n' +
               'Pruebe otro mes o aumente la duración a 3 meses.');
        return;
      }

      filas.sort(function(a, b) { return a[0] - b[0]; });
      var tabla = [['Longitud de onda (nm)', 'Sentinel-2', 'Landsat 8/9']]
                    .concat(filas);

      var grafico = ui.Chart(tabla, 'LineChart', {
        title: 'Reflectancia en el punto seleccionado',
        hAxis: {title: 'Longitud de onda (nm)', viewWindow: {min: 400, max: 2400}},
        vAxis: {title: 'Reflectancia', viewWindow: {min: 0, max: 0.6}},
        interpolateNulls: true, pointSize: 6, lineWidth: 2,
        series: {0: {color: '#1f77b4'}, 1: {color: '#d62728'}},
        legend: {position: 'top'}, height: 300
      });

      var nota = ui.Label(
        'Bandas válidas — Sentinel-2: ' + nS2 + '/10   ·   Landsat: ' + nL8 + '/6' +
        (nL8 === 0 ? '\nSin cobertura Landsat aquí: amplíe el período.' : ''),
        {fontSize: '11px', color: '#666', margin: '2px 4px', whiteSpace: 'pre-wrap'}
      );
      panelModulo.widgets().reset([grafico, nota]);
    });
  });
}

// ====================================================================
// MÓDULO 2 — RESOLUCIÓN ESPACIAL
// ====================================================================
var SENSORES = ['MODIS (500 m)', 'Landsat 8/9 (30 m)', 'Sentinel-2 (10 m)'];

function imagenRGB(sensor) {
  if (sensor === 'MODIS (500 m)') {
    return {img: componerModis(), vis: {min: 0, max: 0.3}, escala: 500};
  }
  if (sensor === 'Landsat 8/9 (30 m)') {
    return {img: componerLandsat().select(['SR_B4','SR_B3','SR_B2']),
            vis: {min: 0, max: 0.3}, escala: 30};
  }
  return {img: componerS2().select(['B4','B3','B2']),
          vis: {min: 0, max: 0.3}, escala: 10};
}

function modulo2() {
  mostrarEscenario(true);
  limpiarMapas();

  describirModulo(
    'Módulo 2 — Resolución espacial',
    'Verificar cómo el tamaño del píxel determina qué objetos del terreno\n' +
    'pueden distinguirse y cuáles se mezclan dentro de un mismo píxel.',
    '1. Elegir el sensor de cada lado de la cortina.\n' +
    '2. Arrastrar la línea vertical central sobre un mismo cuartel de paltos.\n' +
    '3. Acercar el zoom hasta ver los píxeles individuales.\n' +
    '4. Probar las tres combinaciones posibles de sensores.',
    '• ¿En qué sensor todavía se distinguen los caminos y canales?\n' +
    '• Un píxel MODIS cubre 25 hectáreas: ¿qué hay mezclado adentro?\n' +
    '• ¿Sirve MODIS para escala predial? ¿Y para toda la cuenca?'
  );

  var selIzq = ui.Select({items: SENSORES, value: 'MODIS (500 m)',
                          style: {stretch: 'horizontal'}, onChange: dibujar});
  var selDer = ui.Select({items: SENSORES, value: 'Sentinel-2 (10 m)',
                          style: {stretch: 'horizontal'}, onChange: dibujar});

  panelModulo.widgets().reset([
    ui.Label('Lado izquierdo', ESTILO_ETIQUETA), selIzq,
    ui.Label('Lado derecho', ESTILO_ETIQUETA), selDer
  ]);

  function dibujar() {
    limpiarMapas();
    var area = areaActual();
    var a = imagenRGB(selIzq.getValue());
    var b = imagenRGB(selDer.getValue());
    // reproject a la escala nativa: sin esto GEE remuestrea y la diferencia
    // simplemente no se ve al hacer zoom
    mapaIzq.addLayer(a.img.clip(area)
      .reproject(ee.Projection('EPSG:3857').atScale(a.escala)), a.vis, selIzq.getValue());
    mapaDer.addLayer(b.img.clip(area)
      .reproject(ee.Projection('EPSG:3857').atScale(b.escala)), b.vis, selDer.getValue());
    encuadrar(area);
  }
  dibujar();
}

// ====================================================================
// MÓDULO 3 — RESOLUCIÓN RADIOMÉTRICA
// ====================================================================
function modulo3() {
  mostrarEscenario(true);
  limpiarMapas();

  describirModulo(
    'Módulo 3 — Resolución radiométrica',
    'Entender que el sensor convierte una señal continua en un número\n' +
    'finito de niveles, y que con pocos niveles dos cubiertas distintas\n' +
    'terminan registradas con el mismo valor.',
    '1. Observar la banda del infrarrojo cercano en escala de grises.\n' +
    '2. El lado izquierdo mantiene todos los niveles; el derecho se cuantiza.\n' +
    '3. Reducir progresivamente los niveles con el selector.\n' +
    '4. Arrastrar la cortina y mirar el histograma que aparece abajo.',
    '• ¿A partir de cuántos niveles deja de distinguirse el cultivo del suelo?\n' +
    '• ¿Qué le ocurre al histograma cuando se reducen los niveles?\n' +
    '• ¿Por qué más bits significan también archivos más pesados?'
  );

  var selNiveles = ui.Select({
    items: ['2 niveles','4 niveles','8 niveles','16 niveles','64 niveles'],
    value: '4 niveles', style: {stretch: 'horizontal'}, onChange: dibujar
  });

  var panelHist = ui.Panel();
  panelModulo.widgets().reset([
    ui.Label('Niveles del lado derecho', ESTILO_ETIQUETA), selNiveles, panelHist
  ]);

  function dibujar() {
    var miPeticion = ++peticion;
    limpiarMapas();
    var area  = areaActual();
    var n     = parseInt(selNiveles.getValue(), 10);
    var base  = componerS2().select('B8').clip(area);
    var vis   = {min: 0, max: 0.5, palette: ['black','white']};
    var cuant = base.multiply(n).floor().divide(n);

    mapaIzq.addLayer(base,  vis, 'Original (muchos niveles)');
    mapaDer.addLayer(cuant, vis, selNiveles.getValue());
    encuadrar(area);

    // Histograma construido tras evaluate(), no de forma síncrona
    cuant.reduceRegion({
      reducer: ee.Reducer.histogram({maxBuckets: 64}),
      geometry: area, scale: 20, maxPixels: 1e9
    }).evaluate(function(res, error) {
      if (miPeticion !== peticion) { return; }
      if (error || !res || !res.B8) { return; }
      var h = res.B8;
      var filas = [['Reflectancia', 'Píxeles']];
      h.histogram.forEach(function(cuenta, i) {
        filas.push([h.bucketMin + i * h.bucketWidth, cuenta]);
      });
      panelHist.widgets().reset([
        ui.Chart(filas, 'ColumnChart', {
          title: 'Histograma — ' + selNiveles.getValue(),
          hAxis: {title: 'Reflectancia'}, vAxis: {title: 'Píxeles'},
          legend: {position: 'none'}, height: 220
        })
      ]);
    });
  }
  dibujar();
}

// ====================================================================
// MÓDULO 4 — RESOLUCIÓN TEMPORAL (serie del píxel seleccionado)
// ====================================================================
function ndvi(col, roja, nir) {
  return col.map(function(img) {
    return img.normalizedDifference([nir, roja]).rename('NDVI')
              .copyProperties(img, ['system:time_start']);
  });
}

// Extrae la serie de un punto sin usar ui.Chart.image.series
function serieEnPunto(col, pt, escala) {
  var conValor = col.map(function(img) {
    var v = img.reduceRegion(
      {reducer: ee.Reducer.first(), geometry: pt, scale: escala}).get('NDVI');
    return img.set('valor', v);
  }).filter(ee.Filter.notNull(['valor']));
  return ee.List([
    conValor.aggregate_array('system:time_start'),
    conValor.aggregate_array('valor')
  ]);
}

function diaDelAno(ms) {
  var d = new Date(ms);
  var inicio = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - inicio) / 86400000) + 1;
}

function modulo4() {
  mostrarEscenario(false);
  limpiarMapas();

  describirModulo(
    'Módulo 4 — Resolución temporal',
    'Distinguir la frecuencia nominal de paso del satélite de la cantidad\n' +
    'real de observaciones útiles en un píxel, una vez descartadas las\n' +
    'fechas cubiertas por nubes.',
    '1. Elegir el área; el gráfico usa todo el año 2025.\n' +
    '2. Hacer clic sobre un píxel: se extrae su serie de NDVI.\n' +
    '3. Contar los puntos de cada sensor y ubicar los meses sin dato.\n' +
    '4. Comparar un píxel de cultivo con uno de matorral o de agua.',
    '• Sentinel-2 pasa cada 5 días y Landsat cada 16: ¿se refleja aquí?\n' +
    '• ¿En qué estación aparecen los vacíos? ¿Por qué?\n' +
    '• Si necesito detectar un evento de una semana, ¿qué sensor uso?'
  );

  panelModulo.widgets().reset([
    ui.Label('Haga clic en un píxel para ver su serie de 2025.', ESTILO_TEXTO)
  ]);

  var area = areaActual();
  mapaSolo.addLayer(componerS2().clip(area), VIS_S2, 'Sentinel-2');
  encuadrar(area);

  mapaSolo.onClick(function(coords) {
    var miPeticion = ++peticion;
    panelModulo.widgets().reset([
      ui.Label('Recorriendo el año 2025…', ESTILO_TEXTO)
    ]);
    var pt = ee.Geometry.Point([coords.lon, coords.lat]);
    marcarPunto(pt);

    var ini = '2025-01-01', fin = '2026-01-01';
    var s2 = ndvi(coleccionS2(pt, ini, fin), 'B4', 'B8');
    var lc = ndvi(coleccionLandsat(pt, ini, fin), 'SR_B4', 'SR_B5');

    ee.List([serieEnPunto(s2, pt, 20), serieEnPunto(lc, pt, 30)])
      .evaluate(function(res, error) {
        if (miPeticion !== peticion) { return; }
        if (error || !res) {
          avisar('No fue posible extraer la serie.\nPruebe otro píxel.');
          return;
        }
        var fS2 = res[0][0], vS2 = res[0][1];
        var fL8 = res[1][0], vL8 = res[1][1];

        if (fS2.length === 0 && fL8.length === 0) {
          avisar('Este píxel no tuvo ninguna observación libre de nube\n' +
                 'durante 2025. Pruebe otro punto.');
          return;
        }

        var filas = [];
        fS2.forEach(function(t, i) { filas.push([diaDelAno(t), vS2[i], null]); });
        fL8.forEach(function(t, i) { filas.push([diaDelAno(t), null, vL8[i]]); });
        filas.sort(function(a, b) { return a[0] - b[0]; });

        var tabla = [['Día del año 2025', 'Sentinel-2', 'Landsat 8/9']]
                      .concat(filas);

        var grafico = ui.Chart(tabla, 'ScatterChart', {
          title: 'NDVI del píxel durante 2025',
          hAxis: {title: 'Día del año', viewWindow: {min: 0, max: 366},
                  ticks: [1, 60, 121, 182, 244, 305, 366]},
          vAxis: {title: 'NDVI', viewWindow: {min: -0.2, max: 1}},
          pointSize: 5,
          series: {0: {color: '#1f77b4'}, 1: {color: '#d62728'}},
          legend: {position: 'top'}, height: 300
        });

        var nota = ui.Label(
          'Observaciones útiles en 2025\n' +
          'Sentinel-2: ' + fS2.length + '   ·   Landsat 8/9: ' + fL8.length + '\n' +
          '(el paso nominal daría ~73 y ~45 respectivamente)',
          {fontSize: '11px', color: '#666', margin: '2px 4px',
           whiteSpace: 'pre-wrap'}
        );
        panelModulo.widgets().reset([grafico, nota]);
      });
  });
}

// ====================================================================
// MÓDULO 5 — COMPOSICIONES EN COLOR Y CORRECCIÓN ATMOSFÉRICA
// ====================================================================
var COMPARACIONES = [
  'Color verdadero vs Falso color (NIR)',
  'Falso color NIR vs Falso color SWIR',
  'Nivel TOA vs Nivel SR'
];

function modulo5() {
  mostrarEscenario(true);
  limpiarMapas();

  describirModulo(
    'Módulo 5 — Composiciones y corrección atmosférica',
    'Comprender que una imagen en color es una decisión de visualización:\n' +
    'asignamos bandas a los canales rojo, verde y azul de la pantalla.\n' +
    'Y distinguir un cambio real de la cubierta del efecto de la atmósfera,\n' +
    'comparando el mismo píxel en Nivel TOA y en Nivel SR.',
    '1. Elegir la comparación en el selector.\n' +
    '2. Arrastrar la cortina sobre un cuartel de paltos y sobre el río.\n' +
    '3. En "Nivel TOA vs Nivel SR", además hacer clic en el mapa\n' +
    '   izquierdo: se grafican las dos curvas del mismo píxel.\n' +
    '4. Observar en cuál banda la separación entre TOA y SR es mayor.',
    '• En falso color NIR, ¿por qué la vegetación sana aparece roja?\n' +
    '• ¿Qué distingue el SWIR que el NIR no logra separar?\n' +
    '• La diferencia TOA–SR es máxima en el azul: ¿por qué?\n' +
    '• ¿Qué nivel debo usar para comparar dos fechas distintas?'
  );

  var selComp = ui.Select({
    items: COMPARACIONES, value: COMPARACIONES[0],
    style: {stretch: 'horizontal'}, onChange: dibujar
  });

  var pista = ui.Label('', ESTILO_TEXTO);
  var panelGrafico = ui.Panel();

  panelModulo.widgets().reset([
    ui.Label('Comparación', ESTILO_ETIQUETA), selComp, pista, panelGrafico
  ]);

  function dibujar() {
    peticion++;
    limpiarMapas();
    mapaIzq.unlisten();
    panelGrafico.widgets().reset([]);

    var area = areaActual();
    var sr = componerS2();
    var opcion = selComp.getValue();
    var visVerdadero = {min: 0, max: 0.3};
    var visFalso     = {min: 0, max: 0.4};

    if (opcion === COMPARACIONES[0]) {
      pista.setValue(
        'Izquierda: B4-B3-B2 (lo que vería el ojo humano).\n' +
        'Derecha: B8-B4-B3 (el infrarrojo cercano ocupa el canal rojo).');
      mapaIzq.addLayer(sr.select(['B4','B3','B2']).clip(area),
                       visVerdadero, 'Color verdadero');
      mapaDer.addLayer(sr.select(['B8','B4','B3']).clip(area),
                       visFalso, 'Falso color NIR');

    } else if (opcion === COMPARACIONES[1]) {
      pista.setValue(
        'Izquierda: B8-B4-B3 (infrarrojo cercano, vigor).\n' +
        'Derecha: B12-B8-B4 (SWIR, sensible al agua del tejido y del suelo).');
      mapaIzq.addLayer(sr.select(['B8','B4','B3']).clip(area),
                       visFalso, 'Falso color NIR');
      mapaDer.addLayer(sr.select(['B12','B8','B4']).clip(area),
                       visFalso, 'Falso color SWIR');

    } else {
      pista.setValue(
        'Izquierda: Nivel TOA, sin corrección atmosférica.\n' +
        'Derecha: Nivel SR, misma escena ya corregida.\n' +
        'Haga clic en el mapa izquierdo para graficar el píxel.');
      mapaIzq.addLayer(componerS2TOA().select(['B4','B3','B2']).clip(area),
                       visVerdadero, 'Nivel TOA');
      mapaDer.addLayer(sr.select(['B4','B3','B2']).clip(area),
                       visVerdadero, 'Nivel SR');
      mapaIzq.onClick(compararNiveles);
    }
    encuadrar(area);
  }

  function compararNiveles(coords) {
    var miPeticion = ++peticion;
    panelGrafico.widgets().reset([
      ui.Label('Extrayendo los dos niveles…', ESTILO_TEXTO)
    ]);
    var pt = ee.Geometry.Point([coords.lon, coords.lat]);
    marcarPuntoEn(mapaIzq, 1, pt);

    var vToa = componerS2TOA().reduceRegion(
      {reducer: ee.Reducer.first(), geometry: pt, scale: 10});
    var vSr = componerS2().reduceRegion(
      {reducer: ee.Reducer.first(), geometry: pt, scale: 10});

    ee.Dictionary({toa: vToa, sr: vSr}).evaluate(function(res, error) {
      if (miPeticion !== peticion) { return; }
      if (error || !res) {
        panelGrafico.widgets().reset([
          ui.Label('No fue posible leer este punto.', {color: '#a00',
            fontSize: '12px', margin: '8px 4px'})
        ]);
        return;
      }

      var filas = [], hayDatos = false, difAzul = null;
      S2_BANDAS.forEach(function(b, i) {
        var t = res.toa[b], s = res.sr[b];
        if ((t !== null && t !== undefined) || (s !== null && s !== undefined)) {
          hayDatos = true;
        }
        if (b === 'B2' && t !== null && t !== undefined &&
            s !== null && s !== undefined) {
          difAzul = t - s;
        }
        filas.push([S2_NM[i], t, s]);
      });

      if (!hayDatos) {
        panelGrafico.widgets().reset([
          ui.Label('Sin observación libre de nube en este píxel.\n' +
                   'Pruebe otro punto o período.',
            {color: '#a00', fontSize: '12px', margin: '8px 4px',
             whiteSpace: 'pre-wrap'})
        ]);
        return;
      }

      var tabla = [['Longitud de onda (nm)', 'Nivel TOA', 'Nivel SR']]
                    .concat(filas);

      var grafico = ui.Chart(tabla, 'LineChart', {
        title: 'Mismo píxel: antes y después de la corrección',
        hAxis: {title: 'Longitud de onda (nm)',
                viewWindow: {min: 400, max: 2400}},
        vAxis: {title: 'Reflectancia', viewWindow: {min: 0, max: 0.6}},
        interpolateNulls: true, pointSize: 6, lineWidth: 2,
        series: {0: {color: '#f39c12'}, 1: {color: '#1f77b4'}},
        legend: {position: 'top'}, height: 300
      });

      var nota = ui.Label(
        difAzul === null ? '' :
        'Diferencia TOA − SR en el azul (492 nm): ' + difAzul.toFixed(3) + '\n' +
        'Esa brecha es dispersión atmosférica, no superficie.',
        {fontSize: '11px', color: '#666', margin: '2px 4px',
         whiteSpace: 'pre-wrap'});

      panelGrafico.widgets().reset([grafico, nota]);
    });
  }

  dibujar();
}

// ====================================================================
// 5. RUTEO E INICIO
// ====================================================================
var moduloActivo = '1';

function abrirModulo(n) {
  moduloActivo = n;
  peticion++;                // invalida respuestas pendientes
  mapaSolo.unlisten();
  mapaIzq.unlisten();
  // En una App publicada no hay consola: un error no capturado deja la
  // pantalla en blanco. Aquí el error se muestra dentro del panel.
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

// Inicio: se arma la raíz UNA sola vez, con el panel en el índice 0
// y el escenario en el índice 1. No usar ui.root.clear() por separado.
ui.root.widgets().reset([controles, mapaSolo]);
usandoCortina = false;
abrirModulo('1');
