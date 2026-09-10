"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

type QuestionResult = {
  id: number;
  text: string;
  options: { id: number; label: string; score: number }[];
  chosenOptionId: number | null;
};
type ResultData = {
  candidateName: string;
  positionName: string;
  jobTitle: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  passingScore: number;
  submittedAt: string;
  questions: QuestionResult[];
};

export function PsychTestResultDialog({ candidateId, size = "h-4 w-4" }: { candidateId: number; size?: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(open: boolean) {
    if (open && !data && !loading) {
      setLoading(true);
      fetch(`/api/candidates/${candidateId}/psychtest`)
        .then((r) => r.json())
        .then(setData)
        .finally(() => setLoading(false));
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger
        title="Lihat hasil psikotest"
        className="inline-flex items-center justify-center text-primary hover:text-primary/70 transition-colors"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <FileText className={size} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hasil Psikotest</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}

        {data && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">{data.candidateName}</p>
                <p className="text-sm text-muted-foreground">{data.positionName} &middot; {data.jobTitle}</p>
              </div>
              <div className="text-right">
                <Badge variant={data.passed ? "default" : "destructive"}>
                  {data.percentage}% &middot; {data.passed ? "Lulus" : "Tidak Lulus"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.totalScore}/{data.maxScore} poin &middot; ambang lulus {data.passingScore}%
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {data.questions.map((q, i) => {
                const maxOptionScore = Math.max(0, ...q.options.map((o) => o.score));
                return (
                  <div key={q.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium mb-2">{i + 1}. {q.text}</p>
                    <div className="grid gap-1">
                      {q.options.map((o) => {
                        const isChosen = o.id === q.chosenOptionId;
                        const isBest = maxOptionScore > 0 && o.score === maxOptionScore;
                        return (
                          <div
                            key={o.id}
                            className={`text-sm px-2 py-1 rounded-md ${
                              isChosen ? "bg-primary/10 font-medium" : "text-muted-foreground"
                            }`}
                          >
                            {o.label}
                            {isChosen && <span className="text-primary"> &larr; dipilih</span>}
                            {isBest && !isChosen && <span className="italic"> (jawaban terbaik)</span>}
                          </div>
                        );
                      })}
                    </div>
                    {q.chosenOptionId === null && (
                      <p className="text-xs text-destructive mt-1.5">Tidak dijawab (waktu habis)</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
