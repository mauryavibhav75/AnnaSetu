const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  occupation: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  // Kept optional for compatibility with existing accounts created by older versions.
  mobile: { type: String, default: '', sparse: true },
  preferredRole: { type: String, enum: ['DONOR', 'VOLUNTEER'], default: 'DONOR' },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
