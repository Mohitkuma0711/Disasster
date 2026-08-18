from fastapi import APIRouter, File, HTTPException, UploadFile

from services.photo_location_service import analyze_photo_bytes

router = APIRouter()


@router.post('/location-from-photo')
@router.post('/analyze')
async def analyze_image(file: UploadFile = File(...)):
    """Extract EXIF metadata and GPS coordinates from an uploaded photo."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail='Uploaded file is empty.')

    try:
        result = analyze_photo_bytes(contents)
        result['filename'] = file.filename
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Invalid image file: {exc}') from exc
