import { Request, Response, NextFunction } from 'express';
import IdempotencyKey from '../models/IdempotencyKey';

const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';
const IDEMPOTENCY_TTL_HOURS = 24;

interface RequestWithRawBody extends Request {
  rawBody?: string;
}

export const idempotency = async (
  req: RequestWithRawBody,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const idempotencyKey = req.header(IDEMPOTENCY_HEADER);
  
  if (!idempotencyKey) {
    return next();
  }
  
  try {
    const existingKey = await IdempotencyKey.findOne({ key: idempotencyKey });
    
    if (existingKey) {
      const responseData = existingKey.response as Record<string, unknown>;
      res.status(existingKey.statusCode).json({
        ...responseData,
        isDuplicate: true,
        idempotencyKey,
      });
      return;
    }
    
    const originalSend = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let responseData: unknown;
    let statusCode = 200;
    
    res.status = (code: number) => {
      statusCode = code;
      return originalStatus(code);
    };
    
    res.json = (body: unknown) => {
      responseData = body;
      
      if (statusCode >= 200 && statusCode < 300) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);
        
        IdempotencyKey.create({
          key: idempotencyKey,
          response: body,
          statusCode,
          expiresAt,
        }).catch((err) => {
          console.error('Failed to save idempotency key:', err);
        });
      }
      
      return originalSend(body);
    };
    
    next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    next();
  }
};

export default idempotency;
