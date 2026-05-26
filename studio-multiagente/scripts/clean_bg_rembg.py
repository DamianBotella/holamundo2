#!/usr/bin/env python
"""
PLAN V1.0 Bloque 6 (studio-v2) - Limpieza de fondos con rembg (ML).

Sustituye los enfoques de chroma-key + erosion morfologica (que producian
"mordiscos" en grises interiores) por segmentacion ML que entiende el
sujeto (la sala isometrica) vs el fondo. Sin daño al interior.

Modelo: 'isnet-general-use' (mejor para objetos no-humanos / escenas
arquitectonicas que 'u2net' base).

Pipeline por PNG:
  A) rembg.remove(img, session) -> RGBA con fondo transparente quirurgico
  B) Crop a bounding box de alpha>5 + padding uniforme de 20px
     (normaliza tamano entre las 11 salas, resuelve Mesa Dibujo)
  C) Sobrescribe el archivo

Uso:
  python studio-multiagente/scripts/clean_bg_rembg.py
  python studio-multiagente/scripts/clean_bg_rembg.py --only drawing_room
  python studio-multiagente/scripts/clean_bg_rembg.py --model u2net
"""

import argparse
import os
import sys
import time
import numpy as np
from PIL import Image
from rembg import remove, new_session

ROOMS = [
    'library', 'drawing_room', 'reception', 'corridor', 'archive',
    'direction', 'meeting_room', 'workshop', 'accounting',
    'cafe_terrace', 'inspection_terrace',
]

PADDING_PX = 20
ALPHA_THRESHOLD = 5  # umbral bajo para bbox: preserva bordes feathered


def crop_to_bbox(rgba: np.ndarray, padding: int) -> np.ndarray:
    alpha = rgba[..., 3]
    fg = alpha > ALPHA_THRESHOLD
    if not fg.any():
        return rgba
    ys, xs = np.where(fg)
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    h, w = alpha.shape
    y0 = max(0, y0 - padding)
    y1 = min(h, y1 + padding + 1)
    x0 = max(0, x0 - padding)
    x1 = min(w, x1 + padding + 1)
    return rgba[y0:y1, x0:x1]


def process_one(path: str, session, dry_run: bool) -> dict:
    img = Image.open(path).convert('RGBA')
    initial_size = img.size

    t0 = time.time()
    result = remove(img, session=session)
    rembg_ms = int((time.time() - t0) * 1000)

    arr = np.array(result.convert('RGBA'))
    h_in, w_in = arr.shape[:2]
    alpha = arr[..., 3]
    a_kept = (alpha > 0).sum() / alpha.size * 100

    # Crop a bbox + padding
    cropped = crop_to_bbox(arr, PADDING_PX)
    final_h, final_w = cropped.shape[:2]

    if dry_run:
        return {
            'file': os.path.basename(path),
            'initial_size': initial_size,
            'after_rembg_size': (w_in, h_in),
            'final_size': (final_w, final_h),
            'kept_alpha_pct': round(a_kept, 1),
            'rembg_ms': rembg_ms,
            'dry_run': True,
        }

    Image.fromarray(cropped, mode='RGBA').save(path, 'PNG', optimize=True)
    return {
        'file': os.path.basename(path),
        'initial_size': initial_size,
        'final_size': (final_w, final_h),
        'kept_alpha_pct': round(a_kept, 1),
        'rembg_ms': rembg_ms,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--folder', default='studio-multiagente/foxhole-ui/public/assets/rooms')
    p.add_argument('--only', help='Procesar solo esta sala')
    p.add_argument('--model', default='u2net',
                   choices=['u2net', 'u2netp', 'u2net_human_seg', 'isnet-general-use', 'silueta'],
                   help='Modelo rembg. Default u2net (mejor para salas '
                        'arquitectonicas: isnet-general-use borraba las paredes '
                        'cream interpretandolas como fondo).')
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()

    targets = [args.only] if args.only else ROOMS
    if args.only and args.only not in ROOMS:
        print(f'ERROR: --only={args.only} no esta en {ROOMS}')
        return 1

    print(f'[clean_bg_rembg] model={args.model} folder={args.folder} dry_run={args.dry_run}')
    print('Inicializando sesion (la primera vez descarga modelo ~150MB)...')
    t_init = time.time()
    session = new_session(args.model)
    print(f'Sesion lista en {int((time.time() - t_init) * 1000)}ms')
    print('-' * 100)

    for room in targets:
        path = os.path.join(args.folder, room + '.png')
        if not os.path.isfile(path):
            print(f'   SKIP {room}: no existe')
            continue
        r = process_one(path, session, args.dry_run)
        if args.dry_run:
            print(f'  {r["file"]:30s} {r["initial_size"]} -> after_rembg={r["after_rembg_size"]} -> '
                  f'final={r["final_size"]} kept_alpha={r["kept_alpha_pct"]}% rembg={r["rembg_ms"]}ms')
        else:
            print(f'  {r["file"]:30s} {r["initial_size"]} -> final={r["final_size"]} '
                  f'kept_alpha={r["kept_alpha_pct"]}% rembg={r["rembg_ms"]}ms')

    print('-' * 100)
    print('Done.' if not args.dry_run else 'Dry-run done.')
    return 0


if __name__ == '__main__':
    sys.exit(main() or 0)
