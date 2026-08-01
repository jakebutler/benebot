import { notFound } from "next/navigation";

import { BillPageContent } from "@/components/bill/bill-page-content";

export default async function BillPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  if (invoiceId !== "BENEBOT-INV-1001") notFound();

  return <BillPageContent invoiceId={invoiceId} />;
}
