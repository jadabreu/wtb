function extractPartialJsonStringValue(source: string, key: string) {
  const keyPattern = `"${key}"`;
  const keyIndex = source.indexOf(keyPattern);
  if (keyIndex === -1) return "";

  const colonIndex = source.indexOf(":", keyIndex + keyPattern.length);
  if (colonIndex === -1) return "";

  let quoteIndex = -1;
  for (let index = colonIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (/\s/.test(char)) continue;
    if (char !== '"') return "";
    quoteIndex = index;
    break;
  }

  if (quoteIndex === -1) return "";

  let value = "";
  let escaping = false;
  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const char = source[index];

    if (escaping) {
      value += `\\${char}`;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') break;
    value += char;
  }

  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

export { extractPartialJsonStringValue };
