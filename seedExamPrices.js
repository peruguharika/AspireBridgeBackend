const mongoose = require('mongoose');
const ExamPrice = require('./models/ExamPrice');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const examPrices = [
  // SSC Category
  { category: 'SSC', subCategory: 'SSC CGL', hourlyRate: 600, description: 'Combined Graduate Level Examination' },
  { category: 'SSC', subCategory: 'SSC CHSL', hourlyRate: 550, description: 'Combined Higher Secondary Level' },
  { category: 'SSC', subCategory: 'SSC MTS', hourlyRate: 450, description: 'Multi Tasking Staff' },
  { category: 'SSC', subCategory: 'SSC GD', hourlyRate: 400, description: 'General Duty Constable' },
  { category: 'SSC', subCategory: 'SSC JE', hourlyRate: 650, description: 'Junior Engineer' },
  { category: 'SSC', subCategory: 'SSC CPO', hourlyRate: 700, description: 'Central Police Organization' },

  // UPSC Category
  { category: 'UPSC', subCategory: 'UPSC CSE', hourlyRate: 1000, description: 'Civil Services Examination' },
  { category: 'UPSC', subCategory: 'UPSC CDS', hourlyRate: 800, description: 'Combined Defence Services' },
  { category: 'UPSC', subCategory: 'UPSC NDA', hourlyRate: 750, description: 'National Defence Academy' },
  { category: 'UPSC', subCategory: 'UPSC CAPF', hourlyRate: 850, description: 'Central Armed Police Forces' },

  // Banking Category
  { category: 'Banking', subCategory: 'IBPS PO', hourlyRate: 700, description: 'Probationary Officer' },
  { category: 'Banking', subCategory: 'IBPS Clerk', hourlyRate: 500, description: 'Banking Clerk' },
  { category: 'Banking', subCategory: 'IBPS SO', hourlyRate: 750, description: 'Specialist Officer' },
  { category: 'Banking', subCategory: 'SBI PO', hourlyRate: 750, description: 'State Bank PO' },
  { category: 'Banking', subCategory: 'SBI Clerk', hourlyRate: 550, description: 'State Bank Clerk' },
  { category: 'Banking', subCategory: 'RBI Grade B', hourlyRate: 900, description: 'Reserve Bank Grade B' },

  // Railways Category
  { category: 'Railways', subCategory: 'RRB NTPC', hourlyRate: 600, description: 'Non-Technical Popular Categories' },
  { category: 'Railways', subCategory: 'RRB JE', hourlyRate: 650, description: 'Junior Engineer' },
  { category: 'Railways', subCategory: 'RRB Group D', hourlyRate: 450, description: 'Group D Posts' },
  { category: 'Railways', subCategory: 'RRB ALP', hourlyRate: 550, description: 'Assistant Loco Pilot' },

  // State PSC Category
  { category: 'State PSC', subCategory: 'UPPSC PCS', hourlyRate: 800, description: 'UP Provincial Civil Services' },
  { category: 'State PSC', subCategory: 'BPSC', hourlyRate: 750, description: 'Bihar Public Service Commission' },
  { category: 'State PSC', subCategory: 'MPSC', hourlyRate: 750, description: 'Maharashtra Public Service Commission' },
  { category: 'State PSC', subCategory: 'RPSC', hourlyRate: 700, description: 'Rajasthan Public Service Commission' },

  // Defense Category
  { category: 'Defense', subCategory: 'CDS', hourlyRate: 800, description: 'Combined Defence Services' },
  { category: 'Defense', subCategory: 'AFCAT', hourlyRate: 750, description: 'Air Force Common Admission Test' },
  { category: 'Defense', subCategory: 'Indian Navy', hourlyRate: 750, description: 'Indian Navy Entrance' },

  // Insurance Category
  { category: 'Insurance', subCategory: 'LIC AAO', hourlyRate: 700, description: 'Assistant Administrative Officer' },
  { category: 'Insurance', subCategory: 'NIACL', hourlyRate: 650, description: 'National Insurance Company' },

  // Teaching Category
  { category: 'Teaching', subCategory: 'CTET', hourlyRate: 500, description: 'Central Teacher Eligibility Test' }
];

async function seedExamPrices() {
  try {
    console.log('🌱 Starting exam prices seeding...');
    
    // Clear existing exam prices
    await ExamPrice.deleteMany({});
    console.log('🗑️ Cleared existing exam prices');
    
    // Insert new exam prices
    const result = await ExamPrice.insertMany(examPrices);
    console.log(`✅ Successfully seeded ${result.length} exam prices`);
    
    // Display seeded data
    console.log('\n📊 Seeded Exam Prices:');
    const groupedPrices = {};
    result.forEach(price => {
      if (!groupedPrices[price.category]) {
        groupedPrices[price.category] = [];
      }
      groupedPrices[price.category].push(price);
    });
    
    Object.keys(groupedPrices).forEach(category => {
      console.log(`\n${category}:`);
      groupedPrices[category].forEach(price => {
        console.log(`  - ${price.subCategory}: ₹${price.hourlyRate}/hr`);
      });
    });
    
    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding exam prices:', error);
    process.exit(1);
  }
}

// Run seeding
seedExamPrices();