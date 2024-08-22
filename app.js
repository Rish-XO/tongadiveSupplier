const express = require("express");
const mongoose = require("mongoose");
const amqp = require("amqplib/callback_api");

const app = express();
const PORT = process.env.PORT || 3000;

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
     channel.consume(queue, (msg) => {
        console.log(`Received: ${msg.content.toString()}`);
        // Here you can process the message as needed
      }, {
        noAck: true
      });
  });
});

// Routes and middleware
app.get("/", (req, res) => {
  res.send("Hello from Node.js with Docker!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
