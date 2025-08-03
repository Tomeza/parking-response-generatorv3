import { prisma } from '../src/lib/db';
import { TemplateRouter } from '../src/lib/template-router';
import { QueryAnalyzer } from '../src/lib/query-analyzer';

async function testRouterStatusFilter() {
  console.log('🧪 ルーターのstatusフィルタテストを開始...');
  
  try {
    // 1. 承認済みテンプレートの確認
    const approvedTemplates = await prisma.templates.findMany({
      where: {
        status: 'approved'
      },
      select: {
        id: true,
        title: true,
        category: true,
        intent: true,
        tone: true,
        status: true
      },
      take: 5
    });
    
    console.log('📊 承認済みテンプレート（サンプル）:');
    console.table(approvedTemplates);
    
    // 2. ルーターのテスト
    const router = new TemplateRouter();
    const analyzer = new QueryAnalyzer();
    
    // テストクエリ
    const testQueries = [
      '駐車場の予約を変更したいのですが',
      '精算時に必要なものはありますか？',
      '送迎サービスの時間を教えてください'
    ];
    
    for (const query of testQueries) {
      console.log(`\n🔍 テストクエリ: "${query}"`);
      
      try {
        const analysis = await analyzer.analyze(query);
        console.log('📊 解析結果:', {
          category: analysis.category,
          intent: analysis.intent,
          tone: analysis.tone,
          confidence: analysis.confidence
        });
        
        const result = await router.route(analysis);
        console.log('📊 ルーティング結果:', {
          templateFound: !!result.template,
          templateTitle: result.template?.title || 'なし',
          confidence: result.confidence,
          fallbackUsed: result.fallbackUsed,
          reasoning: result.reasoning
        });
        
        // 選択されたテンプレートのstatus確認
        if (result.template) {
          const selectedTemplate = await prisma.templates.findUnique({
            where: { id: result.template.id },
            select: { status: true }
          });
          console.log('✅ 選択テンプレートのstatus:', selectedTemplate?.status);
        }
        
      } catch (error) {
        console.error('❌ ルーティングエラー:', error);
      }
    }
    
    console.log('\n✅ ルーターのstatusフィルタテスト完了');
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

testRouterStatusFilter()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 