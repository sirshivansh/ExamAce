import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, FileText, Loader2, BarChart2, BookOpen,
  AlertCircle, ChevronRight, X, Lightbulb, List,
  BookMarked, AlignLeft, Sparkles, Trophy, MousePointerClick,
  Repeat2, Brain, CheckCircle2, Zap, ArrowRight, GraduationCap,
  ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight as ChevronR,
  FileSearch, MapPin, Sun, Moon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RepeatedQuestion { question: string; count: number; }
interface ImportantTopic { topic: string; priority: "High" | "Medium" | "Low"; }
interface ExtractedQuestion {
  question: string;
  snippet: string;
  source: { fileName: string; page: number };
}
interface AnswerDetail {
  definition: string;
  explanation: string[];
  example?: string;
  conclusion: string;
}
interface AnswerPanelState {
  question: string;
  answer: AnswerDetail | null;
  loading: boolean;
  error: string | null;
  source?: { fileName: string; page: number };
  highlightY?: number;
}
interface AnalysisResult {
  repeatedQuestions: RepeatedQuestion[];
  importantTopics: ImportantTopic[];
  expectedQuestions: string[];
  questions?: ExtractedQuestion[];
  pageImages?: Record<string, string[]>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortName(name: string): string {
  return name.length > 28 ? "…" + name.slice(-26) : name;
}

function computeHighlightY(q: ExtractedQuestion, all: ExtractedQuestion[]): number {
  const peers = all.filter(
    x => x.source.fileName === q.source.fileName && x.source.page === q.source.page
  );
  const idx = peers.findIndex(x => x.question === q.question);
  const total = peers.length;
  if (total <= 1) return 18;
  return 10 + (idx / (total - 1)) * 65; // 10 %–75 % of image height
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClickableQuestion({
  question, badge, isActive, isTop, index, onClick,
}: {
  question: string; badge?: React.ReactNode; isActive: boolean;
  isTop?: boolean; index: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${index * 40}ms` }}
      className={`stagger-item w-full text-left group rounded-2xl border px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-300 backdrop-blur-md ${
        isTop
          ? "top-question"
          : isActive
          ? "border-primary/40 bg-primary/10 shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.2)]"
          : "border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/80 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`leading-snug flex-1 text-sm ${isTop ? "font-semibold" : "font-medium"}`}>
          {question}
        </p>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {badge}
          <ChevronRight className={`w-3.5 h-3.5 transition-all duration-200 ${isActive ? "text-primary translate-x-0.5" : "text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5"}`} />
        </div>
      </div>
    </button>
  );
}

function ExtractedQuestionCard({
  item, index, isActive, onClick,
}: {
  item: ExtractedQuestion; index: number; isActive: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${index * 35}ms` }}
      className={`stagger-item w-full text-left group rounded-2xl border px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-300 backdrop-blur-md ${
        isActive
          ? "border-primary/40 bg-primary/10 shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.2)]"
          : "border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/80 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="leading-snug flex-1 text-sm font-medium">{item.question}</p>
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 mt-0.5 transition-all duration-200 ${isActive ? "text-primary translate-x-0.5" : "text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5"}`} />
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60 bg-muted/40 border border-border/40 px-2 py-0.5 rounded-md">
          <FileText className="w-2.5 h-2.5" />
          {shortName(item.source.fileName)}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-primary/70 bg-primary/8 border border-primary/15 px-2 py-0.5 rounded-md">
          <MapPin className="w-2.5 h-2.5" />
          Page {item.source.page}
        </div>
      </div>
    </button>
  );
}

function PdfPageViewer({
  images,
  startPage,
  highlightY,
}: {
  images: string[];
  startPage: number;
  highlightY?: number;
}) {
  const [zoom, setZoom] = useState(1);
  const [pageIdx, setPageIdx] = useState(0);

  // Sync to external startPage when it changes
  useEffect(() => {
    const idx = Math.max(0, Math.min(startPage - 1, images.length - 1));
    setPageIdx(idx);
  }, [startPage, images.length]);

  const zoomStep = 0.25;
  const minZoom = 0.5;
  const maxZoom = 3;

  const src = images[pageIdx];

  return (
    <div className="rounded-[2rem] border-2 border-foreground/10 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] overflow-hidden sticky top-6 flex flex-col animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-6 py-5 border-b-2 border-foreground/5 bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center shrink-0">
            <FileText className="w-3 h-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
            Original Exam Page
          </span>
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setZoom(z => Math.max(minZoom, +(z - zoomStep).toFixed(2)))}
            disabled={zoom <= minZoom}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-muted-foreground w-9 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(maxZoom, +(z + zoomStep).toFixed(2)))}
            disabled={zoom >= maxZoom}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Reset zoom"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Page navigation bar (shown when multiple pages) */}
      {images.length > 1 && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border/40 bg-muted/10 shrink-0">
          <button
            onClick={() => setPageIdx(p => Math.max(0, p - 1))}
            disabled={pageIdx === 0}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-muted-foreground/70">
            Page {pageIdx + 1} of {images.length}
          </span>
          <button
            onClick={() => setPageIdx(p => Math.min(images.length - 1, p + 1))}
            disabled={pageIdx === images.length - 1}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronR className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Image with highlight overlay */}
      <div className="overflow-auto max-h-[68vh] bg-muted/10 scrollable-list">
        <div
          className="p-3 inline-block"
          style={{ width: `${Math.max(zoom * 100, 100)}%`, minWidth: "100%" }}
        >
          <div className="relative inline-block w-full">
            <img
              key={`${pageIdx}-${src}`}
              src={src}
              alt={`Exam page ${pageIdx + 1}`}
              className="w-full block rounded-lg border border-border/30 shadow-sm"
              draggable={false}
            />

            {/* Yellow highlight overlay */}
            {highlightY !== undefined && (
              <div
                className="absolute left-[2%] right-[2%] pointer-events-none highlight-pulse"
                style={{
                  top: `${highlightY}%`,
                  height: "5%",
                  minHeight: "16px",
                  background: "rgba(255, 213, 0, 0.28)",
                  border: "1.5px solid rgba(255, 200, 0, 0.55)",
                  boxShadow: "0 0 18px rgba(255, 210, 0, 0.35)",
                  borderRadius: "4px",
                }}
              />
            )}
          </div>

          {/* Highlight label */}
          {highlightY !== undefined && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400/80 font-medium">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-400/40 border border-amber-400/60 shrink-0" />
              Highlighted question (approximate)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnswerPanel({ state, onClose }: { state: AnswerPanelState; onClose: () => void }) {
  return (
    <div
      data-testid="panel-answer"
      className="rounded-[2rem] border-2 border-foreground/10 bg-card shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden sticky top-6"
    >
      {/* Question header */}
      <div className="flex items-start justify-between gap-3 px-6 py-5 border-b-2 border-foreground/5 bg-primary/10">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="w-3 h-3 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug text-foreground line-clamp-3">
              {state.question}
            </p>
            {state.source && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground/60 bg-muted/40 border border-border/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" />
                  From: {shortName(state.source.fileName)}
                </span>
                <span className="text-[10px] font-semibold text-primary/70 bg-primary/8 border border-primary/15 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  Page {state.source.page}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          data-testid="button-close-answer"
          onClick={onClose}
          className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Close answer panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Loading */}
      {state.loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 blur-xl bg-primary/15 rounded-full" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium text-foreground">Generating answer</span>
            <span className="text-xs text-muted-foreground/70">AI is crafting your model answer…</span>
          </div>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="p-5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription data-testid="text-answer-error">{state.error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Answer */}
      {state.answer && (
        <div className="p-5 flex flex-col gap-4 text-sm max-h-[62vh] overflow-y-auto scrollable-list animate-in fade-in duration-300">
          <AnswerSection icon={<AlignLeft className="w-3.5 h-3.5" />} label="Definition" colorClass="text-sky-400">
            <p className="leading-relaxed text-foreground" data-testid="text-definition">{state.answer.definition}</p>
          </AnswerSection>
          <div className="border-t border-border/40" />
          <AnswerSection icon={<List className="w-3.5 h-3.5" />} label="Explanation" colorClass="text-violet-400">
            <ul className="flex flex-col gap-2.5" data-testid="list-explanation">
              {state.answer.explanation.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
                  <span className="leading-relaxed text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </AnswerSection>
          {state.answer.example && (
            <>
              <div className="border-t border-border/40" />
              <AnswerSection icon={<Lightbulb className="w-3.5 h-3.5" />} label="Example" colorClass="text-amber-400">
                <p className="leading-relaxed text-muted-foreground italic px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15" data-testid="text-example">
                  {state.answer.example}
                </p>
              </AnswerSection>
            </>
          )}
          <div className="border-t border-border/40" />
          <AnswerSection icon={<BookMarked className="w-3.5 h-3.5" />} label="Conclusion" colorClass="text-emerald-400">
            <p className="leading-relaxed text-foreground" data-testid="text-conclusion">{state.answer.conclusion}</p>
          </AnswerSection>
        </div>
      )}
    </div>
  );
}

function AnswerSection({ icon, label, colorClass, children }: {
  icon: React.ReactNode; label: string; colorClass: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider ${colorClass}`}>
        {icon}{label}
      </div>
      {children}
    </div>
  );
}

function AnswerPlaceholder({ hasImages }: { hasImages: boolean }) {
  return (
    <div className="rounded-[2rem] border-2 border-dashed border-foreground/20 bg-muted/20 flex flex-col items-center justify-center gap-5 py-24 px-6 text-center animate-in fade-in duration-500 sticky top-6">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-sm">
        <MousePointerClick className="w-5 h-5 text-primary/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground/80">Select a question</p>
        <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-[200px]">
          {hasImages
            ? "Click any question to view the source page and generate a model answer"
            : "Click any question to generate a structured model answer"}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
        <ArrowRight className="w-3 h-3" />
        <span>Powered by AI</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center border border-dashed border-border/50 rounded-xl">
      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
        <BookOpen className="w-5 h-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">{message}</p>
    </div>
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────────

function ThemeToggle() {
  const [isLight, setIsLight] = useState(() => {
    try { return localStorage.getItem("examace-theme") === "light"; } catch { return false; }
  });
  const [spinning, setSpinning] = useState(false);

  const toggle = () => {
    const next = !isLight;
    setIsLight(next);
    setSpinning(true);
    setTimeout(() => setSpinning(false), 420);

    try { localStorage.setItem("examace-theme", next ? "light" : "dark"); } catch { /* ignore */ }

    // Enable transitions only during the toggle (not on initial load)
    document.documentElement.classList.add("theme-transitioning");
    document.documentElement.classList.toggle("light", next);
    setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 300);
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      className="fixed top-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center border-2 border-foreground/10 bg-card text-foreground hover:bg-muted shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all duration-300"
    >
      <span className={spinning ? "theme-toggle-spin" : ""}>
        {isLight
          ? <Moon className="w-4 h-4 text-primary" />
          : <Sun className="w-4 h-4 text-amber-400" />
        }
      </span>
    </button>
  );
}

function DocsButton() {
  return (
    <a
      href="/docs.html"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View Documentation"
      className="fixed top-6 right-[80px] z-50 w-12 h-12 rounded-full flex items-center justify-center border-2 border-foreground/10 bg-card text-foreground hover:bg-muted shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all duration-300"
    >
      <BookOpen className="w-4 h-4 text-primary" />
    </a>
  );
}

const FEATURE_HIGHLIGHTS = [
  { icon: Repeat2, label: "Repeated Questions", desc: "Groups similar questions and ranks by frequency", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20" },
  { icon: BarChart2, label: "Priority Topics", desc: "Identifies High / Medium / Low priority topics", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" },
  { icon: Sparkles, label: "Predicted Questions", desc: "AI forecasts likely questions for your next exam", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  { icon: Brain, label: "Model Answers", desc: "Generates structured 10-mark answers on demand", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

// ── Intersection Observer Hook ────────────────────────────────────────────────
function useInView(options = {}) {
  const [isIntersecting, setIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIntersecting(true);
        observer.disconnect();
      }
    }, options);
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting] as const;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contentRef, isIntersecting] = useInView({ threshold: 0.15 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [answerPanel, setAnswerPanel] = useState<AnswerPanelState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter(f => f.type === "application/pdf");
    const rejected = Array.from(incoming).length - pdfs.length;
    if (rejected > 0) setError(`${rejected} file(s) skipped — only PDF files are accepted.`);
    else setError(null);
    if (pdfs.length > 0) {
      setFiles(prev => {
        const existing = new Set(prev.map(f => f.name + f.size));
        return [...prev, ...pdfs.filter(f => !existing.has(f.name + f.size))];
      });
    }
  }, []);

  const removeFile = useCallback((i: number) => setFiles(prev => prev.filter((_, j) => j !== i)), []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }, [addFiles]);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }, [addFiles]);

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setAnswerPanel(null);
    const formData = new FormData();
    files.forEach(f => formData.append("file", f));
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!res.ok) {
        let msg: string | undefined;
        try { msg = ((await res.json()) as { error?: string }).error; } catch { /* ignore */ }
        throw new Error(msg || "Something went wrong. Try another PDF.");
      }
      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try another PDF.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuestionClick = async (
    question: string,
    source?: { fileName: string; page: number },
    highlightY?: number
  ) => {
    setAnswerPanel({ question, answer: null, loading: true, error: null, source, highlightY });
    try {
      const res = await fetch("/api/generate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to generate answer.");
      }
      const data: { answer: AnswerDetail } = await res.json();
      setAnswerPanel({ question, answer: data.answer, loading: false, error: null, source, highlightY });
    } catch (err: unknown) {
      setAnswerPanel({ question, answer: null, loading: false, error: err instanceof Error ? err.message : "Failed to generate answer.", source, highlightY });
    }
  };

