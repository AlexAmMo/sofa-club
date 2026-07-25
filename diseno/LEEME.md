# Biblioteca de diseño

Vistas previas de los componentes de Sofa Club, para iterar el aspecto en
**Claude Design** sin arrastrar la app entera.

## Para qué

`index.html` es un solo archivo de 170 KB con los estilos, la lógica y las
llamadas al Worker dentro. Eso no es una biblioteca de componentes, y Claude
Design trabaja con una vista previa por pieza. Aquí se fabrican esas vistas.

## Cómo

```bash
node diseno/generar.js     # regenera las cinco vistas previas
```

Son: paletas · tarjetas en sus cuatro estados · columnas vacías (las cuatro
propias y la de «no hay nada con esos filtros») · hoja · cabecera y navegación.

**El CSS se lee de `index.html` en cada pasada**, así que las vistas previas no
pueden quedarse viejas: tocas los estilos de la app y se regeneran iguales. El
maquetado vive en `fragmentos.json` y se sacó de la app en marcha; sólo hay que
volver a extraerlo si cambia la *estructura* de un componente, no su aspecto.

Luego, desde una sesión de Claude Code:

```
/design-sync
```

Ese comando lo tienes que escribir tú: no se puede invocar desde el modelo.

## La vuelta es a mano, y es a propósito

Lo que salga de Claude Design es CSS. Se pega en el bloque `<style>` de
`index.html` y **se ejecuta `node build-csp.js`**. No hay reintegración
automática, y tampoco interesa: el prototipo original venía de Claude Design con
React y Babel descargados de unpkg, y hubo que portarlo entero a un archivo
autocontenido para que arrancara en menos de un segundo. Estas vistas previas
son HTML plano justamente para no volver por ahí.
