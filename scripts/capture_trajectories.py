"""
capture_trajectories.py
=======================
Runs DiffusionPack inference headlessly on a set of CSD-16, CSD-32, and RSD-16/32
examples, recording the centroid positions at every N denoising steps (plus the
post-projection final frame) for a single best-candidate trajectory.

The output is a compact JSON file (demo_trajectories.json) that the project website
can load to play back a real denoising animation in Three.js — no GPU required at
view time.

Usage (from the repo root, with the conda env activated):
    python capture_trajectories.py \
        --ckpt16 checkpoints/CKPT_sorted_16/model_step_310000.pth \
        --ckpt32 "checkpoints/32_DiT_sub_subsequence_h_hat_10M_BS_4096_EPOCHS_10000_min_dim=1/model_step_2210000.pth" \
        --out    docs/demo_trajectories.json \
        --steps  30          # keyframes to record (out of 250 sampling steps)
        --sample_size 64     # candidates per run (use 512 for full quality)
        --device cuda

The JSON schema written is:
{
  "examples": [
    {
      "id":          "csd16_seed42",
      "label":       "CSD-16 · seed 42",
      "dataset":     "CSD",
      "n_items":     16,
      "seed":        42,
      "dimensions":  [[w,h,d], ...],          # normalised, one per box
      "colors":      [[r,g,b], ...],           # [0,1] floats, from COLORS_CUBOIDS
      "color_names": ["red", "green", ...],
      "keyframes":   [                         # len = --steps + 1 (includes t=0 final)
        {
          "step":      249,                    # sampling step index (250 → 0)
          "t_frac":    1.0,                    # noise fraction remaining (1=pure noise)
          "centroids": [[x,y,z], ...]          # best candidate, one per box
        },
        ...
        {
          "step":      0,
          "t_frac":    0.0,
          "centroids": [[x,y,z], ...],         # post-projection final
          "projected": true
        }
      ],
      "metrics": {
        "utility_rate":    0.994,
        "packing_density": 0.901,
        "items_placed":    16
      }
    },
    ...
  ]
}
"""

import argparse
import json
import math
import os
import random
import sys
import time
from pathlib import Path

# Disable torch.compile (Inductor) — safe to set early; CPU machines lack the C++ toolchain
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")

import numpy as np
import torch

# ---------------------------------------------------------------------------
# Repo imports — script must be run from the repo root so that
# src/BPP_experiments is on the path, or the package must be installed.
# ---------------------------------------------------------------------------
try:
    from BPP_experiments.config import COLORS_CUBOIDS, color_to_index, index_to_color
    from BPP_experiments.inference.inference_utils import (
        get_projection_operator,
        load_model,
        stabilize_packing,
    )
    from BPP_experiments.inference.metrics import (
        PackingMetrics,
        select_best_configurations,
    )
    from BPP_experiments.models.diffusion import DDPM
    from BPP_experiments.util import generate_CSD, generate_RSD
