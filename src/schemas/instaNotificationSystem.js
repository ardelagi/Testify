const mongoose = require('mongoose');

function sanitizeKey(username) {
    return username.replace(/\./g, '__DOT__');
}

function restoreKey(sanitizedKey) {
    return sanitizedKey.replace(/__DOT__/g, '.');
}

const instagramSchema = new mongoose.Schema({
    Guild: { type: String, required: true },
    Channel: { type: String, required: true },
    InstagramUsers: [{ type: String }], 
    LastPostDates: { type: Map, of: Date, default: new Map() }
});

instagramSchema.methods.setLastPostDate = function(username, date) {
    const sanitizedKey = sanitizeKey(username);
    this.LastPostDates.set(sanitizedKey, date);
    return this;
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
    for (const [sanitizedKey, date] of this.LastPostDates.entries()) {
        const originalUsername = restoreKey(sanitizedKey);
        result[originalUsername] = date;
    }
    return result;
};

instagramSchema.methods.cleanupOrphanedDates = function() {
    const validUsernames = new Set(this.InstagramUsers);
    const toDelete = [];
    
    for (const [sanitizedKey] of this.LastPostDates.entries()) {
        const originalUsername = restoreKey(sanitizedKey);
        if (!validUsernames.has(originalUsername)) {
            toDelete.push(sanitizedKey);
        }
    }
    
    toDelete.forEach(key => this.LastPostDates.delete(key));
    return toDelete.length; 
};

instagramSchema.statics.sanitizeKey = sanitizeKey;
instagramSchema.statics.restoreKey = restoreKey;

instagramSchema.index({ Guild: 1, Channel: 1 });

module.exports = mongoose.model('InstagramNotifications', instagramSchema);