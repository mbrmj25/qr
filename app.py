from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import urllib.parse
import json
import difflib
import webbrowser

HOST = "127.0.0.1"
PORT = 8000

# تحديد مجلد المشروع الحالي
PROJECT_DIR = Path(__file__).resolve().parent

# قاعدة البيانات المدمجة للسيرفر
DATABASE = [
    {"id": 1, "cat": "بلاغة", "title": "سجى دون غيرها", "verse": "﴿وَاللَّيْلِ إِذَا سَجَى﴾", "desc": "اختيار سجى يصور السكون والتغطية الكاملة للظلمة بلطف وراحة تامة.", "source": "سورة الضحى - آية 2"},
    {"id": 2, "cat": "بلاغة", "title": "فعل نشرح", "verse": "﴿أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ﴾", "desc": "استخدام الشرح للتعبير عن السعة والانفساح والطمأنينة الكاملة.", "source": "سورة الشرح - آية 1"},
    {"id": 3, "cat": "علمية", "title": "أصل الحياة", "verse": "﴿وَجَعَلْنَا مِنَ الْمَاءِ كُلَّ شَيْءٍ حَيٍّ﴾", "desc": "ربط حقيقة الحياة بالسائل المائي كأصل لجميع الكائنات الحية.", "source": "سورة الأنبياء - آية 30"},
    {"id": 4, "cat": "علمية", "title": "توسع الكون", "verse": "﴿وَالسَّمَاءَ بَنَيْنَاهَا بِأَيْدٍ وَإِنَّا لَمُوسِعُونَ﴾", "desc": "إشارة بيانية دقيقة لاستمرار اتساع الجرم السماوي والكون.", "source": "سورة الذاريات - آية 47"},
    {"id": 5, "cat": "بلاغة", "title": "الفرق بين جاء وأتى", "verse": "﴿جَاءَ الْحَقُّ وَزَهَقَ الْبَاطِلُ﴾", "desc": "تستعمل جاء للأمور العظيمة الشديدة بينما أتى للأمور اليسيرة.", "source": "سورة الإسراء - آية 81"}
]

class SmartSearchHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # دعم فتح مسار صفحة التحديث الجديد مباشرة
        if parsed_path.path == "/update":
            index_file = PROJECT_DIR / "index.html"
            if index_file.exists():
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(index_file.read_bytes())
                return

        # مسار البحث الذكي
        if parsed_path.path == "/api/search":
            query_params = urllib.parse.parse_qs(parsed_path.query)
            query = query_params.get("q", [""])[0].strip().lower()
            
            results = []
            if not query:
                results = DATABASE
            else:
                titles = [item["title"] for item in DATABASE]
                close_matches = difflib.get_close_matches(query, titles, n=5, cutoff=0.3)
                
                for item in DATABASE:
                    if query in item["title"].lower() or query in item["desc"].lower() or item["title"] in close_matches:
                        results.append(item)
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(json.dumps(results, ensure_ascii=False).encode("utf-8"))
            return

        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

def main():
    server = ThreadingHTTPServer((HOST, PORT), lambda *args, **kwargs: SmartSearchHandler(*args, directory=str(PROJECT_DIR), **kwargs))
    url = f"http://{HOST}:{PORT}"

    print("=" * 55)
    print(" مكتبة اللمسات البيانية القرآنية (خلفية أخضر غامق مريح) ")
    print(f" السيرفر يعمل الآن على الرابط: {url}")
    print(f" رابط صفحة التحديث الإعلانية: {url}/update")
    print(" ميزة بايثون: بحث ذكي يتجاوز نقص الأحرف تلقائياً")
    print(" لإيقاف السيرفر اضغط على Ctrl + C")
    print("=" * 55)

    try:
        webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n تم إيقاف السيرفر بنجاح.")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
