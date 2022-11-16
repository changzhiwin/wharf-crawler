#### 这是什么
基于浏览器模拟点击的爬虫。不能写太多，懂得都懂。


#### 运行
```
nohup node index.js > ./log.out 2>&1 &
```

#### Centos 安装 Puppeteer
> https://www.cnblogs.com/xiaohe520/articles/14723464.html

##### 依赖
```
yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 -y
```

##### 字体
```
yum install ipa-gothic-fonts xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-fonts-cyrillic xorg-x11-fonts-Type1 xorg-x11-fonts-misc -y
```

#### Page Closed
https://github.com/puppeteer/puppeteer/issues/8928

https://github.com/puppeteer/puppeteer/issues/7455

> I'm using puppeteer@13.0.1 with no problems now.

```
"puppeteer": "^19.1.1"
```

#### 采坑
部分网站用了字体加密技术，浏览器可以正常显示，但是加大了爬虫获取信息的难度。