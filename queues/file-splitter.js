require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const amqp = require("amqplib/callback_api");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const XLSX = require("xlsx"); // Add XLSX to parse Excel files
const { v4: uuidv4 } = require('uuid'); // To generate unique identifiers for each chunk

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

// RabbitMQ Connection for the Consumer and Chunk Processing Queue
amqp.connect("amqp://user:password@localhost:5672", (error0, connection) => {
  if (error0) {
    throw error0;
  }
  console.log("connected to rabbit file-splitter");
  
  connection.createChannel((error1, channel) => {
    if (error1) {
      throw error1;
    }
    const queue = "fileProcessingQueue";
    const chunkQueue = "chunkProcessingQueue"; // New queue for chunk processing

    channel.assertQueue(queue, {
      durable: true,
    });

    channel.assertQueue(chunkQueue, {
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

            fileStream.on("data", (chunk) => buffers.push(chunk));
            fileStream.on("end", async () => {
              const buffer = Buffer.concat(buffers);

              // Parse the Excel file
              const workbook = XLSX.read(buffer, { type: "buffer" });
              const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
              const worksheet = XLSX.utils.sheet_to_json(
                workbook.Sheets[sheetName]
              );

              // Split the data into chunks of 10,000 rows each
              const batchSize = 10000;
              for (let i = 0; i < worksheet.length; i += batchSize) {
                const chunk = worksheet.slice(i, i + batchSize);
                const chunkId = uuidv4();
                const chunkKey = `chunks/${chunkId}.json`;

                // Save the chunk to S3 as a JSON file
                const putParams = {
                  Bucket: process.env.S3_BUCKET_NAME,
                  Key: chunkKey,
                  Body: JSON.stringify(chunk),
                  ContentType: "application/json",
                };
                await s3.send(new PutObjectCommand(putParams));

                // Queue the chunk for further processing
                const message = JSON.stringify({
                  filepath: chunkKey,
                });
                channel.sendToQueue(chunkQueue, Buffer.from(message));
                console.log(`Queued chunk for processing: ${chunkKey}`);
              }

              console.log("File split and chunks queued successfully:", fileDetails.filepath);
              channel.ack(msg);
            });
          } catch (err) {
            console.error("Error processing file:", err);
            channel.nack(msg); // Requeue the message on failure
          }
        }
      },
      {
        noAck: false,
      }
    );
  });
});
