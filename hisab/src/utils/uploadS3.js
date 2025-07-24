import AWS from 'aws-sdk';
import path from 'path';

// Initialize S3 client
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

// Get MIME type from file extension
const getMimeType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// Generate unique filename
const generateUniqueFileName = (originalFileName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalFileName);
  const nameWithoutExt = path.basename(originalFileName, ext);
  return `${timestamp}_${random}_${nameWithoutExt}${ext}`;
};

export const uploadFileToS3 = async (fileBuffer, fileName) => {
  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const uniqueFileName = generateUniqueFileName(fileName);
    const contentType = getMimeType(fileName);

    const uploadParams = {
      Bucket: bucketName,
      Key: uniqueFileName,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read', // Always public
    };

    // Upload file to S3
    const uploadResult = await s3.upload(uploadParams).promise();
    
    // Return public URL
    const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uniqueFileName}`;
    
    return publicUrl;

  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};