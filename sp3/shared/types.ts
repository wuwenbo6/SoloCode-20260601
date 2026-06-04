export interface SID {
  address: string;
  function: string;
  description: string;
  full_address?: string;
  compressed?: boolean;
  group_index?: number;
  format?: 'srv6' | 'usid' | 'usid_carrier';
  usid_value?: number;
  usid_hex?: string;
  block?: string;
  carrier_info?: UsidCarrierInfo;
}

export interface UsidCarrierInfo {
  carrier_address: string;
  block: string;
  num_usids: number;
  packed_functions: Array<{
    index: number;
    usid_value: number;
    function: string;
    description: string;
  }>;
  bytes_used: number;
  bytes_equivalent: number;
  savings: number;
}

export interface UsidInfo {
  format: string;
  total_usids: number;
  total_carriers: number;
  num_blocks: number;
  block_groups: Record<string, number>;
  original_bytes: number;
  compressed_bytes: number;
  bytes_saved: number;
  compression_ratio: number;
  carrier_details: UsidCarrierInfo[];
}

export interface SRHField {
  name: string;
  value: string;
  length: number;
  description: string;
}

export interface CompressionInfo {
  total_sids?: number;
  sids_compressed?: number;
  sids_at_branch?: number;
  prefix_hextets?: number;
  max_compression_depth?: number;
  branch_points?: number[];
  preserve_branches?: boolean;
  original_bytes?: number;
  compressed_bytes?: number;
  unique_sids?: number;
  duplicates_removed?: number;
  num_groups?: number;
  group_details?: Array<{
    group_index: number;
    group_size: number;
    prefix: string;
    prefix_hextets: number;
    sids_compressed: number;
  }>;
  [key: string]: any;
}

export interface CompressionResult {
  originalSids: SID[];
  compressedSids: SID[];
  originalTotalLength: number;
  compressedTotalLength: number;
  compressionRatio: number;
  bytesSaved: number;
  srhFields: SRHField[];
  compressedSrhFields: SRHField[];
  srhTotalLength: number;
  compressedSrhTotalLength: number;
  sharedPrefix: string;
  compressionMethod: string;
  compressionInfo: CompressionInfo;
  sidFormat?: string;
  usidInfo?: UsidInfo;
  usidCarriers?: SID[];
  report?: string;
}

export interface SimulateRequest {
  sidCount?: number;
  customSids?: string[];
  prefix?: string;
  compressionMethod?: 'prefix' | 'full';
  compressionDepth?: number;
  preserveBranches?: boolean;
  sidFormat?: 'srv6' | 'usid';
}

export interface SimulateResponse {
  success: boolean;
  data?: CompressionResult;
  error?: string;
}

export interface HealthResponse {
  status: string;
  pythonAvailable: boolean;
  timestamp: string;
}
