export async function hashFile(path: string): Promise<string> {
  const file = Bun.file(path);
  const hasher = new Bun.CryptoHasher("sha256");
  const buffer = await file.arrayBuffer();
  hasher.update(buffer);
  return hasher.digest("hex");
}

export async function hashString(content: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}
