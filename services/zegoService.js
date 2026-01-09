const crypto = require('crypto');

/**
 * Generate Zegocloud token
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 * @returns {string} - Generated token
 */
const generateZegoToken = (userId, roomId) => {
  try {
    const appId = parseInt(process.env.ZEGOCLOUD_APP_ID);
    const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET;
    
    const time = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 1000000000);
    
    // Token payload
    const payload = {
      app_id: appId,
      user_id: userId,
      room_id: roomId,
      privilege: {
        1: 1, // Login privilege
        2: 1  // Publish stream privilege
      },
      stream_id_list: null,
      nonce: nonce,
      expire_time: time + 3600 * 24 // 24 hours
    };

    // Generate signature
    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', serverSecret)
      .update(payloadStr)
      .digest('hex');

    // Create token
    const token = {
      ...payload,
      signature
    };

    return Buffer.from(JSON.stringify(token)).toString('base64');

  } catch (error) {
    console.error('Generate Zego Token Error:', error);
    throw error;
  }
};

/**
 * Validate Zegocloud callback
 */
const validateZegoCallback = (signature, timestamp, nonce) => {
  try {
    const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET;
    
    const dataToSign = `${timestamp}${nonce}`;
    const expectedSignature = crypto
      .createHmac('sha256', serverSecret)
      .update(dataToSign)
      .digest('hex');

    return signature === expectedSignature;

  } catch (error) {
    console.error('Validate Zego Callback Error:', error);
    return false;
  }
};

module.exports = {
  generateZegoToken,
  validateZegoCallback
};