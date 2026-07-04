import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

/**
 * Take (or pick) a photo for AI analysis.
 * Images stay in the app cache and are deleted right after processing —
 * see deleteLocalImage below and docs/privacy.md.
 */
export function usePhotoCapture() {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const capture = async (source: 'camera' | 'library'): Promise<string | null> => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: 0.7,
      allowsEditing: false,
      exif: false, // never collect location metadata from photos
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets[0]) return null;
    const uri = result.assets[0].uri;
    setImageUri(uri);
    return uri;
  };

  const reset = async () => {
    if (imageUri) await deleteLocalImage(imageUri);
    setImageUri(null);
  };

  return { imageUri, capture, reset };
}

export async function deleteLocalImage(uri: string): Promise<void> {
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache files are ephemeral anyway; deletion is best-effort.
  }
}
