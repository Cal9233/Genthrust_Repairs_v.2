"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getRepairOrderById, type RepairOrder } from "@/app/actions/dashboard";
import {
  getROStatusHistory,
  getROActivityLog,
  getRelatedROs,
  updateRepairOrder,
  type RepairOrderUpdateFields,
  type RelatedRO,
  type StatusHistoryEntry,
  type ActivityLogEntry,
} from "@/app/actions/repair-orders";
import { getDocuments, type SharePointFile } from "@/app/actions/documents";
import { getNotificationsForRO } from "@/app/actions/notifications";
import { useStatsStore } from "@/stores/stats-store";
import { parseDate } from "@/lib/date-utils";
import type { NotificationQueueItem } from "@/lib/schema";

export type DueDateStatus = "overdue" | "due_soon" | "on_track" | "no_date";

export interface RODetailState {
  data: RepairOrder | null;
  loading: boolean;
  error: string | null;
  editMode: boolean;
  editedFields: RepairOrderUpdateFields;
  saving: boolean;
  statusHistory: StatusHistoryEntry[];
  activityLog: ActivityLogEntry[];
  relatedROs: RelatedRO[];
  documents: SharePointFile[];
  emailThreads: NotificationQueueItem[];
  dueDateStatus: DueDateStatus;
}

export interface RODetailActions {
  setEditMode: (mode: boolean) => void;
  updateField: <K extends keyof RepairOrderUpdateFields>(
    field: K,
    value: RepairOrderUpdateFields[K]
  ) => void;
  saveChanges: (overrideFields?: RepairOrderUpdateFields) => Promise<{ success: boolean; error?: string }>;
  cancelEdit: () => void;
  refreshData: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  editedFieldsRef: React.RefObject<RepairOrderUpdateFields>;
}

function calculateDueDateStatus(nextDateToUpdate: string | null | undefined): DueDateStatus {
  if (!nextDateToUpdate) return "no_date";

  const nextDate = parseDate(nextDateToUpdate);
  if (!nextDate) return "no_date";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "due_soon";
  return "on_track";
}

export function useRODetail(
  roId: number | null,
  open: boolean
): RODetailState & RODetailActions {
  // Core data state
  const [data, setData] = useState<RepairOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState<RepairOrderUpdateFields>({});
  const [saving, setSaving] = useState(false);

  // Ref to always have the latest editedFields (fixes stale closure in saveChanges)
  const editedFieldsRef = useRef<RepairOrderUpdateFields>(editedFields);
  useEffect(() => {
    editedFieldsRef.current = editedFields;
  }, [editedFields]);

  // Additional data
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [relatedROs, setRelatedROs] = useState<RelatedRO[]>([]);
  const [documents, setDocuments] = useState<SharePointFile[]>([]);
  const [emailThreads, setEmailThreads] = useState<NotificationQueueItem[]>([]);

  // Calculate due date status
  const dueDateStatus = calculateDueDateStatus(data?.nextDateToUpdate);

  // Fetch core RO data
  const fetchData = useCallback(async () => {
    if (!roId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getRepairOrderById(roId);
      if (result.success) {
        if (result.data) {
          setData(result.data);
        } else {
          setError("Repair order not found");
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [roId]);

  // Fetch all additional data
  const fetchAdditionalData = useCallback(async () => {
    if (!roId || !data) return;

    // Fetch all data in parallel
    const [historyResult, activityResult, relatedResult, emailResult] =
      await Promise.all([
        getROStatusHistory(roId),
        getROActivityLog(roId),
        getRelatedROs(roId),
        getNotificationsForRO(roId),
      ]);

    if (historyResult.success) {
      setStatusHistory(historyResult.data);
    }
    if (activityResult.success) {
      setActivityLog(activityResult.data);
    }
    if (relatedResult.success) {
      setRelatedROs(relatedResult.data);
    }
    if (emailResult.success) {
      setEmailThreads(emailResult.data);
    }

    // Fetch documents separately (requires RO number)
    if (data.ro) {
      const docsResult = await getDocuments(data.ro);
      if (docsResult.success) {
        setDocuments(docsResult.data);
      }
    }
  }, [roId, data]);

  // Refresh documents only
  const refreshDocuments = useCallback(async () => {
    if (!data?.ro) return;
    const docsResult = await getDocuments(data.ro);
    if (docsResult.success) {
      setDocuments(docsResult.data);
    }
  }, [data?.ro]);

  // Full refresh
  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Load data when panel opens
  useEffect(() => {
    if (open && roId) {
      fetchData();
    }
    if (!open) {
      // Reset state when closing
      setData(null);
      setEditMode(false);
      setEditedFields({});
      setError(null);
      setStatusHistory([]);
      setActivityLog([]);
      setRelatedROs([]);
      setDocuments([]);
      setEmailThreads([]);
    }
  }, [open, roId, fetchData]);

  // Fetch additional data once core data is loaded
  useEffect(() => {
    if (data && open) {
      fetchAdditionalData();
    }
  }, [data, open, fetchAdditionalData]);

  // Update a single field in edit mode
  const updateField = useCallback(
    <K extends keyof RepairOrderUpdateFields>(
      field: K,
      value: RepairOrderUpdateFields[K]
    ) => {
      setEditedFields((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  // Cancel edit mode and reset changes
  const cancelEdit = useCallback(() => {
    setEditMode(false);
    setEditedFields({});
  }, []);

  // Save changes - accepts optional override fields to bypass stale closure issues
  const saveChanges = useCallback(async (
    overrideFields?: RepairOrderUpdateFields
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    // Use override if provided, otherwise use ref
    const fieldsToSave = overrideFields ?? editedFieldsRef.current;

    if (!roId || Object.keys(fieldsToSave).length === 0) {
      return { success: true };
    }

    setSaving(true);

    try {
      const result = await updateRepairOrder(roId, fieldsToSave);

      if (result.success) {
        // Refresh data after save to get updated nextDateToUpdate
        await fetchData();
        // Also refresh activity log, email threads, etc.
        await fetchAdditionalData();
        // Refresh stats to reflect any changes (e.g., status, cost, etc.)
        useStatsStore.getState().refreshStats();
        setEditMode(false);
        setEditedFields({});
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save changes",
      };
    } finally {
      setSaving(false);
    }
  }, [roId, fetchData, fetchAdditionalData]);

  return {
    // State
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
    // Actions
    setEditMode,
    updateField,
    saveChanges,
    cancelEdit,
    refreshData,
    refreshDocuments,
    editedFieldsRef,
  };
}