except ImportError as e:
    sys.exit(
        f"[capture_trajectories] Import error: {e}\n"
        "Run this script from the repo root with the conda environment activated,\n"
        "or install the package: pip install -e .\n"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def set_seed(seed: int, device: str) -> torch.Generator:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if device.startswith("cuda"):
        torch.cuda.manual_seed_all(seed)
    g = torch.Generator(device=device)
    g.manual_seed(seed)
    return g


def pick_keyframe_indices(num_sampling_steps: int, n_keyframes: int) -> list[int]:
    """
    Return n_keyframes step indices spread across [num_sampling_steps-1 … 0]
    in the order they are visited (high → low), always including the first
    (pure noise) and last (clean) steps.
    """
    total = num_sampling_steps
    # linspace in descending order, always include index 0 (the clean step)
    indices = set(
        int(round(x))
        for x in np.linspace(total - 1, 0, n_keyframes)
    )
    return sorted(indices, reverse=True)   # descending: noise first


def tensor_to_list(t: torch.Tensor) -> list:
    """Recursively convert tensor to nested Python lists of rounded floats."""
    arr = t.detach().cpu().float().numpy()
    return [[round(float(v), 6) for v in row] for row in arr]


# ---------------------------------------------------------------------------
# Core: run inference with trajectory capture
# ---------------------------------------------------------------------------

def run_and_capture(
    dimensions_1xNx3: torch.Tensor,
    model,
    project_operator,
    device: str,
    seed: int,
    num_training_steps: int = 500,
    num_sampling_steps: int = 250,
    sample_size: int = 64,
    n_keyframes: int = 30,
    num_steps_projection: int = 1,
) -> dict:
    """
    Runs one full DDPM inference pass, recording centroid positions at the
    requested keyframe steps for the *best candidate* trajectory.

    Returns a dict with keys:
        keyframes, dimensions, best_idx, placed_mask, final_centroids
    """
    g = set_seed(seed, device)

    scheduler = DDPM(
        generator=g,
        schedule="cosine",
        num_training_steps=num_training_steps,
    )
    scheduler.set_inference_timesteps(num_sampling_steps)

    dims = dimensions_1xNx3.to(device)                          # (1, N, 3)
    dims_batch = dims.repeat(sample_size, 1, 1)                  # (BS, N, 3)
    noisy = torch.randn_like(dims_batch, device=device)          # (BS, N, 3)

    keyframe_steps = set(pick_keyframe_indices(num_sampling_steps, n_keyframes))
    # Always capture the final projected step even if not in the set
    keyframe_steps.add(0)

    # We will track the best candidate index AFTER the run; during the run we
    # record full batches at keyframe steps and then slice the best index later.
    raw_frames: dict[int, torch.Tensor] = {}   # step → (BS, N, 3) centroids
    placed_mask = torch.ones(sample_size, dims_batch.shape[1], device=device, dtype=torch.bool)

    # ---- Denoising loop ----
    use_amp = device.startswith("cuda")
    for i in reversed(range(num_sampling_steps)):
        t_in = torch.tensor(
            [int(num_training_steps * i / num_sampling_steps)], device=device
        )

        with torch.no_grad():
            ctx = torch.amp.autocast("cuda", enabled=use_amp, dtype=torch.float16)
            with ctx:
                noise_pred = model(noisy, dims_batch, t_in)

        noisy = scheduler.step(
            torch.tensor(i, device=device),
            noisy,
            noise_pred,
            dims_batch,
            guide=None,
            cost_function=None,
            clipping=True,
            clip_min=0.0,
            clip_max=1.0,
            apply_guide=False,
        )

        # ---- Projection at the very last step ----
        if i < num_steps_projection:
            noisy, placed_mask = project_operator.project_cuboids_2(
                noisy.clone(), dims_batch.clone(), {}
            )

        # ---- Capture this keyframe ----
        if i in keyframe_steps:
            raw_frames[i] = noisy.detach().cpu().clone()  # (BS, N, 3)

        if i % 50 == 0:
            print(f"  step {i:3d}/{num_sampling_steps}")

    # ---- Select best candidate ----
    metrics = PackingMetrics()

    centroids_cpu = noisy.detach().cpu()
    dims_cpu = dims_batch.detach().cpu()
    mask_cpu = placed_mask.detach().cpu()

    # Stabilise to get support metric
    centroids_s, mask_s, support_metric = stabilize_packing(
        noisy.clone(), dims_batch.clone(), placed_mask.clone(), metrics
    )
    centroids_s = centroids_s.detach().cpu()
    mask_s = mask_s.detach().cpu()
    support_metric = support_metric.detach().cpu()

    ur = metrics.calculate_UR(centroids_s, dims_cpu, mask_s)
    items_placed = metrics.calculate_items_placed(mask_s)

    # For the demo, pick the candidate that places the most items (ties broken by UR).
    # This prioritises visual completeness over strict physical support scoring.
    best_idx = int(
        sorted(range(sample_size), key=lambda i: (int(items_placed[i]), float(ur[i])))[-1]
    )

    # Overwrite frame 0 with the stabilised best candidate (post-projection)
    raw_frames[0] = centroids_s

    # ---- Build keyframes for the best candidate ----
    sorted_steps = sorted(raw_frames.keys(), reverse=True)  # noise → clean
    keyframes = []
    for step in sorted_steps:
        frame_batch = raw_frames[step]          # (BS, N, 3)
        c = frame_batch[best_idx]               # (N, 3)
        t_frac = round(step / (num_sampling_steps - 1), 4) if num_sampling_steps > 1 else 0.0
        entry = {
            "step": step,
            "t_frac": t_frac,
            "centroids": tensor_to_list(c),
        }
        if step == 0:
            entry["projected"] = True
        keyframes.append(entry)

    pd_val = float(metrics.calculate_packing_density(
        centroids_s[best_idx:best_idx+1],
        dims_cpu[best_idx:best_idx+1],
        mask_s[best_idx:best_idx+1],
    )[0])
    ur_val = float(ur[best_idx])
    items_val = int(items_placed[best_idx])

    return {
        "keyframes": keyframes,
        "dimensions": tensor_to_list(dims.squeeze(0)),
        "placed_mask": mask_s[best_idx].tolist(),
        "metrics": {
            "utility_rate":    round(ur_val, 4),
            "packing_density": round(pd_val, 4),
            "items_placed":    items_val,
        },
    }


# ---------------------------------------------------------------------------
# Scenario definitions
# ---------------------------------------------------------------------------

SCENARIOS = [
    # (id_str,           label,                dataset, n_items, seed)
    ("csd16_seed42",  "CSD-16 · seed 42",    "CSD",   16,      42),
    ("csd16_seed7",   "CSD-16 · seed 7",     "CSD",   16,       7),
    ("csd32_seed42",  "CSD-32 · seed 42",    "CSD",   32,      42),
    ("csd32_seed13",  "CSD-32 · seed 13",    "CSD",   32,      13),
    ("rsd16_seed150", "RSD-16 · seed 150",   "RSD",   16,     150),  # 16/16 placed
    ("rsd32_seed150", "RSD-32 · seed 150",   "RSD",   32,     150),  # 32/32 placed
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Capture DiffusionPack denoising trajectories for the demo website."
    )
    parser.add_argument("--ckpt16",
                        default="ckpt/16_final/16_final.pth",
                        help="Path to the 16-item model checkpoint (.pth)")
    parser.add_argument("--ckpt32",
                        default="ckpt/32_final/32_final.pth",
                        help="Path to the 32-item model checkpoint (.pth)")
    parser.add_argument("--ckptdir16",
                        default="ckpt/16_final",
                        help="Directory containing config.yaml for the 16-item model")
    parser.add_argument("--ckptdir32",
                        default="ckpt/32_final",
                        help="Directory containing config.yaml for the 32-item model")
    parser.add_argument("--out",         default="demo_trajectories.json",
                        help="Output JSON file path")
    parser.add_argument("--steps",       type=int, default=30,
                        help="Number of keyframe steps to record (default 30)")
    parser.add_argument("--sample_size", type=int, default=64,
                        help="Candidate batch size per run (default 64; use 512 for full quality)")
    parser.add_argument("--device",      default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--scenarios",   nargs="*", default=None,
                        help="Subset of scenario IDs to run (default: all). "
                             "IDs: " + " ".join(s[0] for s in SCENARIOS))
    parser.add_argument("--projection",  default="EMS",
                        choices=["EMS", "EP", "CP", "None"],
                        help="Projection operator (default EMS)")
    parser.add_argument("--sampling_steps", type=int, default=250,
                        help="DDPM sampling steps (default 250)")
    args = parser.parse_args()

    device = args.device
    print(f"[capture] device={device}  sample_size={args.sample_size}  "
          f"sampling_steps={args.sampling_steps}  keyframes={args.steps}")

    # ---- Load both models once ----
    ckpt16    = Path(args.ckpt16)
    ckpt32    = Path(args.ckpt32)
    ckptdir16 = Path(args.ckptdir16)
    ckptdir32 = Path(args.ckptdir32)

    print(f"\n[capture] Loading 16-item model from {ckpt16} ...")
    model16 = load_model(str(ckptdir16), str(ckpt16), device=device)

    print(f"[capture] Loading 32-item model from {ckpt32} ...")
    model32 = load_model(str(ckptdir32), str(ckpt32), device=device)

    project_op = get_projection_operator(args.projection)

    # ---- Filter scenarios ----
    scenarios = SCENARIOS
    if args.scenarios:
        wanted = set(args.scenarios)
        scenarios = [s for s in SCENARIOS if s[0] in wanted]
        if not scenarios:
            sys.exit(f"No matching scenario IDs. Available: {[s[0] for s in SCENARIOS]}")

    # ---- Run each scenario ----
    examples = []

    for sid, label, dataset, n_items, seed in scenarios:
        print(f"\n{'='*60}")
        print(f"[capture] Scenario: {sid}  ({label})")
        print(f"{'='*60}")

        # Generate box dimensions
        if dataset == "CSD":
            dims_list = generate_CSD(n_items, seed)
        else:
            dims_list = generate_RSD(n_items, seed)

        dims_tensor = torch.tensor(dims_list, dtype=torch.float32).unsqueeze(0)  # (1, N, 3)
        model = model16 if n_items <= 16 else model32

        t0 = time.time()
        result = run_and_capture(
            dimensions_1xNx3=dims_tensor,
            model=model,
            project_operator=project_op,
            device=device,
            seed=seed,
            num_training_steps=500,
            num_sampling_steps=args.sampling_steps,
            sample_size=args.sample_size,
            n_keyframes=args.steps,
            num_steps_projection=1,
        )
        elapsed = time.time() - t0
        print(f"[capture] Done in {elapsed:.1f}s  "
              f"UR={result['metrics']['utility_rate']:.3f}  "
              f"PD={result['metrics']['packing_density']:.3f}  "
              f"placed={result['metrics']['items_placed']}/{n_items}")

        # Colors: first n_items entries from COLORS_CUBOIDS
        colors = COLORS_CUBOIDS[:n_items]
        color_names = [index_to_color.get(i, f"item_{i}") for i in range(n_items)]

        example = {
            "id":          sid,
            "label":       label,
            "dataset":     dataset,
            "n_items":     n_items,
            "seed":        seed,
            "dimensions":  [[round(v, 6) for v in row] for row in dims_list],
            "colors":      [[round(v, 4) for v in c] for c in colors],
            "color_names": color_names,
            "placed_mask": result["placed_mask"],
            "keyframes":   result["keyframes"],
            "metrics":     result["metrics"],
        }
        examples.append(example)

    # ---- Write JSON ----
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "projection":   args.projection,
        "sampling_steps": args.sampling_steps,
        "keyframes_recorded": args.steps,
        "examples":     examples,
    }

    with open(out_path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    size_kb = out_path.stat().st_size / 1024
    print(f"\n[capture] Written {len(examples)} examples → {out_path}  ({size_kb:.1f} KB)")
    print("[capture] Done.")


if __name__ == "__main__":
    main()
