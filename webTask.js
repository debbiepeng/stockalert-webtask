"use strict";
const P = require("bluebird");
const confidence95 = require("confidence95");
const https = require("https");
require("isomorphic-fetch");
const _ = require("lodash");
const Mailgun = require("mailgun-js");
const moment = require("moment");

var getIntradayStockQuote = function (ticker) {
  let url = `https://query.yahooapis.com/v1/public/yql?q=select LastTradePriceOnly from yahoo.finance.quotes where symbol in ("${ticker}")
  &format=json&env=store://datatables.org/alltableswithkeys`;  
  return fetch(url)
    .then(res => res.json())
    .catch(err => {
      throw new Error(`Cannot get intraday quote: ${err.message}.`);
    });
};

var getHistoricalPrices = function (ticker) {
  let endDate = moment();
  let startDate = moment(endDate).subtract(1, "month");  
  let url = `https://query.yahooapis.com/v1/public/yql?q=select Date, High, Low, Close from yahoo.finance.historicaldata where symbol in ("${ticker}")
  and startDate="${startDate.format("YYYY-MM-DD")}" and endDate="${endDate.format("YYYY-MM-DD")}"&format=json&env=store://datatables.org/alltableswithkeys`;  
  return fetch(url)
    .then(res => res.json())
    .catch(err => {
      throw new Error(`Cannot get historical prices: ${err.message}.`);
    });
}

var calculateSupportResistenceLevels = function (historicalPrices) {  
  // We are assuming stock highs and lows are lognorminal distributed, 
  // and we calculate the 95% confidence interval to get an estimate of the upper and lower bounds of stock prices
  let historicalLows = _.map(historicalPrices, (q => Math.log(parseFloat(q.Low))));
  let statistics = confidence95(historicalLows);
  let support = Math.exp(statistics.mean - statistics.interval);
  
  let historicalHighs = _.map(historicalPrices, (q => Math.log(parseFloat(q.High))));
  statistics = confidence95(historicalHighs);
  var resistence = Math.exp(statistics.mean + statistics.interval);
  
  return { support, resistence };
}

var callMailgun = function (subject, text, cb) {
  var apiKey = "<API_Key>";
  var domain = "sandboxd24c573d376b415fb6b3c9388dc7be50.mailgun.org";
  var mailgun = Mailgun({ apiKey, domain });

  var data = {
    from: 'Stock Alert <xyz@gmail.com>',
    to: 'Wei Croteau <xyz@gmail.com>',
    subject,
    text
  };

  var sendPromise = P.promisify(mailgun.messages().send, { context: mailgun.messages() });
  return sendPromise(data)
    .then(() => {
      cb(null, `${subject} ${text}`);
    })
    .catch(error => {
      cb(null, `Called Mailgun: ${JSON.stringify(error)}`);
    });;
}

var checkPricesAPI = function (ctx, cb) {
  P.join(getIntradayStockQuote(ctx.data.ticker), getHistoricalPrices(ctx.data.ticker),  
    (intradayPriceJson, historicalPriceJson) => {
      var intradayPrice = parseFloat(intradayPriceJson.query.results.quote.LastTradePriceOnly);
      var historicalPrices = _.map(historicalPriceJson.query.results.quote, q => q);
      var calcResults = calculateSupportResistenceLevels(historicalPrices);
      let mailBody = `Estimated Support Level: ${calcResults.support}\nEstimated Resistence Level: ${calcResults.resistence}\nLatest Price: ${intradayPrice}\n`;
      if (intradayPrice >= calcResults.resistence || intradayPrice <= calcResults.support) {    
        let subject = `A trade signal for ${ctx.data.ticker} is generated`;    
        let actionRecommendation = `You should ${intradayPrice >= calcResults.resistence ? "SELL" : "BUY"} this stock.`    
        callMailgun(subject, mailBody + actionRecommendation, cb);        
      }
      else {
        cb(null, `Nothing exciting to report.\n${mailBody}`);
      }
    })
    .catch(err => {     
      let subject = 'An error occurred in stock alert calculation';
      let mailBody = err.message;
      callMailgun(subject, mailBody, cb);      
    });
}

module.exports = checkPricesAPI;
