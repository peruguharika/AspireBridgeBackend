# 🏦 COMPLETE FINANCIAL FLOW SYSTEM

## 🎯 **SYSTEM OVERVIEW**

This document outlines the complete financial flow system implemented for MentorConnect, following fintech best practices with proper money locking, admin approval, and secure bank account handling.

## 🔄 **COMPLETE FLOW (Step-by-Step)**

### **1️⃣ Aspirant Adds Money**
- **Frontend**: Razorpay Checkout
- **Backend**: Verify payment (webhook)
- **Action**: Credit aspirant wallet
- **Result**: `Aspirant Wallet +₹1000` 📌 Money is actually in Razorpay account

### **2️⃣ Class Booking (HOLD Money)**
When aspirant books class:
- **DO NOT** give money to achiever yet
- **Mark as locked**: `Aspirant Wallet -₹1000 (locked)`
- **Create**: `LockedTransaction` record
- **Status**: Money is held securely until session completion

### **3️⃣ Class Completed + Verified**
Now do internal split (ledger only):

**Example: ₹1000**
| Destination | Amount |
|-------------|--------|
| Admin wallet (10%) | ₹100 |
| Razorpay fee (2%) | ₹20 |
| Achiever wallet | ₹880 |

**Ledger update:**
- Admin Wallet +₹100
- Achiever Wallet +₹880  
- Platform Fee Account +₹20 (internal)

⚠️ **No Razorpay action here** - just internal accounting

### **4️⃣ Achiever Withdrawal Request**
Achiever:
- Adds bank account (encrypted)
- Requests withdrawal
- Creates `WithdrawalRequest` record

**WithdrawalRequest Table:**
```
- userId
- amount  
- status (pending / approved / rejected / paid)
- bankAccountId
- requestedAt
```

### **5️⃣ Admin Approves Withdrawal**
- Admin reviews request
- Clicks "Approve" 
- Now you actually move real money

### **6️⃣ Pay Achiever via Razorpay Payouts ✅**
Use Razorpay Payouts API:
```javascript
POST /payouts {
  amount: 88000, // in paise
  account_number: "ACHIEVER_BANK",
  mode: "IMPS"
}
```

After success:
- Mark withdrawal → `paid`
- Deduct wallet balance

## 🔐 **BANK ACCOUNT HANDLING (Safe Way)**

### **Encrypted Storage:**
```javascript
// Store encrypted:
{
  bankAccountNumber: encrypt("1234567890"),
  ifsc: "SBIN0001234", // Not encrypted
  accountHolderName: "John Doe", // Not encrypted  
  upiId: encrypt("john@paytm") // Optional, encrypted
}
```

### **Security Rules:**
- ❌ **NEVER** store raw bank account numbers
- ✅ **ALWAYS** encrypt sensitive data
- ✅ Use strong encryption keys
- ✅ Decrypt only when needed for Razorpay API calls

## 📊 **DATABASE MODELS**

### **LockedTransaction Model**
```javascript
{
  bookingId: ObjectId,
  aspirantId: ObjectId,
  achieverId: ObjectId,
  amount: Number,
  platformFee: Number,
  razorpayFee: Number,
  achieverAmount: Number,
  status: 'locked' | 'released' | 'refunded',
  razorpayPaymentId: String,
  lockedAt: Date,
  releasedAt: Date
}
```

### **Wallet Model (Updated)**
```javascript
{
  userId: ObjectId,
  userType: 'aspirant' | 'achiever' | 'admin',
  balance: Number,
  lockedBalance: Number, // NEW: For locked funds
  totalEarnings: Number,
  totalWithdrawn: Number,
  transactions: [TransactionSchema]
}
```

### **WithdrawalRequest Model (Updated)**
```javascript
{
  userId: ObjectId,
  amount: Number,
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed',
  bankDetails: {
    accountHolderName: String,
    accountNumber: String, // ENCRYPTED
    ifscCode: String,
    bankName: String,
    upiId: String // ENCRYPTED
  },
  approvedBy: ObjectId,
  approvedAt: Date,
  rejectedBy: ObjectId,
  rejectedAt: Date,
  rejectionReason: String
}
```

## 🛡️ **SECURITY FEATURES**

### **1. Bank Account Encryption**
- Uses AES encryption for sensitive data
- Separate encryption key in environment variables
- Decrypt only when processing Razorpay payouts

### **2. Money Locking System**
- Funds locked during booking
- Released only after session completion
- Prevents double spending and fraud

### **3. Admin Approval Workflow**
- All withdrawals require admin approval
- Audit trail for all financial operations
- Email notifications for transparency

### **4. Razorpay Integration**
- Test mode for development
- Live mode for production
- Proper webhook verification
- Secure payout processing

## 🔧 **API ENDPOINTS**

### **Payment Flow**
- `POST /api/payments/create-order` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment and lock funds
- `POST /api/session-completion/:sessionId/complete` - Release locked funds

### **Withdrawal Flow**
- `POST /api/wallets/withdrawal` - Request withdrawal
- `PUT /api/admin/withdrawals/:id/approve` - Admin approve
- `PUT /api/admin/withdrawals/:id/reject` - Admin reject

### **Admin Management**
- `GET /api/admin/wallets` - View all wallets
- `GET /api/admin/withdrawals` - View all withdrawal requests
- `GET /api/admin/profile` - Get admin profile

## ✅ **SYSTEM BENEFITS**

1. **Financial Security**: Money is locked until service delivery
2. **Fraud Prevention**: Admin approval prevents unauthorized withdrawals  
3. **Audit Trail**: Complete transaction history for compliance
4. **Data Protection**: Encrypted bank account storage
5. **Scalability**: Proper separation of concerns
6. **Transparency**: Email notifications and status tracking

## 🚀 **PRODUCTION READINESS**

The system is now production-ready with:
- ✅ Proper money flow management
- ✅ Security best practices
- ✅ Admin oversight and control
- ✅ Encrypted sensitive data storage
- ✅ Complete audit trails
- ✅ Email notifications
- ✅ Error handling and recovery

This implementation follows fintech industry standards and provides a secure, scalable foundation for the MentorConnect platform.