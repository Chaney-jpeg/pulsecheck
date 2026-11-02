"""
SSRF defence helpers.

Blocks requests to private, loopback, link-local, and multicast addresses,
as well as hostnames that resolve to such addresses.
"""
import ipaddress
import re
import socket
from urllib.parse import urlparse

# Networks that must never be targeted
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),        # unique local IPv6
    ipaddress.ip_network("fe80::/10"),       # link-local IPv6
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),   # CGNAT
    ipaddress.ip_network("240.0.0.0/4"),     # reserved
]

_BLOCKED_HOSTNAME_RE = re.compile(
    r"^(localhost|.*\.local|.*\.internal|.*\.intranet)$", re.IGNORECASE
)


def _is_blocked_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast or ip.is_reserved or any(
        ip in net for net in _BLOCKED_NETWORKS
    )


def validate_url_for_ssrf(url: str) -> None:
    """
    Raise ValueError if the URL targets a private or otherwise blocked host.
    Call this before issuing outbound HTTP requests.
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""

    if not host:
        raise ValueError("URL has no host")

    if _BLOCKED_HOSTNAME_RE.match(host):
        raise ValueError(f"Host '{host}' is not allowed (blocked hostname pattern)")

    # If it's already an IP literal, check it directly
    if _is_blocked_ip(host):
        raise ValueError(f"Host '{host}' resolves to a blocked address")

    # Resolve the hostname and check all returned addresses
    try:
        results = socket.getaddrinfo(host, parsed.port or 80, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host '{host}': {exc}") from exc

    for _family, _type, _proto, _canonname, sockaddr in results:
        ip_str = sockaddr[0]
        if _is_blocked_ip(ip_str):
            raise ValueError(
                f"Host '{host}' resolves to blocked address '{ip_str}'"
            )
