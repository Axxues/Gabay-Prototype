import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';
import { ApiError } from '../../utils/errors.js';

export interface LikhaUploadedFile {
  id: string;
  filename_download: string;
  type: string;
  filesize: number;
  url: string;
}

export async function getLikhaFileUrl(fileId: string): Promise<string> {
  return `${LIKHA_URL}/assets/${fileId}`;
}

export async function uploadFileToLikha(params: {
  buffer: Buffer | Blob;
  filename: string;
  mimetype: string;
  title?: string;
}): Promise<LikhaUploadedFile> {
  const token = await getLikhaAdminToken();
  const formData = new FormData();
  const blob = params.buffer instanceof Blob
    ? params.buffer
    : new Blob([params.buffer], { type: params.mimetype });

  formData.append('file', blob, params.filename);
  if (params.title) {
    formData.append('title', params.title);
  }

  const res = await fetch(`${LIKHA_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new ApiError(502, 'likha_upload_failed', `Failed to upload file to Likha ERP: ${errorText}`);
  }

  const json = (await res.json()) as {
    data: {
      id: string;
      filename_download: string;
      type: string;
      filesize: string | number;
    };
  };

  const fileData = json.data;
  return {
    id: fileData.id,
    filename_download: fileData.filename_download || params.filename,
    type: fileData.type || params.mimetype,
    filesize: typeof fileData.filesize === 'string' ? parseInt(fileData.filesize, 10) : fileData.filesize,
    url: `${LIKHA_URL}/assets/${fileData.id}`,
  };
}

export async function deleteLikhaFile(fileId: string): Promise<void> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new ApiError(502, 'likha_delete_failed', `Failed to delete file from Likha ERP: ${errorText}`);
  }
}
