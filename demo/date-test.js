const dateUtils = require('../main/DateUtils.js');

console.log(dateUtils.lastMonthStartDate())

console.log(dateUtils.nextMonthEndDate())

console.log(dateUtils.lastMonthStartDate('2022-11-01'))

console.log(dateUtils.nextMonthEndDate('2022-11-01'))

console.log(dateUtils.getDateTimeStr())

const config = require('../main/Config.js');

console.log(config.IMGAPI)
console.log(config.NPEDIUSER)