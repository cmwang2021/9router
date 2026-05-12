/**
 * GET /api/shrimp/metrics
 * Returns combined usage + RTK metrics for HUD
 */
import { NextResponse } from "next/server";
import { getRtkMetrics } from "@/lib/rtkMetrics.js";
import { getUsageStats } from "@/lib/usageDb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    // Get RTK metrics
    const rtkMetrics = getRtkMetrics();
    
    // Get recent usage (last 24h for quick stats)
    let usageMetrics = {};
    try {
      usageMetrics = await getUsageStats("24h");
    } catch (e) {
      console.warn("[metrics] Failed to get usage stats:", e.message);
    }
    
    // Combine into unified response
    const response = {
      // RTK Compression Stats
      rtk: {
        enabled: true,
        totalBytesBefore: rtkMetrics.totalBytesBefore,
        totalBytesAfter: rtkMetrics.totalBytesAfter,
        totalSaved: rtkMetrics.totalSaved,
        compressionRate: rtkMetrics.compressionRate,
        totalHits: rtkMetrics.totalHits,
        byFilter: rtkMetrics.byFilter,
        byShape: rtkMetrics.byShape,
      },
      
      // Token Usage Stats (last 24h)
      usage: {
        requests: usageMetrics.totalRequests || 0,
        promptTokens: usageMetrics.totalPromptTokens || 0,
        completionTokens: usageMetrics.totalCompletionTokens || 0,
        totalTokens: (usageMetrics.totalPromptTokens || 0) + (usageMetrics.totalCompletionTokens || 0),
        cost: usageMetrics.totalCost || 0,
      },
      
      // Meta
      generatedAt: new Date().toISOString(),
      lastReset: new Date(rtkMetrics.lastResetTs).toISOString(),
    };
    
    return NextResponse.json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[API] /api/shrimp/metrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
