import { useListContext } from "ra-core";

import { Task } from "./Task";

export const TasksIterator = ({
  showContact,
  className,
}: {
  showContact?: boolean;
  className?: string;
}) => {
  const { data, error, isPending } = useListContext();
  if (isPending || error || data.length === 0) return null;

  return (
    <div className={`space-y-4 md:space-y-2 ${className || ""}`}>
      {data.map((task) => (
        <Task task={task} showContact={showContact} key={task.id} />
      ))}
    </div>
  );
};
