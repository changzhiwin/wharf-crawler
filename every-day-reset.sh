#!/bin/bash

# crontab 参考：https://panxu.net/article/8492.html

cd /root/vessel-puppeteer

# 每天凌晨执行
echo `date` >> ./curl-log.out
curl -s http://127.0.0.1:4427/reset/login-times/all >> ./curl-log.out 2>&1
echo -e "\n" >> ./curl-log.out 2>&1