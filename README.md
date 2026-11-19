# Claude Monitor

Consumo de tokens de Claude Code por sesión y subagente, con tema oscuro estilo terminal.

![Claude Monitor](image.png)

Todo se calcula en el navegador a partir de los transcripts `.jsonl` de Claude Code. No hay backend ni dependencias que instalar (Chart.js va incluido en `vendor/`).

Versión hermana para Codex: [CodexMonitor](https://github.com/developez/CodexMonitor).

## Arranque rápido

Solo necesitas **Python 3**. Si no lo tienes, instálalo desde [python.org/downloads](https://www.python.org/downloads/). En Windows, marca la casilla **"Add python.exe to PATH"** durante la instalación.

1. Descarga el proyecto: botón verde **Code → Download ZIP** en GitHub, y descomprímelo donde quieras.
2. Arráncalo:
   - **Windows:** doble clic en `start.bat`.
   - **Linux / macOS:** abre una terminal en la carpeta y ejecuta `sh start.sh`.
3. Se abre el navegador en **http://localhost:8050/**. Si no se abre, escribe esa dirección a mano.

Para pararlo, cierra la ventana negra (Windows) o pulsa `Ctrl+C` en la terminal.

El script hace dos cosas: enlaza la carpeta de transcripts de Claude Code (`~/.claude/projects`, o `$CLAUDE_CONFIG_DIR/projects` si lo tienes definido) como `claude-projects`, y sirve la carpeta en el puerto 8050. El servidor solo escucha en tu equipo (`127.0.0.1`), así que nadie más de tu red puede verlo.

> ¿Usas también Codex Monitor? Los dos usan el puerto 8050, así que no pueden estar abiertos a la vez. Cambia `PORT=8050` en el `start` de uno de ellos.

## Configuración opcional

Por defecto se muestran todos los proyectos. Para limitarlos o darles nombre, copia `config.example.json` a `config.json` y pon tus carpetas:

```json
{
  "folders": ["C:/Projects/Acme"],
  "names": { "C:/Projects/Acme/web": "Acme · web" }
}
```

## Arranque manual

Si prefieres hacerlo tú:

```powershell
# Windows (PowerShell)
New-Item -ItemType Junction -Path claude-projects -Target "$env:USERPROFILE\.claude\projects"
python -m http.server 8050 --bind 127.0.0.1
```

```bash
# Linux / macOS
ln -s ~/.claude/projects claude-projects
python3 -m http.server 8050 --bind 127.0.0.1
```

Vale cualquier servidor estático que genere listados de directorio con el formato de `python -m http.server`.

## Qué muestra

- Tokens por sesión desglosados en entrada, salida, escritura de caché y lectura de caché.
- Una barra por la sesión principal y otra por cada subagente, con modelo y número de peticiones.
- Pestaña **En el tiempo**: consumo por día, agrupado por tipo de token o por modelo, en tokens o en euros.
- Coste estimado en euros con las tarifas oficiales de la API. Es el equivalente de pago por uso, no lo que cobra tu plan.
- Tabla de **precios por modelo** al final de la página. Los modelos sin tarifa publicada usan una tarifa estimada: el promedio de los modelos con precio que aparecen en tus datos.
- Filtro por proyecto y sesión, y opción de ocultar la lectura de caché.

## Privacidad

`claude-projects` y `config.json` están en `.gitignore`: contienen tus conversaciones y rutas locales y no deben subirse.
