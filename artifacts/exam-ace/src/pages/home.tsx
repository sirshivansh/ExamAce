import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Loader2, BarChart2, BookOpen,
  CheckCircle, AlertCircle, ChevronRight, X,
  Lightbulb, List, BookMarked, AlignLeft, Sparkles,
  Trophy, MousePointerClick, Repeat2, Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      className={`stagger-item question-glow w-full text-left group rounded-lg border px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        isTop ? "top-question" : isActive ? "border-primary/60 bg-primary/[0.08] is-active" : "border-border bg-card"
      } ${isActive && !isTop ? "is-active" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className={`leading-snug flex-1 ${isTop ? "text-sm font-semibold" : "text-sm font-medium"}`}>
          {question}
        </p>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {badge}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-150" />
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
      className="rounded-xl border border-border bg-card shadow-xl animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden sticky top-6"
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-3 flex-1">
          {state.question}
        </p>
        <button
          data-testid="button-close-answer"
          onClick={onClose}
          className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {state.loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
          <div className="relative">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <div className="absolute inset-0 blur-md bg-primary/20 rounded-full" />
          </div>
          <span className="text-sm animate-pulse">Generating answer...</span>
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
        <div className="p-5 flex flex-col gap-5 text-sm max-h-[70vh] overflow-y-auto scrollable-list animate-in fade-in duration-300">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-widest">
              <AlignLeft className="w-3.5 h-3.5" />
              Definition
            </div>
            <p className="leading-relaxed text-foreground" data-testid="text-definition">
              {state.answer.definition}
            </p>
          </div>

          <div className="border-t border-border/50" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-widest">
              <List className="w-3.5 h-3.5" />
              Explanation
            </div>
            <ul className="flex flex-col gap-2.5" data-testid="list-explanation">
              {state.answer.explanation.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="leading-relaxed text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {state.answer.example && (
            <>
              <div className="border-t border-border/50" />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-widest">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Example
                </div>
                <p className="leading-relaxed text-muted-foreground italic px-3 py-2 rounded-md bg-muted/40 border border-border/40" data-testid="text-example">
                  {state.answer.example}
                </p>
              </div>
            </>
          )}

          <div className="border-t border-border/50" />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-widest">
              <BookMarked className="w-3.5 h-3.5" />
              Conclusion
            </div>
            <p className="leading-relaxed text-foreground" data-testid="text-conclusion">
              {state.answer.conclusion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/40 flex flex-col items-center justify-center gap-4 py-16 px-6 text-center animate-in fade-in duration-500 sticky top-6">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <MousePointerClick className="w-5 h-5 text-primary/60" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">Select a question to view answer</p>
        <p className="text-xs text-muted-foreground/60">Click any question on the left to generate a model answer</p>
      </div>
    </div>
  );
}

const FEATURE_HIGHLIGHTS = [
  { icon: Repeat2, label: "Repeated Questions", desc: "Groups similar questions and ranks by frequency" },
  { icon: BarChart2, label: "Priority Topics", desc: "Identifies High / Medium / Low priority topics" },
  { icon: Sparkles, label: "Predicted Questions", desc: "AI forecasts likely questions for your next exam" },
  { icon: Brain, label: "Model Answers", desc: "Generates structured 10-mark answers on demand" },
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [answerPanel, setAnswerPanel] = useState<AnswerPanelState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
      setError(null);
    } else {
      setError("Please upload a valid PDF file.");
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setError(null);
    } else {
      setError("Please upload a valid PDF file.");
    }
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setAnswerPanel(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!response.ok) {
        let serverMessage: string | undefined;
        try {
          const body = await response.json();
          serverMessage = (body as { error?: string }).error;
        } catch {
          // response body wasn't JSON — ignore
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

  const priorityColor = (priority: string) => {
    if (priority === "High") return "bg-red-500/15 text-red-400 border-red-500/30";
    if (priority === "Medium") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center py-12 px-4 md:px-8 bg-background">
      <div className="w-full max-w-4xl flex flex-col gap-10">

        {/* Header */}
        <header className="flex flex-col items-center text-center gap-3 animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-1">
            <BookOpen className="w-6 h-6" />
            <div className="absolute inset-0 rounded-xl blur-xl bg-primary/20 -z-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">ExamAce</h1>
          <p className="text-muted-foreground max-w-[520px] text-sm leading-relaxed">
            Upload any exam PDF and get instant AI-powered analysis — repeated questions, priority topics, predicted questions, and model answers.
          </p>
        </header>

        {/* Upload view */}
        {!result && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Card className="w-full border-dashed border-2 shadow-sm bg-card/50">
              <CardContent className="p-8 flex flex-col items-center justify-center gap-6">
                <div
                  data-testid="upload-dropzone"
                  className={`w-full max-w-xl p-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-primary bg-primary/5 shadow-[0_0_24px_0_hsl(190,90%,50%,0.15)]"
                      : "border-muted-foreground/20 hover:border-primary/30 hover:bg-muted/40"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf"
                    className="hidden"
                    data-testid="input-file"
                  />
                  <div className="p-4 rounded-full bg-muted transition-colors group-hover:bg-muted/80">
                    <Upload className={`w-8 h-8 transition-colors duration-200 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-medium">Click or drag PDF here</h3>
                    <p className="text-sm text-muted-foreground mt-1">Accepts .pdf files only · max 20 MB</p>
                  </div>
                  {file && (
                    <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm font-medium animate-in fade-in duration-200">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="max-w-[220px] truncate" data-testid="text-filename">{file.name}</span>
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive" className="max-w-xl w-full animate-in fade-in duration-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription data-testid="text-upload-error">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  data-testid="button-analyze"
                  onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
                  disabled={!file || isAnalyzing}
                  className="w-full max-w-sm h-12 text-base font-medium transition-all hover:scale-[1.015] active:scale-[0.99]"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analyzing Document...</>
                  ) : (
                    "Analyze PDF"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Feature highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 px-4 py-3.5"
                >
                  <Icon className="w-4 h-4 text-primary/70" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Analysis Results</h2>
              <Button
                data-testid="button-analyze-another"
                variant="outline"
                size="sm"
                onClick={() => { setResult(null); setFile(null); setAnswerPanel(null); }}
              >
                Analyze Another
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
              {/* Left: Tabs */}
              <div>
                <Tabs defaultValue="repeated" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 mb-5">
                    <TabsTrigger value="repeated" className="gap-1.5 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Repeated
                    </TabsTrigger>
                    <TabsTrigger value="topics" className="gap-1.5 text-xs">
                      <BarChart2 className="w-3.5 h-3.5" />
                      Topics
                    </TabsTrigger>
                    <TabsTrigger value="expected" className="gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      Expected
                    </TabsTrigger>
                  </TabsList>

                  {/* Repeated Questions */}
                  <TabsContent value="repeated">
                    <p className="text-xs text-muted-foreground/70 mb-3">
                      Click a question to generate a model answer.
                    </p>
                    <div className="flex flex-col gap-2.5 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.repeatedQuestions.length > 0 ? (
                        result.repeatedQuestions.map((item, i) => (
                          <ClickableQuestion
                            key={i}
                            index={i}
                            question={item.question}
                            isTop={i === 0}
                            badge={
                              i === 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <Badge className="text-xs font-bold border bg-primary/15 text-primary border-primary/25 px-2 py-0.5 gap-1">
                                    <Trophy className="w-3 h-3" />
                                    Top · {item.count}×
                                  </Badge>
                                </div>
                              ) : (
                                <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                                  {item.count}×
                                </Badge>
                              )
                            }
                            isActive={answerPanel?.question === item.question}
                            onClick={() => handleQuestionClick(item.question)}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed text-sm">
                          No repeated questions found.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Important Topics */}
                  <TabsContent value="topics">
                    <div className="flex flex-col gap-2.5 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.importantTopics.length > 0 ? (
                        result.importantTopics.map((topic, i) => (
                          <div
                            key={i}
                            data-testid={`card-topic-${i}`}
                            style={{ animationDelay: `${i * 40}ms` }}
                            className={`stagger-item flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-colors duration-150 hover:bg-muted/30 ${
                              topic.priority === "High" ? "topic-high" : ""
                            }`}
                          >
                            <span className={`text-sm flex-1 ${topic.priority === "High" ? "font-semibold" : "font-medium"}`}>
                              {topic.topic}
                            </span>
                            <Badge className={`text-xs font-semibold border shrink-0 ${priorityColor(topic.priority)}`}>
                              {topic.priority}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed text-sm">
                          No important topics identified.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Expected Questions */}
                  <TabsContent value="expected">
                    <p className="text-xs text-muted-foreground/70 mb-3">
                      AI-predicted questions for the next exam sitting. Click to generate a model answer.
                    </p>
                    <div className="flex flex-col gap-2.5 max-h-[520px] overflow-y-auto scrollable-list pr-0.5">
                      {result.expectedQuestions.length > 0 ? (
                        result.expectedQuestions.map((q, i) => (
                          <ClickableQuestion
                            key={i}
                            index={i}
                            question={q}
                            badge={
                              <Badge className="text-xs font-semibold border bg-primary/10 text-primary border-primary/20 shrink-0">
                                Predicted
                              </Badge>
                            }
                            isActive={answerPanel?.question === q}
                            onClick={() => handleQuestionClick(q)}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed text-sm">
                          No expected questions could be predicted.
                        </div>
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
