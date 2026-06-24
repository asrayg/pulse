import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { AskExperience } from "@/components/ask/ask-experience";

const SUGGESTIONS = [
  "Why did revenue drop this week?",
  "Who are our top 10 customers by revenue?",
  "How many active users do we have?",
  "Show weekly revenue over the last 8 weeks.",
  "Why are support tickets spiking?",
  "How is churn trending?",
];

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getCtx();
  const { q } = await searchParams;
  const sources = ctx?.workspaceId
    ? db.select().from(schema.dataSources).where(eq(schema.dataSources.workspaceId, ctx.workspaceId)).all()
    : [];
  const dataSources = sources.map((s) => ({ id: s.id, name: s.name, type: s.type }));
  // Put demo first
  dataSources.sort((a, b) => (a.type === "demo" ? -1 : 0) - (b.type === "demo" ? -1 : 0));

  return (
    <div className="h-full">
      <AskExperience dataSources={dataSources} suggestions={SUGGESTIONS} initialQuestion={q} />
    </div>
  );
}
