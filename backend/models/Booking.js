const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  reference_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clientName: {
    type: String,
    required: true
  },
  clientEmail: {
    type: String,
    required: true,
    index: true
  },
  clientPhone: {
    type: String,
    required: true
  },
  services: [
    {
      id: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      durationMinutes: { type: Number, required: true },
      groupName: { type: String }
    }
  ],
  expert: {
    type: String,
    required: true,
    default: 'any'
  },
  expertName: {
    type: String,
    required: true,
    default: 'Any Available Expert'
  },
  dateISO: {
    type: Date,
    required: true
  },
  dateDisplay: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  depositDue: {
    type: Number,
    required: true
  },
  serviceType: {
    type: String,
    enum: ['salon', 'home'],
    default: 'salon'
  },
  address: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'unpaid', 'refunded', 'fully_paid'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'rescheduled', 'completed'],
    default: 'pending'
  },
  paystackReference: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date
  },
  completionNotes: {
    type: String,
    default: ''
  },
  balancePaymentMethod: {
    type: String,
    enum: ['cash', 'transfer', 'pos', 'paystack'],
    default: 'cash'
  }
  reminderSent:    { type: Boolean, default: false },
  reminderSentAt:  { type: Date, default: null },
  completedAt:     { type: Date, default: null },
  completionNotes: { type: String, default: '' },
  balancePaymentMethod: { type: String, default: '' },
  paymentStatus:   { type: String, default: 'deposit_paid' },
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', BookingSchema);
