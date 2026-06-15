"""
Quick CPU seed search — finds RSD seeds where the model places the most items.
Uses tiny settings (sample_size=4, sampling_steps=50) for fast iteration.

Run from the Diff-BPP repo root:
    python <path>/find_best_rsd_seeds.py
"""
import sys, os, random, json, time
os.environ["TORCHDYNAMO_DISABLE"] = "1"   # no torch.compile on CPU
os.environ["TORCH_COMPILE_DISABLE"] = "1"
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3] / "Diff-BPP"
sys.path.insert(0, str(REPO_ROOT / "src"))
os.chdir(REPO_ROOT)

import numpy as np
import torch

from BPP_experiments.config import COLORS_CUBOIDS
from BPP_experiments.inference.inference_utils import get_projection_operator, load_model, stabilize_packing
from BPP_experiments.inference.metrics import PackingMetrics, select_best_configurations
from BPP_experiments.models.diffusion import DDPM
from BPP_experiments.util import generate_RSD

DEVICE = "cpu"
SAMPLE_SIZE = 4
SAMPLING_STEPS = 60   # 60 instead of 250 — much faster on CPU
TRAINING_STEPS = 500
SEEDS_TO_TRY = [0, 1, 5, 7, 10, 13, 21, 33, 42, 56, 77, 84, 99, 123, 200]

def run_quick(dims_list, model, project_op, seed):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    g = torch.Generator(device=DEVICE); g.manual_seed(seed)
    scheduler = DDPM(generator=g, schedule="cosine", num_training_steps=TRAINING_STEPS)
    scheduler.set_inference_timesteps(SAMPLING_STEPS)
    dims = torch.tensor(dims_list, dtype=torch.float32).unsqueeze(0)
    dims_b = dims.repeat(SAMPLE_SIZE, 1, 1)
    noisy = torch.randn_like(dims_b)
    for i in reversed(range(SAMPLING_STEPS)):
        t_in = torch.tensor([int(TRAINING_STEPS * i / SAMPLING_STEPS)])
        with torch.no_grad():
            noise_pred = model(noisy, dims_b, t_in)
        noisy = scheduler.step(torch.tensor(i), noisy, noise_pred, dims_b,
                               guide=None, cost_function=None,
                               clipping=True, clip_min=0.0, clip_max=1.0, apply_guide=False)
        if i < 1:
            noisy, placed_mask = project_op.project_cuboids_2(noisy.clone(), dims_b.clone(), {})
    metrics = PackingMetrics()
    c_s, m_s, sup = stabilize_packing(noisy, dims_b, placed_mask, metrics)
    ur = metrics.calculate_UR(c_s, dims_b, m_s)
    placed = metrics.calculate_items_placed(m_s)
    return int(placed.max()), float(ur.max())

def main():
    print(f"Searching RSD seeds — device={DEVICE}, sample_size={SAMPLE_SIZE}, sampling_steps={SAMPLING_STEPS}")
    model16 = load_model("ckpt/16_final", "ckpt/16_final/16_final.pth", device=DEVICE)
    model32 = load_model("ckpt/32_final", "ckpt/32_final/32_final.pth", device=DEVICE)
    proj = get_projection_operator("EMS")

    results = {"rsd16": [], "rsd32": []}
    for seed in SEEDS_TO_TRY:
        for n, key, model in [(16, "rsd16", model16), (32, "rsd32", model32)]:
            dims = generate_RSD(n, seed)
            t0 = time.time()
            placed, ur = run_quick(dims, model, proj, seed)
            elapsed = time.time() - t0
            results[key].append((seed, placed, ur, elapsed))
            print(f"  {key} seed={seed:3d}  placed={placed}/{n}  UR={ur:.3f}  ({elapsed:.1f}s)")

    print("\n=== TOP 3 SEEDS ===")
    for key, n in [("rsd16", 16), ("rsd32", 32)]:
        top = sorted(results[key], key=lambda x: (-x[1], -x[2]))[:3]
        print(f"\n{key}:")
        for seed, placed, ur, _ in top:
            print(f"  seed={seed}  placed={placed}/{n}  UR={ur:.3f}")

    best = {k: max(v, key=lambda x: (x[1], x[2]))[0] for k, v in results.items()}
    print(f"\nBest seeds: rsd16={best['rsd16']}  rsd32={best['rsd32']}")
    with open("best_rsd_seeds.json", "w") as f:
        json.dump({"best_rsd16_seed": best["rsd16"], "best_rsd32_seed": best["rsd32"],
                   "all_results": results}, f, indent=2)
    print("Saved best_rsd_seeds.json")

if __name__ == "__main__":
    main()
