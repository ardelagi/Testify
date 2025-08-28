const { model, Schema } = require('mongoose');

const motionlifeAiChannelSchema = new Schema({
    guildId: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    allowedRoleId: {
        type: String,
        default: null
    },
    setupBy: {
        type: String,
        required: true
    },
    setupAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsed: {
        type: Date,
        default: Date.now
    }
});

module.exports = model('MotionlifeAiChannel', motionlifeAiChannelSchema);