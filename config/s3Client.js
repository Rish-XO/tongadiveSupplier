const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { S3Client } = require("@aws-sdk/client-s3");

// Initialize the S3 client
const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

module.exports = s3;