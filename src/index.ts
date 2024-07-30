import {
  Plugin,
  Setting,
  showMessage
} from "siyuan";

import "./index.scss";


export default class synca extends Plugin {


  // async syncmode() {
  //   try {
  //     const response = await fetch('http://127.0.0.1:6806/api/sync/setSyncMode', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify({ "mode": 3 })
  //     });
  //     // 可选：处理响应数据
  //     const result = await response.json();
  //     if (result.code === 0) {
  //       showMessage("同步模式初始化成功，请勿更改");
  //     }
  //   } catch (error) {
  //     showMessage("同步模式设置失败，请手动修改为完全手动同步");
  //   }
  // }

  async syncmode() {
    if (!await this.loadData("synclasttime")) {
      showMessage("【重要】首次使用建议先去“设置-云端-云端同步模式”设置同步模式为完全手动，插件完全接管同步，使用体验更佳", 999999);
      alert("【重要】首次使用建议先去“设置-云端-云端同步模式”设置同步模式为完全手动，插件完全接管同步，使用体验更佳");
    }
  }
  async push() {
    try {
      const response = await fetch("http://127.0.0.1:6806/api/sync/performSync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ "upload": true })
      });
      // 可选：处理响应数据
      const result = await response.json();
      if (result.code === 0) {
        // 新的 fetch 请求
        const userKey = await this.loadData("synckey");  // 使用 await 关键字
        const syncurl = await this.loadData("syncurl");
        const encodedUserKey = encodeURIComponent(userKey);  // 对 userKey 进行编码
        const newResponse = await fetch(syncurl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "userkey": encodedUserKey,
            "action": "push"
          },
          body: JSON.stringify({ syncst: 1 })
        });
        this.saveData("synclasttime", Date.now());
      }
    } catch (error) {
      console.error("Error during sync:", error);
    }
  }

  async pull() {
    try {
      const response = await fetch("http://127.0.0.1:6806/api/sync/performSync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ "upload": false })
      });
      // 可选：处理响应数据
      const result = await response.json();
      if (result.code === 0) {
        console.log("拉取完成");
      }
    } catch (error) {
      console.error("Error during sync:", error);
    }
  }

  async aware() {
    const userKey = await this.loadData("synckey");
    const syncurl = await this.loadData("syncurl");
    const encodedUserKey = encodeURIComponent(userKey);

    let intervalId;

    const checkSyncStatus = async () => {
      const currentTime = Date.now();
      const lastSyncTime = await this.loadData("synclasttime");
      const synctime = await this.loadData("synctime");

      // 检查是否需要休眠
      if (currentTime - lastSyncTime < synctime + 5000) {
        // console.log(currentTime - lastSyncTime);
        // console.log(synctime);
        return;
      }

      try {
        const response = await fetch(syncurl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "userkey": encodedUserKey,
            "action": "pull"
          },
          body: JSON.stringify({})
        });

        if (!response.ok) {
          // 不再抛出错误，改为记录日志
          console.error(`HTTP error! status: ${response.status}`);
        } else {
          const result = await response.json();

          if (result.syncst === 1) {
            console.log("感知到同步，正在执行");
            await this.pull();
          }
        }
      } catch (error) {
        // 不再抛出错误，改为记录日志
        console.log("感知服务器无效");
      }
    };

    // 每synctime秒执行一次 checkSyncStatus
    intervalId = window.setInterval(checkSyncStatus, 2000);
  }

  async listenchange() {
    let isFetchOverridden = false; // 标志变量，用于判断 fetch 是否已经被覆盖
    if (!isFetchOverridden) {
      const originalFetch = window.fetch;
      const self = this; // 保存对当前类实例的引用

      window.fetch = async function (url, ...args) {
        try {
          // const requestStart = new Date().getTime();

          const response = await originalFetch(url, ...args);

          // const requestEnd = new Date().getTime();
          // console.log(`Request to ${url} took ${requestEnd - requestStart}ms`);

          if (url.endsWith("/api/transactions")) {
            console.log("监听到文件变动");
            // 在这里执行你的函数
            await self.push(); // 调用 sync 函数
          }

          return response;
        } catch (error) {
          throw error;
        }
      };

      isFetchOverridden = true; // 设置标志变量，表示 fetch 已经被覆盖
    }
  }
  async onLayoutReady() {
    // 调用函数
    this.listenchange();
    this.syncmode();
    this.aware();
    const url = await this.loadData("syncurl");
    if (!url) {
      this.saveData("syncurl", "https://sync.sypai.cc");
    }
    const userKey = await this.loadData("synckey");
    if (!userKey) {
      const randomKey = generateRandomKey(10);
      this.saveData("synckey", randomKey);
    }

    function generateRandomKey(length: number): string {
      let result = "";
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    }
  }

  async onload() {
    const textareaElement1 = document.createElement("textarea");
    const textareaElement2 = document.createElement("textarea");
    const textareaElement3 = document.createElement("textarea");
    this.setting = new Setting({
      confirmCallback: () => {
        this.saveData("synctime", textareaElement1.value);
        this.saveData("syncurl", textareaElement2.value);
        this.saveData("synckey", textareaElement3.value);
        window.location.reload();
      }
    });

    this.setting.addItem({
      title: "感知周期",
      description: "本机同步完成后，其他设备可以在多长时间内感知到本机的同步，当另一个设备的网络条件较差时，可以适当延长时间来等待另一个设备感知，除非网络条件很差，否则不建议设置,留空即可（时间单位：ms）",
      createActionElement: () => {
        textareaElement1.className = "b3-text-field fn__block ids";
        textareaElement1.placeholder = "请输入时间";

        // 使用 setTimeout 确保在输入框加载后设置值
        setTimeout(() => {
          this.loadData("synctime").then(loadedSynctime => {
            if (loadedSynctime) {
              textareaElement1.value = loadedSynctime;
            } else {
              textareaElement1.value = ""; // 如果没有获取到有效数据，设置为空字符串
            }
          }).catch(error => {
            textareaElement1.value = ""; // 如果加载数据出错，设置为空字符串
          });
        }, 0);

        return textareaElement1;
      },
    });

    this.setting.addItem({
      title: "中心感知服务器地址",
      description: "开头要带上http(s)://，可以是域名，也可以是IP，非80/443这些通用端口的记得加端口号，为空则使用思源派公共感知节点https://sync.sypai.cc，不保证稳定性和高速，也不保证一直在线",
      createActionElement: () => {
        textareaElement2.className = "b3-text-field fn__block ids";
        textareaElement2.placeholder = "请输入URL";

        // 使用 setTimeout 确保在输入框加载后设置值
        setTimeout(() => {
          this.loadData("syncurl").then(loadedSyncurl => {
            if (loadedSyncurl) {
              textareaElement2.value = loadedSyncurl;
            } else {
              textareaElement2.value = ""; // 如果没有获取到有效数据，设置为空字符串
            }
          }).catch(error => {
            textareaElement2.value = ""; // 如果加载数据出错，设置为空字符串
          });
        }, 0);

        return textareaElement2;
      },
    });

    this.setting.addItem({
      title: "中心感知密钥",
      description: "在需要同步感知的客户端里填相同的感知密钥，留空时会自动生成，手动设置请尽量复杂，否则在你使用公共感知服务器的时候可能被其他人的重复密钥感知",
      createActionElement: () => {
        textareaElement3.className = "b3-text-field fn__block ids";
        textareaElement3.placeholder = "请输入感知密钥";

        // 使用 setTimeout 确保在输入框加载后设置值
        setTimeout(() => {
          this.loadData("synckey").then(loadedSynckey => {
            if (loadedSynckey) {
              textareaElement3.value = loadedSynckey;
            } else {
              textareaElement3.value = ""; // 如果没有获取到有效数据，设置为空字符串
            }
          }).catch(error => {
            textareaElement3.value = ""; // 如果加载数据出错，设置为空字符串
          });
        }, 0);

        return textareaElement3;
      },
    });

    const btn3Element = document.createElement("button");
    btn3Element.className = "b3-button b3-button--outline fn__flex-center fn__size200";
    btn3Element.textContent = "服务状态：未获取";

    const handleClick = async () => {
      // 设置超时时间为3秒
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("访问超时"));
        }, 3000);
      });

      const testurl = await this.loadData("syncurl");
      // 发起网络请求来刷新服务状态
      Promise.race([
        fetch(testurl),
        timeoutPromise
      ])
        .then(response => {
          if (response.ok) {
            btn3Element.innerText = "服务状态: 200 OK";
          } else {
            btn3Element.innerText = `服务状态: ${response.status} ${response.statusText}`;
          }
        })
        .catch(error => {
          if (error.message !== "访问超时") {
            console.error("发生错误:", error);
          }
          btn3Element.innerText = error.message;
        });
    };

    btn3Element.addEventListener("click", handleClick);

    this.setting.addItem({
      title: "服务状态",
      description: "点击按钮获取当前中心感知服务器状态",
      actionElement: btn3Element,
    });

    const btn4Element = document.createElement("button");
    btn4Element.className = "b3-button b3-button--outline fn__flex-center fn__size200";
    btn4Element.textContent = "下载自部署感知程序";

    btn4Element.addEventListener("click", () => {
      window.open("https://github.com/muhanstudio/siyuan-sync-aware-serve", "_blank");
    });
    this.setting.addItem({
      title: "部署环境",
      description: "点击下载部署环境，别忘了点个star，并关注思源派（https://sypai.cc）",
      actionElement: btn4Element,
    });

    this.addTopBar({
      icon: "iconLanguage",
      title: this.i18n.addTopBarIcon,
      position: "left",
      callback: async () => {
        const syncurl = this.loadData("syncurl");
        window.open(await syncurl, "_blank");
      }
    });
  }
}
