# Measuring the energy local models use

ChainForge measures the energy each request to a local model (Ollama) takes,
on the machine running ChainForge, from the hardware's own energy counters.
It counts only energy *above idle power*, over the time the model was loading
or generating (see `attribution.py` for how, and `monitor.py` for when it
reads the counters).

## What can be measured where

| Machine | GPU | CPU | Memory | Needs |
| --- | --- | --- | --- | --- |
| Apple silicon Mac | ✓ | ✓ | ✓ | nothing |
| Windows PC, NVIDIA GPU | ✓ (each GPU) | — | — | the NVIDIA driver |
| Linux PC, NVIDIA GPU | ✓ (each GPU) | ✓ Intel/AMD, once allowed (below) | server CPUs | the NVIDIA driver |
| Linux PC, no NVIDIA GPU | — | ✓ Intel/AMD, once allowed (below) | server CPUs | |

- **NVIDIA GPUs** are read through NVML, which the NVIDIA driver installs
  (the library `nvidia-smi` uses). GPUs from 2017 on (Volta and newer) have an
  energy counter; older ones only report power, which is added up over time
  and is coarser.
- **Windows doesn't let programs read the CPU's energy counters** without
  installing a kernel driver, so on Windows only the GPUs are measured. With a
  model fully on the GPU, that's most of the energy it takes; each
  measurement says "GPU only".
- **AMD GPUs** aren't measured yet.

## Letting ChainForge measure the CPU on Linux

Linux keeps the CPU's energy counters (RAPL) readable only by root, since
2020: finely-timed power readings can leak secrets from other programs (the
"Platypus" attack). On a machine only you and people you trust use, you can
make them readable for everyone:

```bash
sudo chmod a+r /sys/class/powercap/intel-rapl:*/energy_uj /sys/class/powercap/intel-rapl:*:*/energy_uj
```

This lasts until the next reboot. To keep it, add a systemd tmpfiles rule:

```bash
echo 'z /sys/class/powercap/intel-rapl:*/energy_uj 0444 - - -
z /sys/class/powercap/intel-rapl:*:*/energy_uj 0444 - - -' | sudo tee /etc/tmpfiles.d/chainforge-rapl.conf
```

Then restart ChainForge. (AMD CPUs use the same `intel-rapl` files, from
Linux 5.8 on.)

## What's recorded with each measurement

- **Power settings**: the power source, the power plan (Windows) or power
  profile (Linux), and each GPU's power limit where it's been lowered. These
  change how much energy the same work takes, so idle power is measured
  afresh when they change, and the Vis Node says when measurements it plots
  were taken under different ones.
- **Other programs using the GPU**: another program using the GPU during a
  request (an image generation in ComfyUI, a game) adds its energy to the
  request's measurement. ChainForge checks about once a second which
  programs are using the GPU (on Windows, through the counters Task Manager
  shows; on Linux, through NVML), flags the requests they overlapped, and
  leaves those times out of idle power. The model server itself, ChainForge
  and the desktop's compositor don't count, nor does light use (under 5%),
  nor a browser's use under 30% (it draws ChainForge's own page), nor
  processes whose names can't be read (e.g. in another container, where
  Ollama may be). Only programs' names are recorded, not their arguments.
- **Heat**: whether the GPU was slowed down by heat at any point during the
  request, not only at its start.

## Checking a machine: `energy_probe.py`

`energy_probe.py` checks what a machine can measure, without installing
ChainForge: it's one file, needing only Python 3.8 or newer. It reads the
counters, measures idle power, runs a short test with Ollama (if it's
running), compares NVML's readings with `nvidia-smi`'s, and can watch which
programs use the GPU. It writes a report, `energy_probe_report.json`.

```bash
python energy_probe.py --watch 60
```

Keep it standalone (standard library only, no ChainForge imports), so it can
be sent on its own.
