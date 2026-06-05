# Reporte de Horas

App web para visualizar y gestionar el registro de horas de trabajo, con soporte offline y persistencia remota mediante GitHub Gists.

🌐 **GitHub Pages:** [https://jmompean97.github.io/reporte/](https://jmompean97.github.io/reporte/)

## Estructura

```
reporte/
├── index.html              # App web principal
├── favicon.svg             # Favicon
├── css/                    # Arquitectura CSS modularizada
│   ├── variables.css       # Design tokens (dark/light mode)
│   ├── layout.css          # Estructura principal
│   ├── components/         # Módulos: buttons, cards, modals, nav, tables, etc.
│   └── responsive.css      # Ajustes para móviles
├── js/
│   ├── horas.js            # Lógica principal de la app y UI
│   └── gist.js             # Sincronización con GitHub Gist
```

## Uso

### Ver la app localmente
Abre `index.html` en el navegador (doble clic o servidor local):
```bash
python3 -m http.server 8080
# Luego visita http://localhost:8080
```

### Sincronización con GitHub Gist
Las entradas nuevas que añades en la app se sincronizan con un Gist privado de GitHub:
1. Genera un token en [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=gist) con el scope `gist`
2. Haz clic en **Gist Sync** en la cabecera de la app
3. Pega tu token y guarda

### Publicar en GitHub Pages
1. Crea un repositorio en GitHub
2. `git remote add origin https://github.com/TU_USUARIO/reporte.git`
3. `git push -u origin main`
4. En GitHub → Settings → Pages → Selecciona desplegar desde la rama `main`.

## Vistas disponibles
- **Resumen** — KPIs del mes + tabla de tareas + gráfico de barras por tarea
- **Diario** — Timeline de cada día con entradas y horarios
- **Semanal** — Agrupación por semana con totales
- **Por tareas** — Ranking de horas por tarea con desglose por día
- **Añadir** — Formulario para insertar nuevas entradas (sincronizadas con Gist)
