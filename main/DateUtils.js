
const dayjs = require('dayjs')

function lastMonthStartDate(d) {
  let now = getStdDateObj(d)
  return now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD') //2022-09-01
}

function nextMonthEndDate(d) {
  let now = getStdDateObj(d)
  return now.add(1, 'month').endOf('month').format('YYYY-MM-DD')
}

function getDateTimeStr() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss')
}

function getStdDateObj(d) {
  d = d || ""

  let now = null
  if (d.length === 10) {
    try {
      now = dayjs(d)
    } catch(e) {
      now = dayjs()
    }
  } else {
    now = dayjs()
  }

  return now
}

module.exports = {
  lastMonthStartDate: lastMonthStartDate,
  nextMonthEndDate: nextMonthEndDate,
  getDateTimeStr: getDateTimeStr
}