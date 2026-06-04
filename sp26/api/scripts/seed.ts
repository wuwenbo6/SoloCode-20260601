import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

import User from '../models/User.js';
import Asset from '../models/Asset.js';

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nfc-asset-manager';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    await User.deleteMany({});
    await Asset.deleteMany({});
    console.log('Cleared existing data');

    const passwordHash = await bcrypt.hash('admin123456', 10);
    const inventoryPasswordHash = await bcrypt.hash('inventory123', 10);

    const users = await User.insertMany([
      {
        name: '系统管理员',
        email: 'admin@example.com',
        passwordHash,
        role: 'admin',
      },
      {
        name: '盘点员张三',
        email: 'inventory@example.com',
        passwordHash: inventoryPasswordHash,
        role: 'inventory',
      },
    ]);
    console.log(`Created ${users.length} users`);

    const assets = await Asset.insertMany([
      {
        uid: 'E280689000004000B3F95B51',
        name: 'MacBook Pro 16寸',
        category: 'IT设备',
        location: '研发部-A区-12号工位',
        status: 'in_use',
        description: '开发用笔记本电脑，M3 Max芯片，64GB内存',
        purchaseDate: new Date('2024-01-15'),
        purchasePrice: 19999,
        lastInventoryAt: new Date('2026-05-20'),
      },
      {
        uid: 'E280689000004000B3F95B52',
        name: '办公椅',
        category: '办公家具',
        location: '市场部-B区-5号工位',
        status: 'in_use',
        purchaseDate: new Date('2023-06-20'),
        purchasePrice: 899,
        lastInventoryAt: new Date('2026-05-15'),
      },
      {
        uid: 'E280689000004000B3F95B53',
        name: '投影仪',
        category: '会议设备',
        location: '3楼-大会议室',
        status: 'idle',
        description: '4K激光投影仪，支持无线投屏',
        purchaseDate: new Date('2024-03-10'),
        purchasePrice: 12800,
        lastInventoryAt: new Date('2026-05-10'),
      },
      {
        uid: 'E280689000004000B3F95B54',
        name: 'Dell 27寸显示器',
        category: 'IT设备',
        location: '研发部-A区-12号工位',
        status: 'in_use',
        description: '4K IPS显示器',
        purchaseDate: new Date('2024-02-01'),
        purchasePrice: 3299,
        lastInventoryAt: new Date('2026-05-20'),
      },
      {
        uid: 'E280689000004000B3F95B55',
        name: '打印机',
        category: '办公设备',
        location: '行政部-打印区',
        status: 'maintenance',
        description: '彩色激光打印机，需更换硒鼓',
        purchaseDate: new Date('2023-11-15'),
        purchasePrice: 5899,
        lastInventoryAt: new Date('2026-04-28'),
      },
      {
        uid: 'E280689000004000B3F95B56',
        name: '办公桌',
        category: '办公家具',
        location: '研发部-A区-13号工位',
        status: 'idle',
        purchaseDate: new Date('2023-03-10'),
        purchasePrice: 1299,
        lastInventoryAt: new Date('2026-05-05'),
      },
      {
        uid: 'E280689000004000B3F95B57',
        name: 'iPhone 15 Pro',
        category: 'IT设备',
        location: '销售部-张经理',
        status: 'in_use',
        description: '256GB，钛金属',
        purchaseDate: new Date('2024-09-20'),
        purchasePrice: 8999,
        lastInventoryAt: new Date('2026-05-25'),
      },
      {
        uid: 'E280689000004000B3F95B58',
        name: '碎纸机',
        category: '办公设备',
        location: '财务部-办公区',
        status: 'scrapped',
        description: '已损坏无法修复',
        purchaseDate: new Date('2022-05-10'),
        purchasePrice: 1599,
        lastInventoryAt: new Date('2026-03-15'),
      },
      {
        uid: 'E280689000004000B3F95B59',
        name: '空气净化器',
        category: '办公设备',
        location: '研发部-A区',
        status: 'in_use',
        purchaseDate: new Date('2024-11-01'),
        purchasePrice: 2499,
        lastInventoryAt: new Date('2026-05-28'),
      },
      {
        uid: 'E280689000004000B3F95B60',
        name: '机械键盘',
        category: 'IT设备',
        location: '研发部-A区-12号工位',
        status: 'in_use',
        description: 'HHKB Professional HYBRID Type-S',
        purchaseDate: new Date('2024-06-15'),
        purchasePrice: 2299,
        lastInventoryAt: new Date('2026-05-20'),
      },
    ]);
    console.log(`Created ${assets.length} assets`);

    console.log('\n=== Seed Data Complete ===');
    console.log('\nTest Accounts:');
    console.log('Admin: admin@example.com / admin123456');
    console.log('Inventory: inventory@example.com / inventory123');
    console.log('\nSample NFC UIDs:');
    assets.slice(0, 5).forEach(asset => {
      console.log(`  ${asset.uid} - ${asset.name}`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
