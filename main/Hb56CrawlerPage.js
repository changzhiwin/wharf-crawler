'use strict';

const querystring = require('node:querystring');
const puppeteer = require('puppeteer');
const axios = require('axios');
const constants = require('./Constants.js');
const imageutils = require('./ImageUtils.js');
const config = require('./Config.js');

class Hb56CrawlerPage {

  constructor(browser) {
    this.browser = browser
    this.tryLoginTimes = 0           // 当天的统计

    this.page = null
    this.loginState = 0              // -1 出错 0 初始化 1 登录中 2 成功 3 puppeteer问题 4 登录态无效
    this.loginMsg = "init"
    this.imageCodeBase64 = ""
    this.isRetrieving = false        // 串行化查询标记
  }

  async close() {
    try { await this.page.close() } catch(err) {}
    this.page = null
    this.loginState = 0
    this.loginMsg = "reset"
    this.imageCodeBase64 = ""
    this.isRetrieving = false
  }

  async init() {
    try {
      this.page = await this.browser.newPage()
      this.page.setUserAgent(constants.UserAgent)
    
      // 拦截 再次触发刷新验证码的请求
      await this.page.setRequestInterception(true);
      this.page.on('request', request => {
        const url = request.url()
        if (request.resourceType() === 'image' && url.indexOf("LoginRdCode.aspx") >= 0 && this.imageCodeBase64.length > 0) {
          request.abort()
        } 
        else if (url === (config.HB56URI + config.HB56ABORTPATH)) {
          request.respond({
            status: 200,
            contentType: 'text/html',
            body: JSON.stringify({data: []}),
          });
        }
        else {
          request.continue()
        }
        // 优化：拦截input提示，method=9，返回样例：
        // {"data":[
        //     {"title":"YM WORLD/峰明","SENAME":"YMWORLD","SCNAME":"峰明","ENAME":"YM WORLD","CNAME":"峰明"},
        //     {"title":"YM WORLD/峯明","SENAME":"YMWORLD","SCNAME":"峯明","ENAME":"YM WORLD","CNAME":"峯明"}
        // ]}
      })

      // 打开网址
      await this.page.goto(config.HB56URI + config.HB56INDEXPATH)
      // 点击登录按钮
      const loginLinkSelector = "#a_login"
      await this.page.waitForSelector(loginLinkSelector)
      await this.page.click(loginLinkSelector)
      // 默认出现是微信扫描登录
      const qrLoginSelect = "#qrcodeTable"
      await this.page.waitForSelector(qrLoginSelect)
      // 需要点击密码登录
      const passwordLoginSelector = "#form1 img"
      await this.page.click(passwordLoginSelector)

      // 优化：不使用回调
      let imgResponse = await this.page.waitForResponse(config.HB56URI + config.HB56WAITPATH)
      let mimeType = imgResponse.headers()['content-type']
      let imgBuf = await imgResponse.buffer()
      let imgCode = `data:${mimeType};base64,${imgBuf.toString('base64')}`
      this.imageCodeBase64 = imgCode

      // 确认停留在密码登录的界面了
      const formLoginSelector = "#frm_Login"
      await this.page.waitForSelector(formLoginSelector)

    } catch (err) {
      this.loginState = -1   // 登录失败
      this.loginMsg = `open site failed. [${err}]`
    }
  }

  async login() {

    this.loginState = 1 // 标记登录中
    this.loginMsg = "loging..."
    this.tryLoginTimes = this.tryLoginTimes + 1

    try {
      await this.page.type('#M_USER_NAME', config.HB56USER);
      await this.page.type('#S_PASSWORD', config.HB56PASSWORD);
    
      // 解码，填充验证码
      const decode = await imageutils.base64ToCharStr(this.imageCodeBase64)
      this.log('Hb56 call service base64ToCharStr:')
      this.log(decode)
      await this.page.type('#rdcode', decode.data);
      // 点击登录按钮
      const loginButtonSelector = "#btnLogin"
      await this.page.focus(loginButtonSelector)
      await this.page.click(loginButtonSelector)

      // 等待登录返回
      const successLoginSelector = "div#d_UserInfo"
      await this.page.waitForSelector(successLoginSelector)

      // 进入系统管理页面
      await this.page.goto(config.HB56URI + config.HB56ADMINPATH, {referer: config.HB56URI + config.HB56REFPATH})
      await this.page.waitForSelector("#bigAutocompleteContent")

      this.loginState = 2    // 登录成功
      this.loginMsg = "login success"
    }catch(err) {
      this.loginState = -1   // 登录失败
      this.loginMsg = `login site failed. [${err}]`
    }
  }

