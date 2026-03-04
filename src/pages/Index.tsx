import { useState, useCallback, useRef, useEffect } from "react";
import { convert, detectDirection, Direction } from "@/lib/uzbek-converter";
import { readFile, downloadAsFormat, convertXlsxFile, DownloadFormat } from "@/lib/file-handler";
import { translateWithApi } from "@/lib/ai-translator";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeftRight,
  Copy,
  Check,
  Trash2,
  Upload,
  Download,
  FileText,
  X,
  ChevronDown,
  Sparkles,
  LogIn,
  UserCircle2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type AppMenu = "converter" | "translator";
type LanguageOption = {
  value: string;
  label: string;
};

type AuthProfile = {
  provider: "google" | "email";
  label: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
};

type GoogleOauth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
  }) => GoogleTokenClient;
};

type GoogleAccounts = {
  oauth2: GoogleOauth2;
};

type WindowWithGoogle = Window & {
  google?: {
    accounts: GoogleAccounts;
  };
};

const STORAGE_KEYS = {
  auth: "alifgo_auth",
};

const OPENROUTER_API_KEY = (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined)?.trim() || "";

const FORMATS: { value: DownloadFormat; label: string }[] = [
  { value: "txt", label: ".txt" },
  { value: "docx", label: ".docx" },
  { value: "xlsx", label: ".xlsx" },
];

