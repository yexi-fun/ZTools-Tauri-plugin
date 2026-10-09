/**
 * 最小 zip 读写（仅"存储 stored"条目）。
 *
 * `.zpx` 就是 zip：ZTools-Tauri 的安装器按 zip 解析，并要求条目是**普通文件**
 * （符号链接会被拒绝）。本仓库只写入 stored 条目，因此读取端也只需要支持 stored —— 
 * 这让"从已构建的包里读回 plugin.json"变成几十行代码，不必引入 zip 依赖。
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * CRC-32（IEEE 802.3），zip 条目头必需。
 * @param {Buffer} buffer 数据。
 * @returns {number} 无符号 CRC-32。
 */
export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 收集目录下所有文件（相对路径统一用 `/`）。
 *
 * 跳过 `.zpx` 与常见垃圾文件：打包产物常就放在插件目录里，不跳过会把上一次的包塞进新包。
 * @param {string} root 根目录。
 * @param {string} [prefix] 当前相对前缀。
 * @returns {Array<{relative: string, absolute: string}>} 文件清单。
 */
export function collectFiles(root, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...collectFiles(root, relative));
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.zpx') || entry.name === '.DS_Store') continue;
    files.push({ relative, absolute: path.join(root, relative) });
  }
  return files;
}

/**
 * 写入 local file header + 数据。
 * @param {Buffer[]} parts 输出片段。
 * @param {string} name 条目名。
 * @param {Buffer} data 数据。
 * @returns {{crc: number, offset: number}} CRC 与偏移。
 */
function writeLocalHeader(parts, name, data) {
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const offset = parts.reduce((total, part) => total + part.length, 0);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8); // 仅存储
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  parts.push(header, nameBytes, data);
  return { crc, offset };
}

/**
 * 写入 central directory 条目。
 * @param {Buffer[]} parts 输出片段。
 * @param {{name: string, crc: number, offset: number, size: number}} entry 条目。
 * @returns {number} 该条目占用的字节数。
 */
function writeCentralHeader(parts, entry) {
  const nameBytes = Buffer.from(entry.name, 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.size, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38); // 普通文件：无 unix 属性位 → 安装器不会误判符号链接
  header.writeUInt32LE(entry.offset, 42);
  parts.push(header, nameBytes);
  return header.length + nameBytes.length;
}

/**
 * 把一个目录打成 `.zpx`。
 * @param {string} sourceDir 源目录（必须含 plugin.json）。
 * @param {string} output 输出路径。
 * @returns {{files: number, bytes: number, output: string}} 结果。
 */
export function packDirectory(sourceDir, output) {
  if (!fs.existsSync(path.join(sourceDir, 'plugin.json'))) {
    throw new Error(`插件目录缺少 plugin.json：${sourceDir}`);
  }
  const files = collectFiles(sourceDir).sort((left, right) =>
    left.relative.localeCompare(right.relative)
  );
  const parts = [];
  const central = [];
  for (const file of files) {
    const data = fs.readFileSync(file.absolute);
    const local = writeLocalHeader(parts, file.relative, data);
    central.push({ name: file.relative, crc: local.crc, offset: local.offset, size: data.length });
  }
  const centralOffset = parts.reduce((total, part) => total + part.length, 0);
  let centralSize = 0;
  for (const entry of central) {
    centralSize += writeCentralHeader(parts, entry);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  parts.push(end);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, Buffer.concat(parts));
  return { files: central.length, bytes: fs.statSync(output).size, output };
}

/**
 * 列出 zip 内的条目（只读 central directory）。
 * @param {string} zipPath zip 路径。
 * @returns {Array<{name: string, size: number, offset: number, method: number}>} 条目。
 */
export function listEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOffset < 0) {
    throw new Error(`不是合法的 zip（缺少 EOCD）：${zipPath}`);
  }
  const count = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`central directory 结构非法：${zipPath}`);
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    entries.push({ name, size, offset, method });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * 读取一个 stored 条目的内容（本仓库自己打的包都是 stored）。
 * @param {string} zipPath zip 路径。
 * @param {string} entryName 条目名。
 * @returns {Buffer|null} 内容；条目不存在时返回 null。
 */
export function readStoredEntry(zipPath, entryName) {
  const entry = listEntries(zipPath).find((item) => item.name === entryName);
  if (!entry) return null;
  if (entry.method !== 0) {
    throw new Error(`条目 ${entryName} 不是 stored（method=${entry.method}），本工具不支持解压`);
  }
  const buffer = fs.readFileSync(zipPath);
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  return buffer.subarray(start, start + entry.size);
}