  async refresh() {
    var result = false
    // 刷新页面，保持登录态；请求数据时不能重新加载
    if (this.loginState == 2 && !this.isRetrieving) {
      try {
        await this.page.reload({waitUntil: "domcontentloaded"})
        result = true
      } catch (err) {
        result = false
        this.loginState = 3
        this.loginMsg = `refresh failed: ${err}`
      }
    }
    return result
  }

  async restart() {
    // -1, 0, 1, 2 都不应该选择重新登录
    if (this.loginState == 4) {
      await this.close()
      await this.init()
      await this.login()
    }
  }

  async screenshot(suffix) {
    var result = false
    // 截屏保存，用于debug
    try {
      await this.page.screenshot({path: `./screenshot/hb56-${suffix}.png`, fullPage: true})
      result = true
    } catch(e) {
      this.log(`screenshot error, ${e}`)
    }

    return result
  }

  async retrieve(params) {
    let data = {"code": 401, "msg": `[${this.loginState}][login ${this.tryLoginTimes} times] - ${this.loginMsg}`}
    if (this.loginState != 2) return data

    if (params.vessel == null || params.voyage == null) {
      data.code = 400
      data.msg = "must have [vessel && voyage]"
      return data
    }

    if (this.isRetrieving) {
      data.code = 503
      data.msg = data.msg + ' - busy in retrieve'
      return data
    }

    try {
      let start = Date.now()
      this.isRetrieving = true
      const vesselInputSelector = "input#q"
      const voyageInputSelector ="input#voy"
      const searchBtnSelector = "a#btnSearch"
      // https://pptr.dev/api/puppeteer.page._eval，在page环境中执行，不能传参进去，只能先置空，再填充
      await this.page.$eval(vesselInputSelector, el => {el.value = ""})
      await this.page.$eval(voyageInputSelector, el => {el.value = ""})
      await this.page.type(vesselInputSelector, params.vessel);
      await this.page.type(voyageInputSelector, params.voyage);

      await this.page.focus(searchBtnSelector)
      await this.page.click(searchBtnSelector)

      // https://pptr.dev/api/puppeteer.page.waitforresponse
      try {
        const queryResponse = await this.page.waitForResponse(config.HB56URI + config.HB56QUERYPATH)
        let apiBody = await queryResponse.text()

        let threeParts = apiBody.split("~~")
        data.tabs = threeParts.map(d => JSON.parse(d))
        data.code = 200
        data.msg = 'success'

      } catch(e) {
        data.code = 500
        data.msg = `page.waitForResponse error: ${e}`
      }
      data.cost = (Date.now() - start) / 1000
      
    } catch(error) {
      data.code = 500
      data.msg = `${error}`
      this.log(error);
    } finally {
      this.isRetrieving = false
    }

    return data
  }

  log(msg) {
    console.log(`[${(new Date()).toLocaleString()}]-[hb56:${this.loginState}]: ${msg}`)
  }

  async randomMove() {

    if (this.loginState != 2 || this.isRetrieving) {
      return `[state:${this.loginState}]-[isRetrieving:${this.isRetrieving}]-${this.loginMsg}`
    }

    let x = Math.ceil(Math.random() * 100)
    let y = Math.ceil(Math.random() * 100)
    try {
      await this.page.mouse.move(x, y);
      this.log(`move to (x = ${x}, y = ${y}) ok`)
      return {x, y}
    } catch(e) {
      let msg = `execute move mouse error: ${e}`
      this.log(msg)
      this.loginState = 3
      this.loginMsg = msg
      return msg
    }
  }
}

module.exports = {
  Hb56CrawlerPage: Hb56CrawlerPage,
}