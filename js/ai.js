/**
 * AI 物品识别模块
 * 
 * 支持用户自备 API Key 的 AI 识别服务：
 * - Google Gemini (免费，每分钟60次)
 * - OpenAI GPT-4o-mini (按量付费)
 * - 通义千问 Qwen-VL (有免费额度)
 * 
 * 用户在自己的"我的"页面配置 API Key，数据直接发送到对应 AI 服务。
 * 类似 WebDAV 同步模式——用户自备服务，应用提供集成。
 * 
 * 版本: 1.0
 */

const AI_STORAGE_KEY = 'ai_config';

// ========================================
// AI 配置管理
// ========================================

const AIConfig = {
  /**
   * 获取保存的 AI 配置
   */
  get() {
    try {
      const data = localStorage.getItem(AI_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * 保存 AI 配置
   */
  save(config) {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({
      ...config,
      updatedAt: new Date().toISOString()
    }));
  },

  /**
   * 清除 AI 配置
   */
  clear() {
    localStorage.removeItem(AI_STORAGE_KEY);
  },

  /**
   * 获取预设的 AI 服务商
   */
  getPresets() {
    return [
      {
        id: 'gemini',
        name: 'Google Gemini',
        desc: '免费，每分钟60次，识别准确率高',
        icon: '🔮',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        docUrl: 'https://aistudio.google.com/apikey',
        needProxy: false
      },
      {
        id: 'openai',
        name: 'OpenAI',
        desc: '按量付费，效果最好，约¥0.003/次',
        icon: '🤖',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        docUrl: 'https://platform.openai.com/api-keys',
        needProxy: false
      },
      {
        id: 'qwen',
        name: '通义千问',
        desc: '阿里云出品，国内访问快，有免费额度',
        icon: '🌐',
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        docUrl: 'https://help.aliyun.com/zh/model-studio/getting-started/first-api-call-to-qwen',
        needProxy: false
      }
    ];
  },

  /**
   * 获取当前配置的 AI 服务商信息
   */
  getCurrentPreset() {
    const config = this.get();
    if (!config) return null;
    const presets = this.getPresets();
    return presets.find(p => p.id === config.provider) || null;
  }
};

// ========================================
// AI 识别客户端
// ========================================

const AIClient = {
  /**
   * 调用 AI 识别图片中的物品
   * @param {string} imageDataUrl - base64 图片数据
   * @returns {Promise<{name: string, category: string}>}
   */
  async recognize(imageDataUrl) {
    const config = AIConfig.get();
    if (!config) {
      throw new Error('请先在"我的"页面配置 AI 识别');
    }

    const preset = AIConfig.getPresets().find(p => p.id === config.provider);
    if (!preset) {
      throw new Error('AI 服务商配置无效');
    }

    // 构建提示词
    const systemPrompt = `你是一个家庭物品识别助手。请识别图片中的物品，返回 JSON 格式：
{
  "name": "物品名称（中文，简洁准确）",
  "category": "分类ID（从以下选择）"
}

分类列表：
- food: 食品（零食、方便面、罐头等）
- beverage: 饮料（可乐、果汁、茶、水等）
- condiment: 调味品（酱油、醋、油、盐等）
- daily: 日用品（纸巾、洗衣液、牙膏等）
- medicine: 药品（感冒药、维生素等）
- cosmetic: 化妆品（护肤品、化妆品等）
- electronics: 电子产品（充电器、电池等）
- clothing: 衣物（衣服、鞋子、帽子等）
- book: 书籍
- tool: 工具
- other: 其他

请只返回 JSON，不要其他文字。`;

    try {
      let result;
      switch (config.provider) {
        case 'gemini':
          result = await this._callGemini(preset, config.apiKey, systemPrompt, imageDataUrl);
          break;
        case 'openai':
          result = await this._callOpenAI(preset, config.apiKey, systemPrompt, imageDataUrl);
          break;
        case 'qwen':
          result = await this._callQwen(preset, config.apiKey, systemPrompt, imageDataUrl);
          break;
        default:
          throw new Error('不支持的 AI 服务商');
      }

      return this._parseResult(result);
    } catch (e) {
      console.error('AI 识别失败:', e);
      throw e;
    }
  },

  /**
   * 调用 Google Gemini API
   */
  async _callGemini(preset, apiKey, systemPrompt, imageDataUrl) {
    // 提取 base64 数据（去掉 data:image/... 前缀）
    const base64Data = imageDataUrl.split(',')[1];
    const mimeType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';

    const response = await fetch(`${preset.apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API 错误 (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  /**
   * 调用 OpenAI API
   */
  async _callOpenAI(preset, apiKey, systemPrompt, imageDataUrl) {
    const response = await fetch(preset.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: '请识别这张图片中的物品' },
              { type: 'image_url', image_url: { url: imageDataUrl } }
            ]
          }
        ],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API 错误 (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  },

  /**
   * 调用通义千问 API
   */
  async _callQwen(preset, apiKey, systemPrompt, imageDataUrl) {
    const response = await fetch(preset.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { text: '请识别这张图片中的物品' },
              { image: imageDataUrl }
            ]
          }
        ],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`通义千问 API 错误 (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  },

  /**
   * 解析 AI 返回的 JSON 结果
   */
  _parseResult(text) {
    if (!text) throw new Error('AI 返回为空');

    // 尝试提取 JSON（AI 可能返回带 ```json 标记的文本）
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // 尝试找到 { } 包裹的 JSON
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    try {
      const result = JSON.parse(jsonStr);
      return {
        name: result.name || '',
        category: result.category || 'other'
      };
    } catch (e) {
      // 如果解析失败，尝试从文本中提取名称
      const lines = text.split('\n').filter(l => l.trim());
      const firstLine = lines[0]?.replace(/^["'“」\s]+|["'」\s]+$/g, '') || '';
      return {
        name: firstLine.substring(0, 50),
        category: 'other'
      };
    }
  },

  /**
   * 测试 AI 连接
   * 发送一个简单的请求验证 API Key 是否有效
   */
  async test() {
    const config = AIConfig.get();
    if (!config) {
      return { success: false, message: '未配置 AI 服务' };
    }

    const preset = AIConfig.getPresets().find(p => p.id === config.provider);
    if (!preset) {
      return { success: false, message: 'AI 服务商配置无效' };
    }

    try {
      // 发送一个简单的文本请求来测试连接
      const testPrompt = '请回复"连接成功"四个字';
      
      let response;
      if (config.provider === 'gemini') {
        response = await fetch(`${preset.apiUrl}?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: testPrompt }]
            }]
          })
        });
      } else {
        response = await fetch(preset.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.provider === 'qwen' ? 'qwen-turbo' : 'gpt-4o-mini',
            messages: [
              { role: 'user', content: testPrompt }
            ],
            max_tokens: 50
          })
        });
      }

      if (!response.ok) {
        const err = await response.text();
        return { success: false, message: `连接失败 (${response.status})` };
      }

      return { success: true, message: '连接成功' };
    } catch (e) {
      return { success: false, message: e.message || '连接失败' };
    }
  }
};

// ========================================
// 暴露到全局
// ========================================
window.AIConfig = AIConfig;
window.AIClient = AIClient;
