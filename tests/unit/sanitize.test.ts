/**
 * [PRME-SEC-001] sanitize.ts 单元测试
 * 测试范围: escapeHtml, stripHtmlTags, validateEmail, sanitizeObject, sanitizeUserResponse
 * 最后更新: 2026-07-08
 */
import {
  escapeHtml,
  stripHtmlTags,
  validateEmail,
  sanitizeObject,
  sanitizeUserResponse,
} from '../../src/utils/sanitize';

describe('sanitize', () => {
  describe('escapeHtml', () => {
    it('should escape special HTML characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('should escape ampersand', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should return null for null input', () => {
      expect(escapeHtml(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(escapeHtml(undefined)).toBeNull();
    });

    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should not modify safe string', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('stripHtmlTags', () => {
    it('should remove HTML tags', () => {
      expect(stripHtmlTags('<p>Hello <b>world</b></p>')).toBe('Hello world');
    });

    it('should return null for null input', () => {
      expect(stripHtmlTags(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(stripHtmlTags(undefined)).toBeNull();
    });

    it('should handle string without HTML tags', () => {
      expect(stripHtmlTags('plain text')).toBe('plain text');
    });

    it('should handle nested tags', () => {
      expect(stripHtmlTags('<div><span>text</span></div>')).toBe('text');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email', () => {
      expect(validateEmail('test@example.com')).toEqual({ valid: true });
    });

    it('should reject null email', () => {
      expect(validateEmail(null)).toEqual({ valid: false, error: 'Email is required' });
    });

    it('should reject undefined email', () => {
      expect(validateEmail(undefined)).toEqual({ valid: false, error: 'Email is required' });
    });

    it('should reject empty string', () => {
      expect(validateEmail('')).toEqual({ valid: false, error: 'Email is required' });
    });

    it('should reject email with HTML tags', () => {
      expect(validateEmail('<script>@example.com')).toEqual({
        valid: false,
        error: 'Email contains invalid characters',
      });
    });

    it('should reject invalid email format (no @)', () => {
      expect(validateEmail('invalid-email')).toEqual({
        valid: false,
        error: 'Invalid email format',
      });
    });

    it('should reject invalid email format (no domain)', () => {
      expect(validateEmail('test@')).toEqual({
        valid: false,
        error: 'Invalid email format',
      });
    });

    it('should accept email with plus sign', () => {
      expect(validateEmail('test+tag@example.com')).toEqual({ valid: true });
    });

    it('should accept email with subdomain', () => {
      expect(validateEmail('test@mail.example.com')).toEqual({ valid: true });
    });
  });

  describe('sanitizeObject', () => {
    it('should escape all string fields when no fieldsToEscape specified', () => {
      const obj = { name: '<b>John</b>', age: 30, bio: '<script>alert(1)</script>' };
      const result = sanitizeObject(obj);
      expect(result.name).toBe('&lt;b&gt;John&lt;/b&gt;');
      expect(result.age).toBe(30);
      expect(result.bio).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should only escape specified fields', () => {
      const obj = { name: '<b>John</b>', bio: '<script>alert(1)</script>' };
      const result = sanitizeObject(obj, ['name']);
      expect(result.name).toBe('&lt;b&gt;John&lt;/b&gt;');
      expect(result.bio).toBe('<script>alert(1)</script>');
    });

    it('should handle null object', () => {
      expect(sanitizeObject(null as any)).toBeNull();
    });

    it('should handle non-object input', () => {
      expect(sanitizeObject('string' as any)).toBe('string');
    });

    it('should recursively sanitize nested objects', () => {
      const obj = {
        user: { name: '<b>John</b>', email: 'a@b.com' },
        title: '<h1>Title</h1>',
      };
      const result = sanitizeObject(obj);
      expect(result.user.name).toBe('&lt;b&gt;John&lt;/b&gt;');
      expect(result.user.email).toBe('a@b.com');
      expect(result.title).toBe('&lt;h1&gt;Title&lt;/h1&gt;');
    });

    it('should sanitize items in arrays', () => {
      const obj = {
        items: [
          { name: '<b>Item1</b>' },
          { name: '<script>Item2</script>' },
        ],
      };
      const result = sanitizeObject(obj);
      expect(result.items[0].name).toBe('&lt;b&gt;Item1&lt;/b&gt;');
      expect(result.items[1].name).toBe('&lt;script&gt;Item2&lt;/script&gt;');
    });

    it('should handle array with primitives', () => {
      const obj = { tags: ['html', 'css', 'js'] };
      const result = sanitizeObject(obj);
      expect(result.tags).toEqual(['html', 'css', 'js']);
    });

    it('should handle empty fieldsToEscape array', () => {
      const obj = { name: '<b>John</b>', bio: '<script>alert(1)</script>' };
      const result = sanitizeObject(obj, []);
      expect(result.name).toBe('&lt;b&gt;John&lt;/b&gt;');
      expect(result.bio).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('sanitizeUserResponse', () => {
    it('should escape user string fields', () => {
      const user = {
        username: '<b>admin</b>',
        email: 'test@example.com',
        phone: '<script>123</script>',
        avatar_url: '<img src=x>',
        display_name: '<h1>User</h1>',
      };
      const result = sanitizeUserResponse(user);
      expect(result.username).toBe('&lt;b&gt;admin&lt;/b&gt;');
      expect(result.email).toBe('test@example.com');
      expect(result.phone).toBe('&lt;script&gt;123&lt;/script&gt;');
      expect(result.avatar_url).toBe('&lt;img src=x&gt;');
      expect(result.display_name).toBe('&lt;h1&gt;User&lt;/h1&gt;');
    });

    it('should handle null user', () => {
      expect(sanitizeUserResponse(null)).toBeNull();
    });

    it('should handle user without string fields', () => {
      const user = { id: 1, age: 30 };
      const result = sanitizeUserResponse(user);
      expect(result.id).toBe(1);
      expect(result.age).toBe(30);
    });

    it('should sanitize wechat_info nested object', () => {
      const user = {
        username: 'user',
        wechat_info: {
          nickName: '<b>WeChat</b>',
          avatarUrl: '<img>',
          country: '<script>CN</script>',
          province: '<p>GD</p>',
          city: '<span>SZ</span>',
          language: '<b>zh</b>',
        },
      };
      const result = sanitizeUserResponse(user);
      expect(result.wechat_info.nickName).toBe('&lt;b&gt;WeChat&lt;/b&gt;');
      expect(result.wechat_info.avatarUrl).toBe('&lt;img&gt;');
      expect(result.wechat_info.country).toBe('&lt;script&gt;CN&lt;/script&gt;');
    });

    it('should handle user without wechat_info', () => {
      const user = { username: 'user', email: 'test@test.com' };
      const result = sanitizeUserResponse(user);
      expect(result.username).toBe('user');
      expect(result.wechat_info).toBeUndefined();
    });

    it('should preserve non-string fields in wechat_info', () => {
      const user = {
        username: 'user',
        wechat_info: {
          nickName: 'name',
          gender: 1,
        },
      };
      const result = sanitizeUserResponse(user);
      expect(result.wechat_info.nickName).toBe('name');
      expect(result.wechat_info.gender).toBe(1);
    });
  });
});
