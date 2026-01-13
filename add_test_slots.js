const mongoose = require('mongoose');
require('dotenv').config();

console.log('\n🔧 ADDING TEST SLOTS FOR ACHIEVERS...\n');

async function addTestSlots() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        const Availability = require('./models/Availability');
        const User = require('./models/User');

        // Get achievers who have availability
        const achievers = await User.find({
            userType: 'achiever',
            email: { $in: ['harsham@gmail.com', 'srivennela904@gmail.com'] }
        }).select('name email _id');

        console.log(`📊 Found ${achievers.length} achievers to update\n`);

        for (const achiever of achievers) {
            console.log(`\n👤 Adding slots for: ${achiever.name} (${achiever.email})`);

            let availability = await Availability.findOne({ userId: achiever._id });

            if (!availability) {
                availability = new Availability({
                    userId: achiever._id,
                    weeklySlots: [],
                    specificSlots: []
                });
            }

            // Add future specific slots (next 7 days)
            const futureSlots = [];
            const today = new Date();

            for (let i = 1; i <= 7; i++) {
                const slotDate = new Date(today);
                slotDate.setDate(today.getDate() + i);
                slotDate.setHours(0, 0, 0, 0);

                // Add 3 slots per day
                futureSlots.push({
                    date: slotDate,
                    startTime: '10:00',
                    endTime: '11:00',
                    duration: 60,
                    isBooked: false
                });

                futureSlots.push({
                    date: slotDate,
                    startTime: '14:00',
                    endTime: '15:00',
                    duration: 60,
                    isBooked: false
                });

                futureSlots.push({
                    date: slotDate,
                    startTime: '16:00',
                    endTime: '17:00',
                    duration: 60,
                    isBooked: false
                });
            }

            // Add weekly slots
            const weeklySlots = [
                { day: 'Monday', startTime: '09:00', endTime: '10:00' },
                { day: 'Wednesday', startTime: '14:00', endTime: '15:00' },
                { day: 'Friday', startTime: '16:00', endTime: '17:00' }
            ];

            availability.specificSlots = futureSlots;
            availability.weeklySlots = weeklySlots;
            availability.updatedAt = new Date();

            await availability.save();

            console.log(`   ✅ Added ${futureSlots.length} specific slots`);
            console.log(`   ✅ Added ${weeklySlots.length} weekly slots`);
        }

        console.log('\n\n📋 SUMMARY:');
        console.log('═══════════════════════════════════════════════');
        console.log(`✅ Updated ${achievers.length} achievers with future slots`);
        console.log(`✅ Each achiever now has:`);
        console.log(`   - 21 specific slots (next 7 days, 3 slots per day)`);
        console.log(`   - 3 weekly recurring slots`);
        console.log('\n💡 Slots are now available for booking!\n');

        await mongoose.connection.close();
        console.log('🔒 Connection closed\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

addTestSlots();
