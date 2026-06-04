import type { Response, NextFunction } from 'express';
import LocationService from '../services/LocationService.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { 
  ApiResponse, 
  LocationTrack, 
  PaginatedResponse
} from '../../shared/types.js';

export class LocationController {
  static async trackLocation(
    req: AuthRequest,
    res: Response<ApiResponse<LocationTrack>>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录'
          }
        });
        return;
      }

      const trackData = {
        ...req.body,
        trackedBy: req.user.userId
      };

      const location = await LocationService.trackLocation(trackData);
      res.status(201).json({
        success: true,
        data: location
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLocationHistory(
    req: AuthRequest,
    res: Response<ApiResponse<PaginatedResponse<LocationTrack>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assetUid } = req.params;
      const result = await LocationService.getLocationHistory(assetUid, req.query);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLatestLocation(
    req: AuthRequest,
    res: Response<ApiResponse<LocationTrack | null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assetUid } = req.params;
      const location = await LocationService.getLatestLocation(assetUid);
      res.json({
        success: true,
        data: location
      });
    } catch (error) {
      next(error);
    }
  }
}

export default LocationController;
