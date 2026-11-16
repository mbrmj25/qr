from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json
import os
import re
import webbrowser

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 8000))
PROJECT_DIR = Path(__file__).resolve().parent

# قاموس تحليل الحروف والأدوات القرآنية في الباك-إند
PARTICLES_DICT = {
    "واو": "حرف عطف يفيد مطلق الجمع والاشتراك، أو واو القسم للتعظيم والتأكيد، أو واو الحال.",
    "في": "حرف جر يفيد الظرفية المكانية أو الزمانية، أو الاستغراق والتمكن في المعنى.",
    "من": "حرف جر يفيد الابتداء، أو التبعيض، أو بيان الجنس.",
    "علي": "حرف جر يفيد الاستعلاء الحسي أو المعنوي والتمكن.",
    "الي": "حرف جر يفيد انتهاء الغاية الزمانية أو المكانية.",
    "ان": "حرف توكيد ونصب ينفي الشك ويثبت الخبر بقوة.",
    "اذا": "ظرف لما يستقبل من الزمان يفيد تحقق الوقوع.",
    "لا": "حرف نفي أو نهي يفيد الترك أو استغراق النفي.",
    "ما": "تأتي نافية، أو موصولة بمعنى الذي، أو استفهامية للتعظيم والتعجب.",
    "قد": "حرف تحقيق وتأكيد إذا دخل على الفعل الماضي."
}


def remove_tashkeel(text: str) -> str:
    text = re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED]", "", text)
    text = re.sub(r"[﴿﴾۝]", "", text)
    text = re.sub(r"[أإآٱ]", "ا", text)
    text = text.replace("ة", "ه").replace("ى", "ي")
    return text.strip()


class QuranLibraryHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def send_json(self, data: dict, status: int = 200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json({
                "status": "ok",
                "service": "لمسات بيانية قرآنية - خادم بايثون",
                "port": PORT
            })
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/analyze":
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                body = json.loads(raw_body)
            except json.JSONDecodeError:
                self.send_json({"error": "Invalid JSON"}, 400)
                return

            verse = body.get("verse", "")
            source = body.get("source", "")
            desc = body.get("desc", "")
            raw_words = re.sub(r"[﴿﴾۝]", "", verse).strip().split()

            breakdown_lines = [
                f"📖 التحليل البياني للآية: {verse}",
                f"📍 المصدر: {source}",
                "",
                "💡 السر البياني العام:",
                desc,
                "",
                "🔍 تفكيك كلمات الآية:"
            ]

            for idx, word in enumerate(raw_words, start=1):
                clean_w = remove_tashkeel(word)
                note = "مفردة محورية تؤدي دلالة دقيقة في سياق الآية."
                if clean_w.startswith("و") and len(clean_w) > 2:
                    note = "مبدوءة بالواو للربط أو القسم، وتضيف بعداً دلالياً للسياق."
                elif clean_w.startswith("ال"):
                    note = "معرّفة بـ (أل) لإفادة العهد أو الاستغراق والشمول."
                elif clean_w in PARTICLES_DICT:
                    note = PARTICLES_DICT[clean_w]
                breakdown_lines.append(f"{idx}. ({word}): {note}")

            self.send_json({"reply": "\n".join(breakdown_lines)})
            return

        self.send_json({"error": "Not Found"}, 404)

    def log_message(self, format, *args):
        print(f"[Server] {self.address_string()} - {format % args}")


def main():
    index_file = PROJECT_DIR / "index.html"
    if not index_file.exists():
        print("تنبيه: تأكد من وجود ملف index.html في نفس مجلد app.py")

    server = ThreadingHTTPServer((HOST, PORT), QuranLibraryHandler)
    url = f"http://127.0.0.1:{PORT}"
    print("=" * 55)
    print(f"السيرفر يعمل الآن بنجاح على الرابط: {url}")
    print("لإيقاف السيرفر اضغط Ctrl + C")
    print("=" * 55)

    if os.environ.get("NO_BROWSER") != "1":
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nتم إيقاف السيرفر بنجاح.")
        server.server_close()


if __name__ == "__main__":
    main()