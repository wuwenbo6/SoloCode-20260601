import { z } from 'zod';

const beaconSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  rssi: z.number(),
  uuid: z.string().optional(),
  major: z.number().optional(),
  minor: z.number().optional()
});

export const locationTrackSchema = z.object({
  assetUid: z.string().min(1, '资产UID不能为空'),
  gps: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional()
  }),
  beacons: z.array(beaconSchema).default([]),
  trackedAt: z.string(),
  trackedBy: z.string().min(1, '追踪人不能为空')
});

export const getLocationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export type LocationTrackInput = z.infer<typeof locationTrackSchema>;
export type GetLocationHistoryQueryInput = z.infer<typeof getLocationHistoryQuerySchema>;
