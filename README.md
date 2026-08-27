# Introducción a la Percepción Remota - Aplicación Didáctica 🛰️

![Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-JavaScript-green)
![License](https://img.shields.io/badge/License-MIT-blue)

Aplicación interactiva desarrollada en Google Earth Engine (GEE) diseñada para la enseñanza de los fundamentos de sensoramiento remoto. Este script permite a los estudiantes explorar de forma empírica los conceptos de resolución espacial, espectral, radiométrica y temporal, así como el impacto de la corrección atmosférica.

**Autor:** Lucas Vituri Santarosa  
**Institución:** Escuela de Agronomía, Pontificia Universidad Católica de Valparaíso (PUCV)  
**Laboratorio:** Laboratorio de Recursos Hídricos y Geotecnologías  

## 🎯 Objetivo Educativo

El objetivo principal es materializar conceptos teóricos de la teledetección mediante la interacción directa con datos de **Landsat 8/9, Sentinel-2 y MODIS** en la región de Quillota, Chile. 

## 🧩 Módulos de la Aplicación

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

## 🚀 Cómo usar

1. Necesitas una cuenta activa en [Google Earth Engine](https://earthengine.google.com/).
2. Copia el contenido del archivo `src/gee_app.js`.
3. Pégalo en el [Code Editor de GEE](https://code.earthengine.google.com/).
4. Haz clic en **Run**.
5. Explora los módulos utilizando el panel de control lateral izquierdo.

## 📚 Referencias Recomendadas

Para un estudio más profundo, se recomienda consultar:
* Jensen, J. R. (2015). *Introductory Digital Image Processing: A Remote Sensing Perspective*. Pearson.
* Gorelick, N., et al. (2017). Google Earth Engine: Planetary-scale geospatial analysis for everyone. *Remote Sensing of Environment*, 202, 18-27.
