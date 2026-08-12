import { AppDataSource } from '../../src/config/database';
import { HelpContentService } from '../../src/services/helpContent.service';
import { HelpContent } from '../../src/models/HelpContent';

describe('HelpContentService', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterEach(async () => {
    const helpRepo = AppDataSource.getRepository(HelpContent);
    await helpRepo.delete({ topic: 'test-topic' });
    await helpRepo.delete({ topic: 'test-topic-search' });
    await helpRepo.delete({ topic: 'test-topic-dup' });
  });

  it('should create with only required fields and default optional values', async () => {
    const content = await HelpContentService.create({
      topic: 'test-topic-defaults',
      title: '默认字段测试',
      content: '内容',
    });
    expect(content.category).toBe('general');
    expect(content.format).toBe('markdown');
    expect(content.sort_order).toBe(0);
    expect(content.tags).toEqual([]);

    // cleanup
    await AppDataSource.getRepository(HelpContent).delete({ topic: 'test-topic-defaults' });
  });

  it('should update help content', async () => {
    const content = await HelpContentService.create({
      topic: 'test-topic',
      title: '旧标题',
      content: '旧内容',
    });
    const updated = await HelpContentService.update(content.content_id, {
      title: '新标题',
    });
    expect(updated.title).toBe('新标题');
  });

  it('should soft delete help content', async () => {
    const content = await HelpContentService.create({
      topic: 'test-topic',
      title: '删除测试',
      content: '待删除内容',
    });
    await HelpContentService.delete(content.content_id);

    await expect(HelpContentService.getById(content.content_id)).rejects.toThrow('Help content not found');
  });

  it('should list with default pagination', async () => {
    const list = await HelpContentService.getList();
    expect(list).toHaveProperty('items');
    expect(list).toHaveProperty('total');
  });

  it('should list with category only (default pagination)', async () => {
    const list = await HelpContentService.getList('test');
    expect(list).toHaveProperty('items');
  });

  it('should list without category filter', async () => {
    const list = await HelpContentService.getList(undefined, 1, 10);
    expect(list).toHaveProperty('items');
    expect(list).toHaveProperty('total');
  });

  it('should list with category filter', async () => {
    const list = await HelpContentService.getList('test', 1, 10);
    expect(list).toHaveProperty('items');
    expect(list).toHaveProperty('total');
  });

  it('should list with empty category as no filter', async () => {
    const list = await HelpContentService.getList('', 1, 10);
    expect(list).toHaveProperty('items');
  });

  it('should search with default pagination', async () => {
    await HelpContentService.create({
      topic: 'test-topic-search',
      title: '搜索测试',
      content: '搜索内容关键词',
    });
    const result = await HelpContentService.search('搜索');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
  });

  it('should throw when topic not found', async () => {
    await expect(HelpContentService.getByTopic('nonexistent')).rejects.toThrow('Help content not found');
  });

  it('should throw when id not found', async () => {
    await expect(HelpContentService.getById('nonexistent')).rejects.toThrow('Help content not found');
  });

  it('should throw when creating duplicate topic', async () => {
    await HelpContentService.create({
      topic: 'test-topic-dup',
      title: '重复测试',
      content: '内容',
    });
    await expect(HelpContentService.create({
      topic: 'test-topic-dup',
      title: '重复测试2',
      content: '内容2',
    })).rejects.toThrow('Topic already exists');
  });

  it('should throw when updating non-existent content', async () => {
    await expect(HelpContentService.update('nonexistent', { title: '新标题' })).rejects.toThrow('Help content not found');
  });

  it('should throw when deleting non-existent content', async () => {
    await expect(HelpContentService.delete('nonexistent')).rejects.toThrow('Help content not found');
  });

  it('should initialize default help content', async () => {
    await HelpContentService.initializeDefaultHelp();
    const content = await HelpContentService.getByTopic('risk-disclaimer');
    expect(content.title).toBe('投资风险提示');
  });
});
