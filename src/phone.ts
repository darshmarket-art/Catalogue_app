/**
 * What a buyer typed or pasted, as the ten digits of an Indian mobile number: "+91 98765 43210", "09876543210" and "919876543210" all become
 * 9876543210. (The sign-in field used to cut a pasted number at eleven characters, so one with its country code lost its last digits.)
 */
export const tenDigits = (raw: string): string => {
  let d = raw.replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  else if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};
