const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StaffSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    default: 'Stylist'
  },
  bio: {
    type: String,
    default: ''
  },
  ig: {
    type: String,
    default: '#'
  },
  img: {
    type: String,
    default: 'assets/stylist_kunle.jpg'
  },
  passcodeHash: {
    type: String,
    required: true
  },
  permissions: {
    canViewBookings: { type: Boolean, default: true },
    canCancelBookings: { type: Boolean, default: false },
    canRescheduleBookings: { type: Boolean, default: false },
    canEditCatalog: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Hash passcode before saving
StaffSchema.pre('save', async function (next) {
  if (!this.isModified('passcodeHash')) return next();
  // Only hash if it's not already a bcrypt hash
  if (!this.passcodeHash.startsWith('$2b$')) {
    this.passcodeHash = await bcrypt.hash(this.passcodeHash, 12);
  }
  next();
});

// Compare plain passcode against stored hash
StaffSchema.methods.verifyPasscode = async function (candidate) {
  return bcrypt.compare(candidate, this.passcodeHash);
};

module.exports = mongoose.model('Staff', StaffSchema);
