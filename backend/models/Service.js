const mongoose = require('mongoose');

const ServiceOptionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  durationMinutes: { type: Number, required: true },
  categoryId: { type: String, required: true, index: true }
});

const ServiceCategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  icon: { type: String },
  description: { type: String },
  priceFrom: { type: Number },
  displayOrder: { type: Number, default: 0 }
});

const ServiceOption = mongoose.model('ServiceOption', ServiceOptionSchema);
const ServiceCategory = mongoose.model('ServiceCategory', ServiceCategorySchema);

module.exports = {
  ServiceOption,
  ServiceCategory
};
