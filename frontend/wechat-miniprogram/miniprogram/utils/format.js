const formatCurrency = (value, currency = 'CNY') => {
  if (value === null || value === undefined || value === '') return '--';
  return `${currency === 'CNY' ? '¥' : '$'}${parseFloat(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '--';
  return `${(parseFloat(value) * 100).toFixed(2)}%`;
};

const formatDate = (date) => {
  if (!date) return '--';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getRiskColor = (level) => {
  const colors = { low: '#27ae60', medium: '#f39c12', high: '#e74c3c', critical: '#c0392b' };
  return colors[level] || '#7f8c8d';
};

module.exports = { formatCurrency, formatPercent, formatDate, getRiskColor };
