"""Which device local PyTorch models (embedders, cross-encoders) run on.

The fastest one available: an NVIDIA GPU (CUDA), else Apple silicon's GPU
(MPS), else the CPU. Set CHAINFORGE_TORCH_DEVICE (e.g. to "cpu", "cuda:1" or
"mps") to choose one yourself.
"""
import os
import sys

DEVICE_ENV_VAR = "CHAINFORGE_TORCH_DEVICE"


# Models that failed on the GPU, which run on the CPU from then on
_failed_on_gpu = set()


def torch_device(model: str = "") -> str:
    """The device to run `model` on: the CPU if it failed on the GPU before."""
    if model and model in _failed_on_gpu:
        return "cpu"
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


def fall_back_to_cpu(what: str, model: str, device: str, error: Exception) -> None:
    """Notes that `model` failed on `device`, so it runs on the CPU from now on
    rather than failing on the GPU first every time."""
    _failed_on_gpu.add(model)
    print(f"{what} with {model} failed on {device} ({type(error).__name__}: {error}); using the CPU "
          f"for it from now on. Set {DEVICE_ENV_VAR}=cpu to always use the CPU.", file=sys.stderr)
