import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { FileStorage, UploadResult } from "../../ports/file-storage.js";

export class MinioStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private bucketReady = false;

  constructor(params: {
    endpoint: string;
    port: number;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    useSSL: boolean;
  }) {
    this.bucket = params.bucket;
    const protocol = params.useSSL ? "https" : "http";

    this.client = new S3Client({
      region: "us-east-1",
      endpoint: `${protocol}://${params.endpoint}:${params.port}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: params.accessKeyId,
        secretAccessKey: params.secretAccessKey,
      },
    });

    this.publicBaseUrl = `${protocol}://${params.endpoint}:${params.port}/${params.bucket}`;
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
      return;
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
    }
  }

  async upload(params: { key: string; body: Buffer; contentType: string }): Promise<UploadResult> {
    await this.ensureBucket();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );

    return {
      key: params.key,
      url: `${this.publicBaseUrl}/${params.key}`,
    };
  }
}
