'use client';

import { isSupabaseConfigured, supabase } from '@/lib/db';

export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;
const LEADERBOARD_MEDIA_BUCKET = 'leaderboard-media';

type UploadImageKind = 'leaderboard-cover' | 'player-avatar';

function validateImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    throw new Error('Please choose an image smaller than 2 MB.');
  }
}

function getSafeFileExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  const fromMime = file.type.split('/')[1]?.toLowerCase();
  if (fromMime && /^[a-z0-9.+-]+$/.test(fromMime)) {
    return fromMime.replace('jpeg', 'jpg');
  }

  return 'jpg';
}

function getSafeFileStem(file: File): string {
  const stem = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  return stem || 'image';
}

async function readImageFileAsDataUrl(file: File): Promise<string> {
  validateImageFile(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to read the selected image.'));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the selected image.'));
    };

    reader.readAsDataURL(file);
  });
}

export async function uploadImageAsset(file: File, kind: UploadImageKind): Promise<string> {
  validateImageFile(file);

  if (!isSupabaseConfigured || !supabase) {
    return readImageFileAsDataUrl(file);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Please log in again before uploading an image.');
  }

  const extension = getSafeFileExtension(file);
  const fileStem = getSafeFileStem(file);
  const objectPath = `${user.id}/${kind}/${Date.now()}-${crypto.randomUUID()}-${fileStem}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(LEADERBOARD_MEDIA_BUCKET)
    .upload(objectPath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    if (/bucket/i.test(uploadError.message) || /policy/i.test(uploadError.message) || /row-level security/i.test(uploadError.message)) {
      throw new Error('Image uploads are not ready yet. Run the leaderboard media storage setup SQL in Supabase, then try again.');
    }

    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage.from(LEADERBOARD_MEDIA_BUCKET).getPublicUrl(objectPath);

  if (!publicUrlData.publicUrl) {
    throw new Error('Image upload succeeded, but no public URL was returned.');
  }

  return publicUrlData.publicUrl;
}