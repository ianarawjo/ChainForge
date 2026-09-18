"""Which device local PyTorch models (embedders, cross-encoders) run on.

The fastest one available: an NVIDIA GPU (CUDA), else Apple silicon's GPU
(MPS), else the CPU. Set CHAINFORGE_TORCH_DEVICE (e.g. to "cpu", "cuda:1" or
"mps") to choose one yourself.
"""
import os
import sys

DEVICE_ENV_VAR = "CHAINFORGE_TORCH_DEVICE"


def torch_device() -> str:
    override = os.environ.get(DEVICE_ENV_VAR, "").strip()
    if override:
        return override
    try:
        import torch
    except ImportError:
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def warn_falling_back_to_cpu(what: str, device: str, error: Exception) -> None:
    print(f"{what} failed on {device} ({type(error).__name__}: {error}); retrying on the CPU. "
          f"Set {DEVICE_ENV_VAR}=cpu to always use the CPU.", file=sys.stderr)
