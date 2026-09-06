const JOIN_CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode(length: number): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(
    values,
    (value) => JOIN_CODE_CHARACTERS[value % JOIN_CODE_CHARACTERS.length]
  ).join("");
}

export function generateJoinCode(): string {
  return generateCode(8);
}

export function generateInviteToken(): string {
  return generateCode(24);
}
