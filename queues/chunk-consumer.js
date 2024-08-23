const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require("mongoose");
const amqp = require("amqplib/callback_api");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const Supplier = require("../models/Supplier");
const s3 = require('../config/s3Client');

mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

// RabbitMQ Connection for the Chunk Consumer
amqp.connect(process.env.RABBITMQ_URI, (error0, connection) => {
  if (error0) {
    throw error0;
  }
  console.log("connected to rabbit chunk comsumer");
  connection.createChannel((error1, channel) => {
    if (error1) {
      throw error1;
    }
    const queue = "chunkProcessingQueue";

    channel.assertQueue(queue, {
      durable: true,
    });

    // Consumer: Listen for messages in the queue
    channel.consume(
      queue,
      async (msg) => {
        if (msg !== null) {
          const chunkDetails = JSON.parse(msg.content.toString());
          console.log("Processing chunk:", chunkDetails);

          const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: chunkDetails.filepath,
          };

          try {
            const data = await s3.send(new GetObjectCommand(params));
            const fileStream = data.Body;

            const buffers = [];
            fileStream.on("data", (chunk) => buffers.push(chunk));
            fileStream.on("end", async () => {
              const buffer = Buffer.concat(buffers);
              const chunkData = JSON.parse(buffer.toString());

              const mappedData = chunkData.map(
                (item) =>
                  new Supplier({
                    supplierName: item.SupplierName,
                    amount: parseFloat(item.Amount),
                    contactNumber: item.ContactNumber.toString(),
                    email: item.Email,
                    address: item.Address,
                    country: item.Country,
                  })
              );
              try {
                console.log(mappedData);
                await Supplier.insertMany(mappedData);
                console.log(
                  `Chunk processed and data inserted: ${chunkDetails.filepath}`
                );
                channel.ack(msg);
              } catch (error) {
                console.error("Failed to insert chunk data", error);
                channel.nack(msg); 
              }
            });
          } catch (err) {
            console.error("Error processing chunk:", err);
            channel.nack(msg); 
          }
        }
      },
      {
        noAck: false,
      }
    );
  });
});
