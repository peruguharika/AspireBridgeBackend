const mongoose = require('mongoose');

const WeeklySlotSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  endTime: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  }
});

const SpecificSlotSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  endTime: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  duration: {
    type: Number,
    required: true,
    min: 15 // minimum 15 minutes
  },
  isBooked: {
    type: Boolean,
    default: false
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  }
});

const AvailabilitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  weeklySlots: [WeeklySlotSchema],
  specificSlots: [SpecificSlotSchema],
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
AvailabilitySchema.index({ userId: 1 });
AvailabilitySchema.index({ 'specificSlots.date': 1 });
AvailabilitySchema.index({ 'specificSlots.isBooked': 1 });

// Helper method to get available slots for a specific date range
AvailabilitySchema.methods.getAvailableSlots = function(startDate, endDate) {
  const availableSlots = [];
  
  // Add specific slots within the date range that are not booked
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  this.specificSlots.forEach(slot => {
    const slotDate = new Date(slot.date);
    if (slotDate >= startDate && slotDate <= endDate && !slot.isBooked) {
      // For today's slots, check if the slot time hasn't passed yet
      if (slotDate.toDateString() === today.toDateString()) {
        const [hours, minutes] = slot.startTime.split(':').map(Number);
        const slotStartTime = new Date(today);
        slotStartTime.setHours(hours, minutes, 0, 0);
        
        // Only include slots that haven't started yet
        if (slotStartTime > now) {
          availableSlots.push({
            type: 'specific',
            date: slotDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD string
            startTime: slot.startTime,
            endTime: slot.endTime,
            duration: slot.duration,
            slotId: slot._id
          });
        }
      } else {
        // For future dates, include all slots
        availableSlots.push({
          type: 'specific',
          date: slotDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD string
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: slot.duration,
          slotId: slot._id
        });
      }
    }
  });
  
  // Add weekly slots for each day in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    this.weeklySlots.forEach(weeklySlot => {
      if (weeklySlot.day === dayName) {
        // Check if there's no specific slot that conflicts with this weekly slot
        const hasConflict = this.specificSlots.some(specificSlot => {
          const specificDate = new Date(specificSlot.date);
          return specificDate.toDateString() === currentDate.toDateString();
        });
        
        if (!hasConflict) {
          // For today's weekly slots, check if the slot time hasn't passed yet
          if (currentDate.toDateString() === today.toDateString()) {
            const [hours, minutes] = weeklySlot.startTime.split(':').map(Number);
            const slotStartTime = new Date(today);
            slotStartTime.setHours(hours, minutes, 0, 0);
            
            // Only include slots that haven't started yet
            if (slotStartTime > now) {
              availableSlots.push({
                type: 'weekly',
                date: currentDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD string
                startTime: weeklySlot.startTime,
                endTime: weeklySlot.endTime,
                day: weeklySlot.day
              });
            }
          } else {
            // For future dates, include all slots
            availableSlots.push({
              type: 'weekly',
              date: currentDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD string
              startTime: weeklySlot.startTime,
              endTime: weeklySlot.endTime,
              day: weeklySlot.day
            });
          }
        }
      }
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return availableSlots.sort((a, b) => new Date(a.date) - new Date(b.date));
};

module.exports = mongoose.model('Availability', AvailabilitySchema);