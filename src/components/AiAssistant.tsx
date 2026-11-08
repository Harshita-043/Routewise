import { useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { askRagAssistant, type RagResponse } from "@/services/api";

const SUGGESTIONS = [
  "Find trains between New Delhi and Mumbai",
  "How does Tatkal booking work for AC and Non-AC classes?",
  "What are the chances of a waitlisted (WL) ticket confirming?",
  "What is the cheapest way to travel from Bhopal to Indore?",
];

export default function AiAssistant() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RagResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  const handleSubmit = async (userQuestion?: string) => {
    const q = (userQuestion || query).trim();
    if (!q) return;

    setIsLoading(true);
    setError(null);
    if (userQuestion) {
      setQuery(userQuestion);
    }

    try {
      const data = await askRagAssistant(q);
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI assistant answer");
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-card via-card to-primary/5 p-6 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">RouteWise RAG Assistant</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" /> Live Retrieval
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Retrieval-Augmented Indian transport assistant with verified grounding and anti-hallucination validation.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={isLoading}
            onClick={() => handleSubmit(suggestion)}
            className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Question Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about train schedules, Tatkal, RAC rules, fares, or routes..."
          className="h-12 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="h-12 rounded-2xl px-6 font-semibold shadow-md"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Ask AI</span>
        </Button>
      </form>

      {/* Error display */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Response Box */}
      {response && (
        <div className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm backdrop-blur">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                Intent: {response.intent}
              </span>
              {response.confidence && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Confidence: {response.confidence}
                </span>
              )}
              {response.provider && (
                <span className="rounded-md bg-muted px-2 py-0.5">
                  LLM: {response.provider.toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {response.dataFreshness?.isLive ? "Live data retrieved" : "Grounding verified"} ·{" "}
              {new Date(response.dataFreshness?.retrievedAt || Date.now()).toLocaleTimeString()}
            </span>
          </div>

          {/* Answer Text */}
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
            {response.answer}
          </div>

          {/* Retrieved trains preview if present */}
          {response.retrievedData && response.retrievedData.length > 0 && (
            <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Verified Database Matches ({response.retrievedData.length}):
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {response.retrievedData.map((train) => (
                  <div
                    key={train.trainNo}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-card p-2 text-xs"
                  >
                    <div>
                      <span className="font-bold">{train.trainName}</span>{" "}
                      <span className="text-muted-foreground">({train.trainNo})</span>
                      <p className="text-[11px] text-muted-foreground">
                        {train.source} ({train.departureTime}) → {train.destination} ({train.arrivalTime})
                      </p>
                    </div>
                    <span className="font-semibold text-primary">₹{train.fare}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources attribution */}
          {response.sources && response.sources.length > 0 && (
            <div className="border-t border-border/40 pt-2">
              <button
                type="button"
                onClick={() => setShowSources((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Layers className="h-3 w-3" />
                {showSources ? "Hide Sources" : `View Sources (${response.sources.length})`}
              </button>

              {showSources && (
                <div className="mt-2 space-y-2">
                  {response.sources.map((src, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{src.title}</span>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Source <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{src.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
