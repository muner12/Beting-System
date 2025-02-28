const { EmbedBuilder, Client, GatewayIntentBits } = require("discord.js");
require('dotenv').config();
const axios = require('axios');
const { sportsbookChannels, sportIcons, allowed_sports } = require("../config");

sportsbookChannels
let discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
discordClient.login(process.env.BOT_TOKEN);
// const sportsbookChannels = {
//     "DraftKings": process.env.DRAFT_KINGS,
//     "FanDuel": process.env.FAN_DUEL,
//     "ESPNBet": process.env.ESPN_BET,
//     "BetMGM": process.env.BET_MGM,
//     "Hardrock": process.env.HARDROCK,
//     "Bovada": process.env.BOVADA
//   };
function americanToDecimal(odds) {
    return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  }
  
  // Convert odds to Implied Probability
  function impliedProbability(odds) {
    return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  }
  
  // Remove Vig to estimate True Probability
  function removeVig(probOver, probUnder) {
    const totalProb = probOver + probUnder;
    return {
      trueProbabilityOver: probOver / totalProb,
      trueProbabilityUnder: probUnder / totalProb,
    };
  }
  
  // Calculate Expected Value (EV%) and Edge %
  function calculateEV(trueProbability, impliedProbability, decimalOdds) {
    const ev = (trueProbability * decimalOdds) - 1;
    const edgePercent = ((trueProbability - impliedProbability) / impliedProbability) * 100;
    return {
      expectedValue: ev.toFixed(4),
      edgePercent: edgePercent.toFixed(2),
      isPositiveEV: ev.toFixed(2) > 0.11,
      odds:decimalOdds
    };
  }
  
  // Fetch Sports Data
  async function fetchSports() {
    try {
      const response = await axios.get(`https://api.the-odds-api.com/v4/sports?regions=us`, {
        params: { apiKey: process.env.API_KEY },
      });
      // return [{
      //     key: "basketball_nba",
      //     group: "Basketball",
      //     title: "NBA",
      //     description: "US Basketball",
      //     active: true,
      //     has_outrights: false
      //   }];


      const filteredSports = response.data.filter((sport) =>
        allowed_sports.includes(sport.title)
      );
  
       return filteredSports;
    } catch (error) {

      console.error('❌ Error fetching sports:', error.message);
      return [];
    }
  }
  
  // Fetch Events for a Sport
  async function fetchEvents(sportKey) {
    try {
      const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sportKey}/events`, {
        params: { apiKey: process.env.API_KEY },
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching events for ${sportKey}:`, error.message);
      return [];
    }
  }
  
  // Fetch Betting Odds for an Event
  async function fetchOdds(sportKey, eventId) {
    try {
      const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds`, {
        params: {
          apiKey: process.env.API_KEY,
          regions: 'us',
          markets:'player_assists,player_points,player_rebounds,player_points_rebounds_assists',
          oddsFormat: 'american',
        },
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching odds for event ${eventId}:`, error.message);
      return null;
    }
  }
  
  // Process and Store Odds Data
