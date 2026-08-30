/**
 * [PRME-v1.3-TS-003] 视频教程与学习资源
 * 文件: videoTutorial.service.ts
 * 需求描述: 视频教程元数据管理
 * 最后更新: 2026-08-20
 */
import { AppDataSource } from '../config/database';
import { VideoTutorial } from '../models/VideoTutorial';

const videoRepo = () => AppDataSource.getRepository(VideoTutorial);

export class VideoTutorialService {
  static async getVideos(category?: string, topic?: string, page = 1, pageSize = 20) {
    const where: any = { is_active: true };
    if (category) where.category = category;
    if (topic) where.topic = topic;

    const [list, total] = await videoRepo().findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { sort_order: 'ASC', created_at: 'DESC' },
    });

    return {
      total,
      page,
      pageSize,
      list: list.map(v => ({
        video_id: v.video_id,
        topic: v.topic,
        title: v.title,
        description: v.description,
        video_url: v.video_url,
        duration: v.duration,
        thumbnail_url: v.thumbnail_url,
        category: v.category,
        tags: v.tags ? JSON.parse(v.tags) : [],
        sort_order: v.sort_order,
      })),
    };
  }

  static async getVideoById(videoId: string) {
    const video = await videoRepo().findOne({ where: { video_id: videoId } });
    if (!video) throw new Error('Video not found');
    if (video.watch_count !== undefined) {
      video.watch_count = (video.watch_count || 0) + 1;
      await videoRepo().save(video);
    }
    return {
      video_id: video.video_id,
      topic: video.topic,
      title: video.title,
      description: video.description,
      video_url: video.video_url,
      duration: video.duration,
      thumbnail_url: video.thumbnail_url,
      category: video.category,
      tags: video.tags ? JSON.parse(video.tags) : [],
    };
  }
}
