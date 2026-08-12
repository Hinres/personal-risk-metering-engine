/**
 * [PRME-SEC-001] 安全防护工具
 * 文件: sanitize.ts
 * 需求描述: XSS 防护、输入清理、安全响应处理
 * 最后更新: 2026-07-01
 */

/**
 * 将字符串中的 HTML 特殊字符转义为实体编码
 * 用于：API 响应中返回给用户可能包含 HTML 的字段
 */
export function escapeHtml(str: string | null | undefined): string | null {
  if (str === null || str === undefined) return null;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 移除字符串中的 HTML 标签
 * 用于：存储前清理用户输入（保留纯文本）
 */
export function stripHtmlTags(str: string | null | undefined): string | null {
  if (str === null || str === undefined) return null;
  return str.replace(/<[^>]*>/g, '');
}

/**
 * 验证 Email 格式（拒绝包含 HTML 标签的输入）
 */
export function validateEmail(email: string | null | undefined): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  // 拒绝包含 HTML 标签的输入
  if (/<[^>]*>/.test(email)) {
    return { valid: false, error: 'Email contains invalid characters' };
  }
  // 标准 email 格式（RFC 5322 简化版）
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

/**
 * 深度清理对象中的字符串字段（递归）
 * 用于：对返回给客户端的对象进行 HTML 转义
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, fieldsToEscape?: string[]): T {
  if (!obj || typeof obj !== 'object') return obj;

  const result = { ...obj };
  const escapeAll = !fieldsToEscape || fieldsToEscape.length === 0;

  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === 'string' && (escapeAll || fieldsToEscape?.includes(key))) {
      (result as any)[key] = escapeHtml(val);
    } else if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        (result as any)[key] = val.map((item) =>
          typeof item === 'object' && item !== null ? sanitizeObject(item, fieldsToEscape) : item
        );
      } else {
        (result as any)[key] = sanitizeObject(val, fieldsToEscape);
      }
    }
  }

  return result;
}

/**
 * 对返回给客户端的用户对象进行安全清理
 */
export function sanitizeUserResponse(user: any): any {
  if (!user) return user;
  const safe = { ...user };
  const stringFields = ['username', 'email', 'phone', 'avatar_url', 'display_name'];
  for (const field of stringFields) {
    if (typeof safe[field] === 'string') {
      safe[field] = escapeHtml(safe[field]);
    }
  }
  // 递归清理嵌套对象（如 wechat_info）
  if (safe.wechat_info && typeof safe.wechat_info === 'object') {
    const wxFields = ['nickName', 'avatarUrl', 'country', 'province', 'city', 'language'];
    for (const field of wxFields) {
      if (typeof safe.wechat_info[field] === 'string') {
        safe.wechat_info[field] = escapeHtml(safe.wechat_info[field]);
      }
    }
  }
  return safe;
}
