#!/usr/bin/env python3
"""
check_migration_drift.py — Detecta migrations en repo que NO estan aplicadas en BD.

Origen: B28. Tras 3 incidentes de schema drift silencioso (042, 044, 045 en repo
sin aplicar en Supabase durante semanas), introducimos la tabla applied_migrations
(via 046) y este script que compara repo vs BD y alerta.

Uso:
    # Modo lista (verificacion local, no toca BD)
    python check_migration_drift.py --list

    # Modo check completo (compara repo vs BD)
    python check_migration_drift.py --check

    # Salida JSON para CI / cron / dashboards
    python check_migration_drift.py --check --json

Codigos de salida:
    0 = sin drift, todas las migrations del repo estan registradas como aplicadas
    1 = drift detectado (migrations en repo no aplicadas)
    2 = error de conexion / configuracion

Dependencias:
    pip install psycopg2-binary python-dotenv

Variables de entorno (.env en raiz del repo):
    SUPABASE_DB_HOST=db.xxx.supabase.co
    SUPABASE_DB_PORT=5432
    SUPABASE_DB_NAME=postgres
    SUPABASE_DB_USER=postgres.xxx
    SUPABASE_DB_PASSWORD=xxx
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def _migrations_dir() -> Path:
    """Localiza schemas/migrations/ relativo al script."""
    here = Path(__file__).resolve().parent
    candidate = here.parent / "schemas" / "migrations"
    if not candidate.is_dir():
        sys.exit(f"ERROR: no se encuentra {candidate}")
    return candidate


def list_repo_migrations() -> list[str]:
    return sorted(p.name for p in _migrations_dir().glob("*.sql"))


def list_applied_migrations() -> list[str]:
    try:
        import psycopg2
        from dotenv import load_dotenv
    except ImportError:
        sys.exit("ERROR: pip install psycopg2-binary python-dotenv")

    load_dotenv()
    try:
        conn = psycopg2.connect(
            host=os.environ["SUPABASE_DB_HOST"],
            port=os.getenv("SUPABASE_DB_PORT", "5432"),
            dbname=os.environ["SUPABASE_DB_NAME"],
            user=os.environ["SUPABASE_DB_USER"],
            password=os.environ["SUPABASE_DB_PASSWORD"],
        )
    except KeyError as e:
        sys.exit(f"ERROR: falta variable de entorno {e}")
    except Exception as e:
        print(f"ERROR conectando a Supabase: {e}", file=sys.stderr)
        sys.exit(2)

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT filename FROM applied_migrations ORDER BY filename;")
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def check_drift(as_json: bool = False) -> int:
    repo = list_repo_migrations()
    applied = list_applied_migrations()

    repo_set = set(repo)
    applied_set = set(applied)

    missing_in_db = sorted(repo_set - applied_set)
    extra_in_db = sorted(applied_set - repo_set)

    result = {
        "repo_count": len(repo),
        "applied_count": len(applied),
        "missing_in_db": missing_in_db,
        "extra_in_db": extra_in_db,
        "drift_detected": bool(missing_in_db or extra_in_db),
    }

    if as_json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"Repo:    {len(repo)} migrations en schemas/migrations/")
        print(f"BD:      {len(applied)} registradas en applied_migrations")
        print()
        if missing_in_db:
            print(f"DRIFT — {len(missing_in_db)} migration(s) en repo NO aplicadas en BD:")
            for m in missing_in_db:
                print(f"   - {m}")
            print()
            print("Accion: aplicar la migration en Supabase y registrar en applied_migrations")
            print("        (ver patron en migration 046 o usar workflow MCP temporal).")
        if extra_in_db:
            print(f"WARNING — {len(extra_in_db)} migration(s) registradas en BD pero NO en repo:")
            for m in extra_in_db:
                print(f"   - {m}")
            print("(probablemente borradas del repo; verificar si fue intencional)")
        if not missing_in_db and not extra_in_db:
            print("OK — todas las migrations del repo estan aplicadas en BD.")

    return 1 if result["drift_detected"] else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Detecta drift entre migrations en repo vs BD.")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--list", action="store_true", help="Lista solo las migrations del repo (sin BD)")
    g.add_argument("--check", action="store_true", help="Compara repo vs BD y reporta drift")
    parser.add_argument("--json", action="store_true", help="Salida JSON (para --check)")
    args = parser.parse_args()

    if args.list:
        for m in list_repo_migrations():
            print(m)
        return

    if args.check:
        sys.exit(check_drift(as_json=args.json))


if __name__ == "__main__":
    main()
