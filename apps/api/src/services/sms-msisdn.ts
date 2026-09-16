/**
 * Normalize an Ethiopian mobile number to the 2519XXXXXXXX format required
 * by the SMSEthiopia gateway (12 digits, starts with 2519).
 *
 * Accepts: +251911234567 | 251911234567 | 0911234567 | 911234567
 * Returns null for anything that is not a valid Ethio telecom mobile number.
 * Note: Safaricom Ethiopia 07xx numbers are rejected by the gateway itself.
 */
export function normalizeEthiopianMsisdn(input: string): string | null {
  let d = input.replace(/[^0-9]/g, '');
  if (d.startsWith('0')) d = `251${d.slice(1)}`;
  else if (d.length === 9 && d.startsWith('9')) d = `251${d}`;
  return /^2519\d{8}$/.test(d) ? d : null;
}
