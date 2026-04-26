# Snapshot de memoria de Claude Code

Esta carpeta contiene el sistema de **auto-memory** de Claude Code para este proyecto, sincronizado en git para usarlo desde cualquier PC.

Claude Code lee/escribe memoria en una ruta del filesystem del PC (no en el repo). Para que la memoria persista entre PCs, se copia aquí y se restaura al lugar correcto al cambiar de equipo.

## Archivos

- `MEMORY.md` — índice (siempre cargado en contexto cuando Claude abre el proyecto)
- `project_canonical_doc.md` — pointer al documento maestro
- `project_context.md` — stack técnico, IDs de workflows, credenciales
- `feedback_workflow.md` — cómo Damián quiere que trabajemos
- `project_state.md` — estado actual del proyecto (largo: ~86 KB)
- `feedback_technical.md` — gotchas técnicos n8n 2.12.x
- `architect_email_centralizado.md` — cómo cambiar email destino de notificaciones

## Restaurar memoria en un PC nuevo

Después de `git clone`, copia este snapshot al lugar donde Claude Code lo busca.

### Windows (PowerShell)
```powershell
$dest = "$env:USERPROFILE\.claude\projects\c--Users-$env:USERNAME-Desktop-holamundo2\memory"
New-Item -ItemType Directory -Force -Path $dest
Copy-Item "studio-multiagente\.claude-memory-snapshot\*.md" $dest -Force
```

### macOS / Linux
```bash
DEST=~/.claude/projects/$(pwd | tr '/' '-' | sed 's/^-//')/memory
mkdir -p "$DEST"
cp studio-multiagente/.claude-memory-snapshot/*.md "$DEST/"
```

> **Nota**: el slug del directorio (ej. `c--Users-...-holamundo2`) lo genera Claude Code automáticamente al abrir el proyecto. Si abres el repo en una ruta distinta a `Desktop/holamundo2`, ajusta el path.

## Sincronizar memoria de vuelta al repo (al final de cada sesión)

Cuando Claude actualice memoria durante el trabajo, los cambios se escriben al filesystem local del PC. Para volcarlos al repo antes de hacer push:

### Windows (PowerShell)
```powershell
$src = "$env:USERPROFILE\.claude\projects\c--Users-$env:USERNAME-Desktop-holamundo2\memory"
Copy-Item "$src\*.md" "studio-multiagente\.claude-memory-snapshot\" -Force
git add studio-multiagente/.claude-memory-snapshot/
git commit -m "memory: snapshot $(Get-Date -Format yyyy-MM-dd)"
git push
```

### macOS / Linux
```bash
SRC=~/.claude/projects/$(pwd | tr '/' '-' | sed 's/^-//')/memory
cp "$SRC"/*.md studio-multiagente/.claude-memory-snapshot/
git add studio-multiagente/.claude-memory-snapshot/
git commit -m "memory: snapshot $(date +%Y-%m-%d)"
git push
```

## Mantenimiento

- La memoria es viva y crece. Si algún archivo se vuelve obsoleto, eliminarlo aquí + del filesystem local + actualizar `MEMORY.md`.
- `project_state.md` puede crecer mucho (~86 KB actualmente). Si pasa de unos 200 KB, considerar comprimirlo o dividirlo por temas.
- Esta carpeta NO contiene secrets — el contenido viene de notas de trabajo. Pero si en algún momento se incluye una credencial, **no commitear hasta limpiarla**.
