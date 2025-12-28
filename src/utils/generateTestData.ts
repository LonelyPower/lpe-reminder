import { addTimerRecord } from "./database";

/**
 * 生成测试数据 - 创建不同日期、月份、分类的工作记录
 */
export async function generateTestData() {
  const now = Date.now();
  
  const records = [
    // 今天的记录 (5条)
    {
      date: new Date(),
      category: "work",
      durationMinutes: 45,
      name: "代码开发"
    },
    {
      date: new Date(now - 1 * 60 * 60 * 1000),
      category: "study",
      durationMinutes: 30,
      name: "学习新技术"
    },
    {
      date: new Date(now - 2 * 60 * 60 * 1000),
      category: "meeting",
      durationMinutes: 60,
      name: "团队会议"
    },
    {
      date: new Date(now - 4 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 90,
      name: "项目开发"
    },
    {
      date: new Date(now - 5 * 60 * 60 * 1000),
      category: "entertainment",
      durationMinutes: 25,
      name: "休闲娱乐"
    },
    
    // 昨天的记录 (4条)
    {
      date: new Date(now - 1 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 120,
      name: "Bug修复"
    },
    {
      date: new Date(now - 1 * 24 * 60 * 60 * 1000),
      category: "reading",
      durationMinutes: 40,
      name: "技术文档阅读"
    },
    {
      date: new Date(now - 1 * 24 * 60 * 60 * 1000),
      category: "study",
      durationMinutes: 50,
      name: "算法练习"
    },
    {
      date: new Date(now - 1 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 75,
      name: "需求分析"
    },
    
    // 3天前 (3条)
    {
      date: new Date(now - 3 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 100,
      name: "功能开发"
    },
    {
      date: new Date(now - 3 * 24 * 60 * 60 * 1000),
      category: "exercise",
      durationMinutes: 35,
      name: "健身运动"
    },
    {
      date: new Date(now - 3 * 24 * 60 * 60 * 1000),
      category: "entertainment",
      durationMinutes: 45,
      name: "看电影"
    },
    
    // 本周其他日期 (5条)
    {
      date: new Date(now - 5 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 85,
      name: "代码审查"
    },
    {
      date: new Date(now - 5 * 24 * 60 * 60 * 1000),
      category: "meeting",
      durationMinutes: 45,
      name: "需求评审"
    },
    {
      date: new Date(now - 6 * 24 * 60 * 60 * 1000),
      category: "study",
      durationMinutes: 60,
      name: "在线课程"
    },
    {
      date: new Date(now - 6 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 110,
      name: "功能测试"
    },
    {
      date: new Date(now - 7 * 24 * 60 * 60 * 1000),
      category: "reading",
      durationMinutes: 30,
      name: "技术博客"
    },
    
    // 上周 (4条)
    {
      date: new Date(now - 10 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 95,
      name: "架构设计"
    },
    {
      date: new Date(now - 12 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 80,
      name: "性能优化"
    },
    {
      date: new Date(now - 13 * 24 * 60 * 60 * 1000),
      category: "entertainment",
      durationMinutes: 50,
      name: "游戏时间"
    },
    {
      date: new Date(now - 14 * 24 * 60 * 60 * 1000),
      category: "exercise",
      durationMinutes: 40,
      name: "跑步"
    },
    
    // 本月其他时间 (6条)
    {
      date: new Date(now - 18 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 120,
      name: "项目重构"
    },
    {
      date: new Date(now - 20 * 24 * 60 * 60 * 1000),
      category: "study",
      durationMinutes: 70,
      name: "框架学习"
    },
    {
      date: new Date(now - 22 * 24 * 60 * 60 * 1000),
      category: "meeting",
      durationMinutes: 55,
      name: "技术分享"
    },
    {
      date: new Date(now - 25 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 90,
      name: "数据库优化"
    },
    {
      date: new Date(now - 27 * 24 * 60 * 60 * 1000),
      category: "reading",
      durationMinutes: 45,
      name: "技术书籍"
    },
    {
      date: new Date(now - 28 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 100,
      name: "API开发"
    },
    
    // 上个月 (8条)
    {
      date: new Date(now - 35 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 110,
      name: "前端开发"
    },
    {
      date: new Date(now - 38 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 85,
      name: "后端接口"
    },
    {
      date: new Date(now - 40 * 24 * 60 * 60 * 1000),
      category: "study",
      durationMinutes: 65,
      name: "设计模式"
    },
    {
      date: new Date(now - 42 * 24 * 60 * 60 * 1000),
      category: "entertainment",
      durationMinutes: 35,
      name: "音乐欣赏"
    },
    {
      date: new Date(now - 45 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 95,
      name: "单元测试"
    },
    {
      date: new Date(now - 48 * 24 * 60 * 60 * 1000),
      category: "exercise",
      durationMinutes: 50,
      name: "瑜伽"
    },
    {
      date: new Date(now - 50 * 24 * 60 * 60 * 1000),
      category: "meeting",
      durationMinutes: 70,
      name: "产品讨论"
    },
    {
      date: new Date(now - 52 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 105,
      name: "集成测试"
    },
    
    // 更早的记录 (6条 - 2-3个月前)
    {
      date: new Date(now - 65 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 90,
      name: "项目启动"
    },
    {
      date: new Date(now - 70 * 24 * 60 * 60 * 1000),
      category: "study",
      durationMinutes: 55,
      name: "新语言学习"
    },
    {
      date: new Date(now - 75 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 100,
      name: "技术调研"
    },
    {
      date: new Date(now - 80 * 24 * 60 * 60 * 1000),
      category: "reading",
      durationMinutes: 40,
      name: "论文阅读"
    },
    {
      date: new Date(now - 85 * 24 * 60 * 60 * 1000),
      category: "work",
      durationMinutes: 115,
      name: "原型开发"
    },
    {
      date: new Date(now - 90 * 24 * 60 * 60 * 1000),
      category: "entertainment",
      durationMinutes: 60,
      name: "周末放松"
    },
  ];
  
  console.log(`开始生成 ${records.length} 条测试记录...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const record of records) {
    try {
      const endTime = record.date.getTime();
      const duration = record.durationMinutes * 60 * 1000;
      const startTime = endTime - duration;
      
      await addTimerRecord({
        id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        record_type: "countdown",
        mode: "work",
        name: record.name,
        category: record.category,
        start_time: startTime,
        end_time: endTime,
        duration: duration,
        created_at: endTime,
      });
      
      successCount++;
      console.log(`✓ 已添加: ${record.date.toLocaleDateString()} - ${record.name} (${record.category}, ${record.durationMinutes}分钟)`);
    } catch (error) {
      failCount++;
      console.error(`✗ 添加失败: ${record.name}`, error);
    }
  }
  
  console.log(`\n测试数据生成完成！`);
  console.log(`成功: ${successCount} 条`);
  console.log(`失败: ${failCount} 条`);
  console.log(`\n数据分布:`);
  console.log(`- 今天: 5 条`);
  console.log(`- 本周: 17 条`);
  console.log(`- 本月: 23 条`);
  console.log(`- 上月: 31 条`);
  console.log(`- 更早: 37 条`);
  console.log(`\n分类分布:`);
  const categoryCount = records.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(categoryCount).forEach(([cat, count]) => {
    console.log(`- ${cat}: ${count} 条`);
  });
}
