const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;
    
    switch (file.fieldname) {
      case 'prescription':
        uploadPath = path.join(__dirname, '../uploads/prescriptions');
        break;
      case 'profileImage':
        uploadPath = path.join(__dirname, '../uploads/profiles');
        break;
      case 'medicineImage':
        uploadPath = path.join(__dirname, '../uploads/medicines');
        break;
      case 'deliveryProof':
        uploadPath = path.join(__dirname, '../uploads/delivery');
        break;
      default:
        uploadPath = path.join(__dirname, '../uploads/misc');
    }
    
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Check file type based on field
  if (file.fieldname === 'prescription') {
    // Allow images and PDFs for prescriptions
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed for prescriptions'), false);
    }
  } else if (file.fieldname === 'profileImage' || file.fieldname === 'medicineImage') {
    // Allow only images for profile and medicine images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  } else if (file.fieldname === 'deliveryProof') {
    // Allow images for delivery proof
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for delivery proof'), false);
    }
  } else {
    cb(new Error('Unexpected field'), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 5 // Maximum 5 files per request
  }
});

// Middleware for different upload types
const uploadPrescription = upload.array('prescription', 3); // Max 3 prescription files
const uploadProfileImage = upload.single('profileImage');
const uploadMedicineImages = upload.array('medicineImage', 5); // Max 5 medicine images
const uploadDeliveryProof = upload.array('deliveryProof', 3); // Max 3 delivery proof images

// Error handling wrapper
const handleUploadError = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 5MB.'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files. Please check the file limit.'
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected field name. Please check your form fields.'
          });
        }
      }
      
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error'
        });
      }
      
      next();
    });
  };
};

// Helper function to delete files
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
  return false;
};

// Helper function to get file URL
const getFileUrl = (req, filename, folder) => {
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/uploads/${folder}/${filename}`;
};

// Cleanup old files (can be used in a scheduled job)
const cleanupOldFiles = async (directory, maxAgeInDays = 30) => {
  try {
    const files = fs.readdirSync(directory);
    const now = new Date();
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);
      const ageInDays = (now - stats.mtime) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > maxAgeInDays) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old files:', error);
  }
};

module.exports = {
  uploadPrescription: handleUploadError(uploadPrescription),
  uploadProfileImage: handleUploadError(uploadProfileImage),
  uploadMedicineImages: handleUploadError(uploadMedicineImages),
  uploadDeliveryProof: handleUploadError(uploadDeliveryProof),
  deleteFile,
  getFileUrl,
  cleanupOldFiles
}; 