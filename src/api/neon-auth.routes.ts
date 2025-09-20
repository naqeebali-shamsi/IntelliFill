import { Router, Request, Response, NextFunction } from 'express';
import { NeonService } from '../services/NeonService';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

const router = Router();
const neonService = new NeonService();

// Extend Request to include auth context
interface AuthRequest extends Request {
  auth?: {
    userId: string;
    companyId: string;
    role: string;
  };
}

// Middleware to verify JWT and set tenant context
export const authenticateTenant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Get user context from database
    const authContext = await neonService.getUserByAuthId(decoded.authId);
    
    if (!authContext) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Set tenant context for RLS
    await neonService.setTenantContext(authContext.company_id, authContext.user_id);
    
    // Attach to request
    req.auth = {
      userId: authContext.user_id,
      companyId: authContext.company_id,
      role: authContext.role
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Company signup endpoint
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { companyName, companySlug, email, fullName, authId } = req.body;

    // Validate inputs
    if (!companyName || !companySlug || !email || !fullName || !authId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create company and owner
    const result = await neonService.createCompanyAndOwner(
      companyName,
      companySlug,
      email,
      fullName,
      authId
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        authId,
        companyId: result.company_id,
        userId: result.user_id 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    logger.info(`New company created: ${companySlug}`);

    return res.status(201).json({
      success: true,
      token,
      company: {
        id: result.company_id,
        slug: result.company_slug
      },
      user: {
        id: result.user_id
      }
    });
  } catch (error: any) {
    logger.error('Signup error:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Company slug already exists' });
    }
    
    return res.status(500).json({ error: 'Failed to create company' });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { authId } = req.body;

    if (!authId) {
      return res.status(400).json({ error: 'Auth ID required' });
    }

    // Get user context
    const authContext = await neonService.getUserByAuthId(authId);

    if (!authContext) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        authId,
        companyId: authContext.company_id,
        userId: authContext.user_id 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: authContext.user_id,
        email: authContext.email,
        fullName: authContext.full_name,
        role: authContext.role
      },
      company: {
        id: authContext.company_id,
        name: authContext.company_name,
        slug: authContext.company_slug,
        tier: authContext.subscription_tier,
        creditsRemaining: authContext.credits_remaining
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user context
router.get('/me', authenticateTenant, async (req: AuthRequest, res: Response) => {
  try {
    const authContext = await neonService.getUserByAuthId(req.auth!.userId);
    
    if (!authContext) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: authContext.user_id,
        email: authContext.email,
        fullName: authContext.full_name,
        role: authContext.role
      },
      company: {
        id: authContext.company_id,
        name: authContext.company_name,
        slug: authContext.company_slug,
        tier: authContext.subscription_tier,
        creditsRemaining: authContext.credits_remaining
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user context' });
  }
});

// Get company usage stats
router.get('/usage', authenticateTenant, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const usage = await neonService.getCompanyUsage(req.auth!.companyId, days);

    return res.json({
      companyId: req.auth!.companyId,
      period: `${days} days`,
      usage
    });
  } catch (error) {
    logger.error('Get usage error:', error);
    return res.status(500).json({ error: 'Failed to get usage data' });
  }
});

export { router as neonAuthRouter };