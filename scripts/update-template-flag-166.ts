import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // ID=166のエントリを取得して現在の状態を表示
    const entryBefore = await prisma.knowledge.findUnique({
      where: {
        id: 166
      }
    });
    
    console.log("更新前:", { 
      id: entryBefore?.id, 
      main_category: entryBefore?.main_category,
      sub_category: entryBefore?.sub_category,
      is_template: entryBefore?.is_template 
    });
    
    // ID=166のエントリのis_templateフラグをfalseに更新
    const updatedEntry = await prisma.knowledge.update({
      where: {
        id: 166
      },
      data: {
        is_template: false
      }
    });
    
    console.log("更新後:", { 
      id: updatedEntry.id, 
      main_category: updatedEntry.main_category,
      sub_category: updatedEntry.sub_category,
      is_template: updatedEntry.is_template 
    });
    
    console.log("ID=166のテンプレートフラグを正常に更新しました");
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  }); 