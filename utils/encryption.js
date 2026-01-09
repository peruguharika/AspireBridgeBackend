const CryptoJS = require('crypto-js');

// Use environment variable for encryption key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text
 */
function encrypt(text) {
  if (!text) return text;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text to decrypt
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText; // Return as-is if decryption fails
  }
}

/**
 * Encrypt bank account details
 * @param {Object} bankDetails - Bank account details
 * @returns {Object} - Encrypted bank details
 */
function encryptBankDetails(bankDetails) {
  if (!bankDetails) return bankDetails;
  
  return {
    accountHolderName: bankDetails.accountHolderName, // Name is not encrypted
    accountNumber: encrypt(bankDetails.accountNumber),
    ifscCode: bankDetails.ifscCode, // IFSC is not sensitive
    bankName: bankDetails.bankName,
    upiId: bankDetails.upiId ? encrypt(bankDetails.upiId) : undefined
  };
}

/**
 * Decrypt bank account details
 * @param {Object} encryptedBankDetails - Encrypted bank details
 * @returns {Object} - Decrypted bank details
 */
function decryptBankDetails(encryptedBankDetails) {
  if (!encryptedBankDetails) return encryptedBankDetails;
  
  return {
    accountHolderName: encryptedBankDetails.accountHolderName,
    accountNumber: decrypt(encryptedBankDetails.accountNumber),
    ifscCode: encryptedBankDetails.ifscCode,
    bankName: encryptedBankDetails.bankName,
    upiId: encryptedBankDetails.upiId ? decrypt(encryptedBankDetails.upiId) : undefined
  };
}

module.exports = {
  encrypt,
  decrypt,
  encryptBankDetails,
  decryptBankDetails
};