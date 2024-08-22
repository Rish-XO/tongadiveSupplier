const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
  supplierName: String,
  amount: Number,
  contactNumber: String,
  email: String,
  address: String,
  country: String,
});

const Supplier = mongoose.model("Supplier", supplierSchema);

module.exports = Supplier;
