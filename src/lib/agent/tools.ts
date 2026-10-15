import { tool } from "ai";
import { z } from "zod";
import { searchDocs } from "@/lib/kb/search";
import { SERVICES } from "@/lib/kb/docs";
import { normalizeChannel } from "./policy";

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("Cancelled"));
    });
  });

// Demo data: pretend error counts per service over the last hours.
const ERROR_SERIES: Record<string, number[]> = {
  checkout: [12, 14, 11, 96, 240, 188],
  payments: [3, 4, 3, 71, 160, 122],
  auth: [5, 4, 6, 5, 7, 6],
  search: [8, 9, 30, 28, 12, 9],
};

let ticketSeq = 1040;

export function makeTools(opts: { stageDelayMs?: number } = {}) {
  const stageDelay = opts.stageDelayMs ?? 700;

  return {
    searchDocs: tool({
      description:
        "Search the on-call runbooks. Returns the best matching documents with ids to cite as [kb:<id>].",
      inputSchema: z.object({
        query: z.string().min(2).describe("What to look up, in plain words"),
      }),
      execute: async ({ query }) => {
        const started = Date.now();
        const hits = searchDocs(query);
        return { query, hits, tookMs: Date.now() - started };
      },
    }),

    analyzeIncidents: tool({
      description:
        "Analyze recent error counts for one service. Long running: streams progress while it works.",
      inputSchema: z.object({
        service: z.enum(SERVICES),
        hours: z.number().int().min(1).max(24).default(6),
      }),
      async *execute({ service, hours }, { abortSignal }) {
        const started = Date.now();
        const stages = ["Fetching error counts", "Comparing with baseline", "Finding the spike"];
        for (let i = 0; i < stages.length; i++) {
          yield {
            status: "running" as const,
            stage: stages[i],
            progress: Math.round((i / stages.length) * 100),
          };
          await sleep(stageDelay, abortSignal);
        }
        const series = ERROR_SERIES[service].slice(-hours);
        const baseline = Math.round((series[0] + series[1]) / 2);
        const peak = Math.max(...series);
        const peakHour = series.indexOf(peak);
        yield {
          status: "done" as const,
          stage: "Done",
          progress: 100,
          service,
          series,
          baseline,
          peak,
          spikeStartedHoursAgo: series.length - series.findIndex((n) => n > baseline * 3),
          peakHoursAgo: series.length - peakHour,
          severity: peak > baseline * 10 ? ("P1" as const) : peak > baseline * 3 ? ("P2" as const) : ("none" as const),
          tookMs: Date.now() - started,
        };
      },
    }),

    createTicket: tool({
      description: "Open an incident ticket. Needs human approval before it runs.",
      inputSchema: z.object({
        title: z.string().min(5),
        priority: z.enum(["P1", "P2", "P3"]),
        summary: z.string().min(10),
      }),
      execute: async ({ title, priority }) => {
        const started = Date.now();
        ticketSeq += 1;
        return {
          ticketId: `OPS-${ticketSeq}`,
          title,
          priority,
          url: `https://tickets.example/OPS-${ticketSeq}`,
          tookMs: Date.now() - started,
        };
      },
    }),

    notifyChannel: tool({
      description:
        "Post a message to a team chat channel. Needs human approval. #all-hands and #customers are blocked.",
      inputSchema: z.object({
        channel: z.string().describe("Channel name such as #incidents"),
        message: z.string().min(5),
      }),
      execute: async ({ channel, message }) => {
        const started = Date.now();
        return {
          delivered: true,
          channel: normalizeChannel(channel),
          preview: message.slice(0, 120),
          postedAt: new Date().toISOString(),
          tookMs: Date.now() - started,
        };
      },
    }),
  };
}

export type WorkspaceTools = ReturnType<typeof makeTools>;
