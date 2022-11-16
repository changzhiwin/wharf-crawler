'use strict';

const querystring = require('node:querystring');
const puppeteer = require('puppeteer');
const axios = require('axios');

const constants = require('./Constants.js');
const imageutils = require('./ImageUtils.js');
const dateUtils = require('./DateUtils.js');
const Constants = require('./Constants.js');
const config = require('./Config.js');

class NpediCrawlerPage {

  constructor(browser) {
    this.browser = browser
    this.cookieHeaderName = "ediauthorization"

    // stateful
    this.page = null
    this.loginState = 0          // -1 出错 0 初始化 1 登录中 2 成功 3 puppeteer问题 4 登录态无效
    this.loginMsg = "init"
    this.imageCodeBase64 = ""
    this.cookies = ""

    this.tryLoginTimes = 0       // 当天的统计
  }

  async close() {

    try { await this.page.close() } catch(err) {
      this.log(`close error: ${err}`)
    }
    
    this.page = null
    this.loginState = 0
    this.loginMsg = "close"
    this.imageCodeBase64 = ""
    this.cookies = ""
  }

  getState() {
    let loginState = this.loginState
    let loginMsg = this.loginMsg
    let tryLoginTimes = this.tryLoginTimes

    return {loginState, loginMsg, tryLoginTimes}
  }

  // 新建tab页，打开站点，可以直接拿到验证码图片的base64
  async init() {
    // 必须是初始化态，才去执行登录
    if (this.loginState !== 0) {
      this.log(`can't execute init()`)
      return
    }

    try {
      this.page = await this.browser.newPage()
      this.page.setUserAgent(constants.UserAgent)

      await this.page.goto(config.NPEDIURI + config.NPEDIINDEXPATH)

      // fix: 等待网络空闲；否则，只是等到有img标签，获取的base64数据不全
      await this.page.waitForNetworkIdle({idleTime: 500, timeout: 3000})

      const loginCodeImgSelector = "#loginway_form2 div.login-code img"
      this.imageCodeBase64 = await this.page.evaluate(selector => {
        const img = document.querySelector(selector)
        return img.src
      }, loginCodeImgSelector)

      this.log(this.imageCodeBase64)

    } catch (err) {
      this.loginState = 5   // 登录失败
      this.loginMsg = `open site failed. [${err}]`
      this.log(this.loginMsg)
    }
  }

  async login() {

    // 必须是初始化态，才去执行登录
    if (this.loginState !== 0) {
      this.log(`can't execute login()`)
      return
    }

    this.loginState = 1 // 标记登录中
    this.loginMsg = "loging..."
    this.tryLoginTimes = this.tryLoginTimes + 1

    try {
      // 解码
      const decode = await imageutils.base64ToCharStr(this.imageCodeBase64)
      this.log(JSON.stringify(decode, 0, 2))
      if (decode.code != 200) {
        throw new Error(`ImageDecode, ${decode.msg}`)
      }

      // 填充登录表单
      await this.page.type('#username', config.NPEDIUSER);
      await this.page.type('#password', config.NPEDIPASSWORD);
      await this.page.type('#captcha2', decode.data);

      // 焦点放在登录按钮上，点击登录
      const loginButtenSelector = "#loginway_form2 button.el-button"
      await this.page.focus(loginButtenSelector)
      await this.page.click(loginButtenSelector)

      // 优化：等待登录接口返回，直接获取
      let loginResponse = await this.page.waitForResponse(config.NPEDIURI + config.NPEDILOGINPATH)
      let loginBody     = await loginResponse.json()
      this.cookies = loginResponse.request().headers()[this.cookieHeaderName] || "--"

      // 进入系统界面，不是必须的，请求登录接口后就获取了cookies
      //await this.page.goto(config.NPEDIURI + config.NPEDIADMINPATH)
      //const appMainSelector = "#app section.app-main"
      //await this.page.waitForSelector(appMainSelector)

      this.loginState = 2    // 登录成功
      this.loginMsg = "login success"
    } catch(err) {
      this.loginState = 5   // 登录失败
      this.loginMsg = `login site failed. [${err}]`
      this.log(this.loginMsg)
    }
  }

  async refresh() {
    var result = false
    // 刷新页面，保持登录态
    if (this.loginState == 2 || this.loginState == 4) {
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

  async reset(notLog) {
    let cando = false

    // -1, 0, 1, 2 都不应该选择重新登录
    if (this.loginState > 2 && this.tryLoginTimes <= Constants.MaxImageDecodeTimes) {
      await this.close()
      await this.init()
      await this.login()

      cando = true
    }
    !notLog && this.log(`execute reset ok? ${cando}`)
    return cando
  }

  async screenshot(suffix) {
    var result = false
    try {
      await this.page.screenshot({path: `./screenshot/npedi-${suffix}.png`, fullPage: true})
      result = true
    } catch(e) {
      this.log(`screenshot error, ${e}`)
    }
    return result
  }

  // 只实现axios，因为api可以直接请求。{ vessel, voyage, method }
  async retrieve(params) {

    var data = {"code": 401, "msg": `[${this.loginState}][login ${this.tryLoginTimes} times] - ${this.loginMsg}`}

    if (params.vessel == null || params.voyage == null) {
      data.code = 400
      data.msg = "must have [vessel && voyage]"
      return data
    }

    // 尝试修复登录态，如果是正常的，则不会做什么
    await this.reset(true)

    if (this.loginState != 2) return data
    
    const apiPath = config.NPEDIURI + config.NPEDIQUERYPATH 
    const apiQuery = {
      vesselCnName: "",
      vesselEnName: params.vessel,
      voyage: params.voyage,
      etaBegin: dateUtils.lastMonthStartDate(),
      etaEnd: dateUtils.nextMonthEndDate(),
      terminal: "",
      page: 1,
      pageSize: 10
    }

    try {
      const response = await axios.get(apiPath, {
        params: apiQuery,
        responseType: 'json',
        headers: {
          "Host": config.NPEDIHOST,
          "Referer": config.NPEDIURI + config.NPEDIREFPATH,
          "Accept": "application/json, text/plain, */*",
          "User-Agent": constants.UserAgent,
          "Cookie": "Web-Token=" + this.cookies.substring(7),
          "ediauthorization": this.cookies,
        }
      });

      data = response.data
      if (data.code === 401) {      // {"code": 401, "msg": "请求访问：/error，认证失败，无法访问系统资源"}
        this.loginState = 4         // 登录态无效
        this.loginMsg = `retrieve failed. invalid cookies`
      }

    } catch(error) {
      data.code = 500
      data.msg = `${error}`
      this.log(error);
    }

    return data
  }

  log(msg) {
    console.log(`[${dateUtils.getDateTimeStr()}]-[npedi:${this.loginState}]-[retry:${this.tryLoginTimes}]: ${msg}`)
  }

  async randomMove() {
    if (this.loginState != 2) {
      return `[${this.loginState}]-${this.loginMsg}`
    }
    
    let x = Math.ceil(Math.random() * 100)
    let y = Math.ceil(Math.random() * 100)
    try {
      await this.page.mouse.move(x, y);
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
  NpediCrawlerPage: NpediCrawlerPage,
}