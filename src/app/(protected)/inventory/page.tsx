import { InventorySearch } from "@/components/inventory/InventorySearch";

export default function InventoryPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Inventory Search</h1>
      <InventorySearch />
    </div>
  );
}
