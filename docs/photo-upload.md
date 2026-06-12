# Photo Upload

ChromaMatch accepts JPG, PNG, WebP, HEIC, and HEIF room photos.

HEIC/HEIF files from iPhone cameras are converted locally in the browser to PNG before the existing canvas image pipeline runs. The original photo is not uploaded to a backend.

Working images and exports are bounded to 2048px on the longest side to preserve useful room detail while keeping local simulation responsive and memory-safe in the browser.

If conversion fails, the app shows a decode/conversion error and leaves the current session unchanged.
