const router = require('express').Router();
const Donation = require('../models/Donation');
const { requireAuth } = require('../controllers/auth');

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    else filter.status = 'LIVE';
    const donations = await Donation.find(filter).populate('donor', 'fullName mobile').sort({ createdAt: -1 }).limit(200).lean();
    res.json({ donations: donations.map(d => ({ ...d, id: String(d._id), donorName: d.donor?.fullName || 'AnnaSetu Donor', donorMobile: d.donor?.mobile || '', phone: d.contact || d.donor?.mobile || '' })) });
  } catch (error) { next(error); }
});
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, category, quantity, state, city, area, latitude, longitude, description, address, pickupUntil, contact, photoData } = req.body;
    if (!title || !category || !quantity || !city || !description || !address) return res.status(400).json({ message: 'Please complete all required donation fields.' });
    const allowed = ['Food', 'Ration', 'Clothes', 'Essentials', 'Books', 'Other'];
    if (!allowed.includes(category)) return res.status(400).json({ message: 'Choose a valid donation category.' });
    let until = null;
    if (pickupUntil) {
      until = new Date(pickupUntil);
      if (Number.isNaN(until.getTime())) return res.status(400).json({ message: 'Invalid availability date.' });
    }
    const lat = latitude === '' || latitude == null ? null : Number(latitude);
    const lng = longitude === '' || longitude == null ? null : Number(longitude);
    if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) return res.status(400).json({ message: 'Invalid location coordinates.' });
    let safePhotoData = null;
    if (photoData != null && photoData !== '') {
      if (typeof photoData !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photoData)) {
        return res.status(400).json({ message: 'Photo must be a JPG, PNG, or WebP image.' });
      }
      const base64 = photoData.slice(photoData.indexOf(',') + 1);
      const approximateBytes = Math.floor(base64.length * 3 / 4);
      if (approximateBytes > 500 * 1024) {
        return res.status(400).json({ message: 'Photo must be 500 KB or smaller.' });
      }
      safePhotoData = photoData;
    }
    const donation = await Donation.create({ donor: req.user._id, title, category, quantity, state: String(state || 'Maharashtra').trim(), city, area: String(area || '').trim(), latitude: lat, longitude: lng, description, address, pickupUntil: until, contact: String(contact || '').replace(/\D/g, '').slice(0,10), photoData: safePhotoData, status: 'LIVE' });
    res.status(201).json({ message: 'Donation published.', donation: { id: String(donation._id), title: donation.title, status: donation.status } });
  } catch (error) { next(error); }
});

router.post('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const allowedStatuses = new Set(['PICKUP IN PROGRESS', 'COLLECTED', 'DELIVERED', 'COMPLETED']);
    const status = String(req.body.status || '').trim().toUpperCase().replace(/_/g, ' ');
    if (!allowedStatuses.has(status)) return res.status(400).json({ message: 'Choose a valid seva status.' });
    const donation = await Donation.findOne({
      _id: req.params.id,
      $or: [{ acceptedBy: req.user._id }, { acceptedUsers: req.user._id }]
    });
    if (!donation) return res.status(404).json({ message: 'Accepted seva not found for this account.' });
    const existing = donation.sevaProgress.find(entry => String(entry.user) === String(req.user._id));
    if (existing) {
      existing.status = status;
      existing.updatedAt = new Date();
    } else {
      donation.sevaProgress.push({ user: req.user._id, status, updatedAt: new Date() });
    }
    await donation.save();
    // Volunteer progress is tracked separately; the donor's listing remains LIVE until the donor stops it.
    res.json({ message: 'Your seva progress was updated.', donation: { id: String(donation._id), status, listingStatus: donation.status } });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid donation ID.' });
    next(error);
  }
});

router.post('/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const donation = await Donation.findOneAndUpdate(
      { _id: req.params.id, status: 'LIVE', donor: { $ne: req.user._id } },
      { $addToSet: { acceptedUsers: req.user._id }, $set: { acceptedAt: new Date() } },
      { new: true }
    );
    if (!donation) return res.status(409).json({ message: 'This donation is no longer available or cannot be accepted by its donor.' });
    // Keep the donation LIVE until the donor explicitly stops it.
    res.json({ message: 'Seva interest recorded. This donation remains LIVE until the donor stops it.', donation: { id: String(donation._id), status: donation.status } });
  } catch (error) { if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid donation ID.' }); next(error); }
});

// Donors control when their listing stops being LIVE. Acceptance alone never hides it.
router.post('/:id/stop', requireAuth, async (req, res, next) => {
  try {
    const donation = await Donation.findOneAndUpdate(
      { _id: req.params.id, donor: req.user._id, status: 'LIVE' },
      { $set: { status: 'CANCELLED' } },
      { new: true }
    );
    if (!donation) return res.status(404).json({ message: 'LIVE donation not found for this account.' });
    res.json({ message: 'Donation stopped. It is no longer visible in LIVE Seva.', donation: { id: String(donation._id), status: donation.status } });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid donation ID.' });
    next(error);
  }
});

module.exports = router;
