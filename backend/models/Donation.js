const mongoose = require('mongoose');
const donationSchema = new mongoose.Schema({
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, enum: ['Food', 'Ration', 'Clothes', 'Essentials', 'Books', 'Other'] },
  quantity: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100, default: 'Maharashtra' },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  area: { type: String, trim: true, maxlength: 120, default: '' },
  latitude: { type: Number, default: null, min: -90, max: 90 },
  longitude: { type: Number, default: null, min: -180, max: 180 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  photoData: { type: String, default: null, maxlength: 700000 },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  pickupUntil: { type: Date, default: null },
  contact: { type: String, trim: true, maxlength: 10, default: '' },
  status: { type: String, enum: ['LIVE', 'ACCEPTED', 'PICKUP IN PROGRESS', 'COLLECTED', 'DELIVERED', 'COMPLETED', 'CANCELLED'], default: 'LIVE', index: true },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acceptedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sevaProgress: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['PICKUP IN PROGRESS', 'COLLECTED', 'DELIVERED', 'COMPLETED'] },
    updatedAt: { type: Date, default: Date.now }
  }],
  acceptedAt: { type: Date, default: null }
}, { timestamps: true });
module.exports = mongoose.model('Donation', donationSchema);
