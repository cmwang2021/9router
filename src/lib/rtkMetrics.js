/**
 * shrimp-9router — RTK Metrics Collector
 * =======================================
 * Aggregates RTK compression statistics globally.
 * Provides lightweight API for HUD to pull metrics.
 */

import { EventEmitter } from "events";

// Singleton
let instance = null;

// In-memory accumulation (resets on restart, could persist to usageDb if needed)
let stats = {
  totalBytesBefore: 0,
  totalBytesAfter: 0,
  totalHits: 0,
  lastResetTs: Date.now(),
  recentHits: [], // Last 100 hits for detailed view
  byFilter: {},   // Stats grouped by filter name
  byShape: {},   // Stats grouped by message shape
};

// Event emitter for real-time updates
let emitter = null;

function getEmitter() {
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(20);
  }
  return emitter;
}

/**
 * Record a RTK compression result
 * @param {Object} rtkStats - The stats object from compressMessages()
 */
export function recordRtkStats(rtkStats) {
  if (!rtkStats || !rtkStats.hits || rtkStats.hits.length === 0) {
    return;
  }

  const saved = rtkStats.bytesBefore - rtkStats.bytesAfter;
  stats.totalBytesBefore += rtkStats.bytesBefore;
  stats.totalBytesAfter += rtkStats.bytesAfter;
  stats.totalHits += rtkStats.hits.length;

  // Track recent hits (last 100)
  for (const hit of rtkStats.hits) {
    const entry = {
      ...hit,
      timestamp: Date.now(),
    };
    stats.recentHits.push(entry);
    if (stats.recentHits.length > 100) {
      stats.recentHits.shift();
    }

    // Aggregate by filter
    const filterName = hit.filter || "unknown";
    if (!stats.byFilter[filterName]) {
      stats.byFilter[filterName] = { hits: 0, saved: 0, bytesBefore: 0, bytesAfter: 0 };
    }
    stats.byFilter[filterName].hits++;
    stats.byFilter[filterName].saved += hit.saved;
    stats.byFilter[filterName].bytesBefore += rtkStats.bytesBefore;
    stats.byFilter[filterName].bytesAfter += rtkStats.bytesAfter;

    // Aggregate by shape
    const shapeName = hit.shape || "unknown";
    if (!stats.byShape[shapeName]) {
      stats.byShape[shapeName] = { hits: 0, saved: 0 };
    }
    stats.byShape[shapeName].hits++;
    stats.byShape[shapeName].saved += hit.saved;
  }

  // Emit event for real-time subscribers
  getEmitter().emit("rtk-stats", {
    saved,
    bytesBefore: rtkStats.bytesBefore,
    bytesAfter: rtkStats.bytesAfter,
    hits: rtkStats.hits.length,
  });
}

/**
 * Get current metrics snapshot
 * @returns {Object}
 */
export function getRtkMetrics() {
  const totalSaved = stats.totalBytesBefore - stats.totalBytesAfter;
  const compressionRate = stats.totalBytesBefore > 0 
    ? ((totalSaved / stats.totalBytesBefore) * 100).toFixed(1) 
    : "0";

  return {
    // Summary
    totalBytesBefore: stats.totalBytesBefore,
    totalBytesAfter: stats.totalBytesAfter,
    totalSaved: totalSaved,
    compressionRate: `${compressionRate}%`,
    totalHits: stats.totalHits,
    lastResetTs: stats.lastResetTs,
    
    // By filter breakdown
    byFilter: stats.byFilter,
    
    // By shape breakdown
    byShape: stats.byShape,
    
    // Recent hits (last 100)
    recentHits: stats.recentHits.slice(-20), // Last 20 for API response
    
    // Timestamp
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Subscribe to real-time RTK events
 * @param {Function} callback 
 * @returns {Function} unsubscribe
 */
export function onRtkStats(callback) {
  const em = getEmitter();
  em.on("rtk-stats", callback);
  return () => em.off("rtk-stats", callback);
}

/**
 * Reset stats (called on service restart)
 */
export function resetRtkMetrics() {
  stats = {
    totalBytesBefore: 0,
    totalBytesAfter: 0,
    totalHits: 0,
    lastResetTs: Date.now(),
    recentHits: [],
    byFilter: {},
    byShape: {},
  };
}

// Export singleton getter
export function getRtkMetricsInstance() {
  if (!instance) {
    instance = {
      recordRtkStats,
      getRtkMetrics,
      onRtkStats,
      resetRtkMetrics,
    };
  }
  return instance;
}

export default {
  recordRtkStats,
  getRtkMetrics,
  onRtkStats,
  resetRtkMetrics,
  getRtkMetricsInstance,
};
