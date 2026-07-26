# Sofa Club — láminas de la interfaz

Tablero kanban de series y películas para verlas en compañía. Oscuro, redondeado
y kawaii adulto; todo en español de España, microcopy en minúsculas.

## Qué es esto, exactamente

**Cinco láminas estáticas, no una biblioteca de componentes.** Cada una es HTML
plano con los estilos **reales** de la aplicación: se generan leyendo el bloque
`<style>` de su `index.html`, y el maquetado está extraído de la app en marcha,
no escrito a mano. Lo que se ve aquí es lo que se ve en el móvil.

| lámina | qué enseña |
|---|---|
| `fundamentos.html` | las cuatro paletas conmutables, con sus variables |
| `tarjetas.html` | la tarjeta en sus cuatro estados |
| `vacias.html` | las cinco columnas vacías, cada una con su bicho y su frase |
| `hoja.html` | la hoja, su tirador y su salida |
| `cabecera.html` | cabecera, barra inferior y botón de añadir |

## Lo que aquí NO hay

**No hay componentes que renderizar.** No existe `_ds_bundle.js`, ni tipos, ni
props: la aplicación es un solo archivo que genera su HTML concatenando cadenas,
así que no hay piezas que importar ni con las que componer pantallas nuevas.
Estas láminas sirven para **mirar, comparar y decidir cambios de estilo** — no
para construir con ellas.

Si algún día hicieran falta componentes de verdad, habría que escribirlos: no es
una conversión, es una implementación nueva, y tendría que convivir con el
archivo original.

## Las reglas del sistema

- **Cuatro paletas** conmutables con `data-theme`; por defecto **neón de
  medianoche**. Los colores viven en variables (`--bg`, `--surface`, `--text`,
  y una por columna: `--wish`, `--watching`, `--done`, `--dropped`).
- **Tipografía** Nunito en 400/600/800. Nada más.
- **Radios** 20 / 28 / 999. Las tarjetas 20, las hojas 28, todo lo redondo 999.
- **Curva de muelle** `cubic-bezier(.34,1.56,.64,1)` para lo que entra y se
  asienta; las salidas van con `ease-in` y más rápidas.
- **Objetivos táctiles de 44 px** como mínimo, aunque la caja visible sea menor:
  se amplían con `::after`.
- `prefers-reduced-motion` apaga todas las animaciones.

## Cómo volver

Lo que salga de aquí es CSS y se pega a mano en el `<style>` de `index.html`.
Después hay que ejecutar `node build-csp.js`: la política de seguridad declara el
SHA-256 del script y, si no se recalcula, la página no arranca.
