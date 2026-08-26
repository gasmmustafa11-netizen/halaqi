import { Request, Response } from 'express';
import { db } from '../server/db';

/**
 * Legacy compatibility controller.
 *
 * The active salon registration endpoint is:
 * POST /api/salons
 * in src/server/app.ts.
 *
 * This controller is retained only so TypeScript compilation succeeds
 * if another module imports it.
 */
export const registerSalon = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: 'يجب تسجيل الدخول أولاً'
      });
    }

    return res.status(410).json({
      success: false,
      error: 'استخدم واجهة تسجيل الصالون الرئيسية.'
    });
  } catch (error) {
    console.error('[Legacy Salon Controller]', error);

    return res.status(500).json({
      success: false,
      error: 'خطأ أثناء معالجة طلب الصالون'
    });
  }
};
