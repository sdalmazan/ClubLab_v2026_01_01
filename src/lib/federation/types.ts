// ============================================================
// Federation Scraper — TypeScript Types
// ============================================================

export type CompetitionConfig = {
  season: string;
  competitionName: string;
  region: string;
  competicion: string;
  grupo: string;
  temporada: string;
  domain?: string;
  codAgrupacion?: string;
};

export type ScraperOptions = {
  delayMatch: number;       // ms between match PDF downloads
  delayMatchday: number;    // ms between matchday page requests
  maxMatchday: number;      // safety upper limit (e.g. 60)
  emptyLimit: number;       // consecutive empty matchdays before stopping
};

export type MatchdayPageResult =
  | {
      status: "valid";
      matchday: number;
      html: string;
      actaIds: string[];
    }
  | {
      status: "not_found";
      matchday: number;
      reason: string;
    }
  | {
      status: "blocked";
      matchday: number;
      reason: string;
    }
  | {
      status: "error";
      matchday: number;
      reason: string;
    };

export type ScraperSummary = {
  success: boolean;
  season: string;
  competitionName: string;
  competitionCode: string;
  groupCode: string;
  seasonCode: string;
  detectionMethod: "dom" | "progressive" | "manual";
  detectedMatchdays: number[];
  processedMatchdays: number[];
  validMatchdays: number[];
  emptyMatchdays: number[];
  matchesFound: number;
  matchesExisting: number;
  matchesInserted: number;
  matchesFailed: number;
  stoppedBecause:
    | "completed"
    | "consecutive_empty"
    | "blocked"
    | "manual_range_completed"
    | "fatal_error";
  errors: Array<{
    matchday?: number;
    federationId?: string;
    message: string;
  }>;
};
