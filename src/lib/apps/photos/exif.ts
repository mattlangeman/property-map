import type { ExifData } from './photo.schema';

/**
 * EXIF extraction and stripping utilities.
 * Handles GPS coordinates, bearing, and date extraction from JPEG images.
 */

// EXIF tag constants
const EXIF_MARKER = 0xffe1;
const EXIF_HEADER = 'Exif\0\0';
const GPS_IFD_POINTER = 0x8825;
const GPS_LATITUDE = 0x0002;
const GPS_LATITUDE_REF = 0x0001;
const GPS_LONGITUDE = 0x0004;
const GPS_LONGITUDE_REF = 0x0003;
const GPS_IMG_DIRECTION = 0x0011;
const DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_DIGITIZED = 0x9004;

/**
 * Extract EXIF data from a JPEG file.
 * Returns GPS coordinates, bearing, and date taken if available.
 */
export async function extractExifData(file: File): Promise<ExifData> {
	const result: ExifData = {
		latitude: null,
		longitude: null,
		bearing: null,
		dateTaken: null
	};

	// Only process JPEG files
	if (!file.type.startsWith('image/jpeg') && !file.name.toLowerCase().endsWith('.jpg')) {
		return result;
	}

	try {
		const buffer = await file.arrayBuffer();
		const view = new DataView(buffer);

		// Check JPEG magic number
		if (view.getUint16(0) !== 0xffd8) {
			return result;
		}

		// Find EXIF segment
		let offset = 2;
		while (offset < buffer.byteLength - 4) {
			const marker = view.getUint16(offset);
			offset += 2;

			if (marker === EXIF_MARKER) {
				const length = view.getUint16(offset);
				offset += 2;

				// Check EXIF header
				const header = String.fromCharCode(
					view.getUint8(offset),
					view.getUint8(offset + 1),
					view.getUint8(offset + 2),
					view.getUint8(offset + 3),
					view.getUint8(offset + 4),
					view.getUint8(offset + 5)
				);

				if (header === EXIF_HEADER) {
					const tiffOffset = offset + 6;
					const exifData = parseExifData(view, tiffOffset, length - 8);
					return { ...result, ...exifData };
				}
			} else if ((marker & 0xff00) === 0xff00) {
				// Skip other segments
				const length = view.getUint16(offset);
				offset += length;
			} else {
				break;
			}
		}
	} catch (error) {
		console.error('Error extracting EXIF:', error);
	}

	return result;
}

/**
 * Parse EXIF TIFF data structure.
 */
function parseExifData(view: DataView, tiffOffset: number, maxLength: number): Partial<ExifData> {
	const result: Partial<ExifData> = {};

	try {
		// Determine byte order
		const byteOrder = view.getUint16(tiffOffset);
		const littleEndian = byteOrder === 0x4949; // 'II' = Intel = little-endian

		// Verify TIFF magic number
		const magic = view.getUint16(tiffOffset + 2, littleEndian);
		if (magic !== 0x002a) return result;

		// Get IFD0 offset
		const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian);
		const ifd0AbsOffset = tiffOffset + ifd0Offset;

		// Parse IFD0 to find GPS IFD pointer and date
		const { gpsIfdOffset, dateTaken } = parseIfd0(view, ifd0AbsOffset, tiffOffset, littleEndian);

		if (dateTaken) {
			result.dateTaken = dateTaken;
		}

		// Parse GPS IFD if found
		if (gpsIfdOffset) {
			const gpsAbsOffset = tiffOffset + gpsIfdOffset;
			const gpsData = parseGpsIfd(view, gpsAbsOffset, tiffOffset, littleEndian);
			Object.assign(result, gpsData);
		}
	} catch (error) {
		console.error('Error parsing EXIF TIFF:', error);
	}

	return result;
}

/**
 * Parse IFD0 to extract GPS pointer and date tags.
 */
function parseIfd0(
	view: DataView,
	ifdOffset: number,
	tiffOffset: number,
	littleEndian: boolean
): { gpsIfdOffset: number | null; dateTaken: string | null } {
	let gpsIfdOffset: number | null = null;
	let dateTaken: string | null = null;

	try {
		const entryCount = view.getUint16(ifdOffset, littleEndian);

		for (let i = 0; i < entryCount; i++) {
			const entryOffset = ifdOffset + 2 + i * 12;
			const tag = view.getUint16(entryOffset, littleEndian);

			if (tag === GPS_IFD_POINTER) {
				gpsIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
			} else if (tag === DATE_TIME_ORIGINAL || tag === DATE_TIME_DIGITIZED) {
				const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
				const absOffset = tiffOffset + valueOffset;
				dateTaken = readExifDate(view, absOffset);
			}
		}

		// Check for EXIF sub-IFD
		for (let i = 0; i < entryCount; i++) {
			const entryOffset = ifdOffset + 2 + i * 12;
			const tag = view.getUint16(entryOffset, littleEndian);

			if (tag === 0x8769) {
				// EXIF IFD pointer
				const exifIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
				const exifAbsOffset = tiffOffset + exifIfdOffset;
				const exifDate = parseDateFromExifIfd(view, exifAbsOffset, tiffOffset, littleEndian);
				if (exifDate && !dateTaken) {
					dateTaken = exifDate;
				}
			}
		}
	} catch (error) {
		console.error('Error parsing IFD0:', error);
	}

	return { gpsIfdOffset, dateTaken };
}

