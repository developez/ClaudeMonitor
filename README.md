# Claude Monitor

Consumo de tokens de Claude Code por sesión y subagente, con tema oscuro estilo terminal.

![Claude Monitor](image.png)

Todo se calcula en el navegador a partir de los transcripts `.jsonl` de Claude Code. No hay backend ni dependencias que instalar (Chart.js va incluido en `vendor/`).

## Uso

1. Crea un enlace (junction) a tus transcripts, dentro de la carpeta del proyecto:

   ```powershell
   New-Item -ItemType Junction -Path claude-projects -Target "$env:USERPROFILE\.claude\projects"
   ```

2. Copia `config.example.json` a `config.json` y pon tus carpetas de proyecto:

   ```json
   {
     "folders": ["C:/Projects/Acme"],
     "names": { "C:/Projects/Acme/web": "Acme · web" }
   }
   ```

3. Sirve la carpeta con cualquier servidor estático y abre la URL:

   ```bash
   python -m http.server 8000
   ```

## Qué muestra

- Tokens por sesión desglosados en entrada, salida, escritura de caché y lectura de caché.
- Una barra por la sesión principal y otra por cada subagente, con modelo y número de peticiones.
- Filtro por proyecto y sesión, y opción de ocultar la lectura de caché.

## Privacidad

`claude-projects` y `config.json` están en `.gitignore`: contienen tus conversaciones y rutas locales y no deben subirse.
