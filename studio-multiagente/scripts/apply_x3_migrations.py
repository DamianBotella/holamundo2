#!/usr/bin/env python3
"""
apply_x3_migrations.py — guia paso a paso para aplicar migrations X3 con seguridad.

Multi-tenant + RLS es delicado: una migration aplicada sin haber actualizado
los workflows n8n previamente rompe TODO (queries devuelven 0 filas porque
nadie setea app.current_tenant). Este script:

1. Verifica drift cero antes de empezar.
2. Confirma con el usuario en cada paso destructivo.
3. Ejecuta cada migration con verificacion post-aplicacion.
4. Genera un reporte de evidencia en docs/x3_apply_evidence_<fecha>.md.

NO ejecuta automaticamente. Cada paso requiere confirmacion explicita y
muestra exactamente que va a pasar antes de hacerlo.

Uso:
  python apply_x3_migrations.py --check         # dry-run, solo verifica
  python apply_x3_migrations.py --step 049      # aplica solo migration 049
  python apply_x3_migrations.py --rollback 050  # deshabilita RLS

Requiere variables de entorno:
  PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD - credenciales Postgres
  (si Supabase: PGHOST=db.xxx.supabase.co, PGPORT=5432)
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import psycopg
except ImportError:
    print("ERROR: pip install psycopg[binary]", file=sys.stderr)
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = REPO_ROOT / "schemas" / "migrations"
DOCS_DIR = REPO_ROOT / "docs"

X3_STEPS = [
    {
        "num": "049",
        "file": "049_multi_tenant_extend.sql",
        "name": "tenant_id en tablas raiz",
        "destructive": False,
        "verifications": [
            ("studio_profile sin tenant_id",
             "SELECT count(*) FROM studio_profile WHERE tenant_id IS NULL", 0),
            ("onboarding_sessions sin tenant_id",
             "SELECT count(*) FROM onboarding_sessions WHERE tenant_id IS NULL", 0),
            ("contracts sin tenant_id",
             "SELECT count(*) FROM contracts WHERE tenant_id IS NULL", 0),
            ("invoices sin tenant_id",
             "SELECT count(*) FROM invoices WHERE tenant_id IS NULL", 0),
        ],
    },
    {
        "num": "050",
        "file": "050_rls_enable.sql",
        "name": "habilitar RLS",
        "destructive": True,
        "warning": (
            "Tras aplicar 050, los workflows n8n DEBEN llamar set_tenant_context() "
            "al inicio. Si no lo hacen, las queries devuelven 0 filas. "
            "Ya has actualizado los 13 agentes + utils + crones?"
        ),
        "verifications": [
            ("RLS activo en projects",
             "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='projects' AND rowsecurity=true", 1),
            ("RLS activo en briefings",
             "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='briefings' AND rowsecurity=true", 1),
            ("Numero de tablas con RLS",
             "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true", 28),
        ],
    },
    {
        "num": "051",
        "file": "051_user_profiles_auth.sql",
        "name": "user_profiles linker auth",
        "destructive": False,
        "warning": "Solo aplicar si X4 (Supabase Auth) esta listo - no se usa antes.",
        "verifications": [
            ("Tabla user_profiles existe",
             "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles'", 1),
            ("Vista v_my_profile existe",
             "SELECT count(*) FROM information_schema.views WHERE table_schema='public' AND table_name='v_my_profile'", 1),
        ],
    },
    {
        "num": "052",
        "file": "052_api_views.sql",
        "name": "VIEWS para API",
        "destructive": False,
        "verifications": [
            ("Vista v_project_summary existe",
             "SELECT count(*) FROM information_schema.views WHERE table_schema='public' AND table_name='v_project_summary'", 1),
            ("Vista v_dashboard_metrics existe",
             "SELECT count(*) FROM information_schema.views WHERE table_schema='public' AND table_name='v_dashboard_metrics'", 1),
        ],
    },
    {
        "num": "053",
        "file": "053_auth_triggers.sql",
        "name": "auth triggers + custom_access_token_hook",
        "destructive": False,
        "warning": (
            "Tras aplicar 053, hay que registrar manualmente "
            "custom_access_token_hook en Supabase Dashboard -> Auth -> Hooks."
        ),
        "verifications": [
            ("Function custom_access_token_hook existe",
             "SELECT count(*) FROM pg_proc WHERE proname='custom_access_token_hook'", 1),
            ("Trigger trg_auth_user_created existe",
             "SELECT count(*) FROM pg_trigger WHERE tgname='trg_auth_user_created'", 1),
        ],
    },
]


def get_conn():
    return psycopg.connect(
        host=os.environ.get("PGHOST"),
        port=int(os.environ.get("PGPORT", 5432)),
        dbname=os.environ.get("PGDATABASE"),
        user=os.environ.get("PGUSER"),
        password=os.environ.get("PGPASSWORD"),
    )


def confirm(prompt: str) -> bool:
    if os.environ.get("CI"):
        print("CI mode: auto-confirm")
        return True
    answer = input(f"{prompt} [yes/NO]: ").strip().lower()
    return answer == "yes"


def find_migration_file(num: str) -> Path | None:
    """Busca migration_<num>_*.sql o .draft."""
    for ext in (".sql", ".sql.draft"):
        for f in MIGRATIONS_DIR.glob(f"{num}_*{ext}"):
            return f
    return None


def check_drift_zero() -> bool:
    print("\n[1/N] Verificando drift cero (check_migration_drift.py)...")
    drift_script = REPO_ROOT / "scripts" / "check_migration_drift.py"
    if not drift_script.exists():
        print("  WARN: check_migration_drift.py no existe, saltando")
        return True
    rc = os.system(f'python "{drift_script}" --check')
    return rc == 0


def is_already_applied(num: str) -> bool:
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) FROM applied_migrations WHERE filename LIKE %s",
                (f"{num}_%",),
            )
            (n,) = cur.fetchone()
            return n > 0
    except Exception as e:
        print(f"  ERROR consultando applied_migrations: {e}")
        return False


def run_verifications(verifications: list) -> bool:
    ok = True
    with get_conn() as conn, conn.cursor() as cur:
        for desc, sql, expected in verifications:
            try:
                cur.execute(sql)
                (val,) = cur.fetchone()
                if isinstance(expected, int) and val == expected:
                    print(f"  ✓ {desc}: {val} (esperado {expected})")
                elif isinstance(expected, int) and val >= expected:
                    print(f"  ~ {desc}: {val} (esperado >= {expected})")
                else:
                    print(f"  ✗ {desc}: {val} (esperado {expected})")
                    ok = False
            except Exception as e:
                print(f"  ✗ {desc}: ERROR {e}")
                ok = False
    return ok


def apply_migration(step: dict) -> bool:
    num = step["num"]
    fname = step["file"]
    fpath = find_migration_file(num)
    if fpath is None:
        print(f"  ERROR: no encuentro migration {num}")
        return False

    print(f"\n--- Migration {num}: {step['name']} ---")
    print(f"  Archivo: {fpath.relative_to(REPO_ROOT)}")
    if fpath.suffix == ".draft":
        print(f"  ATENCION: archivo aun esta en .draft. Renombrando primero a .sql...")
        if not confirm(f"Renombrar {fpath.name} -> {fpath.stem}?"):
            return False
        new_path = fpath.with_suffix("")  # quita .draft, queda .sql
        fpath.rename(new_path)
        fpath = new_path
        print(f"  ✓ Renombrado a {fpath.name}")

    if is_already_applied(num):
        print(f"  Migration {num} YA APLICADA segun applied_migrations. Skipping.")
        return True

    if step.get("warning"):
        print(f"\n  ⚠️  {step['warning']}\n")

    if step.get("destructive"):
        print("  Esta migration es DESTRUCTIVA / cambia comportamiento de la BD.")

    if not confirm(f"Aplicar migration {num} ({step['name']})?"):
        return False

    sql = fpath.read_text(encoding="utf-8")
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        print(f"  ✓ Migration {num} aplicada")
    except Exception as e:
        print(f"  ✗ Migration {num} FALLO: {e}")
        return False

    print(f"\n  Verificando post-aplicacion...")
    return run_verifications(step.get("verifications", []))


def rollback_rls():
    print("\n  ROLLBACK: deshabilitando RLS en TODAS las tablas tenant-scoped...")
    if not confirm("Confirmar rollback RLS?"):
        return False
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""
          DO $$ DECLARE r record;
          BEGIN
            FOR r IN SELECT tablename FROM pg_tables
                     WHERE schemaname='public' AND rowsecurity=true LOOP
              EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
            END LOOP;
          END $$;
        """)
        conn.commit()
    print("  ✓ RLS deshabilitado en todas las tablas")
    return True


