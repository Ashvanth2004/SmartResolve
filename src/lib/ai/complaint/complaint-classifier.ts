import { classifyComplaint as classifyComplaintEngine, type AiPrediction } from "@/lib/ai-engine";
import type { ComplaintClassificationResult } from "@/lib/ai/models/intent-analysis";

export async function classifyComplaint(
  title: string,
  description: string
): Promise<ComplaintClassificationResult | null> {
  try {
    const prediction = await classifyComplaintEngine(title, description);
    return {
      category: prediction.category,
      categoryName: prediction.categoryName,
      subcategory: prediction.subcategory,
      priority: prediction.priority,
      severity: prediction.severity,
      sentiment: prediction.sentiment,
      department: prediction.department,
      confidence: prediction.confidence,
      suggestedResolution: prediction.suggestedResolution,
      model: prediction.model,
    };
  } catch (err) {
    console.error("[complaint-classifier] Failed:", err);
    return null;
  }
}

export function isComplaintLike(text: string): boolean {
  const complaintIndicators = [
    "problem", "issue", "not working", "broken", "damaged",
    "complaint", "error", "failed", "can't", "cannot",
    "won't", "help", "support", "fix", "troubleshoot",
    "slow", "crash", "stuck", "not receiving", "never arrived",
    "charged", "billed", "overcharge", "refund",
    "can't login", "cannot access", "locked",
    "hacked", "security", "unauthorized",
  ];
  const lower = text.toLowerCase();
  return complaintIndicators.some((indicator) => lower.includes(indicator));
}
