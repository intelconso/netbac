import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { useStore } from './store';
import { compressImage, uploadToCloudinary } from './cloudinary';
import { randomId } from './utils';
import { PendingPhoto } from '../types';

// Offline-first photos. A captured photo is compressed and copied into the
// app's document directory, then queued (device-locally, see
// AppState.pendingPhotos) for upload. This module drains that queue: on app
// start, on network reconnect, and whenever a form asks after a save. Once a
// file uploads, the resulting Cloudinary URL is written onto the record (which
// then syncs like any other field) and the local file is deleted.
//
// Two kinds share the queue and the same Cloudinary preset:
//   - 'product' → the photo on a label, one per product
//   - 'task'    → the photos attached to a task completion, several per cochage
// An entry with no `kind` is a product photo queued before task photos
// existed; an app update must never orphan a photo someone took offline.

const PHOTO_DIR = FileSystem.documentDirectory + 'product-photos/';
const TASK_PHOTO_DIR = FileSystem.documentDirectory + 'task-photos/';

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

async function safeDelete(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // best-effort cleanup; a leftover file is harmless
  }
}

async function persistInto(dir: string, pickedUri: string): Promise<string> {
  const compressed = await compressImage(pickedUri);
  await ensureDir(dir);
  const dest = dir + randomId() + '.jpg';
  await FileSystem.copyAsync({ from: compressed, to: dest });
  return dest;
}

// Compress the picked original and copy it into persistent storage. Returns the
// stable file:// path to store in the queue. Runs fully offline — no network.
export async function persistCapturedPhoto(pickedUri: string): Promise<string> {
  return persistInto(PHOTO_DIR, pickedUri);
}

// Same, for a task photo. Kept in its own directory so a draft discarded from
// the signing sheet can be deleted without ever touching a product photo.
export async function persistTaskPhoto(pickedUri: string): Promise<string> {
  return persistInto(TASK_PHOTO_DIR, pickedUri);
}

// Discard a captured file that never made it onto a record — the employee threw
// the shot away before validating the cochage. Nothing is queued at that point,
// so this only removes the file.
export async function discardCapturedPhoto(localPath: string): Promise<void> {
  await safeDelete(localPath);
}

// Outcome of one queue item: 'done' (drop it), 'retry' (leave it, stop the pass).
type ItemResult = 'done' | 'retry';

async function processProductItem(item: PendingPhoto): Promise<ItemResult> {
  const state = useStore.getState();
  const product = state.products.find((p) => p.id === item.productId);

  // Product gone/soft-deleted, or already has a remote URL → clean up.
  if (!item.productId || !product || product.deletedAt || product.photoUrl) {
    await safeDelete(item.localPath);
    if (item.productId) state.removePendingPhoto(item.productId);
    return 'done';
  }
  try {
    const url = await uploadToCloudinary(item.localPath);
    state.updateProduct(item.productId, { photoUrl: url });
    await safeDelete(item.localPath);
    state.removePendingPhoto(item.productId);
    return 'done';
  } catch {
    return 'retry';
  }
}

async function processTaskItem(item: PendingPhoto): Promise<ItemResult> {
  const state = useStore.getState();
  const photo = (state.taskPhotos ?? []).find((p) => p.id === item.taskPhotoId);

  // Record gone (never should happen — task photos aren't deletable) or
  // already uploaded → clean up.
  if (!item.taskPhotoId || !photo || photo.url) {
    await safeDelete(item.localPath);
    if (item.taskPhotoId) state.removeTaskPhotoUpload(item.taskPhotoId);
    return 'done';
  }
  try {
    const url = await uploadToCloudinary(item.localPath);
    state.setTaskPhotoUrl(item.taskPhotoId, url);
    await safeDelete(item.localPath);
    state.removeTaskPhotoUpload(item.taskPhotoId);
    return 'done';
  } catch {
    return 'retry';
  }
}

// Drop an item whose local file vanished (cache cleared etc.) — nothing to
// upload, and leaving it queued would retry forever.
function dropMissingFile(item: PendingPhoto): void {
  const state = useStore.getState();
  if (item.kind === 'task') {
    if (item.taskPhotoId) state.removeTaskPhotoUpload(item.taskPhotoId);
  } else if (item.productId) {
    state.removePendingPhoto(item.productId);
  }
}

let processing = false;

// Drain the pending-photo queue. Safe to call anytime and concurrently (guarded).
// No-ops when offline. Leaves an item queued if its upload fails, so it retries
// on the next reconnect. Drops items whose owner was deleted or whose local
// file went missing.
export async function processPhotoQueue(): Promise<void> {
  if (processing) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;

  processing = true;
  try {
    const queue = [...useStore.getState().pendingPhotos];
    for (const item of queue) {
      const info = await FileSystem.getInfoAsync(item.localPath);
      if (!info.exists) {
        dropMissingFile(item);
        continue;
      }
      const result = item.kind === 'task'
        ? await processTaskItem(item)
        : await processProductItem(item);
      // Network or Cloudinary error — keep it queued and stop this pass;
      // the reconnect listener will retry.
      if (result === 'retry') break;
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
