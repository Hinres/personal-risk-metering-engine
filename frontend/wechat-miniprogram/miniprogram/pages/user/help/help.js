const api = require('../../../utils/api');

const FALLBACK_HELP = [
  {
    category: '功能说明',
    title: '功能说明',
    content: 'PRME（个人风险计量引擎）为您提供投资组合管理、VaR 风险价值计算、压力测试、风险监控、组合估值与报告生成等工具。所有计算结果均基于历史市场数据与统计模型，仅供风险参考。'
  },
  {
    category: '使用指南',
    title: '使用指南',
    content: '1. 在“组合”页创建投资组合并添加持仓；\n2. 在“估值”页查看组合实时估值；\n3. 进入“VaR 计算”选择方法与置信度，计算风险价值；\n4. 在“监控”页设置预警规则并接收通知；\n5. 在“报告”页生成并导出风险报告。'
  },
  {
    category: '常见问题',
    title: '常见问题',
    content: 'Q：VaR 是什么？\nA：风险价值（Value at Risk）表示在给定置信水平与持有期内，组合可能面临的最大损失估计。\n\nQ：计算结果是否代表实际亏损？\nA：不代表。VaR 与压力测试均为统计估计，实际市场波动可能超出模型假设。\n\nQ：如何保护数据安全？\nA：您的数据在传输与存储过程中均经过加密，详细隐私政策可在“明示同意”中查看。'
  }
];

Page({
  data: {
    categories: [],
    loading: true,
    error: false
  },

  onLoad() {
    this.loadHelp();
  },

  async loadHelp() {
    this.setData({ loading: true, error: false });
    try {
      const res = await api.get('/system/help');
      const data = res.data || res;
      let categories = [];
      if (Array.isArray(data.items)) {
        categories = this.buildCategories(data.items);
      } else if (Array.isArray(data)) {
        categories = this.buildCategories(data);
      } else {
        categories = this.buildCategories(FALLBACK_HELP);
      }
      this.setData({ categories, loading: false, error: false });
    } catch (e) {
      console.warn('Help fetch failed, using fallback', e);
      this.setData({ categories: this.buildCategories(FALLBACK_HELP), loading: false, error: false });
    }
  },

  buildCategories(list) {
    return list.map(item => ({
      title: item.category || item.title || '帮助',
      content: item.content || item.description || '',
      expanded: false
    }));
  },

  toggleExpand(e) {
    const { index } = e.currentTarget.dataset;
    const categories = this.data.categories.slice();
    categories[index].expanded = !categories[index].expanded;
    this.setData({ categories });
  },

  onRetry() {
    this.loadHelp();
  }
});
