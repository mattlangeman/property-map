// Photo schema exports
export {
	PhotoCreateSchema,
	PhotoUpdateSchema,
	PhotoPositionSchema,
	PhotoBearingSchema,
	PhotoListOptionsSchema,
	ExifDataSchema,
	MediaTypeSchema
} from './photo.schema';
export type {
	PhotoCreateInput,
	PhotoUpdateInput,
	PhotoPositionInput,
	PhotoBearingInput,
	PhotoListOptions,
	ExifData,
	MediaType
} from './photo.schema';

// Photo entity exports
export { Photo } from './photo.entity';
export type { PhotoWithUrl } from './photo.entity';

// Photo service exports
export { PhotoService } from './photo.service';

// EXIF utilities
export { extractExifData, stripExifData, gpsToDecimal } from './exif';
