import multer from 'multer';

// Configure multer with memory storage only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Conditional multer middleware that handles both JSON and FormData
const conditionalUpload = (req, res, next) => {
  const contentType = req.get('Content-Type') || '';
  
  if (contentType.includes('multipart/form-data')) {
    // Use multer for FormData requests (with file uploads)
    upload.single('logo')(req, res, next);
  } else {
    // Skip multer for JSON requests (no file uploads)
    next();
  }
};

export { upload, conditionalUpload }; 