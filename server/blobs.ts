import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import type { Config } from './config';
import { HttpError } from './http';

export interface Blob {
  data: Buffer;
  contentType: string;
}

/** Where photos (and an optional merchant.json) live: one bucket per merchant in production. */
export interface Blobs {
  put(name: string, data: Buffer, contentType: string): Promise<void>;
  get(name: string): Promise<Blob | null>;
  exists(name: string): Promise<boolean>;
}

export class MemoryBlobs implements Blobs {
  private files = new Map<string, Blob>();

  async put(name: string, data: Buffer, contentType: string) {
    this.files.set(name, { data: Buffer.from(data), contentType });
  }
  async get(name: string) {
    return this.files.get(name) ?? null;
  }
  async exists(name: string) {
    return this.files.has(name);
  }
}

const EXT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json'
};

/** Development storage on disk, next to the file-based database. */
export class FileBlobs implements Blobs {
  constructor(private dir: string) {}

  private file(name: string) {
    const resolved = path.resolve(this.dir, name);
    if (!resolved.startsWith(path.resolve(this.dir) + path.sep)) throw new Error('Invalid blob name');
    return resolved;
  }

  async put(name: string, data: Buffer) {
    const file = this.file(name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  }
  async get(name: string) {
    const file = this.file(name);
    if (!fs.existsSync(file)) return null;
    return { data: fs.readFileSync(file), contentType: EXT_TYPES[path.extname(name)] ?? 'application/octet-stream' };
  }
  async exists(name: string) {
    return fs.existsSync(this.file(name));
  }
}

export class GcsBlobs implements Blobs {
  private bucket;

  constructor(bucketName: string) {
    this.bucket = new Storage().bucket(bucketName);
  }

  async put(name: string, data: Buffer, contentType: string) {
    await this.bucket.file(name).save(data, { contentType, resumable: false, metadata: { cacheControl: 'private, max-age=31536000' } });
  }
  async get(name: string) {
    const file = this.bucket.file(name);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [data] = await file.download();
    const [meta] = await file.getMetadata();
    return { data, contentType: meta.contentType ?? 'application/octet-stream' };
  }
  async exists(name: string) {
    const [exists] = await this.bucket.file(name).exists();
    return exists;
  }
}

/** Production without a bucket: photo upload is refused instead of writing to a disk that is wiped on restart. */
class UnconfiguredBlobs implements Blobs {
  async put(): Promise<void> {
    throw new HttpError(503, 'Photo storage is not set up for this catalogue yet. Ask your administrator to configure the storage bucket.');
  }
  async get() {
    return null;
  }
  async exists() {
    return false;
  }
}

export function createBlobs(config: Config): Blobs {
  if (config.storageBucket) return new GcsBlobs(config.storageBucket);
  if (config.isProduction) return new UnconfiguredBlobs();
  return config.storeKind === 'file' ? new FileBlobs(path.resolve(process.cwd(), config.uploadsDir)) : new MemoryBlobs();
}
