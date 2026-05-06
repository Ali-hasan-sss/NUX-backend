import cron from 'node-cron';
import { companyService, yearMonthUTC } from '../services/company.service';

/** Daily run credits the current UTC month once per active company (idempotent). */
export async function runCompanyMonthlyAllowancesJob() {
  const ym = yearMonthUTC();
  try {
    const n = await companyService.runMonthlyAllowancesForAllCompanies(ym);
    if (n > 0) {
      console.log(`Company allowance job: completed runs for ${n} companies (UTC month ${ym})`);
    }
  } catch (err) {
    console.error('Company allowance job error:', err);
  }
}

/** Schedule: every day at 06:10 UTC (covers start-of-month if the server was down on day 1). */
export function startCompanyAllowanceJob() {
  cron.schedule('10 6 * * *', runCompanyMonthlyAllowancesJob);
}