/**
 * Parse EXIF sub-IFD for date tags.
 */
function parseDateFromExifIfd(
	view: DataView,
	ifdOffset: number,
	tiffOffset: number,
	littleEndian: boolean
): string | null {
	try {
		const entryCount = view.getUint16(ifdOffset, littleEndian);

		for (let i = 0; i < entryCount; i++) {
			const entryOffset = ifdOffset + 2 + i * 12;
			const tag = view.getUint16(entryOffset, littleEndian);

			if (tag === DATE_TIME_ORIGINAL || tag === DATE_TIME_DIGITIZED) {
				const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
				const absOffset = tiffOffset + valueOffset;
				return readExifDate(view, absOffset);
			}
		}
	} catch (error) {
		console.error('Error parsing EXIF IFD for date:', error);
	}

	return null;
}

/**
 * Parse GPS IFD to extract coordinates and bearing.
 */
function parseGpsIfd(
	view: DataView,
	ifdOffset: number,
	tiffOffset: number,
	littleEndian: boolean
): Partial<ExifData> {
	const result: Partial<ExifData> = {};

	try {
		const entryCount = view.getUint16(ifdOffset, littleEndian);
		let latRef: string | null = null;
		let lngRef: string | null = null;
		let latValues: number[] | null = null;
		let lngValues: number[] | null = null;

		for (let i = 0; i < entryCount; i++) {
			const entryOffset = ifdOffset + 2 + i * 12;
			const tag = view.getUint16(entryOffset, littleEndian);
			const type = view.getUint16(entryOffset + 2, littleEndian);
			const count = view.getUint32(entryOffset + 4, littleEndian);

			if (tag === GPS_LATITUDE_REF) {
				latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
			} else if (tag === GPS_LONGITUDE_REF) {
				lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
			} else if (tag === GPS_LATITUDE && type === 5 && count === 3) {
				const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
				latValues = readGpsRationals(view, tiffOffset + valueOffset, littleEndian);
			} else if (tag === GPS_LONGITUDE && type === 5 && count === 3) {
				const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
				lngValues = readGpsRationals(view, tiffOffset + valueOffset, littleEndian);
			} else if (tag === GPS_IMG_DIRECTION && type === 5) {
				const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
				const num = view.getUint32(tiffOffset + valueOffset, littleEndian);
				const den = view.getUint32(tiffOffset + valueOffset + 4, littleEndian);
				if (den !== 0) {
					result.bearing = num / den;
				}
			}
		}

		// Convert GPS coordinates to decimal
		if (latValues && latRef) {
			result.latitude = gpsToDecimal(latValues[0], latValues[1], latValues[2], latRef);
		}
		if (lngValues && lngRef) {
			result.longitude = gpsToDecimal(lngValues[0], lngValues[1], lngValues[2], lngRef);
		}
	} catch (error) {
		console.error('Error parsing GPS IFD:', error);
	}

	return result;
}

/**
 * Read GPS rational values (degrees, minutes, seconds).
 */
function readGpsRationals(view: DataView, offset: number, littleEndian: boolean): number[] {
	const values: number[] = [];
	for (let i = 0; i < 3; i++) {
		const num = view.getUint32(offset + i * 8, littleEndian);
		const den = view.getUint32(offset + i * 8 + 4, littleEndian);
		values.push(den !== 0 ? num / den : 0);
	}
	return values;
}

/**
 * Read EXIF date string and convert to ISO format.
 */
function readExifDate(view: DataView, offset: number): string | null {
	try {
		let dateStr = '';
		for (let i = 0; i < 19; i++) {
			const char = view.getUint8(offset + i);
			if (char === 0) break;
			dateStr += String.fromCharCode(char);
		}

		// EXIF format: "YYYY:MM:DD HH:MM:SS"
		const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
		if (match) {
			const [, year, month, day, hour, min, sec] = match;
			return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
		}
	} catch (error) {
		console.error('Error reading EXIF date:', error);
	}
	return null;
}

/**
 * Convert GPS DMS (degrees, minutes, seconds) to decimal degrees.
 */
export function gpsToDecimal(
	degrees: number,
	minutes: number,
	seconds: number,
	ref: string
): number {
	let decimal = degrees + minutes / 60 + seconds / 3600;
	if (ref === 'S' || ref === 'W') {
		decimal = -decimal;
	}
	return decimal;
}

/**
 * Strip EXIF metadata from an image file.
 * Re-encodes the image using canvas to remove all metadata.
 * This ensures privacy by removing GPS data, camera info, etc.
 */
export async function stripExifData(file: File): Promise<File> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			// Create canvas and draw image
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			ctx.drawImage(img, 0, 0);

			// Convert to blob (this removes all EXIF data)
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('Failed to create blob'));
						return;
					}

					// Create new file with same name
					const strippedFile = new File([blob], file.name, {
						type: 'image/jpeg',
						lastModified: Date.now()
					});

					resolve(strippedFile);
				},
				'image/jpeg',
				0.92 // Quality (92% is a good balance of quality and size)
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}
