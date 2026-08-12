import path from 'path';
console.log('__dirname:', __dirname);
console.log('resolved migrations:', path.resolve(__dirname, '../database/migrations/*.ts'));
