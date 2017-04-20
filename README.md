# stockalert-webtask
A simple webtask that alerts myself when a given stock has reached support or resistance level. 

The code here is deployed as a webtask through https://webtask.io/ and can get triggered by an http call to the webtask's url. 
For example, 
```
curl https://wt-403e21263c54152c5faa273af0dacd90-0.run.webtask.io/stockalerts?ticker=TNA
```
Currently I am using ifttt's timer event to trigger this call every hour.

#### This webtask does two things:
* When the webtask's url is hit, it retrieves the latest price of the given stock, as well as the historical highs and lows of this stock, calculates the support and resistance levels based on a custom strategy I designed, and determines whether it's a good time for me to buy or sell this stock.
* If the strategy determines there is a buy or sell signal, the webtask invokes Mailgun's web service and sends me an email, with the current stock price and calculation results.

#### Thoughts behind the strategy:

In my casual stock trading experience, I discovered sometimes stocks seemed to be trading in a narrow range for a long period of time, and this was a good opportunity for [range bound trading](http://www.investopedia.com/terms/r/rangeboundtrading.asp). 

In order for doing range bound trading (buy at support level and sell at resistance level), I had to keep checking the stock market, and keep track of recent highs and lows for every stock I was interested in. This was unrealistic and my calculation was not precise at all.

This is why I developed this trading strategy and deployed it as a webtask, so that I can be alerted when a trade signal is generated. I don't have to spend any time checking the market, and the calculation would be accurate (full disclaimer: the strategy itself might not be accurate and it is not suitable for every stock. Even for the specific stocks I want to track, I will have to keep tweaking the parameters based on situations). 

#### Support and resistance calculation:

In finance people usually use [lognormal distribution to model stock prices](http://financetrain.com/why-lognormal-distribution-is-used-to-describe-stock-prices/), and this is what I did in this strategy. I queried Yahoo's finance api to get the daily highs and lows from the past month, and used them as my sample data to generate a 95% confidence interval from mean. My idea was that if the next high trading price or low trading price gets out of the confidence interval(when I am alerted), it is probably fairly close to the bounds. However this assumption doesn't work any more when stocks are trending, meaning they would break the support and resistance levels and keep going that direction rather than reverting to mean. Also a sample data of one month is not representative of all the history of the stock. 

