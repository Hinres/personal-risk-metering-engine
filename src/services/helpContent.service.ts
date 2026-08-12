import { AppDataSource } from '../config/database';
import { HelpContent } from '../models/HelpContent';
import logger from '../utils/logger';

const helpRepo = () => AppDataSource.getRepository(HelpContent);

export class HelpContentService {
  /**
   * 获取帮助内容列表
   * [PRME-TS-003]
   */
  static async getList(category?: string, page = 1, limit = 20) {
    const where: any = { status: 'published' };
    if (category) where.category = category;

    const [items, total] = await helpRepo().findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { sort_order: 'ASC', updated_at: 'DESC' },
    });

    return { items, total, page, limit };
  }

  /**
   * 按主题获取帮助内容
   * GET /api/v1/help/:topic
   * [PRME-TS-003]
   */
  static async getByTopic(topic: string) {
    const content = await helpRepo().findOne({
      where: { topic, status: 'published' },
    });
    if (!content) throw new Error(`Help content not found: ${topic}`);
    return content;
  }

  /**
   * 获取帮助内容详情（by ID）
   */
  static async getById(id: string) {
    const content = await helpRepo().findOne({ where: { content_id: id, status: 'published' } });
    if (!content) throw new Error('Help content not found');
    return content;
  }

  /**
   * 搜索帮助内容
   */
  static async search(keyword: string, page = 1, limit = 20) {
    const [items, total] = await helpRepo().findAndCount({
      where: [
        { title: `%${keyword}%`, status: 'published' },
        { content: `%${keyword}%`, status: 'published' },
      ],
      skip: (page - 1) * limit,
      take: limit,
      order: { sort_order: 'ASC' },
    });
    return { items, total, page, limit };
  }

  /**
   * 创建帮助内容（管理后台）
   */
  static async create(data: {
    topic: string;
    title: string;
    content: string;
    category?: string;
    format?: string;
    sort_order?: number;
    tags?: string[];
  }) {
    const existing = await helpRepo().findOne({ where: { topic: data.topic } });
    if (existing) throw new Error(`Topic already exists: ${data.topic}`);

    const help = helpRepo().create({
      topic: data.topic,
      title: data.title,
      content: data.content,
      category: data.category || 'general',
      format: data.format || 'markdown',
      sort_order: data.sort_order ?? 0,
      tags: data.tags || [],
      status: 'published',
      is_active: true,
    });
    await helpRepo().save(help);
    return help;
  }

  /**
   * 更新帮助内容
   */
  static async update(id: string, data: Partial<HelpContent>) {
    const help = await helpRepo().findOne({ where: { content_id: id } });
    if (!help) throw new Error('Help content not found');
    Object.assign(help, data);
    help.updated_at = new Date();
    await helpRepo().save(help);
    return help;
  }

  /**
   * 删除帮助内容（软删除）
   */
  static async delete(id: string) {
    const help = await helpRepo().findOne({ where: { content_id: id } });
    if (!help) throw new Error('Help content not found');
    help.status = 'deleted';
    help.is_active = false;
    await helpRepo().save(help);
    return true;
  }

  /**
   * 初始化默认帮助内容（首次风险提示弹窗内容）
   */
  static async initializeDefaultHelp() {
    const defaults = [
      {
        topic: 'risk-disclaimer',
        title: '投资风险提示',
        content: `# 投资风险提示

欢迎使用个人风险计量引擎（PRME）。在使用本系统前，请仔细阅读以下风险提示：

## 1. 市场风险

投资有风险，市场波动可能导致您的投资本金亏损。历史表现不代表未来收益。

## 2. 模型风险

VaR（风险价值）计算基于历史数据和统计模型，存在模型假设和参数估计的不确定性。实际损失可能超出VaR估计值。

## 3. 数据风险

系统使用第三方市场数据，数据可能存在延迟、错误或缺失。请自行核实重要数据。

## 4. 合规声明

本系统提供的所有分析结果仅供参考，不构成投资建议。请您根据自身风险承受能力做出独立判断。

## 5. 技术风险

系统可能因技术故障、网络问题等原因暂时不可用。请做好数据备份和应急预案。

**点击"已了解风险"即表示您已阅读并理解上述风险，同意自行承担投资风险。**
`,
        category: 'compliance',
        format: 'markdown',
        sort_order: 1,
        tags: ['首次使用', '风险提示', '合规'],
      },
      {
        topic: 'var-introduction',
        title: 'VaR（风险价值）简介',
        content: `# VaR（风险价值）简介

VaR（Value at Risk，风险价值）是衡量投资组合在一定置信水平和持有期内可能遭受的最大损失的统计方法。

## 计算方法

### 1. 历史模拟法
使用历史收益率数据直接计算分位数，不需要假设收益率分布。

### 2. 参数法
假设收益率服从正态分布，使用均值和标准差计算VaR。

### 3. 蒙特卡洛模拟
通过随机模拟生成大量可能的投资组合价值路径，计算VaR。

## 参数选择

- **置信度**：90%、95%、99%（越高越保守）
- **时间周期**：1天、7天、30天（越长越保守）

## 局限性

VaR不告诉您损失超过VaR时的具体金额，建议使用压力测试和情景分析作为补充。
`,
        category: 'tutorial',
        format: 'markdown',
        sort_order: 2,
        tags: ['VaR', '教程', '风险计量'],
      },
      {
        topic: 'optimization-guide',
        title: '组合优化指南',
        content: `# 组合优化指南

本系统提供多种组合优化方法，帮助您改善投资组合的风险收益特征。

## 优化方法

### 1. 均值-方差优化
基于现代投资组合理论，在给定预期收益率下最小化风险。

### 2. 风险平价
使各资产对组合风险的贡献度相等，实现真正的风险分散。

### 3. 最小方差
仅最小化组合波动率，不考虑预期收益。

### 4. 最大夏普比率
在给定无风险利率下，最大化风险调整后的收益。

### 5. 最大索提诺比率
与夏普比率类似，但只惩罚下行风险。

## 重要提示

优化建议基于历史数据回测，不代表未来收益。请在优化前阅读并同意《风险分散化参考方案同意书》。
`,
        category: 'tutorial',
        format: 'markdown',
        sort_order: 3,
        tags: ['优化', '教程', '组合管理'],
      },
      {
        topic: 'stress-test-guide',
        title: '压力测试指南',
        content: `# 压力测试指南

压力测试用于评估投资组合在极端市场条件下的表现。

## 内置情景

### 1. 2008年金融危机
模拟全球金融危机时期的市场冲击。

### 2. 2020年新冠疫情
模拟新冠疫情引发的市场恐慌和下跌。

### 3. 2015年A股异常波动
模拟A股市场的异常波动情景。

## 自定义情景

您可以自定义市场下跌幅度、行业冲击、个股特殊事件等参数。

## 使用建议

压力测试结果是"假设性"的，不代表预测。建议定期执行压力测试，了解组合在不同情景下的脆弱性。
`,
        category: 'tutorial',
        format: 'markdown',
        sort_order: 4,
        tags: ['压力测试', '教程', '风险管理'],
      },
    ];

    for (const item of defaults) {
      const existing = await helpRepo().findOne({ where: { topic: item.topic } });
      if (!existing) {
        await this.create(item);
        logger.info('Default help content created', { topic: item.topic });
      }
    }
  }
}

export default HelpContentService;
