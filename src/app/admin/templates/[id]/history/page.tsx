import { notFound } from "next/navigation";
import { TemplateHistory } from "../../../../../components/admin/TemplateHistory";

interface Props {
  params: {
    id: string;
  };
}

export default async function TemplateHistoryPage({ params }: Props) {
  if (!params.id) {
    return notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">テンプレート履歴</h1>
      <TemplateHistory templateId={params.id} />
    </div>
  );
} 