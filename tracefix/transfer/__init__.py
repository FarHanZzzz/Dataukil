"""Stalled bank-to-wallet add-money investigation (additive to the legacy QR workflow)."""
import asyncio
import os

# Importing these modules registers every scheduled step handler with the engine.
from . import engine, investigation, correction, report  # noqa: F401
from .catalog import FAMILY
from .routes import router


def start_ticker():
    """Starts the synthetic-clock ticker unless disabled (tests drive the clock explicitly with `engine.advance`)."""
    if os.environ.get('TRACEFIX_SIM_TICKER', '1') == '0':
        return None
    return asyncio.create_task(engine.ticker())


async def stop_ticker(task):
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


__all__ = ['FAMILY', 'router', 'start_ticker', 'stop_ticker']
