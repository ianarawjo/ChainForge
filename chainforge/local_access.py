"""Keep ChainForge's server usable only by ChainForge's own pages.

The server runs Python code sent to it (/app/executepy, custom providers),
returns saved settings and API keys, and fetches URLs on request. Listening on
localhost is not enough to keep that private: a web page from any other site,
open in the same browser, can send requests to localhost. Three checks close
that off:

- Host. A request must be addressed to this machine by an expected name
  (localhost, 127.0.0.1, the --host value or --allowed-hosts). This defeats DNS
  rebinding, where an attacker's domain is made to resolve to 127.0.0.1 so the
  browser treats the attacker's page as the same site as ChainForge.
- Origin. A request a browser marks as coming from another site is refused.
- Session token. Every request, apart from the page itself and its static
  files, must carry a random token created at startup and written into the
  page. Other sites cannot read that page, so they cannot learn the token.

Front-end development against a separate dev server (npm start) is a different
origin, so it is refused unless allowed with --dev-origins.
"""

import hmac
import secrets
from typing import Iterable, List, Optional, Set
from urllib.parse import urlsplit

TOKEN_HEADER = "X-ChainForge-Token"

LOOPBACK_HOSTNAMES = {"localhost", "127.0.0.1", "::1"}

# Bind addresses meaning "every interface" rather than a name to be reached by.
_WILDCARD_BIND_HOSTS = {"", "0.0.0.0", "::"}

_DEFAULT_PORTS = {"http": 80, "https": 443}


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hostname_of(host: str) -> str:
    """The name part of a Host header: 'localhost:8000' -> 'localhost', '[::1]:8000' -> '::1'."""
    host = (host or "").strip().lower()
    if host.startswith("["):
        end = host.find("]")
        return host[1:end] if end != -1 else host
    if host.count(":") == 1:
        host = host.split(":", 1)[0]
    return host.rstrip(".")


def parse_list(value: Optional[str]) -> List[str]:
    """'a, b,,c' -> ['a', 'b', 'c']."""
    return [part.strip() for part in (value or "").split(",") if part.strip()]


def allowed_hostnames(bind_host: str, extra: Iterable[str] = ()) -> Set[str]:
    """The names requests may be addressed to."""
    names = set(LOOPBACK_HOSTNAMES)
    if bind_host and bind_host.strip() not in _WILDCARD_BIND_HOSTS:
        names.add(hostname_of(bind_host))
    names.update(hostname_of(name) for name in extra if name.strip())
    return names


def _site(scheme: str, hostname: Optional[str], port: Optional[int]) -> Optional[str]:
    if not hostname:
        return None
    host = f"[{hostname}]" if ":" in hostname else hostname
    if port is not None and port != _DEFAULT_PORTS.get(scheme):
        host += f":{port}"
    return host


def normalize_origin(origin: Optional[str]) -> Optional[str]:
    """'HTTP://LocalHost:3000/' -> 'http://localhost:3000'. None if not a web origin ('null')."""
    try:
        parts = urlsplit((origin or "").strip())
        site = _site(parts.scheme.lower(), parts.hostname, parts.port)
    except ValueError:
        return None
    if parts.scheme.lower() not in _DEFAULT_PORTS or site is None:
        return None
    return f"{parts.scheme.lower()}://{site}"


def origin_allowed(origin: Optional[str], request_scheme: str, request_host: str,
                   dev_origins: Set[str]) -> bool:
    """Whether a request's Origin header is ChainForge itself, or an allowed dev server.

    No Origin header is allowed: browsers send one with every cross-site request
    that could carry data, and requests without one still need the token. The
    scheme is not compared, so a page on https:// behind a reverse proxy that
    talks to the server over http is still recognised as itself.
    """
    if origin is None:
        return True
    normalized = normalize_origin(origin)
    if normalized is None:
        return False
    if normalized in dev_origins:
        return True
    request_site = normalize_origin(f"{request_scheme}://{request_host}")
    return request_site is not None and normalized.split("://", 1)[1] == request_site.split("://", 1)[1]


def token_valid(presented: Optional[str], expected: str) -> bool:
    return bool(presented) and bool(expected) and hmac.compare_digest(
        presented.encode("utf-8"), expected.encode("utf-8")
    )
