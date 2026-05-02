import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Loader2, BarChart2, BookOpen,
  AlertCircle, ChevronRight, X,
  Lightbulb, List, BookMarked, AlignLeft, Sparkles,
  Trophy, MousePointerClick, Repeat2, Brain, CheckCircle2,
  Zap, ArrowRight, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RepeatedQuestion {
  question: string;
  count: number;
}

interface ImportantTopic {
  topic: string;
  priority: "High" | "Medium" | "Low";
}

interface AnalysisResult {
  repeatedQuestions: RepeatedQuestion[];
  importantTopics: ImportantTopic[];
  expectedQuestions: string[];
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
}

function ClickableQuestion({
  question,
  badge,
  isActive,
  isTop,
  index,
  onClick,
}: {
  question: string;
  badge?: React.ReactNode;
  isActive: boolean;
  isTop?: boolean;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${index * 45}ms` }}
      className={`stagger-item question-card w-full text-left group rounded-xl border px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all duration-200 ${
        isTop
          ? "top-question"
          : isActive
          ? "border-primary/50 bg-primary/[0.07] shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_0_16px_hsl(var(--primary)/0.12)]"
          : "border-border/60 bg-card/60 hover:border-primary/30 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`leading-snug flex-1 text-sm ${isTop ? "font-semibold" : "font-medium"}`}>
          {question}
        </p>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {badge}
          <ChevronRight className={`w-3.5 h-3.5 transition-all duration-200 ${isActive ? "text-primary translate-x-0.5" : "text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5"}`} />
        </div>
      </div>
    </button>
  );
}

function AnswerPanel({
  state,
  onClose,
}: {
  state: AnswerPanelState;
  onClose: () => void;
}) {
  return (
    <div
      data-testid="panel-answer"
      className="rounded-2xl border border-border/80 bg-card shadow-xl animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden sticky top-6"
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="w-3 h-3 text-primary" />
          </div>
          <p className="text-sm font-semibold leading-snug text-foreground line-clamp-3 flex-1">
            {state.question}
          </p>
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

      {state.loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
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

      {state.error && (
        <div className="p-5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription data-testid="text-answer-error">{state.error}</AlertDescription>
          </Alert>
        </div>
      )}

      {state.answer && (
        <div className="p-5 flex flex-col gap-4 text-sm max-h-[68vh] overflow-y-auto scrollable-list animate-in fade-in duration-300">
          <AnswerSection icon={<AlignLeft className="w-3.5 h-3.5" />} label="Definition" colorClass="text-sky-400">
            <p className="leading-relaxed text-foreground" data-testid="text-definition">
              {state.answer.definition}
            </p>
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
                <p
                  className="leading-relaxed text-muted-foreground italic px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15"
                  data-testid="text-example"
                >
                  {state.answer.example}
                </p>
              </AnswerSection>
            </>
          )}

          <div className="border-t border-border/40" />

          <AnswerSection icon={<BookMarked className="w-3.5 h-3.5" />} label="Conclusion" colorClass="text-emerald-400">
            <p className="leading-relaxed text-foreground" data-testid="text-conclusion">
              {state.answer.conclusion}
            </p>
          </AnswerSection>
        </div>
      )}
    </div>
  );
}

