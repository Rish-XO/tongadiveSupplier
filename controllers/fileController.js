const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const amqp = require("amqplib/callback_api");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const File = require("../models/File");
const s3 = require("../config/s3Client");

// Generate Signed URL and Save File Metadata
exports.generateSignedUrl = async (req, res) => {
  try {
    const filePath = req.query.filename;
    
    if (!filePath) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filePath,
      ContentType: "application/octet-stream",
    };

    const command = new PutObjectCommand(params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // URL expires in 1 hour

    // Save file metadata to MongoDB
    const newFile = new File({
      filename: filePath,
      filepath: filePath,
    });

    await newFile.save();
    console.log(`File metadata saved: ${filePath}`);

    res.json({ url });
  } catch (err) {
    if (err.name === "NoSuchBucket") {
      console.error("Bucket does not exist:", err);
      res.status(404).json({ error: "S3 bucket not found" });
    } else {
      console.error("Failed to generate signed URL:", err);
      res.status(500).json({ error: "Failed to generate signed URL" });
    }
  }
};

// Queue File for Processing After Upload
exports.processUploadedFile = async (req, res) => {
  const { filename } = req.body;

  try {
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const file = await File.findOne({ filename });
    if (!file) {
      return res.status(404).json({ error: "File metadata not found" });
    }

    // Queue the file for processing
    amqp.connect(process.env.RABBITMQ_URI, (error0, connection) => {
      if (error0) {
        console.error("Failed to connect to RabbitMQ:", error0);
        return res.status(500).json({ error: "Failed to connect to RabbitMQ" });
      }
      
      connection.createChannel((error1, channel) => {
        if (error1) {
          console.error("Failed to create RabbitMQ channel:", error1);
          return res.status(500).json({ error: "Failed to create RabbitMQ channel" });
        }
        
        const queue = "fileProcessingQueue";

        channel.assertQueue(queue, {
          durable: true,
        });

        const message = JSON.stringify({
          filename: file.filename,
          filepath: file.filepath,
        });

        channel.sendToQueue(queue, Buffer.from(message));
        console.log("Queued file for processing:", message);
        res.send("File has been queued for processing");
      });
    });
  } catch (err) {
    console.error("Error processing file:", err);
    res.status(500).json({ error: "Error processing file" });
  }
};
