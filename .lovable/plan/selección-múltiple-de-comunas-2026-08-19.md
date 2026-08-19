# Selección múltiple de comunas

Hoy, con "Agrupar por: Comuna", el panel izquierdo obliga a elegir una región y luego una sola comuna desde un desplegable. Lo reemplazamos por un buscador multi-selección que permite acumular comunas de cualquier región del país.

## Cómo funcionará

- Al elegir "Comuna" aparece un buscador: escribes parte del nombre (sin distinguir tildes ni mayúsculas) y se listan las comunas coincidentes con su región.
- Al marcar una comuna se agrega al conjunto activo; se muestran como chips con una "x" para quitarlas, más un enlace "Limpiar todo".
- El selector de región deja de ser obligatorio y pasa a ser un filtro opcional ("Todas las regiones") para acotar la lista del buscador.
- Se pueden combinar comunas de distintas regiones en una misma muestra.
- El filtro "Población mínima de comuna" sigue aplicando: las comunas que no cumplen el umbral no aparecen en la lista; las ya seleccionadas que dejen de cumplirlo se descartan automáticamente.
- Sin comunas seleccionadas, se muestra un mensaje indicando que se debe elegir al menos una.
- La tabla de distribución GSE y todos los cálculos siguen igual, ahora agregando el conjunto de comunas elegidas.

## Detalles técnicos

- `src/pages/Index.tsx`:
  - `comunaRegion` pasa a ser filtro opcional (`number | null`, "Todas") y ya no resetea `selectedComunas`.
  - `availableComunasForMode` deja de exigir `comunaRegion !== null`; aplica filtro de región solo si está definido, filtro de `allowedComunas` y nuevo filtro por texto de búsqueda (normalizando acentos).
  - Nuevo estado `comunaSearch` y UI: input de búsqueda + lista scrolleable de checkboxes (máx. ~240px de alto) + chips de seleccionadas.
  - `effectiveRegions` en modo comuna se deriva de las regiones de las comunas seleccionadas (vía `gseComunas`), en vez del único `comunaRegion`.
  - `effectiveComunas` se mantiene como `selectedComunas`.
  - Efecto que depura `selectedComunas` cuando cambia `allowedComunas`.
- No se modifica `src/lib/sample-calculator.ts` ni la lógica de cálculo: ya soporta múltiples comunas vía `selectedComunas` y resuelve nombres con `gseComunas`.
