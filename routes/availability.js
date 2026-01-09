const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// @route   GET /api/availability
// @desc    Get user's availability
// @access  Private
router.get('/', async (req, res) => {
  try {
    let availability = await Availability.findOne({ userId: req.user.id });

    if (!availability) {
      // Create default availability if none exists
      availability = new Availability({
        userId: req.user.id,
        weeklySlots: [],
        specificSlots: []
      });
      await availability.save();
    }

    res.json({
      success: true,
      availability
    });

  } catch (error) {
    console.error('Get Availability Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch availability',
      error: error.message
    });
  }
});

// @route   GET /api/availability/:mentorId
// @desc    Get a specific mentor's availability (for booking)
// @access  Private
router.get('/:mentorId', async (req, res) => {
  try {
    const { mentorId } = req.params;
    let availability = await Availability.findOne({ userId: mentorId });

    if (!availability) {
      // Return empty availability if none exists
      return res.json({
        success: true,
        availability: {
          userId: mentorId,
          weeklySlots: [],
          specificSlots: []
        }
      });
    }

    res.json({
      success: true,
      availability
    });

  } catch (error) {
    console.error('Get Mentor Availability Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentor availability',
      error: error.message
    });
  }
});

// @route   PUT /api/availability
// @desc    Update user's availability
// @access  Private
router.put('/', async (req, res) => {
  try {
    const { weeklySlots, specificSlots, timezone } = req.body;

    console.log('=== Update Availability Request ===');
    console.log('User ID:', req.user.id);
    console.log('Weekly Slots:', JSON.stringify(weeklySlots, null, 2));
    console.log('Specific Slots:', JSON.stringify(specificSlots, null, 2));
    console.log('Timezone:', timezone);

    // Validate weekly slots
    if (weeklySlots) {
      for (const slot of weeklySlots) {
        if (!slot.day || !slot.startTime || !slot.endTime) {
          return res.status(400).json({
            success: false,
            message: 'Weekly slots must have day, startTime, and endTime'
          });
        }

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid time format. Use HH:MM format'
          });
        }

        // Validate that end time is after start time
        const start = new Date(`2000-01-01T${slot.startTime}:00`);
        const end = new Date(`2000-01-01T${slot.endTime}:00`);
        if (end <= start) {
          return res.status(400).json({
            success: false,
            message: 'End time must be after start time'
          });
        }
      }
    }

    // Validate specific slots - only validate NEW slots, not existing ones
    if (specificSlots) {
      // Get existing slots to compare
      const existingAvailability = await Availability.findOne({ userId: req.user.id });
      const existingSlotIds = existingAvailability ?
        existingAvailability.specificSlots.map(slot => slot._id.toString()) : [];

      for (const slot of specificSlots) {
        // Skip validation for existing slots (they have _id)
        if (slot._id && existingSlotIds.includes(slot._id.toString())) {
          continue;
        }

        if (!slot.date || !slot.startTime || !slot.endTime) {
          return res.status(400).json({
            success: false,
            message: 'Specific slots must have date, startTime, and endTime'
          });
        }

        // Validate date is in the future
        const slotDate = new Date(slot.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (slotDate < today) {
          // console.log('Allowing past date for testing');
          // return res.status(400).json({
          //   success: false,
          //   message: 'Cannot set availability for past dates'
          // });
        }

        // For today's slots, validate that the start time hasn't passed
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // Get today's date as string
        const slotDateStr = slotDate.toISOString().split('T')[0]; // Get slot date as string

        if (slotDateStr === todayStr) {
          const [hours, minutes] = slot.startTime.split(':').map(Number);

          // Create slot start time in local timezone
          const slotStartTime = new Date();
          slotStartTime.setHours(hours, minutes, 0, 0);

          if (slotStartTime <= now) {
            // console.log('Allowing past time for testing');
            // return res.status(400).json({
            //   success: false,
            //   message: 'Cannot set availability for past times. The selected time has already passed.'
            // });
          }
        }

        // Calculate duration
        const start = new Date(`2000-01-01T${slot.startTime}:00`);
        const end = new Date(`2000-01-01T${slot.endTime}:00`);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);

        if (duration <= 0) {
          return res.status(400).json({
            success: false,
            message: 'End time must be after start time'
          });
        }

        if (duration < 15) {
          return res.status(400).json({
            success: false,
            message: 'Minimum slot duration is 15 minutes'
          });
        }

        slot.duration = duration;
      }
    }

    let availability = await Availability.findOne({ userId: req.user.id });

    if (!availability) {
      availability = new Availability({
        userId: req.user.id,
        weeklySlots: weeklySlots || [],
        specificSlots: specificSlots || [],
        timezone: timezone || 'Asia/Kolkata'
      });
    } else {
      if (weeklySlots !== undefined) availability.weeklySlots = weeklySlots;
      if (specificSlots !== undefined) {
        // Preserve booking information for existing slots
        const updatedSpecificSlots = specificSlots.map(newSlot => {
          const existingSlot = availability.specificSlots.find(
            existing => existing.date.toISOString().split('T')[0] === newSlot.date &&
              existing.startTime === newSlot.startTime &&
              existing.endTime === newSlot.endTime
          );

          if (existingSlot) {
            return {
              ...newSlot,
              isBooked: existingSlot.isBooked,
              bookingId: existingSlot.bookingId,
              _id: existingSlot._id
            };
          }

          return newSlot;
        });

        availability.specificSlots = updatedSpecificSlots;
      }
      if (timezone) availability.timezone = timezone;
      availability.updatedAt = new Date();
    }

    await availability.save();

    res.json({
      success: true,
      message: 'Availability updated successfully',
      availability
    });

  } catch (error) {
    console.error('Update Availability Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update availability',
      error: error.message
    });
  }
});