exports.processOdds=async()=>{
    try {
      console.log('🔄 Fetching sports data...');
      const sports = await fetchSports();
      
      for (const sport of sports) {

        console.log(`🎯 Processing Sport: ${sport.title}`);

        let sportIcon=sportIcons[sport.title];
        if(sport.key=='Boxing' || sport.key=='MMA'){
          sportIcon="🥊";
        }
        
        const events = await fetchEvents(sport.key);
        
        for (const event of events) {
          console.log(`📊 Fetching odds for event: ${event.sport_key} (${event.id})`);
          const oddsData = await fetchOdds(event.sport_key, event.id);
          console.log("odds data length: " + oddsData?.bookmakers?.length);
          if (!oddsData || !oddsData.bookmakers || oddsData.bookmakers.length === 0) continue;
  
          for (const bookmaker of oddsData.bookmakers) {
            const sportsbook = bookmaker.title;
            let sportCategory = sport.title;
            console.log("sportsbook: " + sportsbook,sportsbookChannels[sportCategory][sportsbook]);

                    
                    if (sport.title=="MMA" || sport.title=="Boxing"){
                        sportCategory = "MMA & Boxing"; // Match the category in `sportsbookChannels`
                    }

            
            if (!sportsbookChannels[sportCategory] || !sportsbookChannels[sportCategory][sportsbook]) continue; // Skip if no Discord channel is mapped

            for (const market of bookmaker.markets) {
              
              let probOver = null, probUnder = null;
              for (const outcome of market.outcomes) {
                const decimalOdds = americanToDecimal(outcome.price);
                const impliedProb = impliedProbability(outcome.price);
  
                if (market.key.includes("over")) probOver = impliedProb;
                if (market.key.includes("under")) probUnder = impliedProb;
  
                let trueProbability = impliedProb + 0.03;
                if (probOver !== null && probUnder !== null) {
                  const fairProbs = removeVig(probOver, probUnder);
                  trueProbability = market.key.includes("over") ? fairProbs.trueProbabilityOver : fairProbs.trueProbabilityUnder;
                }
  
                const evData = calculateEV(trueProbability, impliedProb, decimalOdds);
                  console.log(evData);
                if (evData.isPositiveEV) {

                  let betData = {
                    sport: sport.title,
                    event: `${outcome.description } | ${event.home_team} vs ${event.away_team}`,
                    betType:`${outcome.name} ${outcome.point}  ${market.key=='player_assists'?'Assists':market.key=='player_points'?'Points':market.key=='player_rebounds'?'Rebounds':'Rebounds+Assists+Points'}`,
                    team: outcome.name,
                    odds: outcome.price>0?"+"+outcome.price:outcome.price,
                    decimalOdds,
                    impliedProbability: (impliedProb * 100).toFixed(2),
                    trueProbability: (trueProbability * 100).toFixed(2),
                    expectedValue: evData.expectedValue,
                    edgePercent: evData.edgePercent,
                    sportsbook,
                    icon:sportIcon
                  };
  
                  //await Bet.create(betData);
                  await sendToDiscord(betData);
                  console.log("BET DATA",betData);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in processOdds:', error);
    }
  }
  
  // Send Messages to Discord (Correct Channel for Each Sportsbook)
  
  async function sendToDiscord(betData) {

    const { sport, sportsbook } = betData;

    const timestamp = Math.floor(Date.now() / 1000);

    if (!sportsbookChannels[sport] || !sportsbookChannels[sport][sportsbook]) {
      console.error(`❌ No Discord channel found for ${sport} - ${sportsbook}`);
      return;
  }
  

  const channelId = sportsbookChannels[sport][sportsbook];

    
    if (!channelId){
      console.error(`�� No Discord channel ID found for ${sport} - ${sportsbook}`);
      return;
    } 
  
    try {
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) return;
  
      // Create an embed message
      const embed = new EmbedBuilder()
        .setColor("#ff5733") // 🔥 Set Embed color (use HEX codes)
        .setTitle(`🔥${betData.edgePercent}% Edge AI Bet!`)
        .setDescription(`${betData.icon} ${betData.event}`)
        .setThumbnail("https://i.imgur.com/zM3T92Y.png")

        .addFields(
          { name: `💵 Bet: ${betData.betType}`, value: ` `, inline: false },
          { name: `📊 Odds: ${betData.odds}`, value: ` `, inline: false },
          { name: `🎯 Edge: ${betData.edgePercent}%`, value: ` `, inline: false }
        ).setFooter({ 
          text: `Powered by Primetime Sports Club`,
          iconURL: "https://i.imgur.com/zM3T92Y.png"  // Replace with your Discord bot's icon URL
  
         }).setTimestamp();
    //.setFooter({ text: `🔹 ${betData.sportsbook} | 📅 ${new Date().toLocaleString()}` });
  
      let send_response=await channel.send({ embeds: [embed] });
      console.log("Message Send Successfully");
    } catch (error) {
      console.error(`❌ Error sending message to Discord channel for ${betData.sportsbook}:`, error);
    }
  }
  
exports.discordClient=discordClient;
