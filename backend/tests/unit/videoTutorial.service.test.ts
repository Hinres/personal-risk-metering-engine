/**
 * [PRME-TS-003] videoTutorial.service 单元测试
 * 测试范围: 列表查询、详情查询、watch_count 自增
 * 最后更新: 2026-08-27
 */
import { AppDataSource } from '../../src/config/database';
import { VideoTutorialService } from '../../src/services/videoTutorial.service';
import { VideoTutorial } from '../../src/models/VideoTutorial';

describe('VideoTutorialService', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  beforeEach(async () => {
    const repo = AppDataSource.getRepository(VideoTutorial);
    await repo.clear();
    const seed = repo.create([
      {
        topic: 'intro',
        title: 'PRME 快速入门',
        description: '快速了解 PRME',
        video_url: 'https://example.com/intro.mp4',
        thumbnail_url: 'https://example.com/intro.jpg',
        duration: 120,
        category: '新手',
        tags: JSON.stringify(['新手', '入门']),
        sort_order: 1,
        is_active: true,
      },
      {
        topic: 'risk',
        title: '如何理解 VaR',
        description: 'VaR 概念讲解',
        video_url: 'https://example.com/var.mp4',
        thumbnail_url: 'https://example.com/var.jpg',
        duration: 180,
        category: '风险',
        tags: JSON.stringify(['VaR', '风险']),
        sort_order: 2,
        is_active: true,
      },
    ]);
    await repo.save(seed);
  });

  afterEach(async () => {
    const repo = AppDataSource.getRepository(VideoTutorial);
    await repo.clear();
  });

  it('应按分类筛选视频列表', async () => {
    const result = await VideoTutorialService.getVideos('风险');
    expect(result.total).toBe(1);
    expect(result.list[0].title).toBe('如何理解 VaR');
  });

  it('应按主题筛选视频列表', async () => {
    const result = await VideoTutorialService.getVideos(undefined, 'intro');
    expect(result.total).toBe(1);
    expect(result.list[0].title).toBe('PRME 快速入门');
  });

  it('获取详情时应增加 watch_count', async () => {
    const repo = AppDataSource.getRepository(VideoTutorial);
    const before = await repo.findOne({ where: { topic: 'intro' } });
    const beforeCount = before?.watch_count || 0;

    const video = await VideoTutorialService.getVideoById(before!.video_id);
    expect(video.title).toBe('PRME 快速入门');

    const after = await repo.findOne({ where: { video_id: before!.video_id } });
    expect(after!.watch_count).toBe(beforeCount + 1);
  });

  it('查询不存在视频时应抛出错误', async () => {
    await expect(VideoTutorialService.getVideoById('non-existent')).rejects.toThrow('Video not found');
  });
});
