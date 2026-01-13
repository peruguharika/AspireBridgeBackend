const mongoose = require('mongoose');
require('dotenv').config();

console.log('\n🔍 CHECKING SLOTS IN DATABASE...\n');

async function checkSlots() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        const Availability = require('./models/Availability');
        const User = require('./models/User');

        // Get all achievers
        const achievers = await User.find({ userType: 'achiever' }).select('name email _id');
        console.log(`📊 Found ${achievers.length} achievers\n`);

        for (const achiever of achievers) {
            console.log(`\n👤 Achiever: ${achiever.name} (${achiever.email})`);
            console.log(`   ID: ${achiever._id}`);

            const availability = await Availability.findOne({ userId: achiever._id });

            if (!availability) {
                console.log(`   ❌ No availability record found`);
                continue;
            }

            console.log(`   ✅ Availability record exists`);
            console.log(`   📅 Weekly Slots: ${availability.weeklySlots.length}`);
            console.log(`   📅 Specific Slots: ${availability.specificSlots.length}`);

            if (availability.weeklySlots.length > 0) {
                console.log(`\n   Weekly Slots:`);
                availability.weeklySlots.forEach((slot, index) => {
                    console.log(`      ${index + 1}. ${slot.day} ${slot.startTime} - ${slot.endTime}`);
                });
            }

            if (availability.specificSlots.length > 0) {
                console.log(`\n   Specific Slots:`);
                availability.specificSlots.forEach((slot, index) => {
                    const dateStr = slot.date.toISOString().split('T')[0];
                    console.log(`      ${index + 1}. ${dateStr} ${slot.startTime} - ${slot.endTime} (Booked: ${slot.isBooked})`);
                });
            }

            if (availability.weeklySlots.length === 0 && availability.specificSlots.length === 0) {
                console.log(`   ⚠️  NO SLOTS CONFIGURED!`);
            }
        }

        console.log('\n\n📋 SUMMARY:');
        console.log('═══════════════════════════════════════════════');

        const allAvailabilities = await Availability.find({});
        const totalWeekly = allAvailabilities.reduce((sum, av) => sum + av.weeklySlots.length, 0);
        const totalSpecific = allAvailabilities.reduce((sum, av) => sum + av.specificSlots.length, 0);

        console.log(`Total Achievers: ${achievers.length}`);
        console.log(`Total Availability Records: ${allAvailabilities.length}`);
        console.log(`Total Weekly Slots: ${totalWeekly}`);
        console.log(`Total Specific Slots: ${totalSpecific}`);

        if (totalWeekly === 0 && totalSpecific === 0) {
            console.log('\n⚠️  NO SLOTS FOUND IN DATABASE!');
            console.log('💡 Achievers need to add their availability first.');
        } else {
            console.log('\n✅ Slots exist in database');
        }

        await mongoose.connection.close();
        console.log('\n🔒 Connection closed\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

checkSlots();
