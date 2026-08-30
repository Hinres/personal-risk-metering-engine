import * as fs from 'fs';

const dumpPath = '/tmp/prme-schema-ordered.sql';
const outputPath = '/workspace/projects/personal-risk-metering-engine/backend/src/database/migrations/001-initial-schema.ts';

const dump = fs.readFileSync(dumpPath, 'utf-8');

const tables: Array<{ name: string; sql: string }> = [];
const indexes: Array<{ name: string; sql: string }> = [];

const tableRegex = /^-- ([a-zA-Z0-9_]+)\n(CREATE TABLE [\s\S]+?);$/gm;
const indexRegex = /^(CREATE INDEX [\s\S]+?);$/gm;

let m: RegExpExecArray | null;
while ((m = tableRegex.exec(dump)) !== null) {
  tables.push({ name: m[1], sql: m[2] });
}

while ((m = indexRegex.exec(dump)) !== null) {
  indexes.push({ name: m[1].match(/"IDX_[a-zA-Z0-9_]+"/g)?.[0]?.replace(/"/g, '') || '', sql: m[1] });
}

// Filter out sqlite_sequence from down list
const tableNames = tables.map(t => t.name).filter(n => n !== 'sqlite_sequence');

function adaptSql(sql: string, dbType: 'sqlite' | 'postgres'): string {
  if (dbType === 'sqlite') {
    return sql.replace(/DEFAULT \(datetime\('now'\)\)/g, 'DEFAULT CURRENT_TIMESTAMP');
  }

  // PostgreSQL adaptations
  return sql
    .replace(/DEFAULT \(datetime\('now'\)\)/g, 'DEFAULT CURRENT_TIMESTAMP')
    // 仅 boolean 列的默认值 (0)/(1) 替换为 false/true；整数/decimal 列保持 0/1
    .replace(/"([^"]+)" boolean NOT NULL DEFAULT \(0\)/g, '"$1" boolean NOT NULL DEFAULT false')
    .replace(/"([^"]+)" boolean NOT NULL DEFAULT \(1\)/g, '"$1" boolean NOT NULL DEFAULT true')
    .replace(/"([^"]+)" boolean DEFAULT \(0\)/g, '"$1" boolean DEFAULT false')
    .replace(/"([^"]+)" boolean DEFAULT \(1\)/g, '"$1" boolean DEFAULT true')
    .replace(/integer PRIMARY KEY AUTOINCREMENT NOT NULL/g, 'SERIAL PRIMARY KEY NOT NULL');
}

const tableCases = tables
  .filter(t => t.name !== 'sqlite_sequence')
  .map(t => {
    const sqliteSql = adaptSql(t.sql, 'sqlite').replace(/"/g, '"');
    const pgSql = adaptSql(t.sql, 'postgres').replace(/"/g, '"');
    return `
      case '${t.name}':
        sqliteSql = \`${sqliteSql}\`;
        pgSql = \`${pgSql}\`;
        break;`;
  })
  .join('');

const indexSqls = indexes
  .filter(i => i.name && !i.name.startsWith('sqlite_'))
  .map(i => `      \`${i.sql.replace(/"/g, '"')}\``)
  .join(',\n');

const migrationTs = `/**
 * [PRME-INFRA-006] 基础设施
 * 文件: 001-initial-schema.ts
 * 需求描述: PRME v1.3 完整初始 schema 迁移（SQLite / PostgreSQL）
 * 最后更新: 2026-08-23
 * 
 * 本迁移根据当前 TypeORM 实体模型生成，确保全新数据库在 synchronize=false 下
 * 也能正确启动，避免开发/测试环境因 synchronize=true 掩盖的 schema 漂移问题。
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import { getDbType } from '../../utils/dbTypes';

export class InitialSchema1718000000001 implements MigrationInterface {
  name = 'InitialSchema1718000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = getDbType();
    const isPostgres = dbType === 'postgres';

    if (!isPostgres) {
      // SQLite：关闭外键检查，允许按 TypeORM 生成顺序创建带外键约束的表
      await queryRunner.query('PRAGMA foreign_keys = OFF');
    }

    const tableDefinitions: Record<string, { sqlite: string; pg: string }> = {};

    const addTable = (name: string, sqlite: string, pg: string) => {
      tableDefinitions[name] = { sqlite, pg };
    };

${tables
  .filter(t => t.name !== 'sqlite_sequence')
  .map(t => {
    const sqliteSql = adaptSql(t.sql, 'sqlite');
    const pgSql = adaptSql(t.sql, 'postgres');
    return `    addTable('${t.name}',\n      \`${sqliteSql}\`,\n      \`${pgSql}\`);`;
  })
  .join('\n\n')}

    for (const { sqlite, pg } of Object.values(tableDefinitions)) {
      await queryRunner.query(isPostgres ? pg : sqlite);
    }

    // 创建索引
    const indexStatements = [
${indexes
  .filter(i => i.name && !i.name.startsWith('sqlite_'))
  .map(i => `      \`${i.sql}\``)
  .join(',\n')}
    ];
    for (const stmt of indexStatements) {
      await queryRunner.query(stmt);
    }

    if (!isPostgres) {
      await queryRunner.query('PRAGMA foreign_keys = ON');
    }

    console.log('InitialSchema1718000000001 migration completed successfully');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = getDbType() === 'postgres';
    if (!isPostgres) {
      await queryRunner.query('PRAGMA foreign_keys = OFF');
    }

    // 按创建顺序反向删除表
    const tablesToDrop = [
${tableNames
  .slice()
  .reverse()
  .map(n => `      '${n}',`)
  .join('\n')}
    ];

    for (const table of tablesToDrop) {
      try {
        await queryRunner.query(\`DROP TABLE IF EXISTS "\${table}"\`);
      } catch (e: any) {
        console.warn(\`Failed to drop table \${table}: \${e.message}\`);
      }
    }

    if (!isPostgres) {
      await queryRunner.query('PRAGMA foreign_keys = ON');
    }

    console.log('InitialSchema1718000000001 rollback completed');
  }
}
`;

fs.writeFileSync(outputPath, migrationTs);
console.log(`Generated ${outputPath}`);
console.log(`Tables: ${tables.length}, Indexes: ${indexes.length}`);
