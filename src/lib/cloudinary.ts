import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';

// Cloudinary unsigned upload. cloudName + uploadPreset are PUBLIC values (they
// ship in the app on purpose for unsigned uploads), so they live in
// app.json → expo.extra.cloudinary rather than in a secret .env. Abuse is
// limited on the Cloudinary side via the preset (allowed formats, max size,
// fixed folder, incoming transformation).
type CloudinaryConfig = { cloudName?: string; uploadPreset?: string };

function getConfig(): Required<CloudinaryConfig> {
  const cfg = (Constants.expoConfig?.extra?.cloudinary ?? {}) as CloudinaryConfig;
  const cloudName = cfg.cloudName;
  const uploadPreset = cfg.uploadPreset;
  if (!cloudName || !uploadPreset || cloudName === 'YOUR_CLOUD_NAME' || uploadPreset === 'YOUR_UNSIGNED_PRESET') {
    throw new Error('Cloudinary non configuré (app.json → extra.cloudinary).');
  }
  return { cloudName, uploadPreset };
}

export function isCloudinaryConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

// Downscale + recompress a camera/gallery original (often 2–5 MB) to a small
// reference thumbnail (~1000px, JPEG q0.7 ≈ 50–120 KB) before it ever leaves
// the device. Cheap sync payload, cheap upload, cheap Cloudinary storage.
async function compress(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1000 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

// Compress then POST to Cloudinary's unsigned upload endpoint. Resolves to the
// hosted secure_url, which is what we persist on Product.photoUrl. Throws on
// no-network or a non-2xx Cloudinary response so the caller can surface it and
// let the user retry or save without a photo.
export async function uploadProductImage(localUri: string): Promise<string> {
  const { cloudName, uploadPreset } = getConfig();
  const uri = await compress(localUri);

  const form = new FormData();
  form.append('file', { uri, type: 'image/jpeg', name: 'product.jpg' } as any);
  form.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message ?? '';
    } catch {
      // response wasn't JSON; keep the status-based message
    }
    throw new Error(detail || `Échec de l'envoi (${res.status}).`);
  }

  const data = await res.json();
  if (!data?.secure_url) throw new Error("Réponse Cloudinary invalide.");
  return data.secure_url as string;
}
