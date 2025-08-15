const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// AWS S3 Configuration
const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

// Only create S3 client if credentials are provided
let s3Client = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client(s3Config);
  console.log('✅ AWS S3 client initialized');
} else {
  console.log('⚠️  AWS credentials not found, S3 uploads disabled');
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'epharmacy-prescriptions';

// Check if S3 is configured
const isS3Configured = () => {
  return !!(s3Client && process.env.AWS_S3_BUCKET_NAME);
};

// Generate unique file name
const generateFileName = (originalName, prefix = 'prescription') => {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const uuid = uuidv4().substring(0, 8);
  return `${prefix}/${timestamp}-${uuid}${ext}`;
};

// Upload file to S3
const uploadToS3 = async (file, fileName) => {
  if (!isS3Configured()) {
    throw new Error('S3 not configured. Please set AWS credentials and bucket name.');
  }

  try {
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256',
      Metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    };

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    const result = await upload.done();
    
    return {
      key: fileName,
      location: result.Location,
      bucket: BUCKET_NAME,
      size: file.size,
      mimetype: file.mimetype,
      originalName: file.originalname,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
};

// Get signed URL for private file access
const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
  if (!isS3Configured()) {
    throw new Error('S3 not configured');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }
};

// Delete file from S3
const deleteFromS3 = async (key) => {
  if (!isS3Configured()) {
    throw new Error('S3 not configured');
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return { success: true, key };
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`Failed to delete from S3: ${error.message}`);
  }
};

// Multer configuration for S3 uploads
const createS3Multer = () => {
  if (!isS3Configured()) {
    // Fallback to memory storage if S3 not configured
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        // Allow images and PDFs
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Only images (jpeg, jpg, png, gif) and PDF files are allowed!'));
        }
      },
    });
  }

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow images and PDFs
      const allowedTypes = /jpeg|jpg|png|gif|pdf/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only images (jpeg, jpg, png, gif) and PDF files are allowed!'));
      }
    },
  });
};

// Get public URL for S3 object (if bucket is public)
const getPublicUrl = (key) => {
  if (!isS3Configured()) {
    return null;
  }
  return `https://${BUCKET_NAME}.s3.${s3Config.region}.amazonaws.com/${key}`;
};

module.exports = {
  s3Client,
  isS3Configured,
  uploadToS3,
  getSignedDownloadUrl,
  deleteFromS3,
  createS3Multer,
  generateFileName,
  getPublicUrl,
  BUCKET_NAME,
};
