import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import fs from 'node:fs';
import appConfig from '../config/app_configs.js';
import { logger } from './logger/logger.js';
import mime from 'mime-types';
const rustfs_client = new S3Client({
  region: appConfig.RUSTFS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: appConfig.RUSTFS_ACCESS_KEY,
    secretAccessKey: appConfig.RUSTFS_SECRET_KEY,
  },
  endpoint: appConfig.RUSTFS_ENDPOINT,
  forcePathStyle: true,
});

export async function createBucket() {
  try {
    const response = await rustfs_client.send(
      new CreateBucketCommand({
        Bucket: 'my-bucket',
      }),
    );
    logger.info(JSON.stringify(response));
  } catch (error) {
    logger.error(JSON.stringify(error));
  }
}

export async function deleteBucket() {
  try {
    const response = await rustfs_client.send(
      new DeleteBucketCommand({
        Bucket: 'my-bucket',
      }),
    );
    logger.info(JSON.stringify(response));
  } catch (error) {
    logger.error(JSON.stringify(error));
  }
}

export async function deleteFile(key?: string | undefined) {
  if (typeof key !== 'string' || !key.trim()) {
    logger.warn(`deleteFile skipped: invalid/falsy key`, { providedKey: key });
    return;
  }
  const safeKey = key.trim();
  // Add strict validation for common invalid patterns
  if (
    safeKey.startsWith('/') ||
    safeKey.endsWith('/') ||
    safeKey.includes('//') ||
    safeKey.length > 1024 || // arbitrary safe max; adjust if needed
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1F\x7F]/.test(safeKey) // control chars
  ) {
    logger.error(`deleteFile rejected: invalid S3 key format`, {
      key: safeKey,
      reason:
        'starts/ends with slash, double slash, control chars, or too long',
    });
    // You can choose to skip or throw; for now skip to unblock delete
    return;
  }
  try {
    const response = await rustfs_client.send(
      new DeleteObjectCommand({
        Bucket: appConfig.RUSTFS_BUCKET_NAME,
        Key: key,
      }),
    );
    logger.info(JSON.stringify(response));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error(`deleteFile failed`, {
      key: safeKey,
      errorName: error.name,
      errorCode: error.Code || 'N/A',
      errorMessage: error.message,
      metadata: error.$metadata,
      stack: error.stack?.split('\n').slice(0, 6).join('\n'), // first few lines
    });
    logger.error(JSON.stringify(error));
    throw error;
  }
}
export async function listBuckets() {
  try {
    const response = await rustfs_client.send(new ListBucketsCommand({}));
    logger.info(JSON.stringify(response));
  } catch (error) {
    logger.error(JSON.stringify(error));
  }
}

export async function listObjects() {
  try {
    const response = await rustfs_client.send(
      new ListObjectsV2Command({
        Bucket: appConfig.RUSTFS_BUCKET_NAME,
      }),
    );
    logger.info(JSON.stringify(response));
  } catch (error) {
    logger.error(JSON.stringify(error));
  }
}

export async function uploadFile(key: string, filePath: string) {
  const fileBuffer = await fs.promises.readFile(filePath);

  const contentType = mime.lookup(filePath) || 'application/octet-stream';

  try {
    await rustfs_client.send(
      new PutObjectCommand({
        Bucket: appConfig.RUSTFS_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      }),
    );
    logger.info('File uploaded successfully with type ' + contentType);
  } catch (error) {
    logger.error(JSON.stringify(error) + ' ' + appConfig.RUSTFS_ENDPOINT);
    throw error;
  }
}

export async function getObject(key: string) {
  try {
    const command = new GetObjectCommand({
      Bucket: appConfig.RUSTFS_BUCKET_NAME,
      Key: key,
    });
    const response = await rustfs_client.send(command);

    if (response.Body) {
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as ReadableStream<Uint8Array>) {
        chunks.push(chunk as Buffer);
      }
      const data = Buffer.concat(chunks).toString('utf-8');
      logger.info('Object content:', data);
    }
  } catch (error) {
    logger.error(error);
  }
}

export async function getFileStream(key: string, bucket?: string) {
  try {
    const bucketName = bucket || appConfig.RUSTFS_BUCKET_NAME;
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    return await rustfs_client.send(command);
  } catch (error) {
    logger.error('getFileStream error:', error);
    throw error;
  }
}

export async function getUrl(key: string, bucket?: string) {
  try {
    // Strip leading slash to prevent double-slash in URL (e.g. /eslbucket//path)
    const safeKey = key.startsWith('/') ? key.replace(/^\/+/, '') : key;
    const bucketName = bucket || appConfig.RUSTFS_BUCKET_NAME;
    const relativeUrl = `/${bucketName}/${safeKey}`;
    logger.info('Public URL generated (Relative Proxy):', relativeUrl);
    return relativeUrl;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
