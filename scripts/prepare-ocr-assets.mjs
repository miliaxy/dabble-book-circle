import { copyFile, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, 'public', 'ocr');
const coreOutput = join(outputRoot, 'core');
const languageOutput = join(outputRoot, 'lang');
const tesseractRoot = dirname(require.resolve('tesseract.js/package.json'));
const tesseractRequire = createRequire(join(tesseractRoot, 'package.json'));
const coreRoot = dirname(tesseractRequire.resolve('tesseract.js-core/package.json'));
const englishLanguageRoot = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
const hindiLanguageRoot = dirname(require.resolve('@tesseract.js-data/hin/package.json'));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(coreOutput, { recursive: true });
await mkdir(languageOutput, { recursive: true });

await copyFile(join(tesseractRoot, 'dist', 'worker.min.js'), join(outputRoot, 'worker.min.js'));

for (const filename of [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
]) {
  await copyFile(join(coreRoot, filename), join(coreOutput, filename));
}

await copyFile(
  join(englishLanguageRoot, '4.0.0_best_int', 'eng.traineddata.gz'),
  join(languageOutput, 'eng.traineddata.gz'),
);
await copyFile(
  join(hindiLanguageRoot, '4.0.0_best_int', 'hin.traineddata.gz'),
  join(languageOutput, 'hin.traineddata.gz'),
);
