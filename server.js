
require('dotenv').config();
const express = require('express');

const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const { processOdds, discordClient } = require("./utils/functions");

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));



// Initialize Discord Bot

discordClient.once('ready', () => {
  console.log(`✅ Logged into Discord as ${discordClient.user.tag}`);
  cron.schedule('*/15 * * * *', processOdds);
});


// Start Express Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
