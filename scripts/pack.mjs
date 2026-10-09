#!/usr/bin/env node
/**
 * 把插件目录打包成 `.zpx`（zip 容器，仅存储）。
 *
 * 用法：
 *   node scripts/pack.mjs <插件目录> <输出.zpx>
 *
 * 一般不需要单独调用：`scripts/build-market.mjs` 会打包全部插件。
 */
import path from 'node:path';
import { packDirectory } from './lib/zip.mjs';

const [pluginDirArg, outputArg] = process.argv.slice(2);
if (!pluginDirArg || !outputArg) {
  console.error('用法：node scripts/pack.mjs <插件目录> <输出.zpx>');
  process.exit(2);
}

try {
  const result = packDirectory(path.resolve(pluginDirArg), path.resolve(outputArg));
  console.log(`已打包 ${result.files} 个文件：${result.output}（${result.bytes} 字节）`);
} catch (error) {
  console.error(`打包失败：${error.message}`);
  process.exit(1);
}
