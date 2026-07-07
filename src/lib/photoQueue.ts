import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { useStore } from './store';
import { compressImage, uploadToCloudinary } from './cloudinary';
import { randomId } from './utils';

// Offline-first product photos. A captured photo is compressed and copied into
// the app's document directory, then queued (device-locally, see
// AppState.pendingPhotos) for upload. This module drains that queue: on app
// start, on network reconnect, and whenever the form asks after a save. Once a
// file uploads, the resulting Cloudinary URL is written onto the product (which
// then syncs like any other field) and the local file is deleted.

const PHOTO_DIR = FileSystem.documentDirectory + 'product-photos/';

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

async function safeDelete(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best-effort cleanup; a leftover file is harmless
  }
}

// Compress the picked original and copy it into persistent storage. Returns the
// stable file:// path to store in the queue. Runs fully offline — no network.
export async function persistCapturedPhoto(pickedUri: string): Promise<string> {
  const compressed = await compressImage(pickedUri);
  await ensureDir();
  const dest = PHOTO_DIR + randomId() + '.jpg';
  await FileSystem.copyAsync({ from: compressed, to: dest });
  return dest;
}

let processing = false;

// Drain the pending-photo queue. Safe to call anytime and concurrently (guarded).
// No-ops when offline. Leaves an item queued if its upload fails, so it retries
// on the next reconnect. Drops items whose product was deleted or whose local
// file went missing.
export async function processPhotoQueue(): Promise<void> {
  if (processing) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;

  processing = true;
  try {
    const queue = [...useStore.getState().pendingPhotos];
    for (const item of queue) {
      const state = useStore.getState();
      const product = state.products.find((p) => p.id === item.productId);

      // Product gone/soft-deleted, or already has a remote URL → clean up.
      if (!product || product.deletedAt || product.photoUrl) {
        await safeDelete(item.localPath);
        state.removePendingPhoto(item.productId);
        continue;
      }

      // Local file vanished (cache cleared etc.) → nothing to upload.
      const info = await FileSystem.getInfoAsync(item.localPath);
      if (!info.exists) {
        state.removePendingPhoto(item.productId);
        continue;
      }

      try {
        const url = await uploadToCloudinary(item.localPath);
        state.updateProduct(item.productId, { photoUrl: url });
        await safeDelete(item.localPath);
        state.removePendingPhoto(item.productId);
      } catch {
        // Network or Cloudinary error — keep it queued and stop this pass;
        // the reconnect listener will retry.
        break;
      }
    }
  } finally {
    processing = false;
  }
}

let unsubscribe: (() => void) | null = null;

export function startPhotoQueue(): void {
  if (unsubscribe) return;
  processPhotoQueue().catch(() => {});
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) processPhotoQueue().catch(() => {});
  });
}

export function stopPhotoQueue(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
