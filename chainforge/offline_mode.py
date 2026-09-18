"""Offline mode, on ChainForge's server.

In offline mode, prompts, responses and documents stay on this machine or the
local network. The page enforces it for the requests it sends itself
(react-server/src/backend/offlineMode.ts); this module enforces it for requests
the server makes on the page's behalf: proxied fetches, and RAG methods that
call online APIs.

It is on when the server was started with `chainforge serve --offline`, which
the app can't turn off, or when the user turns it on in the app's settings.

Code the user writes (custom providers, Python evaluators) runs as written:
ChainForge can't know where it sends data.
"""

import ipaddress
import socket
from typing import Optional
from urllib.parse import urlsplit

_locked = False
_enabled = False

# RAG methods whose providers are online services, by the setting that picks them.
ONLINE_EMBEDDING_PROVIDERS = {"openai": "OpenAI", "azure-openai": "Azure OpenAI", "cohere": "Cohere"}
ONLINE_RERANKERS = {"cohere_rerank": "Cohere"}

# 100.64.0.0/10 is shared address space, which VPNs like Tailscale use for
# private networks of machines. Python doesn't count it as private.
_SHARED_ADDRESS_SPACE = ipaddress.ip_network("100.64.0.0/10")


def lock(on: bool = True) -> None:
    """Called at startup for --offline: on for everyone, and stays on."""
    global _locked
    _locked = on


def is_locked() -> bool:
    return _locked


def set_enabled(on: bool) -> bool:
    """Turns offline mode on or off, as the app's setting asks. Returns whether it is now on."""
    global _enabled
    _enabled = bool(on)
    return is_offline()


def is_offline() -> bool:
    return _locked or _enabled


def _address_is_local(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])  # drop an IPv6 zone
    except ValueError:
        return False
    if getattr(ip, "ipv4_mapped", None):
        ip = ip.ipv4_mapped
    return (ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_unspecified
            or (ip.version == 4 and ip in _SHARED_ADDRESS_SPACE))


def is_local_hostname(hostname: Optional[str]) -> bool:
    """Whether a hostname is this machine or on a private network.

    Names are resolved, so a name only counts as local if every address it
    resolves to is. A name that doesn't resolve isn't local.
    """
    if not hostname:
        return False
    host = hostname.strip().lower().strip("[]").rstrip(".")
    if host == "localhost" or host.endswith(".localhost"):
        return True
    if _address_is_local(host):
        return True
    try:
        ipaddress.ip_address(host.split("%", 1)[0])
        return False  # a public IP address
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError, OSError):
        return False
    addresses = {info[4][0] for info in infos}
    return bool(addresses) and all(_address_is_local(a) for a in addresses)


def is_local_url(url: str) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    if parts.scheme not in ("http", "https"):
        return False
    return is_local_hostname(parts.hostname)


def block_reason_for_url(url: str) -> Optional[str]:
    """Why the server may not send a request to this URL, or None if it may."""
    if not is_offline() or is_local_url(url):
        return None
    host = urlsplit(url).hostname or url
    return (f"Offline mode is on, so ChainForge did not send a request to {host}. "
            "Turn off offline mode in Settings to use online services.")


def block_reason_for_embedding_provider(provider: Optional[str]) -> Optional[str]:
    name = ONLINE_EMBEDDING_PROVIDERS.get(provider or "")
    if not is_offline() or name is None:
        return None
    return (f"Offline mode is on, so {name} embeddings can't be used: they would send your "
            f"documents to {name}. Use a local embedding model (e.g. HuggingFace, Sentence "
            "Transformers or Ollama), or turn off offline mode in Settings.")


def block_reason_for_reranker(method: Optional[str]) -> Optional[str]:
    name = ONLINE_RERANKERS.get(method or "")
    if not is_offline() or name is None:
        return None
    return (f"Offline mode is on, so {name} reranking can't be used: it would send your "
            f"documents to {name}. Use a local reranker, or turn off offline mode in Settings.")
