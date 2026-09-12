"""Keeps FAISS and PyTorch from crashing each other over OpenMP.

FAISS and PyTorch each bundle their own OpenMP runtime. With both loaded and
threaded in one process, the process dies: on an install with both, the test
suite segfaults partway through tests/test_retrievers.py, while the identical
suite passes on an otherwise identical install without FAISS. It is not a
ChainForge bug and there is nothing to fix in our code -- upstream has closed
the same class of FAISS/PyTorch interaction more than once without a fix
(facebookresearch/faiss#4273, #2765).

Confining OpenMP to a single thread avoids it. That has to happen before
either library is imported, because the runtimes read the setting when they
initialize -- which is why this module exists at all, and why
`chainforge/__init__.py` runs it before importing anything else.

Two things that look like fixes and are not:
  * KMP_DUPLICATE_LIB_OK=TRUE, the usual advice, still segfaults. It only
    silences the duplicate-runtime check; the crash is downstream of that.
  * faiss.omp_set_num_threads(1) is worse than nothing: calling it imports
    FAISS, initializing the very runtime the setting was meant to keep out of
    the way, and the process aborts instead.

The cost is that PyTorch also ends up single-threaded, so embedding is slower.
That only applies to installs that actually have FAISS, and a slower embedding
call beats a server that disappears mid-request. Anyone who would rather make
that trade differently can set OMP_NUM_THREADS themselves and this defers.
"""

import os
from importlib.util import find_spec

#: True when this module set OMP_NUM_THREADS, so the CLI can say why.
limited_openmp_for_faiss = False


def limit_openmp_if_faiss_present() -> bool:
    """Pins OpenMP to one thread when FAISS is installed alongside PyTorch.

    Returns whether the limit was applied. Safe to call more than once.
    """
    global limited_openmp_for_faiss

    # An explicit choice wins; someone who set this has already decided.
    if os.environ.get("OMP_NUM_THREADS"):
        return False

    # find_spec locates FAISS without executing it. Importing it here would
    # load the runtime this function exists to keep dormant.
    try:
        faiss_installed = find_spec("faiss") is not None
        torch_installed = find_spec("torch") is not None
    except (ImportError, ValueError):
        # A broken or partially removed distribution; nothing to protect.
        return False

    if not (faiss_installed and torch_installed):
        return False

    os.environ["OMP_NUM_THREADS"] = "1"
    limited_openmp_for_faiss = True
    return True
