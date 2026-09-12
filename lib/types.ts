export type LeadVariant = "live_violation" | "live_bid" | "predictive" | "subcontract";

export type LeadSource =
  | "echo_cwa"
  | "echo_sdwa"
  | "echo_rcra"
  | "superfund"
  | "sam_gov"
  | "usaspending"
  | "pfas_watchlist"
  | "e_amlis"
  | "srf"
  | "tceq"
  | "mpca";

export type DraftLead = {
  source: LeadSource;
  variant: LeadVariant;
  facilityName: string;
  city?: string | null;
  county?: string | null;
  state: string;
  address?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  summary: string;
  detail: string;
  contaminantClass?: string | null;
  violationType?: string | null;
  fineAmount?: number | null;
  contractType?: string | null;
  estimatedValue?: number | null;
  sourceRecordUrl: string;
  sourceRecordId: string;
  registryId?: string | null;
  permitId?: string | null;
  eventDate?: Date | null;
  forecastWindow?: string | null;
  primeContractor?: string | null;
  complianceHistory?: string | null;
  flowMgd?: number | null;
  badges: string[];
  metadata?: Record<string, unknown>;
};

export type IngestResult = {
  source: string;
  found: number;
  created: number;
  updated: number;
  error?: string;
};
