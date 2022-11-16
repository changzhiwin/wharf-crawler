'use strict';

const Koa = require('koa');
const Router = require('@koa/router');
const koaBody = require('koa-body');
const serve = require("koa-static");
const crawlerTool = require("./main/CrawlerBrowser.js");
const dateUtils = require('./main/DateUtils.js');

const app = new Koa();
const router = new Router();
var GlobalCrawler = null;

function log(msg) {
  console.log(`[${dateUtils.getDateTimeStr()}]-[main]: ${msg}`)
}

router
  .get('/retrieve/:name', async (ctx, next) => {
    ctx.body = await GlobalCrawler.retrieve(ctx.params.name, ctx.query.vessel, ctx.query.voyage)
  })
  .get('/refresh/:which', async (ctx, next) => {
    ctx.body = await GlobalCrawler.refresh(ctx.params.which)
  })
  .get('/screenshot/:which', async (ctx, next) => {
    ctx.body = await GlobalCrawler.screenshot(`ts-${Date.now()}`, ctx.params.which)
  })
  .get('/active/move', ctx => {
    ctx.body = GlobalCrawler.activeMouseMove(ctx.query.period)
  })
  .get('/random-move/:which', async (ctx, next) => {
    ctx.body = await GlobalCrawler.randomMove(ctx.params.which)
  })
  .get('/get/state/:which', ctx => {
    ctx.body = GlobalCrawler.showState(ctx.params.which)
  })
  .get('/reset/page/:which', async (ctx, next) => {
    ctx.body = await GlobalCrawler.resetPage(ctx.params.which)
  })
  .get('/reset/login-times/:which', ctx => {
    ctx.body = GlobalCrawler.resetLoginTryTimes(ctx.params.which)
  })
  .get('/crawler/create', async (ctx, next) => {

    let start = Date.now()
    let data = {code: 501}

    log(`Init crawler, need login = ${ctx.query.login}`)
    try {
      if (GlobalCrawler != null) {
        await GlobalCrawler.close()
        GlobalCrawler = null
      }
      let crawler = new crawlerTool.CrawlerBrowser()
      await crawler.init()
      await crawler.screenshot("after-open", 'all')

      if (ctx.query.login === 'yes') {
        await crawler.login()
        await crawler.screenshot("after-login", 'all')
      }

      GlobalCrawler = crawler
      data.code = 200
      data.msg = `Crawler was born`
      log(data.msg)
    } catch(e) {
      data.msg = e
      log(`Create crawler error: ${e}`)
    }
    
    data.cost = ( Date.now() - start ) / 1000
    ctx.body = data
  })

app.use(serve("./screenshot"))

app.use(async (ctx, next) => {
  if (GlobalCrawler == null && ctx.path != "/crawler/create") {
    ctx.body = {code: 503, msg: "crawler is not available!!"}
  } else {
    await next()
  }
});

app.use(router.routes());
app.listen(4427);

log('app listen at 4427')