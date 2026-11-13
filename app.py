from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

HOST = "127.0.0.1"
PORT = 8000
PROJECT_DIR = Path(__file__).resolve().parent

def main():
    server = ThreadingHTTPServer((HOST, PORT), lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=str(PROJECT_DIR), **kwargs))
    url = f"http://{HOST}:{PORT}"
    print(f"السيرفر يعمل الآن بسرعة فائقة: {url}")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

if __name__ == "__main__":
    main()