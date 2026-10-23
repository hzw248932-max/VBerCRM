import { useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { MoreVertical } from "lucide-react";
import {
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
  useCanAccess,
} from "ra-core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Task as TData } from "../types";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Task = ({
  task,
  showContact,
}: {
  task: TData;
  showContact?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { canAccess: canEdit } = useCanAccess({
    resource: "tasks",
    action: "edit",
    record: task,
  });
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const [openEdit, setOpenEdit] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("resources.tasks.deleted", {
          undoable: true,
        });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => () => {
    if (!canEdit) return;
    update("tasks", {
      id: task.id,
      data: {
        done_date: task.done_date ? null : new Date().toISOString(),
      },
      previousData: task,
    });
  };

  useEffect(() => {
    if (isUpdatePending || !isSuccess) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
    queryClient.invalidateQueries({ queryKey: ["tasks", "getInfiniteList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;

  return (
    <>
      <div className="flex items-start justify-between">
        <div
          className="flex items-start gap-2 flex-1"
          onClick={isMobile ? handleCheck() : undefined}
        >
          <Checkbox
            id={labelId}
            aria-label={task.text}
            onClick={(event) => event.stopPropagation()}
            checked={!!task.done_date}
            onCheckedChange={handleCheck()}
            disabled={isUpdatePending || !canEdit}
            className="mt-1"
          />
          <div className={`flex-grow ${task.done_date ? "line-through" : ""}`}>
            <div className="text-sm whitespace-pre-line">
              {task.type && task.type !== "none" && (
                <>
                  <span className="font-semibold text-sm">
                    {(() => {
                      const matchedTaskType = taskTypes.find(
                        (taskType) => taskType.value === task.type,
                      );
                      return matchedTaskType
                        ? translate(matchedTaskType.label, {
                            _: matchedTaskType.label,
                          })
                        : task.type;
                    })()}
                  </span>
                  &nbsp;
                </>
              )}
              {task.text}
            </div>
            {task.recruitment_id != null && (
              <Link
                className="text-sm underline"
                to={`/recruitment/${task.recruitment_id}`}
                onClick={(event) => event.stopPropagation()}
              >
                查看招聘来源 / 安排下次跟进
              </Link>
            )}
            <div className="text-sm text-muted-foreground">
              {translate(
                task.done_date
                  ? "resources.tasks.completed_on"
                  : "resources.tasks.fields.due_short",
              )}
              &nbsp;
              <DateField
                source={task.done_date ? "done_date" : "due_date"}
                record={task}
                showDate
                showTime
              />
              {showContact && (
                <ReferenceField<TData, Contact>
                  source="contact_id"
                  reference="contacts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        {translate("resources.tasks.regarding_contact", {
                          name: getContactRepresentation(referenceRecord),
                        })}
                      </>
                    );
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 pr-0! size-8 cursor-pointer"
                aria-label={translate("resources.tasks.actions.title")}
              >
                <MoreVertical className="size-5 md:size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={() => {
                  update("tasks", {
                    id: task.id,
                    data: {
                      due_date: addDays(new Date(), 1).toISOString(),
                    },
                    previousData: task,
                  });
                }}
              >
                {translate("resources.tasks.actions.postpone_tomorrow")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={() => {
                  update("tasks", {
                    id: task.id,
                    data: {
                      due_date: addDays(new Date(), 7).toISOString(),
                    },
                    previousData: task,
                  });
                }}
              >
                {translate("resources.tasks.actions.postpone_next_week")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={handleEdit}
              >
                {translate("ra.action.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                onClick={handleDelete}
              >
                {translate("ra.action.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}
    </>
  );
};
