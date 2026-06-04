import { readFile } from "@tauri-apps/plugin-fs";

function detectEncoding(data: Uint8Array): "utf-8" | "gbk" {
  let i = 0;
  while (i < data.length) {
    if (data[i] < 0x80) {
      i++;
    } else if (data[i] < 0xc0) {
      return "gbk";
    } else if (data[i] < 0xe0) {
      if (i + 1 >= data.length) return "gbk";
      if ((data[i + 1] & 0xc0) !== 0x80) return "gbk";
      i += 2;
    } else if (data[i] < 0xf0) {
      if (i + 2 >= data.length) return "gbk";
      if ((data[i + 1] & 0xc0) !== 0x80 || (data[i + 2] & 0xc0) !== 0x80) return "gbk";
      i += 3;
    } else if (data[i] < 0xf8) {
      if (i + 3 >= data.length) return "gbk";
      if (
        (data[i + 1] & 0xc0) !== 0x80 ||
        (data[i + 2] & 0xc0) !== 0x80 ||
        (data[i + 3] & 0xc0) !== 0x80
      )
        return "gbk";
      i += 4;
    } else {
      return "gbk";
    }
  }
  return "utf-8";
}

export async function readTextFileAutoEncoding(path: string): Promise<string> {
  const data = await readFile(path);
  const encoding = detectEncoding(data);

  if (encoding === "utf-8") {
    return new TextDecoder("utf-8").decode(data);
  } else {
    try {
      return new TextDecoder("gbk").decode(data);
    } catch {
      return new TextDecoder("utf-8").decode(data);
    }
  }
}
