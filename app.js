require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const amqp = require("amqplib/callback_api");
const {
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const s3 = require('./config/s3Client');
const File = require("./models/File");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const app = express();
const PORT = process.env.PORT || 3001;
const fileRoutes = require("./routes/fileRoutes");

// Express middleware to parse JSON
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });


// Generate Signed URL and Queue File for Processing
// app.get("/generateSignedUrl", async (req, res) => {
//   try {
//     const filePath = req.query.filename;

//     const params = {
//       Bucket: process.env.S3_BUCKET_NAME,
//       Key: filePath,
//       ContentType: "application/octet-stream",
//     };

//     const command = new PutObjectCommand(params);
//     const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // URL expires in 1 hour

//     // Save file metadata to MongoDB
//     const newFile = new File({
//       filename: filePath,
//       filepath: filePath,
//     });

//     await newFile.save();
//     console.log(`File metadata saved: ${filePath}`);

//     res.json({ url });
//   } catch (err) {
//     console.error("Failed to generate signed URL", err);
//     res.status(500).send("Failed to generate signed URL");
//   }
// });

// // Endpoint to Queue File for Processing After Upload
// app.post("/processUploadedFile", async (req, res) => {
//   const { filename } = req.body;

//   try {
//     const file = await File.findOne({ filename });
//     if (!file) {
//       return res.status(404).send("File metadata not found");
//     }

//     // Queue the file for processing
//     amqp.connect(process.env.RABBITMQ_URI, (error0, connection) => {
//       if (error0) {
//         throw error0;
//       }
//       connection.createChannel((error1, channel) => {
//         if (error1) {
//           throw error1;
//         }
//         const queue = "fileProcessingQueue";

//         channel.assertQueue(queue, {
//           durable: true,
//         });

//         const message = JSON.stringify({
//           filename: file.filename,
//           filepath: file.filepath,
//         });

//         channel.sendToQueue(queue, Buffer.from(message));
//         console.log("Queued file for processing:", message);
//       });
//     });

//     res.send("File has been queued for processing");
//   } catch (err) {
//     console.error("Error processing file:", err);
//     res.status(500).send("Error processing file");
//   }
// });

// Routes and middleware

app.use("/", fileRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
