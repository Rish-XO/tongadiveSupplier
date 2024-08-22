require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const amqp = require("amqplib/callback_api");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();
const PORT = process.env.PORT || 3000;

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

// MongoDB Connection
mongoose
  .connect("mongodb://root:example@localhost:2018/", {})
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

// RabbitMQ Connection
amqp.connect("amqp://user:password@localhost:5672", (error0, connection) => {
  if (error0) {
    throw error0;
  }
  connection.createChannel((error1, channel) => {
    if (error1) {
      throw error1;
    }
    const queue = "exampleQueue";
    const msg = "Hello World";

    channel.assertQueue(queue, {
      durable: false,
    });

    channel.sendToQueue(queue, Buffer.from(msg));
    console.log(`Sent: ${msg}`);

    // Consumer: Listen for messages in the queue
    channel.consume(
      queue,
      (msg) => {
        console.log(`Received: ${msg.content.toString()}`);
        // Here you can process the message as needed
      },
      {
        noAck: true,
      }
    );
  });
});

// generate signed url
app.get("/generateSignedUrl", async (req, res) => {
  try {
    const fileName = req.query.filename;
    if (!fileName) {
      return res.status(400).send("Filename query parameter is required");
    }

    const params = {
      Bucket: "suppliertongadive", // Your S3 bucket name
      Key: `uploads/${Date.now()}_${fileName}`, // File path in the bucket
      ContentType: "application/octet-stream", // MIME type of the file
    };

    const command = new PutObjectCommand(params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // URL expires in 1 hour

    res.json({ url });
  } catch (err) {
    console.error("Failed to generate signed URL", err);
    res.status(500).send("Failed to generate signed URL");
  }
});

// Routes and middleware
app.get("/", (req, res) => {
  res.send("Hello from Node.js with Docker!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
