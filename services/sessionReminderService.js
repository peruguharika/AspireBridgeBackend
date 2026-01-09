const Session = require('../models/Session');
const User = require('../models/User');
const { sendAspirantSessionReminder, sendAchieverSessionReminder } = require('./emailService');

class SessionReminderService {
  constructor() {
    this.reminderInterval = null;
    this.sentReminders = new Set(); // Track sent reminders to avoid duplicates
  }

  /**
   * Start the session reminder service
   */
  start() {
    console.log('🔔 Starting session reminder service...');
    
    // Check for upcoming sessions every minute
    this.reminderInterval = setInterval(() => {
      this.checkUpcomingSessions();
    }, 60 * 1000); // Check every 60 seconds

    // Also check immediately on start
    this.checkUpcomingSessions();
  }

  /**
   * Stop the session reminder service
   */
  stop() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
      console.log('🔔 Session reminder service stopped');
    }
  }

  /**
   * Check for sessions starting in the next 10 minutes
   */
  async checkUpcomingSessions() {
    try {
      const now = new Date();
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
      const elevenMinutesFromNow = new Date(now.getTime() + 11 * 60 * 1000);

      // Find sessions that start between 10-11 minutes from now
      // This gives us a 1-minute window to send reminders
      const upcomingSessions = await Session.find({
        status: 'scheduled',
        scheduledStartTime: {
          $gte: tenMinutesFromNow,
          $lt: elevenMinutesFromNow
        }
      }).populate('aspirantId achieverId', 'name email');

      console.log(`🔍 Checking for upcoming sessions... Found ${upcomingSessions.length} sessions starting in 10 minutes`);

      for (const session of upcomingSessions) {
        await this.sendSessionReminders(session);
      }

    } catch (error) {
      console.error('❌ Error checking upcoming sessions:', error);
    }
  }

  /**
   * Send reminder emails for a specific session
   */
  async sendSessionReminders(session) {
    try {
      const reminderKey = `${session._id}_${session.scheduledStartTime.getTime()}`;
      
      // Check if we've already sent reminders for this session
      if (this.sentReminders.has(reminderKey)) {
        return;
      }

      const aspirant = session.aspirantId;
      const achiever = session.achieverId;

      if (!aspirant || !achiever) {
        console.error('❌ Missing user data for session:', session._id);
        return;
      }

      const sessionDetails = {
        date: session.scheduledStartTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: session.scheduledStartTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        roomId: session.roomId
      };

      console.log(`📧 Sending session reminders for session ${session._id}`);
      console.log(`   Aspirant: ${aspirant.name} (${aspirant.email})`);
      console.log(`   Achiever: ${achiever.name} (${achiever.email})`);
      console.log(`   Time: ${sessionDetails.date} at ${sessionDetails.time}`);

      // Send reminder to aspirant
      try {
        await sendAspirantSessionReminder(
          aspirant.email,
          aspirant.name,
          achiever.name,
          sessionDetails
        );
        console.log(`✅ Aspirant reminder sent to ${aspirant.email}`);
      } catch (error) {
        console.error(`❌ Failed to send aspirant reminder to ${aspirant.email}:`, error.message);
      }

      // Send reminder to achiever
      try {
        await sendAchieverSessionReminder(
          achiever.email,
          achiever.name,
          aspirant.name,
          sessionDetails
        );
        console.log(`✅ Achiever reminder sent to ${achiever.email}`);
      } catch (error) {
        console.error(`❌ Failed to send achiever reminder to ${achiever.email}:`, error.message);
      }

      // Mark this session as having reminders sent
      this.sentReminders.add(reminderKey);

      // Clean up old reminder keys (older than 2 hours)
      this.cleanupOldReminders();

    } catch (error) {
      console.error('❌ Error sending session reminders:', error);
    }
  }

  /**
   * Clean up old reminder keys to prevent memory leaks
   */
  cleanupOldReminders() {
    const twoHoursAgo = new Date().getTime() - (2 * 60 * 60 * 1000);
    
    for (const key of this.sentReminders) {
      const timestamp = parseInt(key.split('_')[1]);
      if (timestamp < twoHoursAgo) {
        this.sentReminders.delete(key);
      }
    }
  }

  /**
   * Manually send reminders for a specific session (for testing)
   */
  async sendManualReminder(sessionId) {
    try {
      const session = await Session.findById(sessionId)
        .populate('aspirantId achieverId', 'name email');

      if (!session) {
        throw new Error('Session not found');
      }

      await this.sendSessionReminders(session);
      return { success: true, message: 'Reminders sent successfully' };

    } catch (error) {
      console.error('❌ Error sending manual reminder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.reminderInterval !== null,
      sentRemindersCount: this.sentReminders.size,
      lastCheck: new Date().toISOString()
    };
  }
}

// Create singleton instance
const sessionReminderService = new SessionReminderService();

module.exports = sessionReminderService;