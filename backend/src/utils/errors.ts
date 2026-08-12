/**
 * [PRME-INFRA-006] 基础设施 - 业务错误定义
 * 文件: errors.ts
 * 需求描述: 区分业务校验错误与系统异常，便于日志分级和统一响应
 * 最后更新: 2026-07-22
 */

/**
 * 业务校验错误
 * 用于用户输入不满足业务规则的场景（如密码策略、用户已存在、凭据无效等）。
 * 上层捕获后可记录为 warn/info，避免与系统错误混在一起。
 */
export class ValidationError extends Error {
  public readonly name = 'ValidationError';

  constructor(message: string) {
    super(message);
    // 修正 TypeScript 中继承 Error 时的 prototype 链
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
