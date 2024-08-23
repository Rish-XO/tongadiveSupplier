require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
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

// Routes and middleware
app.use("/", fileRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
