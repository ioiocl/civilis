export interface UploadResult {
  key: string;
  url: string;
}

export interface FileStorage {
  upload(params: { key: string; body: Buffer; contentType: string }): Promise<UploadResult>;
}
