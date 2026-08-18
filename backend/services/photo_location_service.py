import io
from typing import Any

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS


def get_exif_data(image: Image.Image) -> dict[str, Any]:
    exif = image.getexif()
    data: dict[str, Any] = {}

    for tag_id, value in exif.items():
        tag = TAGS.get(tag_id, tag_id)
        data[tag] = value

    return data


def convert_to_degrees(value: Any) -> float | None:
    if not value or len(value) != 3:
        return None

    def convert(part: Any) -> float:
        if hasattr(part, 'numerator') and hasattr(part, 'denominator'):
            return float(part.numerator) / float(part.denominator)
        return float(part)

    d, m, s = value
    return convert(d) + (convert(m) / 60.0) + (convert(s) / 3600.0)


def get_gps(exif: Any) -> dict[str, float] | None:
    if not exif:
        return None

    gps_info = exif.get(34853)
    if not gps_info:
        return None

    gps: dict[str, Any] = {}
    for key, value in gps_info.items():
        gps[GPSTAGS.get(key, key)] = value

    if 'GPSLatitude' not in gps or 'GPSLongitude' not in gps:
        return None

    try:
        latitude = convert_to_degrees(gps['GPSLatitude'])
        longitude = convert_to_degrees(gps['GPSLongitude'])
    except (TypeError, ValueError):
        return None

    if latitude is None or longitude is None:
        return None

    if gps.get('GPSLatitudeRef') == 'S':
        latitude = -latitude

    if gps.get('GPSLongitudeRef') == 'W':
        longitude = -longitude

    return {
        'latitude': round(latitude, 6),
        'longitude': round(longitude, 6),
    }


def analyze_photo_bytes(contents: bytes) -> dict[str, Any]:
    image = Image.open(io.BytesIO(contents))
    try:
        exif = image.getexif()
        data = get_exif_data(image)
        gps = get_gps(exif)

        capture_time = (
            data.get('DateTimeOriginal')
            or data.get('DateTimeDigitized')
            or data.get('DateTime')
        )

        return {
            'filename': getattr(image, 'filename', 'uploaded-image'),
            'capture_time': capture_time,
            'location': gps,
            'camera': {
                'make': data.get('Make'),
                'model': data.get('Model'),
            },
            'metadata_found': bool(exif),
            'gps_found': gps is not None,
        }
    finally:
        image.close()
