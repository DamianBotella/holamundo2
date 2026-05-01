#!/usr/bin/env python3
"""
snapshot_workflows.py — exporta workflows de produccion n8n al repo.

Resuelve PA-6 del audit X2: el JSON del repo esta desactualizado vs produccion.
Este script hace fetch de los workflows criticos via n8n REST API y los guarda
con prefijo PROD_<fecha>_<nombre>.json en workflows/ para diferenciarlos del
JSON template historico.

Uso:
  python snapshot_workflows.py                  # snapshot de TODOS
  python snapshot_workflows.py --critical       # solo los criticos (lista hardcoded)
  python snapshot_workflows.py --workflow main_orchestrator
  python snapshot_workflows.py --diff           # solo muestra que cambio vs ultimo snapshot

Requiere variables de entorno:
  N8N_API_URL  - https://n8n-n8n.zzeluw.easypanel.host
  N8N_API_KEY  - JWT de la instancia n8n

Pensado para correr semanalmente desde un cron o github action.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    print("ERROR: pip install requests", file=sys.stderr)
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS_DIR = REPO_ROOT / "workflows"
SNAPSHOT_DIR = WORKFLOWS_DIR / "_snapshots"

# Workflows criticos a snapshear con prioridad alta
CRITICAL_WORKFLOWS = {
    "main_orchestrator",
    "init_new_project",
    "agent_briefing",
    "agent_design",
    "agent_regulatory",
    "agent_materials",
    "agent_documents",
    "agent_costs",
    "agent_trades",
    "agent_proposal",
    "agent_planner",
    "agent_memory",
    "agent_safety_plan",
    "agent_accessibility",
    "util_llm_call",
    "util_notification",
    "util_consultation",
    "util_architect_presence",
    "error_handler",
}


def env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: missing env {name}", file=sys.stderr)
        sys.exit(2)
    return val.rstrip("/")


def fetch_workflows_list(api_url: str, api_key: str) -> list[dict]:
    """Fetch lista de workflows. Pagina si hace falta."""
    url = urljoin(api_url + "/", "api/v1/workflows")
    out: list[dict] = []
    cursor: str | None = None
    while True:
        params = {"limit": 250}
        if cursor:
            params["cursor"] = cursor
        r = requests.get(
            url,
            headers={"X-N8N-API-KEY": api_key},
            params=params,
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        out.extend(data.get("data", []))
        cursor = data.get("nextCursor")
        if not cursor:
            break
    return out


def fetch_workflow_full(api_url: str, api_key: str, workflow_id: str) -> dict:
    url = urljoin(api_url + "/", f"api/v1/workflows/{workflow_id}")
    r = requests.get(url, headers={"X-N8N-API-KEY": api_key}, timeout=30)
    r.raise_for_status()
    return r.json()


def sanitize(workflow: dict) -> dict:
    """Limpia campos volátiles para diffs estables."""
    keep = {
        "name", "nodes", "connections", "settings",
        "active", "tags", "pinData", "versionId",
    }
    out = {k: v for k, v in workflow.items() if k in keep}
    # Normalizar referencias a credenciales (siempre el mismo placeholder)
    for node in out.get("nodes", []):
        if "credentials" in node:
            node["credentials"] = {
                k: {"id": "PLACEHOLDER", "name": v.get("name", "?")}
                for k, v in node["credentials"].items()
            }
    return out


def write_snapshot(name: str, payload: dict, ts: str) -> Path:
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = name.replace("/", "_").replace(" ", "_")
    out = SNAPSHOT_DIR / f"PROD_{ts}_{safe_name}.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return out


def find_last_snapshot(name: str) -> Path | None:
    safe_name = name.replace("/", "_").replace(" ", "_")
    candidates = sorted(SNAPSHOT_DIR.glob(f"PROD_*_{safe_name}.json"))
    return candidates[-1] if candidates else None


def diff_signature(workflow: dict) -> dict:
    """Resumen liviano de un workflow para detectar cambios sin diff completo."""
    nodes = workflow.get("nodes", [])
    return {
        "n_nodes": len(nodes),
        "node_names": sorted(n.get("name", "?") for n in nodes),
        "active": workflow.get("active"),
        "version": workflow.get("versionId"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--critical", action="store_true",
                        help="Solo snapshotea workflows criticos hardcoded")
    parser.add_argument("--workflow", type=str,
                        help="Snapshot solo de un workflow por nombre exacto")
    parser.add_argument("--diff", action="store_true",
                        help="Solo muestra que cambio vs ultimo snapshot")
    args = parser.parse_args()

    api_url = env("N8N_API_URL")
    api_key = env("N8N_API_KEY")

    print(f"== snapshot_workflows.py ==")
    print(f"   API: {api_url}")
    print(f"   Snapshot dir: {SNAPSHOT_DIR}")

    print("Fetching workflow list...")
    listing = fetch_workflows_list(api_url, api_key)
    print(f"   {len(listing)} workflows en produccion")

    targets: list[dict] = []
    if args.workflow:
        targets = [w for w in listing if w.get("name") == args.workflow]
        if not targets:
            print(f"ERROR: workflow '{args.workflow}' no encontrado", file=sys.stderr)
            return 1
    elif args.critical:
        targets = [w for w in listing if w.get("name") in CRITICAL_WORKFLOWS]
        missing = CRITICAL_WORKFLOWS - {w.get("name") for w in targets}
        if missing:
            print(f"WARN: criticos no encontrados en n8n: {sorted(missing)}")
    else:
        targets = listing

    ts = datetime.now().strftime("%Y%m%d_%H%M")
    diffs: list[str] = []

    for w in targets:
        name = w.get("name", "?")
        wid = w.get("id")
        if not wid:
            continue
        full = fetch_workflow_full(api_url, api_key, wid)
        sanitized = sanitize(full)

        if args.diff:
            last = find_last_snapshot(name)
            if not last:
                diffs.append(f"NEW    {name}")
            else:
                prev = json.loads(last.read_text(encoding="utf-8"))
                if diff_signature(prev) != diff_signature(sanitized):
                    diffs.append(f"CHANGED {name}")
        else:
            out = write_snapshot(name, sanitized, ts)
            print(f"  ✓ {name:40s} -> {out.relative_to(REPO_ROOT)}")

    if args.diff:
        if diffs:
            print("\nCambios detectados:")
            for d in diffs:
                print(f"  {d}")
            print(f"\n{len(diffs)} workflows cambiaron desde el ultimo snapshot.")
            return 1  # exit code !=0 para CI
        else:
            print("\nSin cambios desde el ultimo snapshot. Drift cero.")
            return 0
    else:
        print(f"\nSnapshot {ts} creado para {len(targets)} workflows.")
        print("Tip: revisa diffs con `git diff workflows/_snapshots/`")
        return 0


if __name__ == "__main__":
    sys.exit(main())
