console.log('Loading sessionCompletionService...');

const Session = require('../models/Session');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');

console.log('Dependencies loaded');

/**
 * Submit feedback for a session
 */
async function submitFeedback(sessionId, userId, userType, feedback) {
    console.log('submitFeedback called with:', { sessionId, userId, userType, feedback });
    
    try {
      const session = await Session.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Verify user is part of this session
      if (userType === 'aspirant' && session.aspirantId.toString() !== userId) {
        throw new Error('Not authorized to provide feedback for this session');
      }
      if (userType === 'achiever' && session.achieverId.toString() !== userId) {
        throw new Error('Not authorized to provide feedback for this session');
      }

      // Update feedback
      const feedbackData = {
        rating: feedback.rating,
        review: feedback.review || '',
        submittedAt: new Date()
      };

      if (userType === 'aspirant') {
        session.aspirantFeedback = feedbackData;
      } else {
        session.achieverFeedback = feedbackData;
        // Also update legacy fields for backward compatibility
        session.achieverRating = feedback.rating;
        session.achieverReview = feedback.review || '';
      }

      await session.save();

      // Check if both feedbacks are submitted
      const bothFeedbacksSubmitted = session.aspirantFeedback.rating && session.achieverFeedback.rating;

      return {
        success: true,
        message: 'Feedback submitted successfully',
        bothFeedbacksSubmitted,
        session: {
          id: session._id,
          status: session.status,
          aspirantFeedback: session.aspirantFeedback,
          achieverFeedback: session.achieverFeedback
        }
      };

    } catch (error) {
      console.error('Submit Feedback Error:', error);
      throw error;
    }
}

console.log('Functions defined');

module.exports = {
  submitFeedback
};

console.log('Module exported:', Object.keys(module.exports));