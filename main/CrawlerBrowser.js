'use strict';

const puppeteer = require('puppeteer');

const Constants = require('./Constants.js')
const npedi = require("./NpediCrawlerPage.js");
const dateUtils = require('./DateUtils.js');

class CrawlerBrowser {

  constructor() {
    this.browser = null
    // 定时触发，使页面处于激活状态
    this.intervalTimer = null
    this.pages = new Map()
  }

  async close() {

    try {
      for (let [name, page] of this.pages.entries()) {
        await page.close()
      }
    } catch(e) {} finally {
      await this.browser.close()
    }

    if (this.intervalTimer != null) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }

    this.browser = null
    this.pages = null
  }

  async init() {
    // Create a new incognito browser context
    this.browser = await puppeteer.launch({ args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    //this.browser = await bw.createIncognitoBrowserContext();

    const npediPage = new npedi.NpediCrawlerPage(this.browser)
    this.pages.set(Constants.CrawlerName.NPEDI, npediPage)

    for (let [name, page] of this.pages.entries()) {
      const start = Date.now()
      await page.init()
      this.log(`init ${name} page, cost ${((Date.now() - start) / 1000 )} seconds`)
    }
  }

  async login() {

    for (let [name, page] of this.pages.entries()) {
      const start = Date.now()
      await page.login()
      this.log(`login ${name} page, cost ${((Date.now() - start) / 1000 )} seconds`)
    }

    // 启动周期性移动鼠标任务
    this.activeMouseMove(Constants.MouseMovePeriod)
  }

  async refresh(which) {
    var result = {}
    let filterMap = this.filterByName(which)
    for (let [name, page] of filterMap) {
      const start = Date.now()
      result[name] = await page.refresh()
      this.log(`refresh ${name} page, cost ${((Date.now() - start) / 1000 )} seconds`)
    }
    return {code: 200, msg: result}
  }

  async screenshot(suffix, which) {
    var result = {}
    let filterMap = this.filterByName(which)
    for (let [name, page] of filterMap) {
      const start = Date.now()
      try { 
        result[name] = await page.screenshot(suffix) 
      } catch(e) {
        this.log(`screenshot ${name} page error: ${e}`)
      }
      this.log(`screenshot ${name} page, cost ${((Date.now() - start) / 1000 )} seconds`)
    } 
    return {code: 200, msg: result, suffix}
  }

  async randomMove(which) {
    var result = {}
    let filterMap = this.filterByName(which)
    for (let [name, page] of filterMap) {
      try {
        result[name] = await page.randomMove()
      } catch(e) {
        result[name] = `random move error: ${e}`
      }
      
    }
    return {code: 200, msg: result}
  }

  async resetPage(which) {
    let result = {}
    let filterMap = this.filterByName(which)
    for (let [name, page] of filterMap) {
      try {
        result[name] = await page.reset()
      } catch(e) {
        result[name] = `reset page error: ${e}`
      }
    }
    return {code: 200, msg: result}
  }

  showState(which) {
    let result = {}
    let filterMap = this.filterByName(which)
    for (let [name, page] of filterMap) {
      result[name] = page.getState()
    }
    return {code: 200, msg: result} 
  }

  activeMouseMove(timeout) {
    // 默认30秒
    timeout = +timeout || Constants.MouseMovePeriod

    // 先关闭之前的任务
    if (this.intervalTimer != null) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }

    // 正数则启动新任务；否则什么都不做
    if (timeout > 0) {
      timeout = (timeout < Constants.MouseMovePeriod) ? Constants.MouseMovePeriod : timeout
      this.intervalTimer = setInterval(async () => {
        try {
          await this.randomMove('all')
        } catch(e) {
          this.log(`setInterval execute error: ${e}`)
        }
      }, timeout)
    }

    return {state: (this.intervalTimer != null) ? 'on' : 'off', timeout}
  }

  resetLoginTryTimes(which) {
    let result = {}
    let filterMap = this.filterByName(which)
    for (let [name, page] of filterMap) {
      this.log(`reset login try times: ${name}-${page.tryLoginTimes}`)
      result[`${name}_try_times`] = page.tryLoginTimes
      page.tryLoginTimes = 0
    }
    return {code: 200, msg: result} 
  }

  async retrieve(crawlerName, vessel, voyage) {
    const cw = this.pages.get(crawlerName)
    if (cw == null) {
      return {"code": 500, "msg": `crawler not found. [${crawlerName}]`}
    } else {
      return await cw.retrieve({vessel, voyage})
    }
  }

  filterByName(which) {
    let fMap = new Map()
    for (let [name, page] of this.pages.entries()) {
      if (which === 'all' || which === name) {
        fMap.set(name, page)
      }
    }
    return fMap
  }

  log(msg) {
    console.log(`[${dateUtils.getDateTimeStr()}]-[browser]: ${msg}`)
  }

}

module.exports = {
  CrawlerBrowser: CrawlerBrowser,
}