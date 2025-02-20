const { default: mongoose } = require("mongoose");


const betSchema = new mongoose.Schema({
    sport: String,
    event: String,
    betType: String,
    team: String,
    odds: Number,
    decimalOdds: Number,
    impliedProbability: Number,
    trueProbability: Number,
    expectedValue: Number,
    edgePercent: Number,
    sportsbook: String,
    timestamp: { type: Date, default: Date.now },
  });
  
  const Bet = mongoose.model('Bet', betSchema);

  module.exports = Bet
  