
## Dashboard de Cálculo de Muestras para Encuestas — Chile 2024

### Resumen
Dashboard SaaS limpio y moderno para calcular muestras de encuestas basadas en el Censo de Chile 2024, con paleta Cloud (blancos, grises, azul), tipografía clara, y exportación a Excel/CSV.

### Datos del Censo
- Incorporar datos demográficos del Censo 2024 de Chile directamente en el código (JSON estático):
  - **16 regiones** con población por sexo y tramos de edad
  - Fuente: proyecciones INE 2024

### Funcionalidades

#### 1. Panel de Configuración (sidebar izquierdo o sección superior)
- **Universo objetivo**: Selector de edad mínima y máxima (ej: 18+, 15-65, etc.)
- **Sexo**: Filtro para incluir ambos, solo hombres o solo mujeres
- **Regiones**: Multi-select de regiones o agrupar en zonas (Norte, Centro, Sur, RM)
- **Rangos de edad personalizados**: El usuario define los tramos (ej: 18-29, 30-44, 45-59, 60+)
- **Tamaño de muestra**: Input numérico para definir el n total deseado

#### 2. Panel de Resultados
- **Resumen**: Universo total filtrado, tamaño de muestra, nivel de confianza implícito
- **Tabla de cuotas**: Cruce de variables (sexo × edad × región/zona) con:
  - Población censal
  - Proporción (%)
  - Muestra asignada (proporcional)
- **Gráficos simples**: Barras horizontales mostrando distribución por sexo, edad y región

#### 3. Exportación
- Botón para descargar la tabla de cuotas como CSV o Excel (.xlsx)

### Diseño
- Estilo SaaS moderno con fondo claro (#fafbfc), cards con bordes suaves
- Azul (#3b82f6) como color de acento para botones y highlights
- Grises (#94a3b8, #e8ecf1) para textos secundarios y bordes
- Tipografía limpia, labels descriptivos, tooltips de ayuda para usuarios no técnicos
- Layout responsive: configuración arriba, resultados abajo en móvil
