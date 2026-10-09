/**
 * 极简 PNG 编码 + 绘图工具（零依赖）。
 *
 * 为什么自己画图：仓库要能"clone 下来直接跑"，不能为了生成几个图标就引入 sharp/canvas。
 * 这里用 Node 内置 `zlib` 写 8bit RGBA PNG，够用来画插件的 logo、分类图标与横幅。
 *
 * 真实插件请换成自己的品牌图标；本模块只服务仓库自带的示例与分类图标。
 */
import zlib from 'node:zlib';
import { crc32 } from './zip.mjs';

/**
 * 把 RGBA 像素编码成 PNG。
 * @param {number} width 宽。
 * @param {number} height 高。
 * @param {Buffer} rgba 像素（宽×高×4）。
 * @returns {Buffer} PNG 字节。
 */
export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: None
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  /**
   * 组装一个 PNG chunk。
   * @param {string} type 四字节类型。
   * @param {Buffer} data 数据。
   * @returns {Buffer} chunk。
   */
  function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBytes = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
    return Buffer.concat([length, typeBytes, data, crc]);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/**
 * 创建一个画布。
 * @param {number} size 边长（正方形）。
 * @returns {{size: number, pixels: Buffer, set: (x: number, y: number, color: number[]) => void}} 画布。
 */
export function createCanvas(size) {
  const pixels = Buffer.alloc(size * size * 4, 0);
  return {
    size,
    pixels,
    /**
     * 写一个像素。
     * @param {number} x 横坐标。
     * @param {number} y 纵坐标。
     * @param {number[]} color RGBA。
     * @returns {void}
     */
    set(x, y, color) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  };
}

/**
 * 填充圆角矩形底。
 * @param {ReturnType<typeof createCanvas>} canvas 画布。
 * @param {number[]} color RGBA。
 * @param {number} radius 圆角半径。
 * @returns {void}
 */
export function fillRounded(canvas, color, radius) {
  const size = canvas.size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      if (dx * dx + dy * dy > radius * radius) continue;
      canvas.set(x, y, color);
    }
  }
}

/**
 * 填充矩形（字形与图形都由矩形拼出来）。
 * @param {ReturnType<typeof createCanvas>} canvas 画布。
 * @param {number} x 左上 x。
 * @param {number} y 左上 y。
 * @param {number} width 宽。
 * @param {number} height 高。
 * @param {number[]} color RGBA。
 * @returns {void}
 */
export function fillRect(canvas, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      canvas.set(column, row, color);
    }
  }
}

/**
 * 填充圆形。
 * @param {ReturnType<typeof createCanvas>} canvas 画布。
 * @param {number} centerX 圆心 x。
 * @param {number} centerY 圆心 y。
 * @param {number} radius 半径。
 * @param {number[]} color RGBA。
 * @returns {void}
 */
export function fillCircle(canvas, centerX, centerY, radius, color) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        canvas.set(x, y, color);
      }
    }
  }
}
