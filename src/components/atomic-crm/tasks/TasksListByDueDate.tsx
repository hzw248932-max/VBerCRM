import { useMemo, useState } from "react";
import {
  type Identifier,
  useGetIdentity,
  useInfiniteGetList,
  useTimeout,
  useTranslate,
} from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import { Button } from "@/components/ui/button";
import { TaskListFilter } from "./TasksListFilter";
import {
  isDone,
  isDueLater,
  isDueThisWeek,
  isDueToday,
  isDueTomorrow,
  isOverdue,
} from "./tasksPredicate";

export const TasksListByDueDate = ({
  filterByContact,
  emptyPlaceholder,
  pendingPlaceholder,
}: {
  filterByContact?: Identifier;
  emptyPlaceholder?: React.ReactNode;
  pendingPlaceholder?: React.ReactNode;
}) => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const translate = useTranslate();

  const [completed, setCompleted] = useState(false);

  const {
    data,
    error,
    refetch,
    isFetching,
    isPending,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteGetList(
    "tasks",
    {
      pagination: { page: 1, perPage: 100 },
      sort: {
        field: completed ? "done_date" : "due_date",
        order: completed ? "DESC" : "ASC",
      },
      filter: {
        [completed ? "done_date@not.is" : "done_date@is"]: null,
        ...(filterByContact != null
          ? { contact_id: filterByContact }
          : { sales_id: identity?.id }),
      },
    },
    { enabled: filterByContact != null ? true : !!identity },
  );

  const tasks = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );
  const total = data?.pages[0]?.total;
  const showContact = filterByContact == null;

  const ongoingTasks = useMemo(
    () =>
      tasks?.filter((task) => (completed ? isDone(task) : !isDone(task))) || [],
    [tasks, completed],
  );

  const overdueTasks = useMemo(
    () =>
      ongoingTasks?.filter((task) => {
        return isOverdue(task.due_date);
      }) || [],
    [ongoingTasks],
  );

  const dueTodayTasks = useMemo(
    () =>
      ongoingTasks?.filter((task) => {
        return isDueToday(task.due_date);
      }) || [],
    [ongoingTasks],
  );

  const dueTomorrowTasks = useMemo(
    () => ongoingTasks?.filter((task) => isDueTomorrow(task.due_date)) || [],
    [ongoingTasks],
  );

  const dueThisWeekTasks = useMemo(
    () => ongoingTasks?.filter((task) => isDueThisWeek(task.due_date)) || [],
    [ongoingTasks],
  );

  const dueLaterTasks = useMemo(
    () => ongoingTasks?.filter((task) => isDueLater(task.due_date)) || [],
    [ongoingTasks],
  );

  const oneSecondHasPassed = useTimeout(1000);

  if (isPending && oneSecondHasPassed) {
    return pendingPlaceholder ?? null;
  }

  if (isPending) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {[false, true].map((value) => (
          <Button
            key={String(value)}
            size="sm"
            variant={completed === value ? "default" : "outline"}
            aria-pressed={completed === value}
            onClick={() => {
              setCompleted(value);
            }}
          >
            {translate(
              `resources.tasks.filters.${value ? "completed" : "pending"}`,
            )}
          </Button>
        ))}
      </div>
      {error ? (
        <div role="alert">
          <p>{translate("resources.tasks.load_error")}</p>
          <Button onClick={() => refetch()}>
            {translate("ra.action.retry")}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {translate("resources.tasks.loaded_count", {
              loaded: ongoingTasks.length,
              total: total ?? ongoingTasks.length,
            })}
          </p>
          {!ongoingTasks.length &&
            (completed ? (
              <p>{translate("resources.tasks.no_completed")}</p>
            ) : (
              emptyPlaceholder
            ))}
          {completed ? (
            <TaskListFilter
              tasks={ongoingTasks}
              title={translate("resources.tasks.filters.completed")}
              showContact={showContact}
              isMobile={isMobile}
            />
          ) : (
            <>
              <TaskListFilter
                tasks={overdueTasks}
                title={translate("resources.tasks.filters.overdue")}
                showContact={showContact}
                isMobile={isMobile}
              />
              <TaskListFilter
                tasks={dueTodayTasks}
                title={translate("resources.tasks.filters.today")}
                showContact={showContact}
                isMobile={isMobile}
              />
              <TaskListFilter
                tasks={dueTomorrowTasks}
                title={translate("resources.tasks.filters.tomorrow")}
                showContact={showContact}
                isMobile={isMobile}
              />
              {
                <TaskListFilter
                  tasks={dueThisWeekTasks}
                  title={translate("resources.tasks.filters.this_week")}
                  showContact={showContact}
                  isMobile={isMobile}
                />
              }
              <TaskListFilter
                tasks={dueLaterTasks}
                title={translate("resources.tasks.filters.later")}
                showContact={showContact}
                isMobile={isMobile}
              />
            </>
          )}
          {hasNextPage && (
            <Button
              variant="outline"
              disabled={isFetching}
              onClick={() => fetchNextPage()}
            >
              {translate("crm.common.load_more")}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
