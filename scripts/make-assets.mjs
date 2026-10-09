#!/usr/bin/env node
/**
 * 生成仓库自带的图片资源（零依赖）：
 * - `plugins/<目录>/logo.png`：示例插件图标（48×48）
 * - `icons/<分类>.png`：分类导航图标（64×64）
 * - `icons/banner.png`：市场横幅（640×180）
 *
 * 这些图是**仓库自用**的：真实插件请自备品牌图标（≥48×48 的 PNG）。
 * 之所以自己画而不是拷二进制进来，是为了让仓库自包含、可复现。
 *
 * 用法：
 *   node scripts/make-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, encodePng, fillCircle, fillRect, fillRounded } from './lib/png.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');
const ICONS_DIR = path.join(REPO_ROOT, 'icons');

/** 白色。 */
const WHITE = [255, 255, 255, 255];

/**
 * 生成一个插件 logo（圆角底 + 白色字形）。
 * @param {Buffer} glyph 绘制函数。
 * @param {number[]} background 底色 RGBA。
 * @returns {Buffer} PNG 字节。
 */
function pluginLogo(glyph, background) {
  const canvas = createCanvas(48);
  fillRounded(canvas, background, 10);
  glyph(canvas);
  return encodePng(48, 48, canvas.pixels);
}

/** 三个示例插件的 logo 定义。 */
const PLUGIN_LOGOS = {
  'hello-ztools': {
    background: [5, 150, 105, 255],
    /**
     * 字母 H。
     * @param {ReturnType<typeof createCanvas>} canvas 画布。
     * @returns {void}
     */
    glyph(canvas) {
      fillRect(canvas, 14, 12, 5, 24, WHITE);
      fillRect(canvas, 29, 12, 5, 24, WHITE);
      fillRect(canvas, 19, 21, 10, 6, WHITE);
    }
  },
  'text-toolkit': {
    background: [37, 99, 235, 255],
    /**
     * 字母 T。
     * @param {ReturnType<typeof createCanvas>} canvas 画布。
     * @returns {void}
     */
    glyph(canvas) {
      fillRect(canvas, 12, 12, 24, 6, WHITE);
      fillRect(canvas, 21, 18, 6, 18, WHITE);
    }
  },
  'quick-note': {
    background: [217, 119, 6, 255],
    /**
     * 便签横线。
     * @param {ReturnType<typeof createCanvas>} canvas 画布。
     * @returns {void}
     */
    glyph(canvas) {
      fillRect(canvas, 13, 14, 22, 5, WHITE);
      fillRect(canvas, 13, 22, 22, 5, WHITE);
      fillRect(canvas, 13, 30, 13, 5, WHITE);
    }
  }
};

/** 分类图标定义：key 与 categories-mapping.json 对应。 */
const CATEGORY_ICONS = {
  productivity: {
    background: [5, 150, 105, 255],
    /**
     * 对勾。
     * @param {ReturnType<typeof createCanvas>} canvas 画布。
     * @returns {void}
     */
    glyph(canvas) {
      fillRect(canvas, 18, 34, 6, 8, WHITE);
      fillRect(canvas, 24, 30, 6, 12, WHITE);
      fillRect(canvas, 30, 24, 6, 18, WHITE);
      fillRect(canvas, 36, 16, 6, 26, WHITE);
    }
  },
  text: {
    background: [37, 99, 235, 255],
    /**
     * 三行文本。
     * @param {ReturnType<typeof createCanvas>} canvas 画布。
     * @returns {void}
     */
    glyph(canvas) {
      fillRect(canvas, 16, 20, 32, 6, WHITE);
      fillRect(canvas, 16, 30, 32, 6, WHITE);
      fillRect(canvas, 16, 40, 18, 6, WHITE);
    }
  },
  development: {
    background: [109, 40, 217, 255],
    /**
     * 尖括号。
     * @param {ReturnType<typeof createCanvas>} canvas 画布。
     * @returns {void}
     */
    glyph(canvas) {
      fillRect(canvas, 16, 26, 6, 6, WHITE);
      fillRect(canvas, 20, 22, 6, 6, WHITE);
      fillRect(canvas, 20, 30, 6, 6, WHITE);
      fillRect(canvas, 42, 26, 6, 6, WHITE);
      fillRect(canvas, 38, 22, 6, 6, WHITE);
      fillRect(canvas, 38, 30, 6, 6, WHITE);
      fillRect(canvas, 30, 34, 8, 6, WHITE);
    }
  },
  other: {
    background: [100, 116, 139, 255],
    /**
     * 三个圆点。
     * @param {ReturnType<typeof createCanvas>} canvas 画布。
     * @returns {void}
     */
    glyph(canvas) {
      fillCircle(canvas, 22, 32, 5, WHITE);
      fillCircle(canvas, 32, 32, 5, WHITE);
      fillCircle(canvas, 42, 32, 5, WHITE);
    }
  }
};

/**
 * 生成市场横幅（渐变底 + 白色方块装饰）。
 * @returns {Buffer} PNG 字节。
 */
function banner() {
  const width = 640;
  const height = 180;
  const pixels = Buffer.alloc(width * height * 4, 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const ratio = x / width;
      pixels[offset] = Math.round(5 + ratio * 30);
      pixels[offset + 1] = Math.round(150 - ratio * 60);
      pixels[offset + 2] = Math.round(105 + ratio * 40);
      pixels[offset + 3] = 255;
    }
  }
  // 右侧装饰：三个半透明白色方块 + 一个圆点。
  for (const [bx, by, size] of [
    [430, 40, 34],
    [478, 78, 52],
    [540, 34, 26]
  ]) {
    for (let y = by; y < by + size; y += 1) {
      for (let x = bx; x < bx + size; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const offset = (y * width + x) * 4;
        pixels[offset] = Math.min(255, pixels[offset] + 42);
        pixels[offset + 1] = Math.min(255, pixels[offset + 1] + 42);
        pixels[offset + 2] = Math.min(255, pixels[offset + 2] + 42);
      }
    }
  }
  return encodePng(width, height, pixels);
}

fs.mkdirSync(ICONS_DIR, { recursive: true });

let pluginCount = 0;
for (const [dir, logo] of Object.entries(PLUGIN_LOGOS)) {
  const pluginDir = path.join(PLUGINS_DIR, dir);
  if (!fs.existsSync(pluginDir)) {
    console.warn(`[assets] 跳过不存在的插件：${dir}`);
    continue;
  }
  // 已有 logo.png 的插件不覆盖：真实插件应当自带品牌图标。
  const target = path.join(pluginDir, 'logo.png');
  if (fs.existsSync(target) && !process.argv.includes('--force')) {
    console.log(`[assets] 保留已有图标：${path.relative(REPO_ROOT, target)}`);
    continue;
  }
  fs.writeFileSync(target, pluginLogo(logo.glyph, logo.background));
  pluginCount += 1;
  console.log(`[assets] ${path.relative(REPO_ROOT, target)}`);
}

let iconCount = 0;
for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
  const canvas = createCanvas(64);
  fillRounded(canvas, icon.background, 14);
  icon.glyph(canvas);
  fs.writeFileSync(path.join(ICONS_DIR, `${key}.png`), encodePng(64, 64, canvas.pixels));
  iconCount += 1;
}
fs.writeFileSync(path.join(ICONS_DIR, 'banner.png'), banner());
console.log(`[assets] icons/：${iconCount} 个分类图标 + banner.png`);
console.log(`[assets] 完成：插件图标 ${pluginCount} 个`);