const TARGET_LANGUAGES: LanguageOption[] = [
  { value: "Uzbek (Latin)", label: "Uzbek (Latin)" },
  { value: "Uzbek (Cyrillic)", label: "Uzbek (Cyrillic)" },
  { value: "English", label: "English" },
  { value: "Russian", label: "Russian" },
  { value: "Turkish", label: "Turkish" },
  { value: "Arabic", label: "Arabic" },
  { value: "Azerbaijani", label: "Azerbaijani" },
  { value: "Bengali", label: "Bengali" },
  { value: "Bulgarian", label: "Bulgarian" },
  { value: "Chinese (Simplified)", label: "Chinese (Simplified)" },
  { value: "Chinese (Traditional)", label: "Chinese (Traditional)" },
  { value: "Czech", label: "Czech" },
  { value: "Danish", label: "Danish" },
  { value: "Dutch", label: "Dutch" },
  { value: "Estonian", label: "Estonian" },
  { value: "Finnish", label: "Finnish" },
  { value: "French", label: "French" },
  { value: "Georgian", label: "Georgian" },
  { value: "German", label: "German" },
  { value: "Greek", label: "Greek" },
  { value: "Hebrew", label: "Hebrew" },
  { value: "Hindi", label: "Hindi" },
  { value: "Hungarian", label: "Hungarian" },
  { value: "Indonesian", label: "Indonesian" },
  { value: "Italian", label: "Italian" },
  { value: "Japanese", label: "Japanese" },
  { value: "Kazakh", label: "Kazakh" },
  { value: "Korean", label: "Korean" },
  { value: "Kyrgyz", label: "Kyrgyz" },
  { value: "Latvian", label: "Latvian" },
  { value: "Lithuanian", label: "Lithuanian" },
  { value: "Malay", label: "Malay" },
  { value: "Mongolian", label: "Mongolian" },
  { value: "Norwegian", label: "Norwegian" },
  { value: "Persian", label: "Persian" },
  { value: "Polish", label: "Polish" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Romanian", label: "Romanian" },
  { value: "Serbian", label: "Serbian" },
  { value: "Slovak", label: "Slovak" },
  { value: "Slovenian", label: "Slovenian" },
  { value: "Spanish", label: "Spanish" },
  { value: "Swedish", label: "Swedish" },
  { value: "Tajik", label: "Tajik" },
  { value: "Tamil", label: "Tamil" },
  { value: "Thai", label: "Thai" },
  { value: "Turkmen", label: "Turkmen" },
  { value: "Ukrainian", label: "Ukrainian" },
  { value: "Urdu", label: "Urdu" },
  { value: "Vietnamese", label: "Vietnamese" },
];

const SOURCE_LANGUAGES: LanguageOption[] = [
  { value: "Auto-detect", label: "Auto-detect" },
  ...TARGET_LANGUAGES,
];

const Index = () => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  const [activeMenu, setActiveMenu] = useState<AppMenu>("translator");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [input, setInput] = useState("");
  const [direction, setDirection] = useState<Direction>("cyr2lat");
  const [copied, setCopied] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string; file: File } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("txt");
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceLanguage, setSourceLanguage] = useState("Auto-detect");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [translateInput, setTranslateInput] = useState("");
  const [translateOutput, setTranslateOutput] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const output = convert(input, direction);

  useEffect(() => {
    const rawAuth = localStorage.getItem(STORAGE_KEYS.auth);
    if (rawAuth) {
      try {
        setAuthProfile(JSON.parse(rawAuth) as AuthProfile);
      } catch {
        localStorage.removeItem(STORAGE_KEYS.auth);
      }
    }
  }, []);

  useEffect(() => {
    if (!googleClientId) return;
    const maybeGoogle = (window as WindowWithGoogle).google;
    if (maybeGoogle?.accounts?.oauth2) {
      setGoogleReady(true);
      return;
    }

    const scriptId = "google-oauth-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setGoogleReady(true), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => toast.error("Google kirish kutubxonasi yuklanmadi.");
    document.head.appendChild(script);
  }, [googleClientId]);

  const setLoggedInUser = useCallback((profile: AuthProfile) => {
    setAuthProfile(profile);
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(profile));
    setShowAuthPanel(false);
  }, []);

  const handleGoogleLogin = useCallback(() => {
    if (!googleClientId) {
      toast.error("Google kirish uchun VITE_GOOGLE_CLIENT_ID o'rnatilmagan.");
      return;
    }

    const google = (window as WindowWithGoogle).google;
    if (!google?.accounts?.oauth2) {
      toast.error("Google kirish hali tayyor emas. Sahifani qayta yuklang.");
      return;
    }

    setGoogleLoading(true);

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "openid email profile",
      callback: async (tokenResponse) => {
        if (!tokenResponse.access_token) {
          setGoogleLoading(false);
          toast.error(tokenResponse.error || "Google kirishda xatolik.");
          return;
        }

        try {
          const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          });

          if (!userInfoResponse.ok) {
            throw new Error("Google profil ma'lumoti olinmadi.");
          }

          const userInfo = (await userInfoResponse.json()) as { email?: string; name?: string };
          setLoggedInUser({
            provider: "google",
            label: userInfo.email || userInfo.name || "Google User",
          });
          toast.success("Google orqali muvaffaqiyatli kirildi.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Google kirishda xatolik.");
        } finally {
          setGoogleLoading(false);
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  }, [googleClientId, setLoggedInUser]);

  const handleLogout = useCallback(() => {
    setAuthProfile(null);
    localStorage.removeItem(STORAGE_KEYS.auth);
    toast.success("Hisobdan chiqildi.");
  }, []);

  const toggleDirection = useCallback(() => {
    setDirection((d) => {
      const newDir = d === "cyr2lat" ? "lat2cyr" : "cyr2lat";
      if (output) setInput(output);
      return newDir;
    });
  }, [output]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Nusxalandi.");
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setUploadedFile(null);
    setDownloadFormat("txt");
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const result = await readFile(file);
      setInput(result.text);
      setUploadedFile({ name: result.fileName, type: result.fileType, file });
      setDirection(detectDirection(result.text));
      const ext = result.fileType as DownloadFormat;
      if (ext === "txt" || ext === "docx" || ext === "xlsx") setDownloadFormat(ext);
      toast.success(`${file.name} yuklandi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Faylni o'qishda xatolik.");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDownload = useCallback(async () => {
    if (!output) return;

    if (uploadedFile && (uploadedFile.type === "xlsx" || uploadedFile.type === "xls") && downloadFormat === "xlsx") {
      await convertXlsxFile(uploadedFile.file, direction);
      toast.success("XLSX yuklab olindi.");
    } else {
      await downloadAsFormat(output, uploadedFile?.name || "converted.txt", downloadFormat, direction, uploadedFile?.file);
      toast.success("Fayl yuklab olindi.");
    }
  }, [output, uploadedFile, direction, downloadFormat]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInput(val);
      if (val.length > 0 && input.length === 0) setDirection(detectDirection(val));
    },
    [input.length]
  );

  const handleTranslate = useCallback(async () => {
    if (!translateInput.trim()) {
      toast.error("Tarjima uchun matn kiriting.");
      return;
    }
    if (sourceLanguage !== "Auto-detect" && sourceLanguage === targetLanguage) {
      toast.error("Manba va maqsad tillari bir xil bo'lmasin.");
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await translateWithApi({
        apiKey: SHARED_TRANSLATION_API_KEY,
        inputText: translateInput,
        sourceLanguage,
        targetLanguage,
      });
      setTranslateOutput(translated);
      toast.success("Tarjima tayyor.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tarjima xatoligi.");
    } finally {
      setIsTranslating(false);
    }
  }, [sourceLanguage, targetLanguage, translateInput]);

  const fromLabel = direction === "cyr2lat" ? "Kiril" : "Lotin";
  const toLabel = direction === "cyr2lat" ? "Lotin" : "Kiril";

  if (!authProfile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/alifgo-logo.svg" alt="Alifgo logo" className="w-10 h-10 rounded-xl" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Alifgo</h1>
                <p className="text-xs text-muted-foreground">Kiril-Lotin va AI Tarjimon</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAuthPanel(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <LogIn size={15} />
                Kirish
              </button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {showAuthPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/45" onClick={() => setShowAuthPanel(false)} />
            <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <h3 className="text-xl font-semibold text-foreground">Alifgo'ga kirish</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Google orqali kiring. Kirgandan keyin asosiy menyular ochiladi.
              </p>

              <div className="mt-5 space-y-4">
                <button
                  onClick={handleGoogleLogin}
                  disabled={!googleReady || googleLoading}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-60"
                >
                  {googleLoading ? "Google tekshirilmoqda..." : "Google orqali kirish"}
                </button>
                {!googleClientId && (
                  <p className="text-xs text-amber-600">
                    Google kirish uchun `.env` faylga `VITE_GOOGLE_CLIENT_ID=...` qo'shilishi kerak.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-4 py-10 md:py-16">
          <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-10">
            <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
            <div className="relative">
              <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
                <ShieldCheck size={13} /> Tez va qulay matn vositasi
              </p>
              <h2 className="mt-4 text-2xl md:text-4xl font-semibold leading-tight text-foreground">
                O'zbek matn bilan ishlash uchun bitta platforma
              </h2>
              <p className="mt-3 text-sm md:text-base text-muted-foreground">
                Alifgo orqali lotin-kiril konvertatsiya qiling, fayllarni yuklab qayta saqlang va API key bilan AI
                tarjimadan foydalaning.
              </p>
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-background/80 p-3">Lotin-Kiril konvertor</div>
                <div className="rounded-xl border border-border bg-background/80 p-3">AI tarjimon bo'limi</div>
                <div className="rounded-xl border border-border bg-background/80 p-3">.txt/.docx/.xlsx qo'llab-quvvatlash</div>
                <div className="rounded-xl border border-border bg-background/80 p-3">Mobil va desktopga mos</div>
              </div>
              <div className="mt-7 rounded-xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
                Kirish uchun tepadagi o'ng tomondagi <span className="text-foreground font-medium">Kirish</span> tugmasini bosing.
                Tizimga kirgandan keyin asosiy menyular ochiladi.
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background transition-colors"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && activeMenu === "converter" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-primary bg-accent/50">
            <Upload className="text-primary" size={48} />
            <p className="text-lg font-medium text-foreground">Faylni shu yerga tashlang</p>
            <p className="text-sm text-muted-foreground">.txt, .docx, .xlsx</p>
          </div>
        </div>
      )}

      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/alifgo-logo.svg" alt="Alifgo logo" className="w-8 h-8 rounded-lg" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">Alifgo</h1>
              <p className="text-xs text-muted-foreground">Kiril-Lotin va AI Tarjimon</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs text-secondary-foreground">
              <UserCircle2 size={14} />
              {authProfile.label}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent transition-colors"
            >
              Chiqish
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-5">
        <div className="rounded-2xl border border-border bg-card p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Bosh menyu</h2>
              <p className="text-xs text-muted-foreground">Bo'limni tanlang</p>
            </div>
            <div className="inline-flex rounded-xl bg-secondary p-1 w-full sm:w-auto">
              <button
                onClick={() => setActiveMenu("translator")}
                className={`flex-1 sm:flex-none min-w-[130px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeMenu === "translator" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Tarjimon
              </button>
              <button
                onClick={() => setActiveMenu("converter")}
                className={`flex-1 sm:flex-none min-w-[130px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeMenu === "converter" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Lotin-Kiril
              </button>
            </div>
          </div>
        </div>

        {activeMenu === "converter" ? (
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-sm font-medium text-muted-foreground px-3 py-1.5 rounded-lg bg-secondary">
                {fromLabel}
              </span>
              <button
                onClick={toggleDirection}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-95 shadow-sm"
                aria-label="Toggle direction"
              >
                <ArrowLeftRight size={18} />
              </button>
              <span className="text-sm font-medium text-muted-foreground px-3 py-1.5 rounded-lg bg-secondary">
                {toLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Kirish matni</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{input.length.toLocaleString()} belgi</span>
                    {input && (
                      <button
                        onClick={handleClear}
                        className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="Clear"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={input}
                  onChange={handleInputChange}
                  placeholder={direction === "cyr2lat" ? "Kiril matn kiriting..." : "Lotin matn kiriting..."}
                  className="w-full h-64 md:h-80 p-4 rounded-xl bg-card border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-foreground placeholder:text-muted-foreground transition-all font-mono text-sm leading-relaxed"
                  spellCheck={false}
                />
                <div className="mt-3 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.docx,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                  >
                    <Upload size={14} />
                    Fayl yuklash
                  </button>
                  {uploadedFile && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm">
                      <FileText size={14} />
                      <span className="truncate max-w-[150px]">{uploadedFile.name}</span>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="p-0.5 rounded hover:bg-secondary transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Natija</label>
                  <div className="flex items-center gap-1">
                    {output && (
                      <>
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all"
                        >
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                          {copied ? "Nusxalandi" : "Nusxalash"}
                        </button>

                        <div className="relative">
                          <div className="flex items-center">
                            <button
                              onClick={handleDownload}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-l-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                            >
                              <Download size={12} />
                              {downloadFormat.toUpperCase()}
                            </button>
                            <button
                              onClick={() => setShowFormatMenu(!showFormatMenu)}
                              className="px-1.5 py-1 rounded-r-md text-xs bg-secondary text-secondary-foreground hover:bg-accent transition-colors border-l border-border"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                          {showFormatMenu && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowFormatMenu(false)} />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[100px]">
                                {FORMATS.map((f) => (
                                  <button
                                    key={f.value}
                                    onClick={() => {
                                      setDownloadFormat(f.value);
                                      setShowFormatMenu(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                                      downloadFormat === f.value
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  value={output}
                  readOnly
                  placeholder="Natija shu yerda chiqadi..."
                  className="w-full h-64 md:h-80 p-4 rounded-xl bg-card border border-border outline-none resize-none text-foreground placeholder:text-muted-foreground font-mono text-sm leading-relaxed cursor-default"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-primary" />
                <h2 className="text-sm font-semibold">AI Tarjimon</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Manba tili</label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {SOURCE_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Maqsad tili</label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TARGET_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-muted-foreground mb-2">Tarjima uchun matn</label>
                <textarea
                  value={translateInput}
                  onChange={(e) => setTranslateInput(e.target.value)}
                  placeholder="Matn kiriting..."
                  className="w-full h-64 md:h-80 p-4 rounded-xl bg-card border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-foreground placeholder:text-muted-foreground transition-all font-mono text-sm leading-relaxed"
                />
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {isTranslating ? "Tarjima qilinmoqda..." : "Tarjima qilish"}
                </button>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-muted-foreground mb-2">Tarjima natijasi</label>
                <textarea
                  value={translateOutput}
                  readOnly
                  placeholder="Natija shu yerda chiqadi..."
                  className="w-full h-64 md:h-80 p-4 rounded-xl bg-card border border-border outline-none resize-none text-foreground placeholder:text-muted-foreground font-mono text-sm leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Alifgo - Lotin-Kiril konvertor + API asosidagi tarjimon</p>
        </div>
      </main>
    </div>
  );
};

export default Index;