  const priorityConfig = (p: string) => {
    if (p === "High") return { badge: "bg-red-500/12 text-red-400 border-red-500/25", bar: "bg-red-400", width: "w-full" };
    if (p === "Medium") return { badge: "bg-amber-500/12 text-amber-400 border-amber-500/25", bar: "bg-amber-400", width: "w-2/3" };
    return { badge: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25", bar: "bg-emerald-400", width: "w-1/3" };
  };

  const pageImages = result?.pageImages ?? {};
  const extractedQuestions = result?.questions ?? [];
  const hasPageImages = Object.keys(pageImages).length > 0;

  // Determine which images to show in the PDF viewer
  const viewerImages: string[] = answerPanel?.source
    ? (pageImages[answerPanel.source.fileName] ?? [])
    : hasPageImages
    ? Object.values(pageImages)[0] ?? []
    : [];

  const viewerPage = answerPanel?.source?.page ?? 1;
  const showSplitView = !!answerPanel && viewerImages.length > 0;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center bg-background overflow-x-hidden selection:bg-primary/30 selection:text-foreground font-sans relative">

      <ThemeToggle />
      <DocsButton />

      {/* Decorative Blob Shapes (Agency Style) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-100 mix-blend-normal">
        <div className="absolute top-10 left-10 w-32 h-32 bg-secondary rounded-[40%_60%_70%_30%/40%_50%_60%_50%] shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.1),_4px_4px_10px_rgba(0,0,0,0.05)] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-primary rounded-[60%_40%_30%_70%/60%_30%_70%_40%] shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.1),_4px_4px_10px_rgba(0,0,0,0.05)] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 -right-10 w-24 h-24 bg-accent rounded-full shadow-[inset_-5px_-5px_15px_rgba(0,0,0,0.1),_4px_4px_10px_rgba(0,0,0,0.05)] animate-pulse" style={{ animationDuration: '7s' }} />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">

        {/* Hero Section */}
        <section className="min-h-[80vh] w-full max-w-5xl px-4 md:px-8 flex flex-col justify-center items-center relative pt-10">
          <header className="flex flex-col items-center text-center gap-8 animate-in fade-in slide-in-from-top-8 duration-700 ease-out z-10 relative">
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/20 border-2 border-primary/30 text-sm font-bold text-foreground">
              <GraduationCap className="w-5 h-5 text-primary" />
              <span className="tracking-widest uppercase">AI-Powered Exam Analysis</span>
            </div>
            
            <div className="flex flex-col gap-4 max-w-4xl relative z-10 px-4">
              <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-black uppercase tracking-tighter text-foreground leading-[0.9]">
                Insights that<br />
                <span className="text-secondary inline-block transform -rotate-2 origin-left mx-2">elevate</span> your scores.
              </h1>
              <p className="text-foreground/70 max-w-[600px] mx-auto text-lg md:text-xl leading-relaxed font-medium mt-6">
                Upload exam PDFs and get instant AI-powered insights — repeated questions, priority topics, predicted questions, and model answers.
              </p>
            </div>
          </header>
        </section>

        {/* Content Section with a clean, smooth reveal */}
        <div 
          ref={contentRef} 
          className={`w-full flex flex-col items-center transition-all duration-[1000ms] ease-out ${isIntersecting || result ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}
        >
          
          {/* Scrolling Marquee - Straight and clean for a 'put together' look */}
          <div className="w-full bg-primary text-primary-foreground py-6 border-y-2 border-foreground/10 overflow-hidden flex whitespace-nowrap mt-12 mb-8 z-20 shadow-md">
            <div className="animate-marquee flex gap-10 items-center text-xl font-bold uppercase tracking-widest">
              {Array(10).fill("• UPLOAD PDFS • REPEATED QUESTIONS • MODEL ANSWERS • AI PREDICTIONS").map((text, i) => (
                <span key={i} className="inline-block px-4">{text}</span>
              ))}
            </div>
          </div>

          <div className={`relative w-full flex flex-col gap-10 pb-20 pt-8 px-4 md:px-8 ${showSplitView ? "max-w-[1500px]" : "max-w-5xl"}`}>

        {/* ── Upload ── */}
        {!result && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div
              data-testid="upload-dropzone"
              className={`relative w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 overflow-hidden ${
                isDragging ? "border-primary bg-primary/5 shadow-[0_0_40px_hsl(var(--primary)/0.15)]" : "border-border/50 hover:border-primary/30 bg-card/40 hover:bg-muted/20"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isDragging && <div className="absolute inset-0 bg-primary/5 animate-pulse" />}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" multiple className="hidden" data-testid="input-file" />
              <div className="flex flex-col items-center justify-center gap-4 py-10 px-6">
                <div className={`p-5 rounded-full border-2 transition-all duration-300 ${isDragging ? "bg-primary border-primary text-foreground scale-110 shadow-[4px_4px_0px_rgba(0,0,0,0.1)]" : "bg-card border-foreground/10 text-foreground/50 shadow-sm"}`}>
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center mt-1">
                  <p className="text-xl font-bold text-foreground tracking-tight">{isDragging ? "Drop your PDFs here" : "Click or drag PDFs here"}</p>
                  <p className="text-xs text-foreground/60 mt-1.5 font-medium uppercase tracking-wider">Max 20 MB each</p>
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="flex flex-col gap-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{files.length} file{files.length > 1 ? "s" : ""} ready</p>
                  <button onClick={() => setFiles([])} className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors">Clear all</button>
                </div>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/5 border border-primary/12 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground" data-testid={`text-filename-${i}`}>{f.name}</p>
                        <p className="text-xs text-muted-foreground/60">{(f.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground/50 hover:text-foreground" aria-label={`Remove ${f.name}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="animate-in fade-in duration-200 rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription data-testid="text-upload-error">{error}</AlertDescription>
              </Alert>
            )}

            <button
              data-testid="button-analyze"
              onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
              disabled={files.length === 0 || isAnalyzing}
              className={`relative w-full h-16 rounded-full text-lg font-bold transition-all duration-300 overflow-hidden group border-2 border-transparent uppercase tracking-wider ${
                files.length === 0 || isAnalyzing 
                ? "bg-muted text-foreground/40 cursor-not-allowed" 
                : "bg-primary text-foreground hover:-translate-y-1 active:translate-y-0 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.3)]"
              }`}
            >
              <span className="relative flex items-center justify-center gap-3 h-full">
                {isAnalyzing
                  ? <><Loader2 className="w-6 h-6 animate-spin" />Analyzing {files.length > 1 ? `${files.length} PDFs` : "document"}…</>
                  : <><Zap className="w-6 h-6" />{files.length > 1 ? `Analyze ${files.length} PDFs` : "Analyze PDF"}{files.length > 0 && <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-2" />}</>
                }
              </span>
            </button>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label, desc, color, bg }) => (
                <div key={label} className="flex flex-col gap-3 rounded-3xl border-2 border-foreground/5 bg-card px-5 py-6 hover:border-foreground/20 hover:bg-card hover:-translate-y-1 transition-all duration-300 group shadow-sm">
                  <div className={`w-12 h-12 rounded-full border-2 border-foreground/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${bg}`}><Icon className={`w-6 h-6 ${color}`} /></div>
                  <div>
                    <p className="text-base font-bold text-foreground tracking-tight leading-none">{label}</p>
                    <p className="text-xs text-foreground/70 mt-2 font-medium">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Results header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Analysis Complete</h2>
                  <p className="text-xs text-muted-foreground/70">
                    {result.repeatedQuestions.length} patterns · {result.importantTopics.length} topics · {result.expectedQuestions.length} predictions
                    {extractedQuestions.length > 0 && <span className="text-primary/60"> · {extractedQuestions.length} extracted questions</span>}
                    {hasPageImages && <span className="text-emerald-400/60"> · {Object.keys(pageImages).length} PDF{Object.keys(pageImages).length > 1 ? "s" : ""} rendered</span>}
                  </p>
                </div>
              </div>
              <button
                data-testid="button-analyze-another"
                onClick={() => { setResult(null); setFiles([]); setAnswerPanel(null); }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border/60 hover:border-border rounded-lg px-3 py-1.5 transition-all hover:bg-muted/40"
              >
                <Upload className="w-3 h-3" />
                New Analysis
              </button>
            </div>

            {/* 3-col when split view, else 2-col */}
            <div className={`grid gap-5 items-start ${
              showSplitView
                ? "grid-cols-1 xl:grid-cols-[380px_1fr_340px]"
                : "grid-cols-1 lg:grid-cols-[1fr_360px]"
            }`}>

              {/* Col 1: Tabs */}
              <div>
                <Tabs defaultValue={extractedQuestions.length > 0 ? "questions" : "repeated"} className="w-full">
                  <TabsList className={`w-full grid mb-5 rounded-xl bg-muted/40 border border-border/40 p-1 h-auto gap-1 ${extractedQuestions.length > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
                    {extractedQuestions.length > 0 && (
                      <TabsTrigger value="questions" className="gap-1 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                        <FileSearch className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Questions</span>
                        <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-bold">{extractedQuestions.length}</span>
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="repeated" className="gap-1.5 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                      <Repeat2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Repeated</span>
                      {result.repeatedQuestions.length > 0 && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{result.repeatedQuestions.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="topics" className="gap-1.5 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Topics</span>
                      {result.importantTopics.length > 0 && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-bold">{result.importantTopics.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="expected" className="gap-1.5 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Predicted</span>
                      {result.expectedQuestions.length > 0 && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">{result.expectedQuestions.length}</span>}
                    </TabsTrigger>
                  </TabsList>

                  {/* Questions tab */}
                  {extractedQuestions.length > 0 && (
                    <TabsContent value="questions">
                      <p className="text-xs text-muted-foreground/60 mb-3 flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" />
                        Click to view the source page and generate a model answer
                      </p>
                      <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                        {extractedQuestions.map((item, i) => (
                          <ExtractedQuestionCard
                            key={i}
                            item={item}
                            index={i}
                            isActive={answerPanel?.question === item.question}
                            onClick={() => handleQuestionClick(item.question, item.source, computeHighlightY(item, extractedQuestions))}
                          />
                        ))}
                      </div>
                    </TabsContent>
                  )}

                  {/* Repeated tab */}
                  <TabsContent value="repeated">
                    <p className="text-xs text-muted-foreground/60 mb-3 flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3" />
                      Click any question to generate a model answer
                    </p>
                    <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.repeatedQuestions.length > 0 ? (
                        result.repeatedQuestions.map((item, i) => (
                          <ClickableQuestion
                            key={i} index={i} question={item.question} isTop={i === 0}
                            badge={
                              i === 0
                                ? <Badge className="text-xs font-bold border bg-primary/12 text-primary border-primary/20 px-2 py-0.5 gap-1 rounded-lg"><Trophy className="w-2.5 h-2.5" />Top · {item.count}×</Badge>
                                : <span className="text-xs font-semibold text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-md">{item.count}×</span>
                            }
                            isActive={answerPanel?.question === item.question}
                            onClick={() => handleQuestionClick(item.question)}
                          />
                        ))
                      ) : <EmptyState message="No repeated questions found." />}
                    </div>
                  </TabsContent>

                  {/* Topics tab */}
                  <TabsContent value="topics">
                    <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.importantTopics.length > 0 ? (
                        result.importantTopics.map((topic, i) => {
                          const cfg = priorityConfig(topic.priority);
                          return (
                            <div
                              key={i} data-testid={`card-topic-${i}`}
                              style={{ animationDelay: `${i * 40}ms` }}
                              className={`stagger-item flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3.5 transition-colors hover:bg-muted/20 ${topic.priority === "High" ? "border-l-2 border-l-red-500/50" : ""}`}
                            >
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${topic.priority === "High" ? "font-semibold" : "font-medium"}`}>{topic.topic}</span>
                                <div className="mt-2 w-full bg-muted/50 rounded-full h-1">
                                  <div className={`h-1 rounded-full ${cfg.bar} ${cfg.width} opacity-60`} />
                                </div>
                              </div>
                              <Badge className={`text-xs font-semibold border shrink-0 rounded-lg px-2.5 ${cfg.badge}`}>{topic.priority}</Badge>
                            </div>
                          );
                        })
                      ) : <EmptyState message="No important topics identified." />}
                    </div>
                  </TabsContent>

                  {/* Predicted tab */}
                  <TabsContent value="expected">
                    <p className="text-xs text-muted-foreground/60 mb-3 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      AI-predicted questions for the next exam sitting
                    </p>
                    <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.expectedQuestions.length > 0 ? (
                        result.expectedQuestions.map((q, i) => (
                          <ClickableQuestion
                            key={i} index={i} question={q}
                            badge={<Badge className="text-xs font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/20 shrink-0 rounded-lg px-2">Predicted</Badge>}
                            isActive={answerPanel?.question === q}
                            onClick={() => handleQuestionClick(q)}
                          />
                        ))
                      ) : <EmptyState message="No predictions could be generated." />}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Col 2 (split view only): PDF page viewer */}
              {showSplitView && (
                <PdfPageViewer
                  images={viewerImages}
                  startPage={viewerPage}
                  highlightY={answerPanel?.highlightY}
                />
              )}

              {/* Col 3 (or 2): Answer panel */}
              {answerPanel
                ? <AnswerPanel state={answerPanel} onClose={() => setAnswerPanel(null)} />
                : <AnswerPlaceholder hasImages={hasPageImages} />
              }
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>
  );
}
