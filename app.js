require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); 
const amqp = require("amqplib/callback_api");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const XLSX = require('xlsx'); // Add XLSX to parse Excel files

const File = require('./models/File'); // Import the File model
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = process.env.PORT || 3001;

// Express middleware to parse JSON
app.use(express.json());
app.use(cors());

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

// RabbitMQ Connection for the Consumer
amqp.connect(process.env.RABBITMQ_URI, (error0, connection) => {
  if (error0) {
    throw error0;
  }
  connection.createChannel((error1, channel) => {
    if (error1) {
      throw error1;
    }
    const queue = "fileProcessingQueue"; 

    channel.assertQueue(queue, {
      durable: true,
    });

      // Purge the queue to remove all existing messages
      channel.purgeQueue(queue, (err, ok) => {
        if (err) {
          console.error("Error purging queue:", err);
        } else {
          console.log(`Purged ${ok.messageCount} messages from the queue`);
        }
      });

    // Consumer: Listen for messages in the queue
    channel.consume(
      queue,
      async (msg) => {
        if (msg !== null) {
          const fileDetails = JSON.parse(msg.content.toString());
          console.log("Processing file:", fileDetails);

          const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileDetails.filepath,
          };

          try {
            const data = await s3.send(new GetObjectCommand(params));
            const fileStream = data.Body;

            // Convert the file stream to a buffer
            const buffers = [];
            fileStream.on('data', (chunk) => buffers.push(chunk));
            fileStream.on('end', () => {
              const buffer = Buffer.concat(buffers);

              // Parse the Excel file
              const workbook = XLSX.read(buffer, { type: 'buffer' });
              const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
              const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

              // Process the data from the Excel file
              worksheet.forEach(row => {
                // Here, you could store the row in MongoDB or perform other operations
                // console.log(row);
              });

              console.log("File processed successfully:", fileDetails.filepath);
              channel.ack(msg);
            });

          } catch (err) {
            console.error("Error processing file:", err);
            channel.nack(msg); // You might want to requeue the message on failure
          }
        }
      },
      {
        noAck: false,
      }
    );
  });
});

// Generate Signed URL and Queue File for Processing
app.get("/generateSignedUrl", async (req, res) => {
  try {
    const fileName = req.query.filename;
    if (!fileName) {
      return res.status(400).send("Filename query parameter is required");
    }

    const filePath = `uploads/${Date.now()}_${fileName}`;
    const params = {
      Bucket: process.env.S3_BUCKET_NAME, 
      Key: filePath, 
      ContentType: "application/octet-stream", 
    };

    const command = new PutObjectCommand(params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // URL expires in 1 hour

    // Save file metadata to MongoDB
    const newFile = new File({
      filename: fileName,
      filepath: filePath,
    });

    await newFile.save();
    console.log(`File metadata saved: ${filePath}`);

    res.json({ url });
  } catch (err) {
    console.error("Failed to generate signed URL", err);
    res.status(500).send("Failed to generate signed URL");
  }
});

// Endpoint to Queue File for Processing After Upload
app.post("/processUploadedFile", async (req, res) => {
  const { filename } = req.body;

  try {
    const file = await File.findOne({ filename });
    if (!file) {
      return res.status(404).send("File metadata not found");
    }

    // Queue the file for processing
    amqp.connect(process.env.RABBITMQ_URI, (error0, connection) => {
      if (error0) {
        throw error0;
      }
      connection.createChannel((error1, channel) => {
        if (error1) {
          throw error1;
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
      });
    });

    res.send("File has been queued for processing");
  } catch (err) {
    console.error("Error processing file:", err);
    res.status(500).send("Error processing file");
  }
});

// Routes and middleware
app.get("/", (req, res) => {
  res.send("Hello from Node.js with Docker!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
