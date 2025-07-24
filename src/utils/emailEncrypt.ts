export function encodeEmail(email: string): string {
  const salted = `cuce-salt-${email}-shh`;
  return Buffer.from(salted).toString('base64');
}
