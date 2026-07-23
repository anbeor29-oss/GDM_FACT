/**
 * Companies Controller
 * HTTP request handlers for companies
 */

import { Request, Response } from 'express';
import * as companiesService from './companies.service';
import { ValidationError, ForbiddenError } from '../../middleware/errorHandler';
import logger from '../../middleware/logger';

/**
 * POST /api/v1/companies
 * Create company (admin only)
 */
export async function createCompany(req: Request, res: Response) {
  const { rfc, businessName, fiscalRegime, postalCode, state, email, phone } = req.body;

  // Validate input
  if (!rfc || !businessName || !fiscalRegime) {
    throw new ValidationError('RFC, business name, and fiscal regime are required');
  }

  // Create company
  const company = await companiesService.createCompany({
    rfc,
    businessName,
    fiscalRegime,
    postalCode,
    state,
    email,
    phone,
  });

  res.status(201).json({
    success: true,
    message: 'Company created successfully',
    data: company,
  });
}

/**
 * GET /api/v1/companies/:id
 * Get company by ID
 */
export async function getCompany(req: Request, res: Response) {
  const { id } = req.params;

  // Check authorization (user can only access their own company)
  if (req.user?.companyId !== id && req.user?.role !== 'ADMIN') {
    throw new ForbiddenError('You do not have access to this company');
  }

  const company = await companiesService.getCompanyById(id);

  res.status(200).json({
    success: true,
    data: company,
  });
}

/**
 * GET /api/v1/companies
 * List all companies (admin only)
 */
export async function listCompanies(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  if (page < 1 || limit < 1) {
    throw new ValidationError('Page and limit must be positive numbers');
  }

  const offset = (page - 1) * limit;

  const { companies, total } = await companiesService.listCompanies(limit, offset);

  res.status(200).json({
    success: true,
    data: {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    },
  });
}

/**
 * PUT /api/v1/companies/:id
 * Update company
 */
export async function updateCompany(req: Request, res: Response) {
  const { id } = req.params;
  const updateData = req.body;

  // Check authorization
  if (req.user?.companyId !== id && req.user?.role !== 'ADMIN') {
    throw new ForbiddenError('You do not have access to this company');
  }

  const company = await companiesService.updateCompany(id, updateData);

  res.status(200).json({
    success: true,
    message: 'Company updated successfully',
    data: company,
  });
}

/**
 * DELETE /api/v1/companies/:id
 * Delete company (soft delete)
 */
export async function deleteCompany(req: Request, res: Response) {
  const { id } = req.params;

  // Check authorization (admin only)
  if (req.user?.role !== 'ADMIN') {
    throw new ForbiddenError('Only admins can delete companies');
  }

  await companiesService.deleteCompany(id);

  res.status(200).json({
    success: true,
    message: 'Company deleted successfully',
  });
}

export default {
  createCompany,
  getCompany,
  listCompanies,
  updateCompany,
  deleteCompany,
  updateSMTP,
  testSMTP,
};

/**
 * PATCH /companies/:id/smtp — persiste SMTP de la empresa. La password se
 * cifra con AES-256-GCM (misma key que CSD). Si no se envía password nueva,
 * conserva la existente. Invalida el cache del mailer para que la siguiente
 * llamada tome la nueva config.
 */
export async function updateSMTP(req: Request, res: Response) {
  const { id } = req.params;
  const { mail_host, mail_port, mail_secure, mail_user, mail_pass, mail_from } = req.body || {};
  if (!mail_host || !mail_user) {
    throw new (require('../../middleware/errorHandler').ValidationError)('mail_host y mail_user son obligatorios');
  }
  const { query } = require('../../config/database');
  const { encryptPass, invalidateSMTPCache } = require('../mailer/mailer.service');
  const fields = ['mail_host=$1','mail_port=$2','mail_secure=$3','mail_user=$4','mail_from=$5','mail_updated_at=NOW()'];
  const values: any[] = [mail_host, Number(mail_port) || 587, mail_secure === true, mail_user, mail_from || mail_user];
  if (mail_pass && String(mail_pass).length > 0) {
    fields.push(`mail_pass_enc=$${values.length + 1}`);
    values.push(encryptPass(String(mail_pass)));
  }
  values.push(id);
  await query(`UPDATE companies SET ${fields.join(', ')} WHERE id=$${values.length}`, values);
  invalidateSMTPCache(id);
  res.json({ success: true });
}

/** POST /companies/:id/smtp/test — envía un email al ADMIN autenticado. */
export async function testSMTP(req: Request, res: Response) {
  const { id } = req.params;
  const email = (req as any).user?.email;
  if (!email) throw new (require('../../middleware/errorHandler').ValidationError)('Sin email en el JWT');
  const { sendTestMail } = require('../mailer/mailer.service');
  try {
    await sendTestMail(id, email);
    res.json({ success: true, message: `Correo de prueba enviado a ${email}` });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e?.message || 'Error al enviar prueba' });
  }
}
