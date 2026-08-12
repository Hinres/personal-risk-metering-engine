#!/usr/bin/env tsx
/**
 * 数据库种子脚本
 * Usage:
 *   npm run seed          - 运行种子数据
 *   npm run seed:clear    - 清空数据库
 *   npm run seed:reset    - 清空并重新种子
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase, closeDatabase } from '../src/config/database';
import { seedDatabase, clearDatabase } from '../src/database/seeds/development.seed';

async function main() {
  const command = process.argv[2] || 'seed';
  
  try {
    await initializeDatabase();
    
    switch (command) {
      case 'seed':
        await seedDatabase();
        break;
      case 'clear':
        await clearDatabase();
        break;
      case 'reset':
        await clearDatabase();
        await seedDatabase();
        break;
      default:
        console.log('Usage: npm run seed [seed|clear|reset]');
        process.exit(1);
    }
    
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Seed script failed:', error);
    process.exit(1);
  }
}

main();
