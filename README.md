# Reporte de Horas

App web para visualizar y gestionar el registro de horas de trabajo, generada a partir del Excel `Horas.xlsx`.

🌐 **GitHub Pages:** _(URL tras configurar el repo en GitHub)_

## Estructura

```
reporte/
├── index.html              # App web principal
├── css/
│   ├── variables.css       # Design tokens (dark/light mode)
│   ├── layout.css          # Header, footer, secciones
│   ├── components.css      # Botones, tabs, cards, tablas, gráficos
│   └── responsive.css      # Responsive breakpoints
├── js/
│   ├── horas-data.js       # ⚠️ AUTO-GENERADO (no editar)
│   ├── horas.js            # Lógica de la app
│   └── gist.js             # Sincronización con GitHub Gist
├── scripts/
│   └── extract_horas.py    # Script para regenerar horas-data.js
├── Horas.xlsx              # Fuente de datos
└── .github/workflows/
    └── pages.yml           # Auto-deploy a GitHub Pages
```

## Uso

### Ver la app localmente
Abre `index.html` en el navegador (doble clic o servidor local):
```bash
python3 -m http.server 8080
# Luego visita http://localhost:8080
```

### Actualizar datos del Excel
Cada vez que modifiques `Horas.xlsx`, regenera los datos:
```bash
python3 scripts/extract_horas.py
```
Luego haz commit y push → GitHub Pages se actualiza automáticamente.

### Sincronización con GitHub Gist
Las entradas nuevas que añades en la app se sincronizan con un Gist privado de GitHub:
1. Genera un token en [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=gist) con el scope `gist`
2. Haz clic en **Gist Sync** en la cabecera de la app
3. Pega tu token y guarda

### Publicar en GitHub Pages
1. Crea un repositorio en GitHub
2. `git remote add origin https://github.com/TU_USUARIO/reporte.git`
3. `git push -u origin main`
4. En GitHub → Settings → Pages → Source: **GitHub Actions**

## Vistas disponibles
- **Resumen** — KPIs del mes + tabla de tareas + gráfico de barras por tarea
- **Diario** — Timeline de cada día con entradas y horarios
- **Semanal** — Agrupación por semana con totales
- **Por tareas** — Ranking de horas por tarea con desglose por día
- **Añadir** — Formulario para insertar nuevas entradas (sincronizadas con Gist)
