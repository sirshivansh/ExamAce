import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Loader2, BarChart2, BookOpen, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RepeatedQuestion {
  question: string;
  frequency: number;
  years: string[];
}

interface ImportantTopic {
  topic: string;
  description: string;
  weightage: "High" | "Medium" | "Low";
}

interface AnswerEntry {
  question: string;
  answer: string;
}

interface AnalysisResult {
  repeatedQuestions: RepeatedQuestion[];
  importantTopics: ImportantTopic[];
  answers: AnswerEntry[];
  summary: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

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
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getWeightageColor = (weightage: string) => {
    switch (weightage) {
      case "High":
        return "bg-destructive text-destructive-foreground border-destructive-border";
      case "Medium":
        return "bg-chart-4 text-primary-foreground border-chart-4";
      case "Low":
        return "bg-chart-5 text-primary-foreground border-chart-5";
      default:
        return "bg-secondary text-secondary-foreground";
    }
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
          <p className="text-muted-foreground max-w-[600px]">
            Upload your exam PDF to instantly extract repeated questions, important topics, and model answers.
          </p>
        </header>

        {/* Upload Section */}
        {!result && (
          <Card className="w-full border-dashed border-2 shadow-sm bg-card/50">
            <CardContent className="p-8 flex flex-col items-center justify-center gap-6">
              <div
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
                />
                
                <div className="p-4 rounded-full bg-muted">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                
                <div className="text-center">
                  <h3 className="text-lg font-medium">Click or drag PDF here</h3>
                  <p className="text-sm text-muted-foreground mt-1">Accepts .pdf files only</p>
                </div>
                
                {file && (
                  <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-primary/10 text-primary rounded-md text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    <span className="max-w-[200px] truncate">{file.name}</span>
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive" className="max-w-xl w-full">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyze();
                }} 
                disabled={!file || isAnalyzing}
                className="w-full max-w-sm h-12 text-base font-medium transition-all hover:scale-[1.02]"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Document...
                  </>
                ) : (
                  "Analyze PDF"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {result && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Analysis Results</h2>
              <Button variant="outline" onClick={() => { setResult(null); setFile(null); }}>
                Analyze Another
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{result.summary}</p>
              </CardContent>
            </Card>

            <Tabs defaultValue="repeated" className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-6">
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
                <TabsTrigger value="answers" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">Model Answers</span>
                  <span className="sm:hidden">Answers</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="repeated" className="space-y-4">
                {result.repeatedQuestions.length > 0 ? (
                  result.repeatedQuestions.map((item, i) => (
                    <Card key={i} className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-5">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <p className="text-base font-medium leading-tight flex-1">{item.question}</p>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold">
                              {item.frequency}x Repeated
                            </Badge>
                            {item.years.map((year, j) => (
                              <Badge key={j} variant="outline" className="text-xs">
                                {year}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    No repeated questions found.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="topics" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.importantTopics.length > 0 ? (
                    result.importantTopics.map((topic, i) => (
                      <Card key={i} className="hover:border-primary/30 transition-colors">
                        <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                          <CardTitle className="text-lg leading-tight">{topic.topic}</CardTitle>
                          <Badge className={`${getWeightageColor(topic.weightage)} ml-2 shrink-0`}>
                            {topic.weightage}
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-sm mt-2">{topic.description}</CardDescription>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                      No important topics identified.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="answers">
                <Card>
                  <CardContent className="p-0">
                    <Accordion type="multiple" className="w-full">
                      {result.answers.length > 0 ? (
                        result.answers.map((ans, i) => (
                          <AccordionItem key={i} value={`item-${i}`} className="px-5 border-b last:border-b-0">
                            <AccordionTrigger className="text-left font-medium hover:text-primary transition-colors py-4">
                              {ans.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground pb-5 leading-relaxed prose prose-invert max-w-none">
                              {ans.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          No model answers generated.
                        </div>
                      )}
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

      </div>
    </div>
  );
}
