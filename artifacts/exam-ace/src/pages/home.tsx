import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Loader2, BarChart2, BookOpen,
  CheckCircle, AlertCircle, ChevronRight, X,
  Lightbulb, List, BookMarked, AlignLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setError(null);
    } else {
      setError("Please upload a valid PDF file.");
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
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
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Analysis failed. Please try again.");
      }
      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate answer.");
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
      <div className="w-full max-w-4xl flex flex-col gap-8">

        {/* Header */}
        <header className="flex flex-col items-center text-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-2">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">ExamAce</h1>
          <p className="text-muted-foreground max-w-[560px]">
            Upload your exam PDF to extract repeated questions, priority topics, and AI-generated model answers.
          </p>
        </header>

        {/* Upload */}
        {!result && (
          <Card className="w-full border-dashed border-2 shadow-sm bg-card/50">
            <CardContent className="p-8 flex flex-col items-center justify-center gap-6">
              <div
                data-testid="upload-dropzone"
                className={`w-full max-w-xl p-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:bg-muted/50"
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
                <div className="p-4 rounded-full bg-muted">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium">Click or drag PDF here</h3>
                  <p className="text-sm text-muted-foreground mt-1">Accepts .pdf files only</p>
                </div>
                {file && (
                  <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    <span className="max-w-[220px] truncate" data-testid="text-filename">{file.name}</span>
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive" className="max-w-xl w-full">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription data-testid="text-upload-error">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                data-testid="button-analyze"
                onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
                disabled={!file || isAnalyzing}
                className="w-full max-w-sm h-12 text-base font-medium transition-all hover:scale-[1.02]"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analyzing Document...</>
                ) : (
                  "Analyze PDF"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Analysis Results</h2>
              <Button
                data-testid="button-analyze-another"
                variant="outline"
                onClick={() => { setResult(null); setFile(null); setAnswerPanel(null); }}
              >
                Analyze Another
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
              {/* Left: Tabs */}
              <div>
                <Tabs defaultValue="repeated" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 mb-6">
                    <TabsTrigger value="repeated" className="gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Repeated Questions</span>
                      <span className="sm:hidden">Repeated</span>
                    </TabsTrigger>
                    <TabsTrigger value="topics" className="gap-2">
                      <BarChart2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Important Topics</span>
                      <span className="sm:hidden">Topics</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="repeated" className="space-y-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Click a question to generate a model answer.
                    </p>
                    {result.repeatedQuestions.length > 0 ? (
                      result.repeatedQuestions.map((item, i) => (
                        <button
                          key={i}
                          data-testid={`card-question-${i}`}
                          onClick={() => handleQuestionClick(item.question)}
                          className={`w-full text-left group rounded-lg border px-5 py-4 transition-all hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                            answerPanel?.question === item.question
                              ? "border-primary/60 bg-primary/8"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-medium leading-snug flex-1">{item.question}</p>
                            <div className="flex items-center gap-2 shrink-0 mt-0.5">
                              <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                                {item.count}×
                              </Badge>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                        No repeated questions found.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="topics" className="space-y-3">
                    {result.importantTopics.length > 0 ? (
                      result.importantTopics.map((topic, i) => (
                        <div
                          key={i}
                          data-testid={`card-topic-${i}`}
                          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4"
                        >
                          <span className="text-sm font-medium">{topic.topic}</span>
                          <Badge className={`text-xs font-semibold border shrink-0 ${priorityColor(topic.priority)}`}>
                            {topic.priority} Priority
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                        No important topics identified.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: Answer Panel */}
              {answerPanel && (
                <div
                  data-testid="panel-answer"
                  className="rounded-xl border border-border bg-card shadow-lg animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden"
                >
                  {/* Panel header */}
                  <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
                    <p className="text-sm font-semibold leading-snug text-foreground line-clamp-3 flex-1">
                      {answerPanel.question}
                    </p>
                    <button
                      data-testid="button-close-answer"
                      onClick={() => setAnswerPanel(null)}
                      className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Loading */}
                  {answerPanel.loading && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm">Generating answer...</span>
                    </div>
                  )}

                  {/* Error */}
                  {answerPanel.error && (
                    <div className="p-5">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription data-testid="text-answer-error">{answerPanel.error}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Answer content */}
                  {answerPanel.answer && (
                    <div className="p-5 flex flex-col gap-5 text-sm">

                      {/* Definition */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                          <AlignLeft className="w-3.5 h-3.5" />
                          Definition
                        </div>
                        <p className="leading-relaxed text-foreground" data-testid="text-definition">
                          {answerPanel.answer.definition}
                        </p>
                      </div>

                      <div className="border-t border-border/50" />

                      {/* Explanation */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                          <List className="w-3.5 h-3.5" />
                          Explanation
                        </div>
                        <ul className="flex flex-col gap-2" data-testid="list-explanation">
                          {answerPanel.answer.explanation.map((point, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              <span className="leading-relaxed text-muted-foreground">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Example */}
                      {answerPanel.answer.example && (
                        <>
                          <div className="border-t border-border/50" />
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                              <Lightbulb className="w-3.5 h-3.5" />
                              Example
                            </div>
                            <p className="leading-relaxed text-muted-foreground italic" data-testid="text-example">
                              {answerPanel.answer.example}
                            </p>
                          </div>
                        </>
                      )}

                      <div className="border-t border-border/50" />

                      {/* Conclusion */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                          <BookMarked className="w-3.5 h-3.5" />
                          Conclusion
                        </div>
                        <p className="leading-relaxed text-foreground" data-testid="text-conclusion">
                          {answerPanel.answer.conclusion}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
