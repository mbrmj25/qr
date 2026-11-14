import { useEffect, useMemo, useRef, useState } from "react";
import { LocalAiPanel } from "./components/LocalAiPanel";
import { VerseCard } from "./components/VerseCard";
import { VerseModal } from "./components/VerseModal";
import { normalizeArabic, VERSES_DATA } from "./data/verses";
import { ActivePage, AppTheme, VerseCategory, VerseItem } from "./types";

const SAVED_KEY = "quran_saved_items";
const THEME_KEY = "quran_theme";
const FONT_SIZE_KEY = "quran_verse_size";

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem(THEME_KEY) as AppTheme | null;
    if (saved === "classic" || saved === "red" || saved === "blue") {
      return saved;
    }
    return "classic";
  });

  const [verseSize, setVerseSize] = useState<number>(() => {
    const parsed = parseInt(localStorage.getItem(FONT_SIZE_KEY) || "23", 10);
    return Number.isFinite(parsed) ? Math.min(34, Math.max(16, parsed)) : 23;
  });

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const scale =
      verseSize <= 23
        ? 0.85 + ((verseSize - 16) / 7) * 0.15
        : 1 + ((verseSize - 23) / 11) * 0.45;
    document.documentElement.style.setProperty("--verse-size", `${verseSize}px`);
    document.documentElement.style.setProperty("--text-scale", scale.toFixed(3));
    localStorage.setItem(FONT_SIZE_KEY, String(verseSize));
  }, [verseSize]);

  const [activePage, setActivePage] = useState<ActivePage>("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCat, setActiveCat] = useState<"all" | VerseCategory>("all");
  const [savedSearchQuery, setSavedSearchQuery] = useState("");

  const [savedItems, setSavedItems] = useState<VerseItem[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      return raw ? (JSON.parse(raw) as VerseItem[]) : [];
    } catch {
      return [];
    }
  });
  const [confirmClearSaved, setConfirmClearSaved] = useState(false);

  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedItems));
  }, [savedItems]);

  const [modalItem, setModalItem] = useState<VerseItem | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRequestedItem, setAiRequestedItem] = useState<VerseItem | null>(null);
  const [aiResetSignal, setAiResetSignal] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<number | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function showToast(msg: string) {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2800);
  }

  function showMainPage(anchorId = "") {
    setActivePage("main");
    setConfirmClearSaved(false);
    if (anchorId) {
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" });
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function showSavedPage() {
    setActivePage("saved");
    setConfirmClearSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSettingsPage() {
    setActivePage("settings");
    setConfirmClearSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const savedIds = useMemo(
    () => new Set(savedItems.map((i) => i.id)),
    [savedItems]
  );

  const filteredVerses = useMemo(() => {
    const q = normalizeArabic(searchQuery.toLowerCase());
    return VERSES_DATA.filter((item) => {
      const matchesCat = activeCat === "all" || item.cat === activeCat;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        normalizeArabic(item.title.toLowerCase()).includes(q) ||
        normalizeArabic(item.verse.toLowerCase()).includes(q)
      );
    });
  }, [searchQuery, activeCat]);

  const filteredSavedItems = useMemo(() => {
    const q = normalizeArabic(savedSearchQuery.toLowerCase());
    if (!q) return savedItems;
    return savedItems.filter(
      (item) =>
        normalizeArabic(item.title.toLowerCase()).includes(q) ||
        normalizeArabic(item.verse.toLowerCase()).includes(q)
    );
  }, [savedItems, savedSearchQuery]);

  function handleToggleSave(item: VerseItem) {
    setSavedItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        showToast("تمت الإزالة من المحفوظات");
        return prev.filter((i) => i.id !== item.id);
      } else {
        showToast("تم حفظ الآية في السلة");
        return [...prev, item];
      }
    });
  }

  async function handleCopy(item: VerseItem) {
    const text = `${item.verse}\n[${item.source}]\n\n💡 اللمسة البيانية (${item.title}):\n${item.desc}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("تم نسخ الآية واللمسة بنجاح");
    } catch {
      showToast("تعذر النسخ التلقائي");
    }
  }

  async function handleShare(item: VerseItem) {
    const text = `${item.verse}\n[${item.source}]\n\n💡 اللمسة البيانية (${item.title}):\n${item.desc}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text });
        return;
      } catch {
        // ignore cancel
      }
    }
    await handleCopy(item);
    showToast("تم النسخ للمشاركة");
  }

  function handlePlayAudio(item: VerseItem) {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingId === item.id && !audio.paused) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    const url = `https://everyayah.com/data/Alafasy_128kbps/${String(
      item.surah
    ).padStart(3, "0")}${String(item.ayah).padStart(3, "0")}.mp3`;

    setLoadingAudioId(item.id);
    audio.src = url;
    audio
      .play()
      .then(() => {
        setLoadingAudioId(null);
        setPlayingId(item.id);
      })
      .catch(() => {
        setLoadingAudioId(null);
        setPlayingId(null);
        showToast("تعذر تشغيل التلاوة، تحقق من الاتصال");
      });
  }

  function handleAskAiAboutAyah(item: VerseItem) {
    setAiRequestedItem(item);
    setAiOpen(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Header - Centered on mobile, balanced 3-zone on laptop */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col md:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5">
          <button
            type="button"
            onClick={() => showMainPage()}
            className="text-xl sm:text-2xl font-extrabold text-[var(--text)] cursor-pointer whitespace-nowrap shrink-0"
          >
            لمسات <span className="font-light text-[var(--gray)]">بيانية</span>
          </button>

          <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-sm">
            <button
              type="button"
              onClick={() => showMainPage("home")}
              className={`rounded-md border px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activePage === "main"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
              }`}
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => showMainPage("library")}
              className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              المكتبة
            </button>
            <button
              type="button"
              onClick={showSavedPage}
              className={`rounded-md border px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                activePage === "saved"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
              }`}
            >
              المحفوظات ({savedItems.length})
            </button>
            <button
              type="button"
              onClick={showSettingsPage}
              className={`rounded-md border px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activePage === "settings"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
              }`}
            >
              ⚙️ الإعدادات
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {activePage === "main" && (
          <>
            {/* Centered Hero */}
            <section
              id="home"
              className="mx-auto max-w-4xl px-4 sm:px-6 pt-12 pb-8 sm:pt-20 sm:pb-12 text-center"
            >
              <span className="inline-block text-scaled-sm text-[var(--gray)] tracking-wide">
                مكتبة عجائب القرآن - الإصدار الذكي المتقدم
              </span>
              <h1 className="mt-3 sm:mt-4 text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-snug text-[var(--text)] [text-wrap:balance]">
                مكتبة اللمسات البيانية وتحليل الحروف والكلمات
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-scaled-base text-[var(--gray)]">
                ذكاء اصطناعي فائق مصمم لفهم كل حرف وكلمة في القرآن الكريم بدقة
                متناهية مع تلاوة صوتية وتخصيص كامل للألوان وحجم الخط.
              </p>
              <div className="mt-7 flex justify-center">
                <button
                  type="button"
                  onClick={() => showMainPage("library")}
                  className="rounded-lg border border-[var(--accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-7 py-3 text-scaled-base font-bold text-white transition-colors cursor-pointer"
                >
                  تصفح المكتبة (100 آية)
                </button>
              </div>
            </section>

            {/* Centered Library Section */}
            <section
              id="library"
              className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12"
            >
              <div className="text-center mb-7">
                <span className="block text-scaled-xs font-bold text-[var(--gray)]">
                  01 / المكتبة الشاملة
                </span>
                <h2 className="mt-1.5 text-scaled-2xl font-extrabold text-[var(--text)]">
                  عجائب ولمسات بيانية (100 آية قرآنية)
                </h2>
              </div>

              {/* Centered Search & Categories */}
              <div className="mx-auto max-w-3xl mb-6">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم السورة، الآية، أو اللمسة البيانية..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3.5 text-scaled-base text-[var(--text)] placeholder:text-[var(--gray)] text-center focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8">
                {(
                  [
                    { key: "all", label: "الكل (100)" },
                    { key: "بلاغة", label: "بلاغة ودقة لفظية" },
                    { key: "علمية", label: "معجزات علمية وتأملات" },
                    { key: "عددي", label: "تناسق ونظم" },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCat(cat.key)}
                    className={`rounded-lg border px-3.5 sm:px-4 py-2 text-scaled-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      activeCat === cat.key
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--gray)] hover:border-[var(--accent)] hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {filteredVerses.length === 0 ? (
                <p className="py-12 text-center text-scaled-base text-[var(--gray)]">
                  لم نعثر على نتائج مطابقة لبحثك.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredVerses.map((item) => (
                    <VerseCard
                      key={item.id}
                      item={item}
                      isSaved={savedIds.has(item.id)}
                      isPlaying={playingId === item.id}
                      isLoadingAudio={loadingAudioId === item.id}
                      onReadMore={(v) => setModalItem(v)}
                      onToggleSave={handleToggleSave}
                      onCopy={handleCopy}
                      onShare={handleShare}
                      onPlayAudio={handlePlayAudio}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Saved Page */}
        {activePage === "saved" && (
          <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
            <div className="text-center mb-8 space-y-3">
              <span className="block text-scaled-xs font-bold text-[var(--gray)]">
                المفضلة
              </span>
              <h2 className="text-scaled-2xl font-extrabold text-[var(--text)]">
                سلة المحفوظات والآيات المحفوظة
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {savedItems.length > 0 && !confirmClearSaved && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearSaved(true)}
                    className="rounded-md border border-[#dc3545] bg-[rgba(220,53,69,0.15)] px-4 py-2 text-scaled-sm font-bold text-[#ff8a95] hover:bg-[#dc3545] hover:text-white transition-colors cursor-pointer"
                  >
                    مسح جميع المحفوظات
                  </button>
                )}

                {confirmClearSaved && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSavedItems([]);
                        setConfirmClearSaved(false);
                        showToast("تم مسح المحفوظات بنجاح");
                      }}
                      className="rounded-md bg-[#dc3545] px-4 py-2 text-scaled-sm font-bold text-white cursor-pointer"
                    >
                      تأكيد المسح
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearSaved(false)}
                      className="rounded-md border border-[var(--border)] px-4 py-2 text-scaled-sm font-bold text-[var(--text)] cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => showMainPage()}
                  className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-scaled-sm font-bold text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                >
                  العودة للرئيسية
                </button>
              </div>
            </div>

            {savedItems.length > 0 && (
              <div className="mx-auto max-w-3xl mb-7">
                <input
                  type="search"
                  value={savedSearchQuery}
                  onChange={(e) => setSavedSearchQuery(e.target.value)}
                  placeholder="ابحث داخل الآيات المحفوظة..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3.5 text-scaled-base text-[var(--text)] placeholder:text-[var(--gray)] text-center focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            )}

            {savedItems.length === 0 ? (
              <p className="py-12 text-center text-scaled-base text-[var(--gray)]">
                سلة المحفوظات فارغة حالياً.
              </p>
            ) : filteredSavedItems.length === 0 ? (
              <p className="py-12 text-center text-scaled-base text-[var(--gray)]">
                لا توجد نتائج مطابقة لبحثك في المحفوظات.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredSavedItems.map((item) => (
                  <VerseCard
                    key={item.id}
                    item={item}
                    isSaved={true}
                    isPlaying={playingId === item.id}
                    isLoadingAudio={loadingAudioId === item.id}
                    onReadMore={(v) => setModalItem(v)}
                    onToggleSave={handleToggleSave}
                    onCopy={handleCopy}
                    onShare={handleShare}
                    onPlayAudio={handlePlayAudio}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Black & White Luxury Settings Page (Centered) */}
        {activePage === "settings" && (
          <section className="min-h-[82vh] bg-white text-black px-4 sm:px-6 py-10 sm:py-14">
            <div className="mx-auto max-w-2xl text-center">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
                <h2 className="text-scaled-2xl font-extrabold text-black">
                  إعدادات النظام
                </h2>
                <button
                  type="button"
                  onClick={() => showMainPage()}
                  className="rounded-md border-2 border-black bg-white px-4 py-2 text-scaled-sm font-bold text-black hover:bg-black hover:text-white transition-colors cursor-pointer"
                >
                  ← العودة للرئيسية
                </button>
              </div>

              <p className="text-scaled-base text-[#444] mb-8">
                تحكم في مظهر التطبيق، حجم خط الآيات والشرح وكلام المساعد، وثيم الألوان المفضل لديك.
              </p>

              <div className="rounded-xl border-2 border-black bg-[#f8f9fa] p-5 sm:p-7 shadow-[6px_6px_0px_#000000] space-y-7 text-center">
                <div className="space-y-3">
                  <label className="block text-scaled-base font-bold text-black">
                    🎨 اختر ثيم الألوان:
                  </label>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                    {(
                      [
                        { id: "classic", label: "1. الكلاسيكي (الأخضر)" },
                        { id: "red", label: "2. الأحمر الغامق الهادئ" },
                        { id: "blue", label: "3. الأزرق الجميل" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTheme(t.id);
                          showToast("تم تطبيق الثيم بنجاح");
                        }}
                        className={`rounded-md border-2 border-black px-4 py-2.5 text-scaled-sm font-bold transition-colors cursor-pointer ${
                          theme === t.id
                            ? "bg-black text-white"
                            : "bg-white text-black hover:bg-neutral-100"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 border-t border-[#ddd] pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="verseSizeSlider"
                      className="text-scaled-base font-bold text-black text-right"
                    >
                      🔤 حجم الخط (الآيات والشرح والـ AI):
                    </label>
                    <span className="tabular-nums rounded-md border-2 border-black bg-white px-3 py-1 text-sm font-extrabold text-black shrink-0">
                      {verseSize}px
                    </span>
                  </div>

                  <div className="flex items-center gap-3 px-1">
                    <span className="tabular-nums text-xs font-bold text-[#555] shrink-0">
                      16px
                    </span>
                    <input
                      id="verseSizeSlider"
                      type="range"
                      min={16}
                      max={34}
                      step={1}
                      value={verseSize}
                      onChange={(e) => setVerseSize(Number(e.target.value))}
                      className="w-full h-2.5 rounded-lg appearance-none bg-neutral-300 border border-black accent-black cursor-pointer"
                    />
                    <span className="tabular-nums text-xs font-bold text-[#555] shrink-0">
                      34px
                    </span>
                  </div>

                  <div className="rounded-lg border border-black/20 bg-white px-4 py-3 text-center space-y-1.5">
                    <p className="font-quran text-black leading-relaxed">
                      ﴿وَاللَّيْلِ إِذَا سَجَى﴾
                    </p>
                    <p className="text-scaled-sm text-[#444]">
                      اختيار لفظ سجى يصور السكون والتغطية الكاملة للظلمة بلطف وراحة تامة.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-[#ddd] pt-6">
                  <label className="block text-scaled-base font-bold text-black">
                    ⚡ ذكاء الاصطناعي (AI):
                  </label>
                  <p className="text-scaled-sm text-[#444]">
                    المساعد مبرمج لتعليم كل حرف قرآني وتقديم ردود تفاعلية قوية جداً.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAiResetSignal((s) => s + 1);
                      showToast("تم إعادة ضبط ذاكرة المساعد الذكي");
                    }}
                    className="rounded-md border-2 border-black bg-white px-5 py-2.5 text-scaled-sm font-bold text-black hover:bg-black hover:text-white transition-colors cursor-pointer"
                  >
                    إعادة تعيين ذاكرة المساعد
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--card-bg)] py-9 px-4 sm:px-6 text-center mt-10">
        <div className="text-scaled-lg font-extrabold text-[var(--text)] mb-1">
          لمسات بيانية قرآنية
        </div>
        <p className="text-scaled-sm text-[var(--gray)]">
          مكتبة عجائب القرآن الكريم - الإصدار الذكي المتقدم
        </p>
      </footer>

      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onError={() => {
          setLoadingAudioId(null);
          setPlayingId(null);
        }}
      />

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-[var(--accent)] bg-[var(--card-bg)] px-5 py-2.5 text-xs sm:text-sm font-bold text-[var(--text)] shadow-xl whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {/* Scroll To Top (Left) */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        title="العودة للأعلى"
        aria-label="العودة للأعلى"
        className={`fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center border-2 border-[var(--border)] bg-[var(--card-bg)] text-lg sm:text-xl font-bold text-[var(--text)] shadow-[4px_4px_0px_var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all duration-300 cursor-pointer ${
          showScrollTop
            ? "opacity-100 translate-y-0 scale-100 visible"
            : "opacity-0 translate-y-6 scale-75 invisible"
        }`}
      >
        ↑
      </button>

      {/* Original AI Toggle Button (Right) */}
      <button
        type="button"
        onClick={() => setAiOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 border-2 border-[var(--accent)] bg-[var(--card-bg)] px-3.5 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-[var(--text)] shadow-[4px_4px_0px_var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all cursor-pointer whitespace-nowrap"
      >
        <span>⚡</span>
        <span>المساعد الذكي AI</span>
      </button>

      {/* Original Local AI Panel */}
      <LocalAiPanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        requestedItem={aiRequestedItem}
        onConsumeRequestedItem={() => setAiRequestedItem(null)}
        resetSignal={aiResetSignal}
        onShowToast={showToast}
      />

      {/* Article Modal */}
      <VerseModal
        item={modalItem}
        isPlaying={modalItem ? playingId === modalItem.id : false}
        isLoadingAudio={modalItem ? loadingAudioId === modalItem.id : false}
        onClose={() => setModalItem(null)}
        onCopy={handleCopy}
        onShare={handleShare}
        onPlayAudio={handlePlayAudio}
        onAskAi={handleAskAiAboutAyah}
      />
    </div>
  );
}
