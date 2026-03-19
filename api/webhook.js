const axios = require('axios');

// 配置信息（稍后在Vercel环境变量中设置）
const COZE_TOKEN = process.env.COZE_TOKEN;
const COZE_BOT_ID = process.env.COZE_BOT_ID;
const QQ_APP_ID = process.env.QQ_APP_ID;
const QQ_APP_SECRET = process.env.QQ_APP_SECRET;

/**
 * 调用Coze API获取回复
 */
async function callCoze(query, userId) {
  try {
    const response = await axios.post(
      'https://api.coze.cn/v1/chat',
      {
        bot_id: COZE_BOT_ID,
        user_id: userId,
        query: query,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${COZE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10秒超时
      }
    );

    return response.data.answer || '抱歉，我现在无法回答';
  } catch (error) {
    console.error('Coze API调用失败:', error.message);
    return '调用智能体失败，请稍后再试';
  }
}

/**
 * 验证QQ平台签名（安全考虑）
 */
function verifySignature(signature, timestamp, nonce, body) {
  // 简化版：实际生产中应按QQ官方文档实现签名验证
  // 参考：https://bot.q.qq.com/wiki/develop/api/#%E6%B6%88%E6%81%AF%E9%89%B4%E6%9D%83
  return true; // 开发阶段先放行，上线前必须实现验证
}

/**
 * Vercel Serverless函数入口
 */
module.exports = async (req, res) => {
  // 只处理POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 获取请求参数
    const { signature, timestamp, nonce } = req.query;
    const body = req.body;

    // 验证签名（安全相关，必须实现）
    if (!verifySignature(signature, timestamp, nonce, body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // QQ开放平台推送的消息格式
    // 文档：https://bot.q.qq.com/wiki/develop/api/
    const eventType = body.op; // 操作类型
    const eventData = body.d;  // 事件数据

    // 处理不同类型的消息
    if (eventType === 0) { // 0 表示消息事件
      const message = eventData.message;
      const groupId = eventData.group_id;
      const userId = eventData.author.id;
      const content = message.content;

      // 只处理@机器人的消息（去掉@部分）
      const cleanContent = content.replace(/<@!\d+>/g, '').trim();
      
      if (!cleanContent) {
        // 如果只有@没有内容，可以忽略或回复提示
        return res.json({
          reply: '请说点什么吧～'
        });
      }

      // 调用Coze
      const reply = await callCoze(cleanContent, `${groupId}_${userId}`);

      // 返回给QQ平台
      return res.json({
        reply: reply,
        at_sender: true // 是否@发送者
      });
    }

    // 其他事件类型（如进群欢迎等）可以在这里扩展
    return res.json({ reply: '收到' });

  } catch (error) {
    console.error('处理消息失败:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
