'use strict';

const fs = require('fs');
const Koa = require('koa');
const Router = require('@koa/router');
const koaBody = require('koa-body');

const app = new Koa();
const router = new Router();

router
  .get('/retrieve/npedi', (ctx, next) => {
    let data = null
    if (ctx.query.voyage === 'FK243A') {
      let txt = fs.readFileSync('./data/mock1.json', {encoding:'utf8', flag:'r'})
      data = JSON.parse(txt)
    } else {
      let txt = fs.readFileSync('./data/mock2.json', {encoding:'utf8', flag:'r'})
      data = JSON.parse(txt)
    }
    ctx.body = data
  })
  .get('/test', (ctx, next) => {
    ctx.body = {name: 'Bob', age: 22}
  })

app.use(router.routes());
app.listen(4427);

console.log('app listen at 4427')