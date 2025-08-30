const mongoose = require('mongoose');

// Helper function to sanitize keys for MongoDB
function sanitizeKey(key) {
    return key.replace(/\./g, '_DOT_');
}

// Helper function to restore original keys
function restoreKey(key) {
    return key.replace(/_DOT_/g, '.');
}

const instagramSchema = new mongoose.Schema({
    Guild: { type: String, required: true },
    Channel: { type: String, required: true },
    InstagramUsers: [{ type: String }],
    LastPostDates: { type: Map, of: Date, default: new Map() }
});

// Add instance methods to handle key sanitization
instagramSchema.methods.setLastPostDate = function(username, date) {
    const sanitizedKey = sanitizeKey(username);
    this.LastPostDates.set(sanitizedKey, date);
};

instagramSchema.methods.getLastPostDate = function(username) {
    const sanitizedKey = sanitizeKey(username);
    return this.LastPostDates.get(sanitizedKey);
};

instagramSchema.methods.hasLastPostDate = function(username) {
    const sanitizedKey = sanitizeKey(username);
    return this.LastPostDates.has(sanitizedKey);
};

instagramSchema.methods.deleteLastPostDate = function(username) {
    const sanitizedKey = sanitizeKey(username);
    return this.LastPostDates.delete(sanitizedKey);
};

instagramSchema.methods.getAllLastPostDates = function() {
    const result = {};
    for (const [key, value] of this.LastPostDates.entries()) {
        const originalKey = restoreKey(key);
        result[originalKey] = value;
    }
    return result;
};

// Export the helper functions as well
instagramSchema.statics.sanitizeKey = sanitizeKey;
instagramSchema.statics.restoreKey = restoreKey;

module.exports = mongoose.model('InstagramNotifications', instagramSchema);