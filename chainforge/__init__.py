# Must run before anything imports torch or faiss: the OpenMP runtimes read
# their thread setting when they initialize, so this is the only point at
# which it can still be changed. See chainforge/_openmp.py.
from ._openmp import limit_openmp_if_faiss_present

limit_openmp_if_faiss_present()

from .app import main
