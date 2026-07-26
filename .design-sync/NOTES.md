# Notas de sincronización con Claude Design

## Este repo NO tiene biblioteca de componentes, y es a propósito

`/design-sync` importa una biblioteca: coge el `dist/` compilado, produce un
`_ds_bundle.js` con los componentes reales y sus tipos, y a partir de ahí el
agente de diseño construye pantallas con ellos.

Sofa Club no encaja y no debería forzarse:

- no hay `package.json` en la raíz, ni `dist/`, ni Storybook, ni `*.stories.*`
  (el único `package.json` es el del Worker, que es servidor)
- la interfaz se genera concatenando cadenas de HTML dentro del mismo script que
  lleva el estado, el cliente del Worker y los gestos: no hay nada que exportar

Convertirlo exigiría **escribir una biblioteca React que no existe**, que es justo
lo que el skill prohíbe («enviar lo que el cliente ya construyó, nunca una
reimplementación») y justo lo que este proyecto deshizo: el prototipo original
venía de Claude Design con React y Babel desde unpkg y se portó entero a un
archivo autocontenido para que arrancara en menos de un segundo. Ver §5 del
HANDOFF.

## Lo que sí se sube

Las cinco vistas previas estáticas que fabrica `node diseno/generar.js`, con su
marcador `@dsCard`. Sirven para **mirar, comparar y pedir cambios de estilo** con
el aspecto real de la app.

Lo que **no** dan: el agente de diseño no puede construir pantallas nuevas con
estos componentes, porque no hay bundle que renderizar. Son láminas, no piezas.

## El viaje de vuelta es a mano

Lo que salga de Claude Design es CSS. Se pega en el bloque `<style>` de
`index.html` y **se ejecuta `node build-csp.js`**, o el hash de la CSP deja de
cuadrar y la página no arranca.
