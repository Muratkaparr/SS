import sharp from 'sharp';

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 85;

/** HEIC/HEIF (iPhone kamerasının varsayılan formatı) çoğu tarayıcıda görüntülenemez. */
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

export interface ProcessedImage {
  buffer: Buffer;
  extension: string;
  mimetype: string;
}

/** EXIF orientation'a göre döndürür, büyük boyutu küçültür, HEIC'i JPEG'e çevirir. */
export async function processProductImage(
  buffer: Buffer,
  mimetype: string,
): Promise<ProcessedImage> {
  const image = sharp(buffer, { failOn: 'none' }).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (HEIC_MIME_TYPES.has(mimetype)) {
    return {
      buffer: await image.jpeg({ quality: JPEG_QUALITY }).toBuffer(),
      extension: '.jpg',
      mimetype: 'image/jpeg',
    };
  }

  switch (mimetype) {
    case 'image/png':
      return {
        buffer: await image.png().toBuffer(),
        extension: '.png',
        mimetype: 'image/png',
      };
    case 'image/webp':
      return {
        buffer: await image.webp().toBuffer(),
        extension: '.webp',
        mimetype: 'image/webp',
      };
    case 'image/gif':
      return {
        buffer: await image.gif().toBuffer(),
        extension: '.gif',
        mimetype: 'image/gif',
      };
    default:
      return {
        buffer: await image.jpeg({ quality: JPEG_QUALITY }).toBuffer(),
        extension: '.jpg',
        mimetype: 'image/jpeg',
      };
  }
}
