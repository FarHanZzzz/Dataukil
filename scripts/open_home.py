"""Open the homepage once the foreground server is ready; exit after a bounded wait."""
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser


def open_when_ready(url, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return webbrowser.open(url, new=2)
        except (URLError, OSError):
            pass
        time.sleep(0.25)
    return False


if __name__ == '__main__':
    open_when_ready(sys.argv[1])