// @route   GET /api/availability/slots
// @desc    Get available slots for a date range
// @access  Private
router.get('/slots', async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const targetUserId = userId || req.user.id;
    const availability = await Availability.findOne({ userId: targetUserId });

    if (!availability) {
      return res.json({
        success: true,
        slots: []
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const availableSlots = availability.getAvailableSlots(start, end);

    res.json({
      success: true,
      slots: availableSlots
    });

  } catch (error) {
    console.error('Get Available Slots Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available slots',
      error: error.message
    });
  }
});

// @route   POST /api/availability/book-slot
// @desc    Book a specific slot (used by booking system)
// @access  Private
router.post('/book-slot', async (req, res) => {
  try {
    const { mentorId, date, startTime, endTime, bookingId } = req.body;

    if (!mentorId || !date || !startTime || !endTime || !bookingId) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const availability = await Availability.findOne({ userId: mentorId });

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Mentor availability not found'
      });
    }

    // Find the specific slot
    const slotIndex = availability.specificSlots.findIndex(slot =>
      slot.date.toISOString().split('T')[0] === date &&
      slot.startTime === startTime &&
      slot.endTime === endTime &&
      !slot.isBooked
    );

    if (slotIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Slot not available or already booked'
      });
    }

    // Mark slot as booked
    availability.specificSlots[slotIndex].isBooked = true;
    availability.specificSlots[slotIndex].bookingId = bookingId;
    availability.updatedAt = new Date();

    await availability.save();

    res.json({
      success: true,
      message: 'Slot booked successfully'
    });

  } catch (error) {
    console.error('Book Slot Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book slot',
      error: error.message
    });
  }
});

// @route   POST /api/availability/unbook-slot
// @desc    Unbook a specific slot (used when booking is cancelled)
// @access  Private
router.post('/unbook-slot', async (req, res) => {
  try {
    const { mentorId, bookingId } = req.body;

    if (!mentorId || !bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Mentor ID and booking ID are required'
      });
    }

    const availability = await Availability.findOne({ userId: mentorId });

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Mentor availability not found'
      });
    }

    // Find and unbook the slot
    const slotIndex = availability.specificSlots.findIndex(slot =>
      slot.bookingId && slot.bookingId.toString() === bookingId
    );

    if (slotIndex !== -1) {
      availability.specificSlots[slotIndex].isBooked = false;
      availability.specificSlots[slotIndex].bookingId = null;
      availability.updatedAt = new Date();

      await availability.save();
    }

    res.json({
      success: true,
      message: 'Slot unbooked successfully'
    });

  } catch (error) {
    console.error('Unbook Slot Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unbook slot',
      error: error.message
    });
  }
});

module.exports = router;