function AnswerSection({
  icon,
  label,
  colorClass,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider ${colorClass}`}>
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function AnswerPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 flex flex-col items-center justify-center gap-5 py-16 px-6 text-center animate-in fade-in duration-500 sticky top-6">
      <div className="w-12 h-12 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
        <MousePointerClick className="w-5 h-5 text-primary/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground/80">Select a question</p>
        <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-[180px]">
          Click any question to generate a structured model answer
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
        <ArrowRight className="w-3 h-3" />
        <span>Powered by AI</span>
      </div>
    </div>
  );
}

const FEATURE_HIGHLIGHTS = [
  { icon: Repeat2, label: "Repeated Questions", desc: "Groups similar questions and ranks by frequency", color: "text-sky-400", bg: "bg-sky-400/10" },
  { icon: BarChart2, label: "Priority Topics", desc: "Identifies High / Medium / Low priority topics", color: "text-violet-400", bg: "bg-violet-400/10" },
  { icon: Sparkles, label: "Predicted Questions", desc: "AI forecasts likely questions for your next exam", color: "text-amber-400", bg: "bg-amber-400/10" },
  { icon: Brain, label: "Model Answers", desc: "Generates structured 10-mark answers on demand", color: "text-emerald-400", bg: "bg-emerald-400/10" },
];

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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
        const fresh = pdfs.filter(f => !existing.has(f.name + f.size));
        return [...prev, ...fresh];
      });
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

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
      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!response.ok) {
        let serverMessage: string | undefined;
        try {
          const body = await response.json();
          serverMessage = (body as { error?: string }).error;
        } catch {
          // not JSON — ignore
        }
        throw new Error(serverMessage || "Something went wrong. Try another PDF.");
      }
      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try another PDF.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuestionClick = async (question: string) => {
    setAnswerPanel({ question, answer: null, loading: true, error: null });
    try {
      const response = await fetch("/api/generate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to generate answer.");
      }
      const data: { answer: AnswerDetail } = await response.json();
      setAnswerPanel({ question, answer: data.answer, loading: false, error: null });
    } catch (err: unknown) {
      setAnswerPanel({
        question,
        answer: null,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to generate answer.",
      });
    }
  };

  const priorityConfig = (priority: string) => {
    if (priority === "High") return { badge: "bg-red-500/12 text-red-400 border-red-500/25", bar: "bg-red-400", width: "w-full" };
    if (priority === "Medium") return { badge: "bg-amber-500/12 text-amber-400 border-amber-500/25", bar: "bg-amber-400", width: "w-2/3" };
    return { badge: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25", bar: "bg-emerald-400", width: "w-1/3" };
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center bg-background overflow-x-hidden">

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -left-40 w-[300px] h-[400px] bg-violet-500/3 rounded-full blur-[80px]" />
      </div>

      <div className="relative w-full max-w-4xl flex flex-col gap-10 py-12 px-4 md:px-8">

        {/* Header */}
        <header className="flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <GraduationCap className="w-3.5 h-3.5" />
            AI-Powered Exam Analysis
          </div>
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_40px_hsl(var(--primary)/0.15)]">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              ExamAce
            </h1>
            <p className="text-muted-foreground max-w-[480px] text-sm leading-relaxed">
              Upload exam PDFs and get instant AI-powered insights — repeated questions, priority topics, predicted questions, and model answers.
            </p>
          </div>
        </header>

        {/* Upload view */}
        {!result && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-500">

            {/* Drop zone */}
            <div
              data-testid="upload-dropzone"
              className={`relative w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 overflow-hidden ${
                isDragging
                  ? "border-primary bg-primary/5 shadow-[0_0_40px_hsl(var(--primary)/0.15)]"
                  : "border-border/50 hover:border-primary/30 bg-card/40 hover:bg-muted/20"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isDragging && (
                <div className="absolute inset-0 bg-primary/5 animate-pulse" />
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf"
                multiple
                className="hidden"
                data-testid="input-file"
              />
              <div className="flex flex-col items-center justify-center gap-4 py-12 px-6">
                <div className={`p-4 rounded-2xl border transition-all duration-200 ${isDragging ? "bg-primary/20 border-primary/40" : "bg-muted/60 border-border/40"}`}>
                  <Upload className={`w-7 h-7 transition-colors duration-200 ${isDragging ? "text-primary" : "text-muted-foreground/60"}`} />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">
                    {isDragging ? "Drop your PDFs here" : "Click or drag PDFs here"}
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Multiple files supported · PDF only · max 20 MB each
                  </p>
                </div>
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="flex flex-col gap-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {files.length} file{files.length > 1 ? "s" : ""} ready
                  </p>
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/5 border border-primary/12 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground" data-testid={`text-filename-${i}`}>
                          {f.name}
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                          {(f.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground/50 hover:text-foreground"
                      aria-label={`Remove ${f.name}`}
                    >
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

            {/* Analyze Button */}
            <button
              data-testid="button-analyze"
              onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
              disabled={files.length === 0 || isAnalyzing}
              className={`relative w-full h-13 rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden group ${
                files.length === 0 || isAnalyzing
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.4)]"
              }`}
            >
              {files.length > 0 && !isAnalyzing && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              )}
              <span className="relative flex items-center justify-center gap-2.5 py-3.5">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing {files.length > 1 ? `${files.length} PDFs` : "document"}…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    {files.length > 1 ? `Analyze ${files.length} PDFs` : "Analyze PDF"}
                    {files.length > 0 && <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </span>
            </button>

            {/* Feature highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label, desc, color, bg }) => (
                <div
                  key={label}
                  className="flex flex-col gap-2.5 rounded-xl border border-border/50 bg-card/30 px-4 py-3.5 hover:border-border/80 transition-colors duration-200"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Results header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Analysis Complete</h2>
                  <p className="text-xs text-muted-foreground/70">
                    {result.repeatedQuestions.length} patterns · {result.importantTopics.length} topics · {result.expectedQuestions.length} predictions
                  </p>
                </div>
              </div>
              <button
                data-testid="button-analyze-another"
                onClick={() => { setResult(null); setFiles([]); setAnswerPanel(null); }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border/60 hover:border-border rounded-lg px-3 py-1.5 transition-all duration-150 hover:bg-muted/40"
              >
                <Upload className="w-3 h-3" />
                New Analysis
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
              {/* Left: Tabs */}
              <div>
                <Tabs defaultValue="repeated" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 mb-5 rounded-xl bg-muted/40 border border-border/40 p-1 h-auto gap-1">
                    <TabsTrigger value="repeated" className="gap-1.5 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                      <Repeat2 className="w-3.5 h-3.5" />
                      Repeated
                      {result.repeatedQuestions.length > 0 && (
                        <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{result.repeatedQuestions.length}</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="topics" className="gap-1.5 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                      <BarChart2 className="w-3.5 h-3.5" />
                      Topics
                      {result.importantTopics.length > 0 && (
                        <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-bold">{result.importantTopics.length}</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="expected" className="gap-1.5 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                      <Sparkles className="w-3.5 h-3.5" />
                      Predicted
                      {result.expectedQuestions.length > 0 && (
                        <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">{result.expectedQuestions.length}</span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* Repeated Questions */}
                  <TabsContent value="repeated">
                    <p className="text-xs text-muted-foreground/60 mb-3 flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3" />
                      Click any question to generate a model answer
                    </p>
                    <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.repeatedQuestions.length > 0 ? (
                        result.repeatedQuestions.map((item, i) => (
                          <ClickableQuestion
                            key={i}
                            index={i}
                            question={item.question}
                            isTop={i === 0}
                            badge={
                              i === 0 ? (
                                <Badge className="text-xs font-bold border bg-primary/12 text-primary border-primary/20 px-2 py-0.5 gap-1 rounded-lg">
                                  <Trophy className="w-2.5 h-2.5" />
                                  Top · {item.count}×
                                </Badge>
                              ) : (
                                <span className="text-xs font-semibold text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-md">
                                  {item.count}×
                                </span>
                              )
                            }
                            isActive={answerPanel?.question === item.question}
                            onClick={() => handleQuestionClick(item.question)}
                          />
                        ))
                      ) : (
                        <EmptyState message="No repeated questions found." />
                      )}
                    </div>
                  </TabsContent>

                  {/* Important Topics */}
                  <TabsContent value="topics">
                    <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.importantTopics.length > 0 ? (
                        result.importantTopics.map((topic, i) => {
                          const cfg = priorityConfig(topic.priority);
                          return (
                            <div
                              key={i}
                              data-testid={`card-topic-${i}`}
                              style={{ animationDelay: `${i * 40}ms` }}
                              className={`stagger-item flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3.5 transition-colors duration-150 hover:bg-muted/20 ${
                                topic.priority === "High" ? "border-l-2 border-l-red-500/50" : ""
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${topic.priority === "High" ? "font-semibold" : "font-medium"}`}>
                                  {topic.topic}
                                </span>
                                <div className="mt-2 w-full bg-muted/50 rounded-full h-1">
                                  <div className={`h-1 rounded-full ${cfg.bar} ${cfg.width} opacity-60`} />
                                </div>
                              </div>
                              <Badge className={`text-xs font-semibold border shrink-0 rounded-lg px-2.5 ${cfg.badge}`}>
                                {topic.priority}
                              </Badge>
                            </div>
                          );
                        })
                      ) : (
                        <EmptyState message="No important topics identified." />
                      )}
                    </div>
                  </TabsContent>

                  {/* Expected Questions */}
                  <TabsContent value="expected">
                    <p className="text-xs text-muted-foreground/60 mb-3 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      AI-predicted questions for the next exam sitting
                    </p>
                    <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.expectedQuestions.length > 0 ? (
                        result.expectedQuestions.map((q, i) => (
                          <ClickableQuestion
                            key={i}
                            index={i}
                            question={q}
                            badge={
                              <Badge className="text-xs font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/20 shrink-0 rounded-lg px-2">
                                Predicted
                              </Badge>
                            }
                            isActive={answerPanel?.question === q}
                            onClick={() => handleQuestionClick(q)}
                          />
                        ))
                      ) : (
                        <EmptyState message="No predictions could be generated." />
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: Answer Panel or Placeholder */}
              {answerPanel ? (
                <AnswerPanel state={answerPanel} onClose={() => setAnswerPanel(null)} />
              ) : (
                <AnswerPlaceholder />
              )}
            </div>
          </div>
        )}

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