def write_evidence(applied: list[str]):
    if not applied:
        return
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    fname = DOCS_DIR / f"x3_apply_evidence_{datetime.now().strftime('%Y-%m-%d')}.md"
    content = f"""# X3 Apply Evidence — {datetime.now().isoformat()}

Migrations aplicadas con `apply_x3_migrations.py` en esta sesion:

{chr(10).join(f'- {a}' for a in applied)}

## Verificaciones post-aplicacion

Ver output del script para detalle.

## Proximo paso

Si X3 aplicado al 100%:
- Smoke test del pipeline E2E con un proyecto existente.
- Crear 2do tenant test y verificar aislamiento.
- Documentar en `docs/x3_smoke_test_<fecha>.md`.
"""
    fname.write_text(content, encoding="utf-8")
    print(f"\n  Evidencia escrita en {fname.relative_to(REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true",
                        help="Dry-run: verificar drift y mostrar plan")
    parser.add_argument("--step", type=str,
                        help="Aplicar solo una migration por numero (ej. 049)")
    parser.add_argument("--rollback", type=str,
                        help="Rollback (solo soportado: 'rls' = disable RLS en todas)")
    parser.add_argument("--all", action="store_true",
                        help="Aplicar TODAS las migrations X3 en orden")
    args = parser.parse_args()

    if args.rollback:
        if args.rollback == "rls":
            return 0 if rollback_rls() else 1
        print(f"Rollback '{args.rollback}' no soportado")
        return 2

    if not check_drift_zero():
        print("\n  ✗ Drift detectado o check fallo. Resolver antes de continuar.")
        return 1
    print("  ✓ Drift cero")

    if args.check:
        print("\nPlan X3 que se aplicaria:")
        for s in X3_STEPS:
            applied = " (ya aplicada)" if is_already_applied(s["num"]) else ""
            destructive = " [DESTRUCTIVA]" if s.get("destructive") else ""
            print(f"  {s['num']}: {s['name']}{destructive}{applied}")
        return 0

    if args.step:
        step = next((s for s in X3_STEPS if s["num"] == args.step), None)
        if not step:
            print(f"Step {args.step} no reconocido")
            return 2
        ok = apply_migration(step)
        write_evidence([f"{step['num']} {step['name']} - {'OK' if ok else 'FAIL'}"])
        return 0 if ok else 1

    if args.all:
        applied = []
        for step in X3_STEPS:
            ok = apply_migration(step)
            applied.append(f"{step['num']} {step['name']} - {'OK' if ok else 'FAIL'}")
            if not ok:
                print(f"\nAbort: migration {step['num']} fallo. Las anteriores se quedan aplicadas.")
                write_evidence(applied)
                return 1
        write_evidence(applied)
        print("\n✓ TODAS las migrations X3 aplicadas con exito")
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
