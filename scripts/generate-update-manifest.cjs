#!/usr/bin/env node

/**
 * 生成 Tauri 更新清单文件 (latest.json)
 * 
 * 使用方法：
 * 1. 构建应用：pnpm tauri build
 * 2. 运行此脚本：node scripts/generate-update-manifest.js <version> <release-url>
 * 
 * 示例：
 * node scripts/generate-update-manifest.js 0.1.0 https://github.com/username/lpe-reminder/releases/download/v0.1.0
 */

const fs = require('fs');
const path = require('path');

// 从命令行参数获取版本号和下载 URL
const version = process.argv[2];
const releaseUrl = process.argv[3];

if (!version || !releaseUrl) {
  console.error('❌ 缺少必需参数！');
  console.log('');
  console.log('使用方法：');
  console.log('  node scripts/generate-update-manifest.js <version> <release-url>');
  console.log('');
  console.log('示例：');
  console.log('  node scripts/generate-update-manifest.js 0.1.0 https://github.com/username/lpe-reminder/releases/download/v0.1.0');
  process.exit(1);
}

// 构建产物路径
const bundlePath = path.join(__dirname, '../src-tauri/target/release/bundle/nsis');
const setupFile = `lpe-reminder_${version}_x64-setup.exe`;
const sigFile = `${setupFile}.sig`;

const setupFilePath = path.join(bundlePath, setupFile);
const sigFilePath = path.join(bundlePath, sigFile);

// 检查文件是否存在
if (!fs.existsSync(setupFilePath)) {
  console.error(`❌ 安装包文件不存在: ${setupFilePath}`);
  console.log('请先运行: pnpm tauri build');
  process.exit(1);
}

if (!fs.existsSync(sigFilePath)) {
  console.error(`❌ 签名文件不存在: ${sigFilePath}`);
  console.log('请确保已配置签名密钥: pnpm tauri signer generate');
  process.exit(1);
}

// 读取签名文件
const signature = fs.readFileSync(sigFilePath, 'utf8').trim();

// 生成更新清单
const manifest = {
  version: version,
  date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: signature,
      url: `${releaseUrl}/${setupFile}`
    }
  },
  notes: `版本 ${version} 更新说明（请在此处填写更新内容）`
};

// 保存到文件
const outputPath = path.join(bundlePath, 'latest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log('✅ 更新清单已生成！');
console.log('');
console.log('📦 文件位置:', outputPath);
console.log('');
console.log('📋 清单内容:');
console.log(JSON.stringify(manifest, null, 2));
console.log('');
console.log('📤 下一步：');
console.log(`1. 编辑 ${outputPath} 补充更新说明`);
console.log(`2. 将以下文件上传到 GitHub Release:`);
console.log(`   - ${setupFile}`);
console.log(`   - ${sigFile}`);
console.log(`   - latest.json`);
