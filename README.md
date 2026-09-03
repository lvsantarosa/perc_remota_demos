# Aplicaciones Didácticas de Percepción Remota 🛰️

![Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-JavaScript-green)
![License](https://img.shields.io/badge/License-MIT-blue)

Colección de aplicaciones interactivas desarrolladas en Google Earth Engine (GEE) diseñadas para la enseñanza de la percepción remota. Estos scripts permiten a los estudiantes explorar de forma empírica desde conceptos fundamentales hasta el modelado avanzado de resolución sub-píxel.

**Autor:** Lucas Vituri Santarosa  
**Institución:** Escuela de Agronomía, Pontificia Universidad Católica de Valparaíso (PUCV)  
**Laboratorio:** Laboratorio de Recursos Hídricos y Geotecnologías  

---

## 1. Introducción a la Percepción Remota (Nivel Fundamental)
**Archivo:** `intro_perc_remo_app.js`


### 🎯 Objetivo Educativo
El objetivo principal es materializar conceptos teóricos de la teledetección mediante la interacción directa con datos de **Landsat 8/9, Sentinel-2 y MODIS** en la región de Quillota, Chile. 

### 🧩 Módulos de la Aplicación
1. **Módulo 1: Firma Espectral** 
   * Extrae y compara las firmas espectrales de diferentes coberturas (agua, suelo, vegetación) interactuando con píxeles en el mapa.
2. **Módulo 2: Resolución Espacial**
   * Utiliza una cortina de comparación (*split-panel*) para visualizar el mismo territorio bajo las resoluciones de MODIS (500m), Landsat (30m) y Sentinel-2 (10m).
3. **Módulo 3: Resolución Radiométrica**
   * Simula el proceso de cuantización reduciendo los niveles digitales de la banda infrarroja (NIR) y visualizando el efecto en la imagen y su histograma.
4. **Módulo 4: Resolución Temporal**
   * Genera series de tiempo anuales (NDVI 2025) para un píxel seleccionado, ilustrando el impacto de la nubosidad y el tiempo de revisita de los satélites.
5. **Módulo 5: Composiciones y Corrección Atmosférica**
   * Contrasta imágenes en Nivel TOA (Top of Atmosphere) y Nivel SR (Surface Reflectance), demostrando el efecto de la dispersión atmosférica, especialmente en la banda azul.

---

## 2. Análisis de Mezcla Espectral / SMA (Nivel Posgrado)
**Archivo:** `spectral_mixing.js`

### 🎯 Objetivo Educativo
Abordar el problema de los píxeles mixtos y la resolución sub-píxel partiendo de una premisa física realista: un *endmember* no es un espectro único perfecto, sino una **nube de espectros con variabilidad intrínseca**.

### 🧩 Módulos de la Aplicación
1. **Módulo 1: Biblioteca de Endmembers** 
   * Construcción interactiva de la referencia. Permite recolectar múltiples muestras por componente para capturar la variabilidad (envolvente) de la vegetación, suelo, agua y sombra.
2. **Módulo 2: Mezcla Directa**
   * Modelado *forward* manual donde el analista ajusta las fracciones de área para intentar replicar la firma espectral de un píxel mixto medido en la escena, minimizando el RMSE.
3. **Módulo 3: Espacio de Atributos**
   * Visualización bidimensional (Rojo vs NIR) de la nube de píxeles de la escena frente al *simplex* difuso formado por las nubes de *endmembers*.
4. **Módulo 4: Inversión y Mapas de Fracción**
   * Aplicación del algoritmo *Linear Spectral Unmixing* sobre la imagen completa, evaluando el impacto matemático y físico de las restricciones (suma unitaria y no negatividad).
5. **Módulo 5: Residuo, Clasificación y Escala**
   * Evaluación crítica del modelo mediante el mapa de residuo (RMSE), la comparación contra clasificadores duros (forzando una clase por píxel) y la demostración del efecto de la escala (remuestreo a 500m).

---

## 🚀 Cómo usar

1. Necesitas una cuenta activa en [Google Earth Engine](https://earthengine.google.com/).
2. Navega a la carpeta `src/` del repositorio y copia el contenido del archivo `.js` que deseas analizar.
3. Pégalo en el [Code Editor de GEE](https://code.earthengine.google.com/).
4. Haz clic en **Run**.
5. Explora los módulos utilizando el panel de control lateral izquierdo.

---

## 📚 Referencias Recomendadas

Para un estudio más profundo, se recomienda consultar:
* Adams, J. B., Smith, M. O., & Johnson, P. E. (1986). Spectral mixture modeling: A new analysis of rock and soil types at the Viking Lander 1 site. *Journal of Geophysical Research: Solid Earth*, 91(B8), 8098-8112.
* Jensen, J. R. (2015). *Introductory Digital Image Processing: A Remote Sensing Perspective*. Pearson.
* Gorelick, N., et al. (2017). Google Earth Engine: Planetary-scale geospatial analysis for everyone. *Remote Sensing of Environment*, 202, 18-27.
