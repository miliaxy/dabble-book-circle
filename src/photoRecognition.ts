import { createWorker } from 'tesseract.js';

export interface PhotoRecognitionProgress {
  status: string;
  progress: number;
}

export async function readBookCoverText(
  image: string,
  onProgress?: (progress: PhotoRecognitionProgress) => void,
) {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const assetRoot = `${baseUrl}/ocr`;
  const worker = await createWorker(['eng', 'hin'], 1, {
    workerPath: `${assetRoot}/worker.min.js`,
    corePath: `${assetRoot}/core`,
    langPath: `${assetRoot}/lang`,
    workerBlobURL: false,
    logger: (message) => {
      onProgress?.({
        status: message.status,
        progress: typeof message.progress === 'number' ? message.progress : 0,
      });
    },
  });

  try {
    const result = await worker.recognize(image);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}
