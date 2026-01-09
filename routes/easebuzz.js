const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

// Easebuzz configuration
const EASEBUZZ_MERCHANT_KEY = process.env.EASEBUZZ_MERCHANT_KEY || 'your_merchant_key';
const EASEBUZZ_SALT = process.env.EASEBUZZ_SALT || 'your_salt_key';
const EASEBUZZ_ENV = process.env.EASEBUZZ_ENV || 'test'; // 'test' or 'prod'

// @route   POST /api/easebuzz/initiate-payment
// @desc    Generate payment hash for Easebuzz
// @access  Private
router.post('/initiate-payment', authenticateToken, async (req, res) => {
    try {
        const { amount, firstname, email, phone, productinfo, surl, furl } = req.body;

        // Generate unique transaction ID
        const txnid = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Prepare hash string
        // Hash format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
        const hashString = `${EASEBUZZ_MERCHANT_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|email|||||||||||${EASEBUZZ_SALT}`;

        // Generate SHA-512 hash
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        // Prepare payment data
        const paymentData = {
            key: EASEBUZZ_MERCHANT_KEY,
            txnid: txnid,
            amount: amount,
            productinfo: productinfo,
            firstname: firstname,
            phone: phone,
            email: email,
            surl: surl || 'http://localhost:5000/api/easebuzz/success',
            furl: furl || 'http://localhost:5000/api/easebuzz/failure',
            hash: hash,
            udf1: req.user.id, // Store user ID for reference
            udf2: '',
            udf3: '',
            udf4: '',
            udf5: ''
        };

        res.json({
            success: true,
            paymentData: paymentData,
            env: EASEBUZZ_ENV
        });

    } catch (error) {
        console.error('Easebuzz Initiate Payment Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error.message
        });
    }
});

// @route   POST /api/easebuzz/verify-payment
// @desc    Verify Easebuzz payment response
// @access  Private
router.post('/verify-payment', authenticateToken, async (req, res) => {
    try {
        const {
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            status,
            hash: receivedHash,
            easepayid
        } = req.body;

        // Verify hash
        // Reverse hash format: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
        const hashString = `${EASEBUZZ_SALT}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${EASEBUZZ_MERCHANT_KEY}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

        if (calculatedHash === receivedHash) {
            // Payment verified
            res.json({
                success: true,
                verified: true,
                status: status,
                txnid: txnid,
                easepayid: easepayid,
                message: 'Payment verified successfully'
            });
        } else {
            // Hash mismatch
            res.status(400).json({
                success: false,
                verified: false,
                message: 'Payment verification failed - hash mismatch'
            });
        }

    } catch (error) {
        console.error('Easebuzz Verify Payment Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error.message
        });
    }
});

// @route   POST /api/easebuzz/success
// @desc    Payment success callback
// @access  Public
router.post('/success', async (req, res) => {
    console.log('Easebuzz Payment Success:', req.body);
    res.send('Payment Successful');
});

// @route   POST /api/easebuzz/failure
// @desc    Payment failure callback
// @access  Public
router.post('/failure', async (req, res) => {
    console.log('Easebuzz Payment Failed:', req.body);
    res.send('Payment Failed');
});

module.exports = router;
