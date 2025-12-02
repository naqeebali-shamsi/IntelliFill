import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validated = await schema.validateAsync(req.body, {
        abortEarly: false, // Return all errors
        stripUnknown: true // Remove unknown fields
      });

      // Replace request body with validated data
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof Joi.ValidationError) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Validation failed', {
          path: req.path,
          errors
        });

        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }

      // Unexpected error
      logger.error('Validation middleware error', error);
      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
};

// Query validation middleware factory
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.validateAsync(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof Joi.ValidationError) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          error: 'Query validation failed',
          details: errors
        });
      }

      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
};

// Params validation middleware factory
export const validateParams = (schema: Joi.ObjectSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.validateAsync(req.params, {
        abortEarly: false
      });

      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof Joi.ValidationError) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          error: 'Parameter validation failed',
          details: errors
        });
      }

      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
};