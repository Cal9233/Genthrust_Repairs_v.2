"use client";

import { useRODetail } from "./useRODetail";
import { RODetailHeader } from "./RODetailHeader";
import { ROInfoGrid } from "./ROInfoGrid";
import { ROStatusFlowchart } from "./ROStatusFlowchart";
import { ROStatusTimeline } from "./ROStatusTimeline";
import { ROActivityLog } from "./ROActivityLog";
import { RODocuments } from "./RODocuments";
import { RONotes } from "./RONotes";
import { RORelatedOrders } from "./RORelatedOrders";
import { RODueDateAlert } from "./RODueDateAlert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { AlertCircle, FileText, History, Mail, Activity } from "lucide-react";

interface RODetailPanelProps {
  roId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataChanged?: () => void;
}

export function RODetailPanel({
  roId,
  open,
  onOpenChange,
  onDataChanged,
}: RODetailPanelProps) {
  const {
    data,
    loading,
    error,
    editMode,
    editedFields,
    saving,
    statusHistory,
    activityLog,
    relatedROs,
    documents,
    emailThreads,
    dueDateStatus,
    setEditMode,
    updateField,
    saveChanges,
    cancelEdit,
    refreshData,
    refreshDocuments,
  } = useRODetail(roId, open);

  const handleSave = async () => {
    const result = await saveChanges();
    if (result.success) {
      onDataChanged?.();
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    updateField("curentStatus", newStatus);
    // Auto-save status changes
    const result = await saveChanges();
    if (result.success) {
      onDataChanged?.();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto bg-background p-6"
      >
        {/* Always render header for accessibility */}
        <SheetHeader className="pb-4 border-b border-border mb-4">
          <SheetTitle className="text-xl font-bold">
            {data ? `RO# G${data.ro}` : "Repair Order Details"}
          </SheetTitle>
          <SheetDescription>
            {data
              ? `${data.shopName} - ${data.partDescription || data.part}`
              : "Loading repair order information..."}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <TurbineSpinner size="lg" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <AlertCircle className="h-12 w-12 text-danger" />
            <p className="text-danger">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>

            {/* Due Date Alert Banner */}
            {dueDateStatus !== "on_track" && dueDateStatus !== "no_date" && (
              <RODueDateAlert
                status={dueDateStatus}
                nextDateToUpdate={data.nextDateToUpdate}
              />
            )}

            {/* Header with Status and Edit Mode */}
            <RODetailHeader
              data={data}
              editMode={editMode}
              saving={saving}
              editedFields={editedFields}
              onEditModeChange={setEditMode}
              onSave={handleSave}
              onCancel={cancelEdit}
              onStatusChange={handleStatusChange}
            />

            {/* Tabbed Content */}
            <Tabs defaultValue="details" className="mt-6">
              <TabsList className="grid w-full grid-cols-5 bg-muted">
                <TabsTrigger
                  value="details"
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Details</span>
                </TabsTrigger>
                <TabsTrigger
                  value="status"
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Status</span>
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Docs</span>
                  {documents.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                      {documents.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="emails"
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Emails</span>
                  {emailThreads.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                      {emailThreads.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Activity</span>
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="mt-4 space-y-6">
                <ROInfoGrid
                  data={data}
                  editMode={editMode}
                  editedFields={editedFields}
                  onUpdateField={updateField}
                />
                <RONotes
                  repairOrderId={data.id}
                  notes={data.notes}
                  onNoteAdded={refreshData}
                />
                <RORelatedOrders
                  repairOrderId={data.id}
                  relatedROs={relatedROs}
                  onRelationChanged={refreshData}
                />
              </TabsContent>

              {/* Status Tab */}
              <TabsContent value="status" className="mt-4 space-y-6">
                <ROStatusFlowchart currentStatus={data.curentStatus} />
                <ROStatusTimeline history={statusHistory} />
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="mt-4">
                <RODocuments
                  repairOrderId={data.id}
                  roNumber={data.ro}
                  documents={documents}
                  onDocumentsChanged={refreshDocuments}
                />
              </TabsContent>

              {/* Emails Tab */}
              <TabsContent value="emails" className="mt-4">
                <div className="text-center text-muted-foreground py-8">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Email history coming soon</p>
                  <p className="text-sm mt-2">
                    {emailThreads.length} email(s) in queue
                  </p>
                </div>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="mt-4">
                <ROActivityLog activities={activityLog} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
