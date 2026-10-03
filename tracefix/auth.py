"""Session lookup shared by the legacy routes and the add-money routes.

A request authenticates with either an `Authorization: Bearer <opaque token>` header (per-tab fixture sessions, so a
customer tab and an admin tab never overwrite each other) or the legacy `tracefix_session` cookie. Roles and
ownership are always checked on the server; nothing is authorized from a URL or a browser-side role flag.
"""
from fastapi import HTTPException, Request

from . import store
from .domain import now


def token_of(request: Request) -> str:
    legacy_header = request.headers.get('X-TraceFix-Session')
    if legacy_header:
        return legacy_header
    h = request.headers.get('authorization', '')
    if h[:7].lower() == 'bearer ':
        return h[7:].strip()
    return request.cookies.get('tracefix_session', '')


def read_session(request: Request) -> dict:
    token = token_of(request)
    with store.connect() as db:
        r = db.execute('SELECT * FROM sessions WHERE token=?', (token,)).fetchone()
    if not r or r['expires'] < now():
        raise HTTPException(401, 'Choose a predefined demo session first.')
    return dict(r)
