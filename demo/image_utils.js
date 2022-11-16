
const axios = require('axios');
const config = require('../main/Config.js');

async function base64ToCharStr(base64Code) {

  try {
    const response = await axios.post(config.IMGAPIURI, {
      token: config.IMGAPITOKEN,
      type: "online",
      uri: base64Code
    }, {
      headers: {"Content-Type": "application/x-www-form-urlencoded"}
    });

    return response.data
    
  } catch (error) {
    console.error(error);
    return null
  }

}

module.exports = {
  base64ToCharStr: base64ToCharStr,
}