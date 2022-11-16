'use strict';

const fs = require('fs');
const imageUtils = require('./image_utils.js');

(async () => {

  const data = fs.readFileSync('./img/code-hb56-1.jpeg')

  console.log("File data is buffer: " + Buffer.isBuffer(data))

  const imgBase64 = `data:image/jpeg;base64,${data.toString('base64')}`

  const result = await imageUtils.base64ToCharStr(imgBase64)

  console.log(result)

  console.log(`result.data = ${result.data}`)
  console.log(`left ${result.times} times.`)
  
})()

/*
示例输出：

File data is buffer: true
{
  code: 200,
  msg: '公告：大哥大姐们行行好，写代码的时候不要写死循环。都判断下times参数，小于0的时候就不要在发送请求了，服务器真心扛不住啊！！times小于-20后永久封禁！',
  times: 18,
  data: 'kp5z'
}
result.data = kp5z
left 18 times.
*/